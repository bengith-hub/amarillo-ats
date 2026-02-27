// Amarillo ATS — Signal Engine: Scheduled Scan Function
// Runs daily at 6:00 AM to scan watchlist companies for signals.
// Processes a batch of 5 companies per execution (cursor-based).

import { getStore } from "@netlify/blobs";

const ALLORIGINS_PROXY = 'https://api.allorigins.win/get?url=';

async function fetchPageText(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const proxyUrl = ALLORIGINS_PROXY + encodeURIComponent(url);
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return '';
    const data = await response.json();
    const html = data.contents || '';
    if (!html) return '';
    // Simple HTML→text in Node (no DOMParser)
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 3000 ? text.substring(0, 3000) : text;
  } catch {
    return '';
  }
}

async function scrapeGoogleNews(name, region) {
  try {
    const query = encodeURIComponent(`"${name}" investissement OR industrie ${region || ''}`);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=fr&gl=FR&ceid=FR:fr`;
    const proxyUrl = ALLORIGINS_PROXY + encodeURIComponent(rssUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return [];
    const data = await response.json();
    const xml = data.contents || '';
    // Simple XML extraction
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) && items.length < 5) {
      const content = match[1];
      const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      items.push({
        titre: title.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim(),
        url: link.trim(),
        date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : '',
        extrait: ''
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 3000,
  });

  let response;
  for (let attempt = 0; attempt <= 2; attempt++) {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body,
    });
    if (response.status !== 429 || attempt === 2) break;
    await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
  }

  if (!response.ok) throw new Error('OpenAI error: ' + response.status);
  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

const SIGNAL_DETECTION_PROMPT = `Tu es un analyste business specialise dans la detection de signaux d'affaires revelateurs d'opportunites commerciales et de besoins potentiels en systemes d'information (DSI) pour tout type d'entreprise.

Analyse TOUTES les donnees fournies (site web, articles de presse) et detecte le maximum de signaux pertinents parmi :
- investissement : Investissement significatif, levee de fonds, nouveau projet, demenagement, nouveaux locaux, construction de nouveaux batiments, nouveaux entrepots, agrandissement de site, modernisation d'equipements, travaux d'extension, nouvelle usine, nouvelle ligne de production
- expansion : Extension multi-sites, ouverture de filiales, nouveaux bureaux, croissance geographique, ouverture de nouveaux sites
- erp_mes : Projet ERP, SAP, MES, CRM, transformation digitale, migration SI, cybersecurite, cloud
- croissance : Croissance du CA, augmentation des effectifs, nouveaux clients, nouveaux contrats importants, diversification d'activite, hausse de volume
- rachat_lbo : Rachat, acquisition, LBO, fusion, cession, changement d'actionnariat
- internationalisation : Expansion internationale, export, nouveaux marches etrangers
- recrutement_it : Recrutement IT, DSI, CTO, developpeurs, postes tech ouverts
- nomination : Nomination d'un nouveau PDG, DG, DAF, DSI, directeur, changement de gouvernance, nouvelle equipe de direction

REGLES :
- Sois EXHAUSTIF : detecte tout signal meme faible ou indirect.
- Un article mentionnant des TRAVAUX, CONSTRUCTION, AGRANDISSEMENT, MODERNISATION ou NOUVEAU SITE est TOUJOURS un signal "investissement".
- En cas de doute, INCLUS le signal avec une confiance basse (0.3-0.5) plutot que de l'ignorer.
- Les articles de presse peuvent utiliser des variantes du nom de l'entreprise : acronyme, nom commercial, nom abrege, nom du groupe parent. Considere qu'un article parle de l'entreprise si le nom, l'acronyme, ou une partie significative du nom apparait dans le contexte du bon secteur.
- IGNORE les articles qui parlent clairement d'un lieu ou d'une entite sans rapport, mais ne rejette PAS un article simplement parce qu'il utilise un nom abrege ou acronyme.

Reponds en JSON: {"signaux":[{"type":"...","label":"...","confiance":0.8,"extrait":"..."}],"score_besoin_dsi":75,"score_urgence":60,"score_complexite_si":70,"justification":"..."}
Si rien: {"signaux":[],"score_besoin_dsi":10,"score_urgence":5,"score_complexite_si":5,"justification":"Aucun signal."}`;

// Generate acronym from company name (e.g. "SOCIETE INDUSTRIELLE RAISON FRERES" → "SIRF")
const STOP_WORDS_RE = /^(de|des|du|la|le|les|et|en|a|au|aux|l|d|sa|sas|sarl|srl|eurl|sci)$/i;
function makeAcronym(name) {
  if (!name) return '';
  const words = name.split(/[\s'-]+/).filter(w => w.length > 1 && !STOP_WORDS_RE.test(w));
  if (words.length < 2) return '';
  const acr = words.map(w => w[0].toUpperCase()).join('');
  return acr.length >= 2 && acr.length <= 6 ? acr : '';
}

export default async function handler(req) {
  const BATCH_SIZE = 5;
  const now = new Date().toISOString().split('T')[0];

  try {
    const store = getStore("ats-data");

    // Load config, watchlist, existing signals
    const config = await store.get("signal_config", { type: "json" }) || {
      regions_actives: [],
      scan_cursor: 0,
      score_seuil_alerte: 70,
    };

    const watchlist = await store.get("watchlist", { type: "json" }) || [];
    const signaux = await store.get("signaux", { type: "json" }) || [];

    if (!watchlist.length) {
      return new Response(JSON.stringify({ message: 'Watchlist empty, nothing to scan' }));
    }

    // Get OpenAI key from environment
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), { status: 500 });
    }

    // Filter by active regions
    const activeRegions = config.regions_actives || [];
    const eligible = activeRegions.length
      ? watchlist.filter(w => w.actif && activeRegions.includes(w.region))
      : watchlist.filter(w => w.actif);

    // Cursor-based batch
    const cursor = config.scan_cursor || 0;
    const batch = eligible.slice(cursor, cursor + BATCH_SIZE);
    const nextCursor = cursor + BATCH_SIZE >= eligible.length ? 0 : cursor + BATCH_SIZE;

    let processed = 0;

    for (const wl of batch) {
      try {
        // Scrape site
        let siteText = '';
        if (wl.site_web) {
          let url = wl.site_web.trim();
          if (!url.startsWith('http')) url = 'https://' + url;
          siteText = await fetchPageText(url);
        }

        // Scrape Google News
        const articles = await scrapeGoogleNews(wl.nom, wl.region);

        // Enrich articles with full content (best effort, first 3)
        for (const article of articles.slice(0, 3)) {
          try {
            if (!article.url) continue;
            const fullText = await fetchPageText(article.url);
            if (fullText && fullText.length > (article.extrait || '').length) {
              article.extrait = fullText.substring(0, 2500);
            }
          } catch { /* best effort */ }
        }

        // Detect signals via OpenAI
        const acronym = makeAcronym(wl.nom_officiel || wl.nom);
        const articlesSummary = articles.map(a => `[${a.date}] ${a.titre}\n${a.extrait || ''}`).join('\n\n');
        const userPrompt = `ENTREPRISE: ${wl.nom}${acronym ? '\nACRONYME: ' + acronym : ''}${wl.ville ? '\nVILLE: ' + wl.ville : ''}\nSITE WEB:\n${siteText || 'Non disponible'}\nARTICLES DE PRESSE RECENTS:\n${articlesSummary || 'Aucun'}`;
        const raw = await callOpenAI(openaiKey, SIGNAL_DETECTION_PROMPT, userPrompt);

        let aiResult;
        try {
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          aiResult = JSON.parse(cleaned);
        } catch {
          aiResult = { signaux: [], score_besoin_dsi: 0, score_urgence: 0, score_complexite_si: 0, justification: 'Parse error' };
        }

        // Compute score
        const global = Math.round(
          (aiResult.score_besoin_dsi || 0) * 0.5 +
          (aiResult.score_urgence || 0) * 0.25 +
          (aiResult.score_complexite_si || 0) * 0.25
        );

        const record = {
          id: 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          entreprise_id: wl.entreprise_id || null,
          entreprise_nom: wl.nom,
          entreprise_siren: wl.siren || '',
          region: wl.region || '',
          departement: wl.departement || '',
          ville: wl.ville || '',
          code_postal: wl.code_postal || '',
          signaux: (aiResult.signaux || []).map(s => ({
            ...s,
            source: 'cron_scan',
            date_detection: now,
          })),
          score_besoin_dsi: aiResult.score_besoin_dsi || 0,
          score_urgence: aiResult.score_urgence || 0,
          score_complexite_si: aiResult.score_complexite_si || 0,
          score_global: global,
          donnees_pappers: {},
          donnees_scraping: {
            site_texte: siteText.substring(0, 300),
            actualites: articles,
            offres_emploi: [],
          },
          generation: { hypothese_it: null, angle_approche: null, script_appel: null, message_linkedin: null, date_generation: null },
          statut: 'nouveau',
          date_creation: now,
          date_mise_a_jour: now,
          notes: aiResult.justification || '',
        };

        // Update or insert signal
        const existIdx = signaux.findIndex(s => s.entreprise_siren === wl.siren && wl.siren);
        if (existIdx >= 0) {
          signaux[existIdx] = { ...signaux[existIdx], ...record, id: signaux[existIdx].id, date_creation: signaux[existIdx].date_creation };
        } else {
          signaux.push(record);
        }

        // Update watchlist entry
        wl.derniere_analyse = now;
        processed++;
      } catch (e) {
        console.error('Scan error for ' + wl.nom + ':', e);
      }
    }

    // Save everything
    config.scan_cursor = nextCursor;
    config.derniere_execution = now;
    await store.setJSON("signal_config", config);
    await store.setJSON("watchlist", watchlist);
    await store.setJSON("signaux", signaux);

    return new Response(JSON.stringify({
      processed,
      batch_size: batch.length,
      next_cursor: nextCursor,
      total_signals: signaux.length,
    }));

  } catch (error) {
    console.error('signal-scan error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export const config = {
  schedule: "0 6 * * *" // Daily at 6:00 AM
};
