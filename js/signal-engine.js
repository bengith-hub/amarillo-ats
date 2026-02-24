// Amarillo ATS — Signal Engine Industriel
// Détection automatique de signaux business déclencheurs de besoins DSI
// Scraping sites corporate + Google News + Pappers + scoring IA

const SignalEngine = (() => {

  // ============================================================
  // CONFIG & CONSTANTS
  // ============================================================

  const SIGNAL_TYPES = {
    investissement:      { label: 'Investissement industriel', icon: '🏗️', color: '#2563eb' },
    expansion:           { label: 'Extension multi-sites',     icon: '🌐', color: '#7c3aed' },
    erp_mes:             { label: 'Projet ERP / MES / SAP',   icon: '⚙️', color: '#059669' },
    croissance:          { label: 'Croissance forte',          icon: '📈', color: '#d97706' },
    rachat_lbo:          { label: 'Rachat / LBO',              icon: '🤝', color: '#dc2626' },
    internationalisation:{ label: 'Internationalisation',      icon: '✈️', color: '#0891b2' },
    recrutement_it:      { label: 'Recrutement IT/DSI',        icon: '👤', color: '#4f46e5' },
  };

  const SCORE_RULES = {
    investissement_10m: 25,
    investissement_50m: 35,
    expansion: 20,
    erp_mes: 30,
    croissance_15: 15,
    croissance_30: 25,
    rachat_lbo: 20,
    internationalisation: 15,
    recrutement_it: 25,
    pas_de_dsi: 10,
  };

  const CODES_NAF_INDUSTRIELS = ['10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33'];

  // ============================================================
  // STATE
  // ============================================================

  let _config = null;
  let _watchlist = null;
  let _signaux = null;
  let _activeTab = 'signaux';
  let _filters = { score: null, type: null, departement: null };

  // ============================================================
  // DATA ACCESS (via Store / API)
  // ============================================================

  async function _loadConfig() {
    if (_config) return _config;
    try {
      _config = await API.fetchBin('signal_config');
      if (!_config || !_config.regions_actives) {
        _config = _defaultConfig();
      }
    } catch {
      _config = _defaultConfig();
    }
    return _config;
  }

  function _defaultConfig() {
    return {
      regions_actives: ['Pays de la Loire'],
      scan_cursor: 0,
      effectif_min_decouverte: 100,
      ca_min_decouverte: 5000000,
      codes_naf_cibles: CODES_NAF_INDUSTRIELS,
      score_seuil_alerte: 70,
      derniere_execution: null
    };
  }

  async function _saveConfig() {
    await API.updateBin('signal_config', _config);
  }

  async function _loadWatchlist() {
    if (_watchlist) return _watchlist;
    try {
      _watchlist = await API.fetchBin('watchlist');
      if (!Array.isArray(_watchlist)) _watchlist = [];
    } catch {
      _watchlist = [];
    }
    return _watchlist;
  }

  async function _saveWatchlist() {
    await API.updateBin('watchlist', _watchlist);
  }

  async function _loadSignaux() {
    if (_signaux) return _signaux;
    try {
      _signaux = await API.fetchBin('signaux');
      if (!Array.isArray(_signaux)) _signaux = [];
    } catch {
      _signaux = [];
    }
    return _signaux;
  }

  async function _saveSignaux() {
    await API.updateBin('signaux', _signaux);
  }

  // ============================================================
  // SCRAPING — CORS proxy with fallback
  // ============================================================

  const CORS_PROXIES = [
    { name: 'netlify', buildUrl: (u) => '/.netlify/functions/cors-proxy?url=' + encodeURIComponent(u), parseHtml: (d) => d },
    { name: 'corsproxy', buildUrl: (u) => 'https://corsproxy.io/?' + encodeURIComponent(u), parseHtml: (d) => d },
    { name: 'allorigins', buildUrl: (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), parseHtml: (d) => { try { return JSON.parse(d).contents || ''; } catch { return d; } } },
  ];

  async function _fetchViaProxy(url, timeoutMs) {
    const timeout = timeoutMs || 10000;
    for (const proxy of CORS_PROXIES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(proxy.buildUrl(url), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          console.warn('[SignalEngine] Proxy ' + proxy.name + ' returned ' + response.status + ' for ' + url);
          continue;
        }
        const raw = await response.text();
        if (!raw) continue;
        const result = proxy.parseHtml(raw);
        if (result) {
          console.log('[SignalEngine] Proxy ' + proxy.name + ' OK for ' + url + ' (' + result.length + ' chars)');
          return result;
        }
      } catch (e) {
        console.warn('[SignalEngine] Proxy ' + proxy.name + ' failed for ' + url + ':', e.message || 'timeout');
      }
    }
    console.warn('[SignalEngine] All proxies failed for ' + url);
    return '';
  }

  // ============================================================
  // SCRAPING — Site corporate
  // ============================================================

  async function _fetchPageText(url) {
    try {
      const html = await _fetchViaProxy(url, 10000);
      if (!html) return '';
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, svg, noscript, iframe, link, meta').forEach(el => el.remove());
      let text = doc.body?.textContent || '';
      text = text.replace(/[\t\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').replace(/ {2,}/g, ' ').trim();
      return text.length > 3000 ? text.substring(0, 3000) + '...' : text;
    } catch {
      return '';
    }
  }

  async function _scrapeSite(siteUrl) {
    if (!siteUrl) return { site_texte: '', offres_emploi: [] };
    let url = siteUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    const baseUrl = url.replace(/\/+$/, '');

    const pagePaths = ['', '/actualites', '/news', '/carrieres', '/careers', '/recrutement'];
    const results = await Promise.allSettled(
      pagePaths.slice(0, 3).map(p => _fetchPageText(baseUrl + p))
    );

    const parts = [];
    const labels = ['ACCUEIL', 'ACTUALITES', 'CARRIERES'];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        parts.push(labels[i] + ':\n' + r.value);
      }
    });

    return { site_texte: parts.join('\n\n'), offres_emploi: [] };
  }

  // ============================================================
  // SCRAPING — Google News RSS
  // ============================================================

  async function _scrapeGoogleNews(entrepriseNom, region) {
    try {
      const query = encodeURIComponent(`"${entrepriseNom}" investissement OR industrie OR usine ${region || ''}`);
      const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=fr&gl=FR&ceid=FR:fr`;

      const xmlText = await _fetchViaProxy(rssUrl, 10000);
      if (!xmlText) return [];

      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const items = doc.querySelectorAll('item');

      const articles = [];
      items.forEach((item, i) => {
        if (i >= 5) return;
        const titre = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        // Strip HTML from description
        const tmp = document.createElement('div');
        tmp.innerHTML = description;
        const extrait = tmp.textContent.substring(0, 300);

        articles.push({
          titre,
          url: link,
          date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : '',
          extrait
        });
      });

      return articles;
    } catch {
      return [];
    }
  }

  // ============================================================
  // SCRAPING — Google Search (web results, not just news)
  // ============================================================

  async function _scrapeGoogleSearch(entrepriseNom, region) {
    try {
      const query = encodeURIComponent(`"${entrepriseNom}" ${region || ''} entreprise activite`);
      const searchUrl = `https://www.google.com/search?q=${query}&hl=fr&num=5`;
      const html = await _fetchViaProxy(searchUrl, 10000);
      if (!html) return '';

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, svg, noscript, iframe, link, meta').forEach(el => el.remove());

      let text = doc.body?.textContent || '';
      text = text.replace(/[\t\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').replace(/ {2,}/g, ' ').trim();
      return text.length > 2000 ? text.substring(0, 2000) : text;
    } catch {
      return '';
    }
  }

  // ============================================================
  // PAPPERS — Recherche par département + enrichissement
  // ============================================================

  function _getPappersKey() {
    return localStorage.getItem('ats_pappers_key') || '';
  }

  async function _searchPappersByRegion(regionName, options = {}) {
    const apiKey = _getPappersKey();
    if (!apiKey) return [];

    const deps = SignalRegions.getDepartements(regionName);
    if (!deps.length) return [];

    const config = await _loadConfig();
    const allResults = [];

    for (const dep of deps) {
      try {
        const params = new URLSearchParams({
          api_token: apiKey,
          departement: dep,
          par_page: '20',
        });
        if (options.code_naf) params.set('code_naf', options.code_naf);

        const response = await fetch('https://api.pappers.fr/v2/recherche?' + params.toString());
        if (!response.ok) {
          if (response.status === 429) {
            UI.toast('Quota Pappers atteint', 'error');
            break;
          }
          continue;
        }
        const data = await response.json();
        const results = data.resultats || [];

        for (const r of results) {
          const effectif = _parseEffectif(r.tranche_effectif);
          if (effectif < (config.effectif_min_decouverte || 100)) continue;

          allResults.push({
            siren: r.siren || '',
            nom: r.denomination || r.nom_entreprise || '',
            ville: r.siege?.ville || '',
            code_postal: r.siege?.code_postal || '',
            departement: dep,
            region: regionName,
            secteur_naf: r.code_naf || '',
            libelle_naf: r.libelle_code_naf || '',
            effectif: effectif,
            ca: r.chiffre_affaires || 0,
            forme_juridique: r.forme_juridique || '',
          });
        }

        // Rate limit: 300ms between Pappers calls
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.warn('Pappers search error for dep ' + dep + ':', e);
      }
    }

    return allResults;
  }

  async function _enrichPappers(siren) {
    const apiKey = _getPappersKey();
    if (!apiKey || !siren) return null;

    try {
      const params = new URLSearchParams({
        api_token: apiKey,
        siren: siren,
      });
      const response = await fetch('https://api.pappers.fr/v2/entreprise?' + params.toString());
      if (!response.ok) return null;
      const data = await response.json();

      return {
        ca: data.chiffre_affaires || 0,
        effectif: _parseEffectif(data.tranche_effectif),
        croissance_ca: _estimateCroissance(data),
        secteur_naf: data.code_naf || '',
        libelle_naf: data.libelle_code_naf || '',
        date_creation: data.date_creation || '',
        site_web: data.site_web || '',
        dirigeants: (data.representants || []).slice(0, 5).map(d => ({
          nom: [d.prenom, d.nom].filter(Boolean).join(' '),
          fonction: d.qualite || ''
        })),
      };
    } catch {
      return null;
    }
  }

  async function _searchPappersByName(nom, ville) {
    const apiKey = _getPappersKey();
    if (!apiKey || !nom) return null;

    try {
      const params = new URLSearchParams({
        api_token: apiKey,
        q: nom,
        par_page: '5',
      });
      const response = await fetch('https://api.pappers.fr/v2/recherche?' + params.toString());
      if (!response.ok) return null;
      const data = await response.json();
      const results = data.resultats || [];
      if (!results.length) return null;

      // Try to match by city if available, otherwise take first result
      let best = results[0];
      if (ville) {
        const villeNorm = ville.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const match = results.find(r => {
          const rv = (r.siege?.ville || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return rv.includes(villeNorm) || villeNorm.includes(rv);
        });
        if (match) best = match;
      }

      return {
        siren: best.siren || '',
        nom_officiel: best.denomination || best.nom_entreprise || '',
        site_web: best.site_web || '',
        code_naf: best.code_naf || '',
        libelle_naf: best.libelle_code_naf || '',
        ville: best.siege?.ville || '',
        code_postal: best.siege?.code_postal || '',
      };
    } catch {
      return null;
    }
  }

  function _parseEffectif(tranche) {
    if (!tranche) return 0;
    const nums = String(tranche).match(/(\d[\d\s]*)/g);
    if (!nums) return 0;
    return parseInt(nums[0].replace(/\s/g, '')) || 0;
  }

  function _estimateCroissance(data) {
    // Pappers free tier doesn't always have historical CA
    // Return 0 as default, can be improved with paid plan
    return 0;
  }

  // ============================================================
  // OPENAI — Signal extraction + scoring
  // ============================================================

  async function _callOpenAI(systemPrompt, userPrompt) {
    const apiKey = CVParser.getOpenAIKey();
    if (!apiKey) throw new Error('Cle API OpenAI non configuree.');

    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });

    const maxRetries = 3;
    let response;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body,
      });
      if (response.status !== 429 || attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
    }

    if (!response.ok) {
      if (response.status === 401) throw new Error('Cle API OpenAI invalide.');
      if (response.status === 429) throw new Error('Limite OpenAI atteinte. Reessayez dans 30s.');
      throw new Error('Erreur OpenAI: ' + response.status);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
  }

  async function _detectSignaux(entrepriseNom, siteTexte, articles, pappers) {
    const system = `Tu es un analyste business specialise dans la detection de signaux declencheurs de besoins en DSI (Directeur des Systemes d'Information) pour des entreprises industrielles.

Analyse les donnees fournies et detecte les signaux suivants :
- investissement : Investissement industriel significatif (>10M EUR)
- expansion : Extension multi-sites, ouverture de nouveaux sites
- erp_mes : Projet ERP, SAP, MES, transformation digitale, SI
- croissance : Croissance forte du CA (>15%)
- rachat_lbo : Rachat, acquisition, LBO, fusion
- internationalisation : Expansion internationale, export
- recrutement_it : Recrutement de profils IT, DSI, CTO

Reponds UNIQUEMENT en JSON valide avec cette structure :
{
  "signaux": [
    {
      "type": "investissement",
      "label": "Description courte du signal",
      "confiance": 0.85,
      "extrait": "Phrase source qui justifie la detection"
    }
  ],
  "score_besoin_dsi": 75,
  "score_urgence": 60,
  "score_complexite_si": 70,
  "justification": "Explication en 2 phrases du scoring"
}

Si aucun signal n'est detecte, retourne {"signaux":[],"score_besoin_dsi":10,"score_urgence":5,"score_complexite_si":5,"justification":"Aucun signal significatif detecte."}`;

    const articlesSummary = (articles || []).map(a => `[${a.date}] ${a.titre}\n${a.extrait}`).join('\n\n');

    const user = `ENTREPRISE: ${entrepriseNom}

DONNEES PAPPERS:
- CA: ${pappers?.ca ? (pappers.ca / 1000000).toFixed(1) + 'M EUR' : 'inconnu'}
- Effectif: ${pappers?.effectif || 'inconnu'}
- Secteur NAF: ${pappers?.libelle_naf || 'inconnu'}
- Dirigeants: ${pappers?.dirigeants?.map(d => d.nom + ' (' + d.fonction + ')').join(', ') || 'inconnus'}

CONTENU SITE WEB:
${siteTexte || 'Non disponible'}

ARTICLES DE PRESSE RECENTS:
${articlesSummary || 'Aucun article trouve'}`;

    const raw = await _callOpenAI(system, user);

    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      console.warn('Failed to parse OpenAI signal response:', raw);
      return { signaux: [], score_besoin_dsi: 0, score_urgence: 0, score_complexite_si: 0, justification: 'Erreur analyse' };
    }
  }

  // ============================================================
  // SCORING — Hybrid (rules + AI)
  // ============================================================

  function _computeRuleScore(signaux, pappers) {
    let score = 0;
    for (const s of signaux) {
      switch (s.type) {
        case 'investissement': score += 25; break;
        case 'expansion': score += 20; break;
        case 'erp_mes': score += 30; break;
        case 'croissance': score += 15; break;
        case 'rachat_lbo': score += 20; break;
        case 'internationalisation': score += 15; break;
        case 'recrutement_it': score += 25; break;
      }
    }
    if (pappers?.croissance_ca > 30) score += 10;
    return score;
  }

  function _normalizeScore(raw, max) {
    if (max <= 0) return 0;
    const linear = Math.max(0, Math.min(1, raw / max));
    const k = 3.0;
    const sigmoid = 1 / (1 + Math.exp(-k * (linear - 0.5) * 4));
    const sigMin = 1 / (1 + Math.exp(-k * (-0.5) * 4));
    const sigMax = 1 / (1 + Math.exp(-k * (0.5) * 4));
    return Math.round(Math.max(0, Math.min(100, ((sigmoid - sigMin) / (sigMax - sigMin)) * 100)));
  }

  function _computeFinalScore(aiResult, signaux, pappers) {
    const ruleScore = _computeRuleScore(signaux, pappers);
    // Blend: 40% rules, 60% AI
    const besoin = Math.round(0.4 * _normalizeScore(ruleScore, 100) + 0.6 * (aiResult.score_besoin_dsi || 0));
    const urgence = aiResult.score_urgence || 0;
    const complexite = aiResult.score_complexite_si || 0;
    const global = Math.round(besoin * 0.5 + urgence * 0.25 + complexite * 0.25);
    return { score_besoin_dsi: besoin, score_urgence: urgence, score_complexite_si: complexite, score_global: global };
  }

  // ============================================================
  // GENERATION — Semi-auto content (on-demand)
  // ============================================================

  async function generateApproche(signal) {
    const system = `Tu es un expert en recrutement de DSI industriels chez Amarillo Search. A partir des signaux business detectes pour une entreprise, genere du contenu d'approche commercial.

Reponds UNIQUEMENT en JSON valide :
{
  "hypothese_it": "L'enjeu SI probable lie au signal (2-3 phrases)",
  "angle_approche": "Comment aborder le dirigeant en tenant compte du contexte regional et sectoriel (2-3 phrases)",
  "script_appel": "Script telephonique: accroche percutante + 3 questions cles + conclusion",
  "message_linkedin": "Message LinkedIn court et percutant, moins de 300 caracteres, personnalise"
}`;

    const signauxDesc = (signal.signaux || []).map(s => `- ${SIGNAL_TYPES[s.type]?.label || s.type}: ${s.label}`).join('\n');

    const user = `ENTREPRISE: ${signal.entreprise_nom}
LOCALISATION: ${signal.ville || ''}, ${signal.departement || ''} (${signal.region || ''})
CA: ${signal.donnees_pappers?.ca ? (signal.donnees_pappers.ca / 1000000).toFixed(1) + 'M EUR' : 'inconnu'}
EFFECTIF: ${signal.donnees_pappers?.effectif || 'inconnu'}
SECTEUR: ${signal.donnees_pappers?.libelle_naf || 'inconnu'}
DIRIGEANTS: ${signal.donnees_pappers?.dirigeants?.map(d => d.nom + ' (' + d.fonction + ')').join(', ') || 'inconnus'}

SIGNAUX DETECTES:
${signauxDesc || 'Aucun signal'}

SCORE BESOIN DSI: ${signal.score_global}/100`;

    const raw = await _callOpenAI(system, user);
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      throw new Error('Erreur de parsing du contenu genere.');
    }
  }

  // ============================================================
  // ANALYSE — Full pipeline for one company
  // ============================================================

  async function analyseEntreprise(watchlistEntry) {
    const nom = watchlistEntry.nom;
    const region = watchlistEntry.region;
    let siren = watchlistEntry.siren || '';
    let siteWeb = watchlistEntry.site_web || '';

    // 0. Auto-enrich missing SIREN/site_web via Pappers name search
    if (!siren || !siteWeb) {
      const lookup = await _searchPappersByName(nom, watchlistEntry.ville);
      if (lookup) {
        if (!siren && lookup.siren) {
          siren = lookup.siren;
          watchlistEntry.siren = siren;
          console.log('[SignalEngine] Auto-found SIREN for ' + nom + ': ' + siren);
        }
        if (!siteWeb && lookup.site_web) {
          siteWeb = lookup.site_web;
          watchlistEntry.site_web = siteWeb;
          console.log('[SignalEngine] Auto-found site_web for ' + nom + ': ' + siteWeb);
        }
      }
    }

    // 1. Scrape site + Google News + Google Search in parallel
    const [siteData, articles, searchContext] = await Promise.all([
      _scrapeSite(siteWeb),
      _scrapeGoogleNews(nom, region),
      _scrapeGoogleSearch(nom, region),
    ]);

    // 2. Enrich with Pappers
    const pappers = siren ? await _enrichPappers(siren) : null;

    // If Pappers found a site_web and we didn't have one, scrape it now
    if (pappers?.site_web && !siteWeb) {
      siteWeb = pappers.site_web;
      watchlistEntry.site_web = siteWeb;
      const extraSite = await _scrapeSite(siteWeb);
      if (extraSite.site_texte) siteData.site_texte = extraSite.site_texte;
    }

    // Combine all text sources
    const allText = [siteData.site_texte, searchContext].filter(Boolean).join('\n\n');

    // 3. Detect signals via OpenAI
    const aiResult = await _detectSignaux(nom, allText, articles, pappers);

    // 4. Compute final scores
    const scores = _computeFinalScore(aiResult, aiResult.signaux || [], pappers);

    // 5. Build signal record
    const now = new Date().toISOString().split('T')[0];
    const signalRecord = {
      id: 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      entreprise_id: watchlistEntry.entreprise_id || null,
      entreprise_nom: nom,
      entreprise_siren: siren,
      region: region || '',
      departement: watchlistEntry.departement || '',
      ville: watchlistEntry.ville || '',
      code_postal: watchlistEntry.code_postal || '',
      signaux: (aiResult.signaux || []).map(s => ({
        type: s.type,
        label: s.label,
        source: s.source || 'site_corporate',
        source_url: siteWeb || '',
        date_detection: now,
        extrait: s.extrait || '',
        confiance: s.confiance || 0.5,
      })),
      ...scores,
      donnees_pappers: pappers || {},
      donnees_scraping: {
        site_texte: (siteData.site_texte || '').substring(0, 500),
        actualites: articles,
        offres_emploi: siteData.offres_emploi || [],
        search_context: (searchContext || '').substring(0, 500),
      },
      generation: { hypothese_it: null, angle_approche: null, script_appel: null, message_linkedin: null, date_generation: null },
      statut: 'nouveau',
      date_creation: now,
      date_mise_a_jour: now,
      notes: aiResult.justification || '',
    };

    return signalRecord;
  }

  // ============================================================
  // WATCHLIST MANAGEMENT
  // ============================================================

  async function addToWatchlist(entry, options) {
    const silent = options?.silent || false;
    await _loadWatchlist();
    // Dedup by siren or nom
    const exists = _watchlist.find(w =>
      (entry.siren && w.siren === entry.siren) ||
      (entry.nom && w.nom.toLowerCase() === entry.nom.toLowerCase())
    );
    if (exists) {
      if (!silent) UI.toast('Entreprise deja dans la watchlist', 'error');
      return null;
    }

    const now = new Date().toISOString().split('T')[0];
    const wlEntry = {
      id: 'wl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      entreprise_id: entry.entreprise_id || null,
      nom: entry.nom || '',
      siren: entry.siren || '',
      site_web: entry.site_web || '',
      region: entry.region || SignalRegions.codePostalToRegion(entry.code_postal) || '',
      departement: entry.departement || SignalRegions.codePostalToDep(entry.code_postal) || '',
      ville: entry.ville || '',
      code_postal: entry.code_postal || '',
      secteur_naf: entry.secteur_naf || '',
      source: entry.source || 'manual',
      actif: true,
      date_ajout: now,
      derniere_analyse: null,
    };

    _watchlist.push(wlEntry);
    await _saveWatchlist();
    if (!silent) UI.toast('Ajoutee a la watchlist');
    return wlEntry;
  }

  async function removeFromWatchlist(id) {
    await _loadWatchlist();
    _watchlist = _watchlist.filter(w => w.id !== id);
    await _saveWatchlist();
  }

  async function addFromATS(entrepriseId, options) {
    const ent = Store.findById('entreprises', entrepriseId);
    if (!ent) return null;
    return addToWatchlist({
      entreprise_id: entrepriseId,
      nom: ent.nom,
      siren: ent._pappers_siren || '',
      site_web: ent.site_web || '',
      code_postal: ent.siege_code_postal || '',
      ville: ent.siege_ville || ent.localisation || '',
      source: 'ats_import',
    }, options);
  }

  function _getATSSuggestions(activeRegion) {
    const entreprises = Store.get('entreprises') || [];
    const wl = _watchlist || [];
    const wlIds = new Set(wl.map(w => w.entreprise_id).filter(Boolean));
    const wlSirens = new Set(wl.map(w => w.siren).filter(Boolean));
    const wlNoms = new Set(wl.map(w => w.nom.toLowerCase()));

    return entreprises.filter(e => {
      // Already in watchlist?
      if (wlIds.has(e.id)) return false;
      if (e._pappers_siren && wlSirens.has(e._pappers_siren)) return false;
      if (e.nom && wlNoms.has(e.nom.toLowerCase())) return false;

      // Match region via code postal
      const cp = e.siege_code_postal || '';
      if (!cp) return false;
      const region = SignalRegions.codePostalToRegion(cp);
      return region === activeRegion;
    });
  }

  async function _addBatchFromATS(entrepriseIds, containerId) {
    let added = 0;
    for (const id of entrepriseIds) {
      const result = await addFromATS(id, { silent: true });
      if (result) added++;
    }
    if (added > 0) {
      UI.toast(added + ' entreprise' + (added > 1 ? 's ajoutees' : ' ajoutee') + ' a la watchlist');
    } else {
      UI.toast('Toutes ces entreprises sont deja dans la watchlist', 'error');
    }
    _watchlist = null;
    renderPage(containerId);
  }

  // ============================================================
  // UI — MAIN PAGE RENDER
  // ============================================================

  async function renderPage(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const [config, watchlist, signaux] = await Promise.all([
      _loadConfig(),
      _loadWatchlist(),
      _loadSignaux(),
    ]);

    const activeRegion = config.regions_actives?.[0] || 'Pays de la Loire';

    // Filter signaux by active region
    const regionSignaux = signaux.filter(s => !activeRegion || s.region === activeRegion);
    const regionWatchlist = watchlist.filter(w => !activeRegion || w.region === activeRegion);

    // Apply filters
    let filtered = [...regionSignaux];
    if (_filters.score) {
      const minScore = parseInt(_filters.score);
      filtered = filtered.filter(s => s.score_global >= minScore);
    }
    if (_filters.type) {
      filtered = filtered.filter(s => s.signaux.some(sig => sig.type === _filters.type));
    }
    if (_filters.departement) {
      filtered = filtered.filter(s => s.departement === _filters.departement);
    }

    // Sort by score descending
    filtered.sort((a, b) => (b.score_global || 0) - (a.score_global || 0));

    const regionDeps = SignalRegions.getDepartements(activeRegion);

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <select id="se-region-select" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:0.875rem;">
            ${SignalRegions.getRegionNames().map(r => `<option value="${UI.escHtml(r)}" ${r === activeRegion ? 'selected' : ''}>${UI.escHtml(r)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" id="se-btn-add-watch" style="font-size:0.8125rem;">+ Watchlist</button>
          <button class="btn btn-primary" id="se-btn-scan" style="font-size:0.8125rem;">Lancer un scan</button>
        </div>
      </div>

      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card">
          <div class="kpi-label">Signaux actifs</div>
          <div class="kpi-value">${regionSignaux.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Entreprises surveillees</div>
          <div class="kpi-value">${regionWatchlist.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Score moyen</div>
          <div class="kpi-value">${regionSignaux.length ? Math.round(regionSignaux.reduce((s, x) => s + (x.score_global || 0), 0) / regionSignaux.length) : '—'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Signaux forts (&gt;70)</div>
          <div class="kpi-value" style="color:#059669;">${regionSignaux.filter(s => s.score_global >= 70).length}</div>
        </div>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid #e2e8f0;">
        ${['signaux', 'watchlist', 'decouverte', 'carte'].map(tab => `
          <button class="se-tab ${_activeTab === tab ? 'se-tab-active' : ''}" data-tab="${tab}" style="padding:8px 16px;border:none;background:${_activeTab === tab ? '#fff' : 'transparent'};border-bottom:${_activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent'};margin-bottom:-2px;font-size:0.875rem;font-weight:${_activeTab === tab ? '600' : '400'};color:${_activeTab === tab ? '#1e293b' : '#64748b'};cursor:pointer;">
            ${{ signaux: 'Signaux', watchlist: 'Watchlist', decouverte: 'Decouverte', carte: 'Carte' }[tab]}
          </button>
        `).join('')}
      </div>

      <div id="se-tab-content"></div>
    `;

    // Render active tab content
    const tabContent = document.getElementById('se-tab-content');
    if (_activeTab === 'signaux') {
      _renderSignauxTab(tabContent, filtered, regionDeps);
    } else if (_activeTab === 'watchlist') {
      _renderWatchlistTab(tabContent, regionWatchlist, activeRegion);
    } else if (_activeTab === 'decouverte') {
      _renderDecouverteTab(tabContent, activeRegion);
    } else if (_activeTab === 'carte') {
      _renderCarteTab(tabContent, regionSignaux, activeRegion);
    }

    // Event listeners
    document.getElementById('se-region-select')?.addEventListener('change', async (e) => {
      _config.regions_actives = [e.target.value];
      await _saveConfig();
      _signaux = null;
      _watchlist = null;
      renderPage(containerId);
    });

    document.querySelectorAll('.se-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = btn.dataset.tab;
        renderPage(containerId);
      });
    });

    document.getElementById('se-btn-add-watch')?.addEventListener('click', () => {
      _showAddWatchlistModal(containerId);
    });

    document.getElementById('se-btn-scan')?.addEventListener('click', () => {
      _runManualScan(containerId);
    });
  }

  // ============================================================
  // UI — SIGNAUX TAB
  // ============================================================

  function _renderSignauxTab(container, signaux, regionDeps) {
    if (!signaux.length) {
      container.innerHTML = '<div class="empty-state"><p>Aucun signal detecte. Ajoutez des entreprises a la watchlist et lancez un scan.</p></div>';
      return;
    }

    const filtersHtml = `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <select id="se-filter-score" style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:0.8125rem;">
          <option value="">Score: tous</option>
          <option value="70" ${_filters.score === '70' ? 'selected' : ''}>Score &ge; 70</option>
          <option value="50" ${_filters.score === '50' ? 'selected' : ''}>Score &ge; 50</option>
          <option value="30" ${_filters.score === '30' ? 'selected' : ''}>Score &ge; 30</option>
        </select>
        <select id="se-filter-type" style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:0.8125rem;">
          <option value="">Type: tous</option>
          ${Object.entries(SIGNAL_TYPES).map(([k, v]) => `<option value="${k}" ${_filters.type === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
        <select id="se-filter-dep" style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:0.8125rem;">
          <option value="">Dept: tous</option>
          ${regionDeps.map(d => `<option value="${d}" ${_filters.departement === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
    `;

    const cardsHtml = signaux.map(s => _renderSignalCard(s)).join('');
    container.innerHTML = filtersHtml + cardsHtml;

    // Filter events
    ['se-filter-score', 'se-filter-type', 'se-filter-dep'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        const key = id.replace('se-filter-', '').replace('dep', 'departement');
        _filters[key] = e.target.value || null;
        // Re-render page
        const pageContainer = document.getElementById('signaux-content');
        if (pageContainer) renderPage('signaux-content');
      });
    });

    // Card action buttons
    document.querySelectorAll('.se-btn-detail').forEach(btn => {
      btn.addEventListener('click', () => _showSignalDetail(btn.dataset.id));
    });
    document.querySelectorAll('.se-btn-generate').forEach(btn => {
      btn.addEventListener('click', () => _onGenerateApproche(btn.dataset.id));
    });
  }

  function _renderSignalCard(s) {
    const scoreColor = s.score_global >= 70 ? '#059669' : s.score_global >= 40 ? '#d97706' : '#94a3b8';
    const scoreEmoji = s.score_global >= 70 ? '🟢' : s.score_global >= 40 ? '🟠' : '⚪';
    const signauxList = (s.signaux || []).map(sig => {
      const t = SIGNAL_TYPES[sig.type] || {};
      return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.8125rem;color:#334155;">${t.icon || '•'} ${UI.escHtml(sig.label)}</span>`;
    }).join('<br>');

    const sources = [...new Set((s.signaux || []).map(sig => sig.source))].join(', ');
    const daysAgo = Math.floor((Date.now() - new Date(s.date_creation).getTime()) / 86400000);
    const dateLabel = daysAgo === 0 ? "aujourd'hui" : daysAgo === 1 ? 'hier' : `il y a ${daysAgo}j`;

    const ca = s.donnees_pappers?.ca ? (s.donnees_pappers.ca / 1000000).toFixed(0) + 'M' : '—';
    const effectif = s.donnees_pappers?.effectif || '—';

    const atsLink = s.entreprise_id
      ? `<a href="entreprise.html?id=${s.entreprise_id}" class="btn btn-secondary" style="font-size:0.75rem;padding:3px 8px;">Fiche ATS</a>`
      : '';

    return `
      <div class="card" style="margin-bottom:12px;border-left:4px solid ${scoreColor};">
        <div class="card-body" style="padding:14px 18px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-weight:600;font-size:1rem;color:#1e293b;">${UI.escHtml(s.entreprise_nom)}</div>
              <div style="font-size:0.8125rem;color:#64748b;">${UI.escHtml(s.ville || '')}${s.departement ? ' (' + s.departement + ')' : ''}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:1.25rem;font-weight:700;color:${scoreColor};">${s.score_global}/100 ${scoreEmoji}</div>
              <div style="font-size:0.6875rem;color:#94a3b8;">${dateLabel}</div>
            </div>
          </div>
          <div style="margin:8px 0;">${signauxList || '<span style="color:#94a3b8;font-size:0.8125rem;">Aucun signal</span>'}</div>
          <div style="display:flex;align-items:center;gap:12px;font-size:0.75rem;color:#94a3b8;margin-bottom:8px;">
            <span>CA: ${ca} EUR</span>
            <span>Effectif: ${effectif}</span>
            <span>Source: ${sources || '—'}</span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-secondary se-btn-detail" data-id="${s.id}" style="font-size:0.75rem;padding:4px 10px;">Voir detail</button>
            <button class="btn btn-primary se-btn-generate" data-id="${s.id}" style="font-size:0.75rem;padding:4px 10px;">Generer approche</button>
            ${atsLink}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // UI — WATCHLIST TAB
  // ============================================================

  function _renderWatchlistTab(container, watchlist, activeRegion) {
    // --- Suggestions banner: ATS companies from active region not yet in watchlist ---
    const suggestions = _getATSSuggestions(activeRegion);
    let suggestionsHtml = '';
    if (suggestions.length > 0) {
      const sugRows = suggestions.map(e => {
        const ville = e.siege_ville || e.localisation || '';
        const dep = SignalRegions.codePostalToDep(e.siege_code_postal || '') || '';
        const info = [ville, dep].filter(Boolean).join(', ');
        const extra = [e.secteur ? e.secteur : '', e.taille ? e.taille + ' sal.' : ''].filter(Boolean).join(' | ');
        return `
          <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;transition:background .15s;"
                 onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
            <input type="checkbox" class="se-suggest-cb" value="${e.id}" checked style="width:16px;height:16px;accent-color:#3b82f6;" />
            <span style="font-weight:500;">${UI.escHtml(e.nom)}</span>
            <span style="color:#64748b;font-size:0.8125rem;">${UI.escHtml(info)}</span>
            ${extra ? '<span style="color:#94a3b8;font-size:0.75rem;">' + UI.escHtml(extra) + '</span>' : ''}
          </label>`;
      }).join('');

      suggestionsHtml = `
        <div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-weight:600;font-size:0.9375rem;color:#1e40af;">
              Suggestions ATS — ${UI.escHtml(activeRegion)}
            </div>
            <span style="font-size:0.75rem;color:#64748b;">${suggestions.length} entreprise${suggestions.length > 1 ? 's' : ''} disponible${suggestions.length > 1 ? 's' : ''}</span>
          </div>
          <div style="max-height:200px;overflow-y:auto;margin-bottom:10px;">
            ${sugRows}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn btn-secondary" id="se-suggest-all" style="font-size:0.75rem;padding:3px 10px;">Tout cocher</button>
            <button class="btn btn-secondary" id="se-suggest-none" style="font-size:0.75rem;padding:3px 10px;">Aucun</button>
            <button class="btn btn-primary" id="se-suggest-add" style="font-size:0.8125rem;padding:4px 14px;margin-left:auto;">
              Ajouter <span id="se-suggest-count">${suggestions.length}</span> selectionnee${suggestions.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>`;
    }

    // --- Watchlist table ---
    let tableHtml = '';
    if (watchlist.length) {
      const rows = watchlist.map(w => `
        <tr>
          <td style="font-weight:500;">${UI.escHtml(w.nom)}</td>
          <td>${UI.escHtml(w.ville || '')} (${w.departement || ''})</td>
          <td style="font-size:0.8125rem;">${UI.escHtml(w.siren || '—')}</td>
          <td style="font-size:0.8125rem;">${w.site_web ? '<a href="' + UI.escHtml(w.site_web) + '" target="_blank" style="color:#3b82f6;">Site</a>' : '—'}</td>
          <td style="font-size:0.8125rem;">${w.derniere_analyse || 'Jamais'}</td>
          <td>
            <button class="btn btn-secondary se-btn-scan-one" data-id="${w.id}" style="font-size:0.6875rem;padding:2px 8px;">Scanner</button>
            <button class="btn btn-secondary se-btn-remove-wl" data-id="${w.id}" style="font-size:0.6875rem;padding:2px 8px;color:#dc2626;">Retirer</button>
          </td>
        </tr>
      `).join('');

      tableHtml = `
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Localisation</th>
                <th>SIREN</th>
                <th>Site web</th>
                <th>Dernier scan</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } else if (!suggestions.length) {
      tableHtml = '<div class="empty-state"><p>Watchlist vide. Ajoutez des entreprises a surveiller.</p></div>';
    }

    container.innerHTML = suggestionsHtml + tableHtml;

    // --- Suggestions events ---
    const _updateSuggestCount = () => {
      const checked = container.querySelectorAll('.se-suggest-cb:checked').length;
      const countEl = document.getElementById('se-suggest-count');
      if (countEl) countEl.textContent = checked;
      const addBtn = document.getElementById('se-suggest-add');
      if (addBtn) {
        addBtn.textContent = 'Ajouter ' + checked + ' selectionnee' + (checked > 1 ? 's' : '');
        addBtn.disabled = checked === 0;
      }
    };

    container.querySelectorAll('.se-suggest-cb').forEach(cb => {
      cb.addEventListener('change', _updateSuggestCount);
    });

    document.getElementById('se-suggest-all')?.addEventListener('click', () => {
      container.querySelectorAll('.se-suggest-cb').forEach(cb => { cb.checked = true; });
      _updateSuggestCount();
    });

    document.getElementById('se-suggest-none')?.addEventListener('click', () => {
      container.querySelectorAll('.se-suggest-cb').forEach(cb => { cb.checked = false; });
      _updateSuggestCount();
    });

    document.getElementById('se-suggest-add')?.addEventListener('click', async () => {
      const selected = [...container.querySelectorAll('.se-suggest-cb:checked')].map(cb => cb.value);
      if (!selected.length) { UI.toast('Aucune entreprise selectionnee', 'error'); return; }
      const btn = document.getElementById('se-suggest-add');
      if (btn) { btn.disabled = true; btn.textContent = 'Import en cours...'; }
      await _addBatchFromATS(selected, 'signaux-content');
    });

    // --- Watchlist table events ---
    container.querySelectorAll('.se-btn-scan-one').forEach(btn => {
      btn.addEventListener('click', () => _scanOneEntreprise(btn.dataset.id));
    });
    container.querySelectorAll('.se-btn-remove-wl').forEach(btn => {
      btn.addEventListener('click', async () => {
        await removeFromWatchlist(btn.dataset.id);
        _watchlist = null;
        renderPage('signaux-content');
      });
    });
  }

  // ============================================================
  // UI — DECOUVERTE TAB
  // ============================================================

  function _renderDecouverteTab(container, activeRegion) {
    container.innerHTML = `
      <div class="card"><div class="card-body">
        <h3 style="margin:0 0 12px;font-size:0.9375rem;">Decouverte — ${UI.escHtml(activeRegion)}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <select id="se-disc-naf" style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:0.8125rem;">
            <option value="">Tous secteurs industriels</option>
            <option value="25">25 - Produits metalliques</option>
            <option value="26">26 - Produits informatiques/electroniques</option>
            <option value="27">27 - Equipements electriques</option>
            <option value="28">28 - Machines/equipements</option>
            <option value="29">29 - Vehicules automobiles</option>
            <option value="30">30 - Materiels de transport</option>
            <option value="10">10 - Produits alimentaires</option>
            <option value="20">20 - Produits chimiques</option>
            <option value="22">22 - Produits caoutchouc/plastique</option>
          </select>
          <button class="btn btn-primary" id="se-btn-discover" style="font-size:0.8125rem;">Rechercher via Pappers</button>
        </div>
        <div id="se-discover-results"></div>
      </div></div>
    `;

    document.getElementById('se-btn-discover')?.addEventListener('click', async () => {
      const nafSelect = document.getElementById('se-disc-naf');
      const naf = nafSelect?.value || '';
      const resultsDiv = document.getElementById('se-discover-results');
      if (!resultsDiv) return;

      if (!_getPappersKey()) {
        UI.toast('Configurez votre cle Pappers d\'abord', 'error');
        return;
      }

      resultsDiv.innerHTML = '<p style="color:#64748b;">Recherche en cours...</p>';

      try {
        const results = await _searchPappersByRegion(activeRegion, { code_naf: naf });

        // Dedup with existing watchlist
        await _loadWatchlist();
        const wlSirens = new Set(_watchlist.map(w => w.siren).filter(Boolean));
        const filtered = results.filter(r => !wlSirens.has(r.siren));

        if (!filtered.length) {
          resultsDiv.innerHTML = '<p style="color:#94a3b8;">Aucune entreprise trouvee (ou toutes deja dans la watchlist).</p>';
          return;
        }

        resultsDiv.innerHTML = filtered.map(r => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <div>
              <div style="font-weight:500;">${UI.escHtml(r.nom)}</div>
              <div style="font-size:0.8125rem;color:#64748b;">
                ${UI.escHtml(r.ville)} (${r.departement}) | ${UI.escHtml(r.libelle_naf)} | CA: ${r.ca ? (r.ca / 1000000).toFixed(0) + 'M' : '?'} | ${r.effectif} sal.
              </div>
            </div>
            <button class="btn btn-secondary se-btn-add-disc" data-siren="${r.siren}" data-nom="${UI.escHtml(r.nom)}" data-ville="${UI.escHtml(r.ville)}" data-cp="${r.code_postal}" data-dep="${r.departement}" data-region="${UI.escHtml(r.region)}" data-naf="${r.secteur_naf}" style="font-size:0.75rem;padding:3px 10px;white-space:nowrap;">+ Watchlist</button>
          </div>
        `).join('');

        resultsDiv.querySelectorAll('.se-btn-add-disc').forEach(btn => {
          btn.addEventListener('click', async () => {
            await addToWatchlist({
              siren: btn.dataset.siren,
              nom: btn.dataset.nom,
              ville: btn.dataset.ville,
              code_postal: btn.dataset.cp,
              departement: btn.dataset.dep,
              region: btn.dataset.region,
              secteur_naf: btn.dataset.naf,
              source: 'decouverte',
            });
            btn.textContent = 'Ajoutee';
            btn.disabled = true;
          });
        });
      } catch (e) {
        resultsDiv.innerHTML = `<p style="color:#dc2626;">Erreur: ${UI.escHtml(e.message)}</p>`;
      }
    });
  }

  // ============================================================
  // UI — CARTE TAB
  // ============================================================

  function _renderCarteTab(container, signaux, activeRegion) {
    const regionData = SignalRegions.getRegion(activeRegion);
    container.innerHTML = `<div id="se-map" style="height:500px;border-radius:8px;overflow:hidden;"></div>`;

    // Wait for DOM then init Leaflet
    setTimeout(() => {
      if (typeof L === 'undefined') {
        container.innerHTML = '<p style="color:#94a3b8;">Leaflet non disponible sur cette page.</p>';
        return;
      }

      const center = regionData?.center || [46.6, 2.5];
      const zoom = regionData?.zoom || 6;
      const map = L.map('se-map').setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      // Add markers for each signal with a known city
      for (const s of signaux) {
        if (!s.ville) continue;
        // Use geocoder if available, otherwise approximate
        const coords = _approxCoords(s.ville);
        if (!coords) continue;

        const color = s.score_global >= 70 ? '#059669' : s.score_global >= 40 ? '#d97706' : '#94a3b8';
        const marker = L.circleMarker(coords, {
          radius: 8,
          fillColor: color,
          color: '#fff',
          weight: 2,
          fillOpacity: 0.85,
        }).addTo(map);

        const sigLabels = (s.signaux || []).map(sig => '• ' + sig.label).join('<br>');
        marker.bindPopup(`
          <strong>${UI.escHtml(s.entreprise_nom)}</strong><br>
          Score: <strong>${s.score_global}/100</strong><br>
          ${sigLabels}
        `);
      }
    }, 100);
  }

  // Simple city→coords lookup (extends as needed, or uses Geocoder if loaded)
  function _approxCoords(ville) {
    const KNOWN = {
      'nantes': [47.218, -1.553], 'angers': [47.473, -0.554], 'le mans': [48.006, 0.199],
      'laval': [48.073, -0.771], 'la roche-sur-yon': [46.670, -1.427], 'saint-nazaire': [47.274, -2.213],
      'cholet': [47.060, -0.879], 'saumur': [47.260, -0.076],
      'paris': [48.856, 2.352], 'lyon': [45.764, 4.835], 'marseille': [43.296, 5.369],
      'toulouse': [43.604, 1.444], 'bordeaux': [44.837, -0.576], 'lille': [50.629, 3.057],
      'strasbourg': [48.573, 7.752], 'rennes': [48.117, -1.677], 'grenoble': [45.188, 5.724],
      'rouen': [49.443, 1.099], 'tours': [47.394, 0.684], 'dijon': [47.322, 5.041],
      'nice': [43.710, 7.262], 'montpellier': [43.611, 3.877], 'clermont-ferrand': [45.778, 3.087],
    };
    return KNOWN[ville.toLowerCase()] || null;
  }

  // ============================================================
  // UI — SIGNAL DETAIL MODAL
  // ============================================================

  function _showSignalDetail(signalId) {
    const s = _signaux?.find(x => x.id === signalId);
    if (!s) return;

    const sigList = (s.signaux || []).map(sig => {
      const t = SIGNAL_TYPES[sig.type] || {};
      return `
        <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
          <div style="font-weight:500;">${t.icon || ''} ${UI.escHtml(sig.label)}</div>
          <div style="font-size:0.8125rem;color:#64748b;">
            Source: ${sig.source} | Confiance: ${Math.round((sig.confiance || 0) * 100)}%
          </div>
          ${sig.extrait ? '<div style="font-size:0.8125rem;color:#475569;margin-top:2px;font-style:italic;">"' + UI.escHtml(sig.extrait) + '"</div>' : ''}
        </div>
      `;
    }).join('');

    const genHtml = s.generation?.hypothese_it ? `
      <h4 style="margin:12px 0 6px;">Contenu genere</h4>
      <div style="background:#f0fdf4;padding:10px;border-radius:6px;margin-bottom:8px;">
        <strong>Hypothese IT :</strong><br>${UI.escHtml(s.generation.hypothese_it)}
      </div>
      <div style="background:#eff6ff;padding:10px;border-radius:6px;margin-bottom:8px;">
        <strong>Angle d'approche :</strong><br>${UI.escHtml(s.generation.angle_approche)}
      </div>
      <div style="background:#fefce8;padding:10px;border-radius:6px;margin-bottom:8px;">
        <strong>Script d'appel :</strong><br><pre style="white-space:pre-wrap;font-size:0.8125rem;">${UI.escHtml(s.generation.script_appel)}</pre>
      </div>
      <div style="background:#faf5ff;padding:10px;border-radius:6px;margin-bottom:8px;">
        <strong>Message LinkedIn :</strong><br>${UI.escHtml(s.generation.message_linkedin)}
        <button class="btn btn-secondary se-copy-linkedin" style="font-size:0.6875rem;padding:2px 8px;margin-top:4px;">Copier</button>
      </div>
    ` : '<p style="color:#94a3b8;font-size:0.875rem;">Aucun contenu genere. Cliquez sur "Generer approche" pour creer.</p>';

    const articles = (s.donnees_scraping?.actualites || []).map(a => `
      <div style="padding:4px 0;font-size:0.8125rem;">
        <a href="${UI.escHtml(a.url)}" target="_blank" style="color:#3b82f6;">${UI.escHtml(a.titre)}</a>
        <span style="color:#94a3b8;">${a.date || ''}</span>
      </div>
    `).join('') || '<span style="color:#94a3b8;font-size:0.8125rem;">Aucun article</span>';

    const bodyHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <div style="font-size:0.8125rem;color:#64748b;">Score besoin DSI</div>
          <div style="font-size:1.5rem;font-weight:700;">${s.score_besoin_dsi}/100</div>
        </div>
        <div>
          <div style="font-size:0.8125rem;color:#64748b;">Score urgence</div>
          <div style="font-size:1.5rem;font-weight:700;">${s.score_urgence}/100</div>
        </div>
        <div>
          <div style="font-size:0.8125rem;color:#64748b;">Complexite SI</div>
          <div style="font-size:1.5rem;font-weight:700;">${s.score_complexite_si}/100</div>
        </div>
        <div>
          <div style="font-size:0.8125rem;color:#64748b;">Score global</div>
          <div style="font-size:1.5rem;font-weight:700;color:${s.score_global >= 70 ? '#059669' : s.score_global >= 40 ? '#d97706' : '#94a3b8'};">${s.score_global}/100</div>
        </div>
      </div>

      <h4 style="margin:12px 0 6px;">Signaux detectes</h4>
      ${sigList || '<p style="color:#94a3b8;">Aucun signal</p>'}

      <h4 style="margin:12px 0 6px;">Articles de presse</h4>
      ${articles}

      <p style="font-size:0.8125rem;color:#64748b;margin-top:8px;"><em>${UI.escHtml(s.notes || '')}</em></p>

      ${genHtml}
    `;

    UI.modal(s.entreprise_nom + ' — Detail signal', bodyHtml, { width: 700 });

    // Copy LinkedIn button
    setTimeout(() => {
      document.querySelector('.se-copy-linkedin')?.addEventListener('click', () => {
        if (s.generation?.message_linkedin) {
          navigator.clipboard.writeText(s.generation.message_linkedin);
          UI.toast('Message LinkedIn copie');
        }
      });
    }, 100);
  }

  // ============================================================
  // UI — ADD TO WATCHLIST MODAL
  // ============================================================

  function _showAddWatchlistModal(containerId) {
    // Show existing ATS entreprises for quick add + manual form
    const entreprises = Store.get('entreprises') || [];

    const entOptions = entreprises
      .filter(e => !(_watchlist || []).find(w => w.entreprise_id === e.id))
      .map(e => `<option value="${e.id}">${UI.escHtml(e.nom)}${e.localisation ? ' (' + e.localisation + ')' : ''}</option>`)
      .join('');

    const bodyHtml = `
      <div class="form-group">
        <label>Depuis les entreprises ATS</label>
        <select id="se-wl-ats-select" style="width:100%;">
          <option value="">— Selectionner —</option>
          ${entOptions}
        </select>
        <button class="btn btn-secondary" id="se-wl-ats-add" style="margin-top:6px;">Ajouter depuis ATS</button>
      </div>
      <hr style="margin:16px 0;border-color:#e2e8f0;">
      <div class="form-group">
        <label>Ajout manuel</label>
        <input type="text" id="se-wl-nom" placeholder="Nom de l'entreprise" />
        <input type="text" id="se-wl-siren" placeholder="SIREN (optionnel)" style="margin-top:4px;" />
        <input type="text" id="se-wl-site" placeholder="Site web (optionnel)" style="margin-top:4px;" />
        <input type="text" id="se-wl-cp" placeholder="Code postal" style="margin-top:4px;" />
        <input type="text" id="se-wl-ville" placeholder="Ville" style="margin-top:4px;" />
      </div>
    `;

    UI.modal('Ajouter a la watchlist', bodyHtml, {
      width: 500,
      saveLabel: 'Ajouter manuellement',
      onSave: async () => {
        const nom = document.getElementById('se-wl-nom')?.value?.trim();
        if (!nom) { UI.toast('Nom requis', 'error'); throw new Error('validation'); }

        await addToWatchlist({
          nom,
          siren: document.getElementById('se-wl-siren')?.value?.trim() || '',
          site_web: document.getElementById('se-wl-site')?.value?.trim() || '',
          code_postal: document.getElementById('se-wl-cp')?.value?.trim() || '',
          ville: document.getElementById('se-wl-ville')?.value?.trim() || '',
        });
        _watchlist = null;
        renderPage(containerId);
      },
    });

    setTimeout(() => {
      document.getElementById('se-wl-ats-add')?.addEventListener('click', async () => {
        const entId = document.getElementById('se-wl-ats-select')?.value;
        if (!entId) { UI.toast('Selectionnez une entreprise', 'error'); return; }
        await addFromATS(entId);
        _watchlist = null;
        // Close modal
        document.getElementById('modal-overlay')?.classList.remove('visible');
        renderPage(containerId);
      });
    }, 50);
  }

  // ============================================================
  // ACTIONS — Manual scan
  // ============================================================

  async function _runManualScan(containerId) {
    await _loadWatchlist();
    const config = await _loadConfig();
    const activeRegion = config.regions_actives?.[0];
    const toScan = _watchlist.filter(w => w.actif && (!activeRegion || w.region === activeRegion));

    if (!toScan.length) {
      UI.toast('Aucune entreprise a scanner dans cette region', 'error');
      return;
    }

    if (!CVParser.getOpenAIKey()) {
      UI.toast('Configurez votre cle OpenAI d\'abord', 'error');
      return;
    }

    UI.toast('Scan en cours... ' + toScan.length + ' entreprise(s)');

    await _loadSignaux();
    let count = 0;

    for (const wl of toScan) {
      try {
        const result = await analyseEntreprise(wl);

        // Update or add signal
        const existingIdx = _signaux.findIndex(s => s.entreprise_siren === wl.siren && wl.siren);
        if (existingIdx >= 0) {
          _signaux[existingIdx] = { ..._signaux[existingIdx], ...result, id: _signaux[existingIdx].id, date_creation: _signaux[existingIdx].date_creation };
        } else {
          _signaux.push(result);
        }

        // Update watchlist derniere_analyse
        wl.derniere_analyse = new Date().toISOString().split('T')[0];
        count++;
      } catch (e) {
        console.error('Scan error for ' + wl.nom + ':', e);
        UI.toast('Erreur scan ' + wl.nom + ': ' + (e.message || 'echec'), 'error');
      }
    }

    await _saveSignaux();
    await _saveWatchlist();

    UI.toast(count + '/' + toScan.length + ' entreprise(s) analysee(s) avec succes');
    _signaux = null;
    _watchlist = null;
    renderPage(containerId);
  }

  async function _scanOneEntreprise(watchlistId) {
    await _loadWatchlist();
    const wl = _watchlist.find(w => w.id === watchlistId);
    if (!wl) return;

    if (!CVParser.getOpenAIKey()) {
      UI.toast('Configurez votre cle OpenAI d\'abord', 'error');
      return;
    }

    UI.toast('Analyse de ' + wl.nom + '...');

    try {
      const result = await analyseEntreprise(wl);
      await _loadSignaux();

      const existingIdx = _signaux.findIndex(s => s.entreprise_siren === wl.siren && wl.siren);
      if (existingIdx >= 0) {
        _signaux[existingIdx] = { ..._signaux[existingIdx], ...result, id: _signaux[existingIdx].id };
      } else {
        _signaux.push(result);
      }

      wl.derniere_analyse = new Date().toISOString().split('T')[0];
      await _saveSignaux();
      await _saveWatchlist();

      UI.toast('Analyse terminee — Score: ' + result.score_global + '/100');
      _signaux = null;
      _watchlist = null;
      renderPage('signaux-content');
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  }

  async function _onGenerateApproche(signalId) {
    await _loadSignaux();
    const s = _signaux.find(x => x.id === signalId);
    if (!s) return;

    if (!CVParser.getOpenAIKey()) {
      UI.toast('Configurez votre cle OpenAI d\'abord', 'error');
      return;
    }

    UI.toast('Generation en cours...');

    try {
      const gen = await generateApproche(s);
      s.generation = {
        ...gen,
        date_generation: new Date().toISOString().split('T')[0],
      };
      await _saveSignaux();
      UI.toast('Contenu genere');
      _showSignalDetail(signalId);
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
    }
  }

  // ============================================================
  // WIDGET — Dashboard (for index.html)
  // ============================================================

  async function renderDashboardWidget(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const signaux = await API.fetchBin('signaux');
      if (!Array.isArray(signaux) || !signaux.length) {
        container.innerHTML = '<p style="color:#94a3b8;font-size:0.8125rem;">Aucun signal detecte. <a href="signaux.html" style="color:#3b82f6;">Configurer le Signal Engine</a></p>';
        return;
      }

      const top5 = signaux
        .filter(s => s.score_global >= 50)
        .sort((a, b) => b.score_global - a.score_global)
        .slice(0, 5);

      if (!top5.length) {
        container.innerHTML = '<p style="color:#94a3b8;font-size:0.8125rem;">Aucun signal fort. <a href="signaux.html" style="color:#3b82f6;">Voir tous les signaux</a></p>';
        return;
      }

      container.innerHTML = top5.map(s => {
        const scoreColor = s.score_global >= 70 ? '#059669' : '#d97706';
        const mainSignal = s.signaux?.[0];
        const typeInfo = mainSignal ? SIGNAL_TYPES[mainSignal.type] : null;
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:1.1rem;">${typeInfo?.icon || '📊'}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:500;font-size:0.8125rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${UI.escHtml(s.entreprise_nom)}</div>
              <div style="font-size:0.75rem;color:#64748b;">${mainSignal ? UI.escHtml(mainSignal.label).substring(0, 50) : ''}</div>
            </div>
            <span style="font-weight:700;color:${scoreColor};font-size:0.875rem;">${s.score_global}</span>
          </div>
        `;
      }).join('') + `<div style="text-align:right;margin-top:8px;"><a href="signaux.html" style="color:#3b82f6;font-size:0.8125rem;">Voir tout →</a></div>`;
    } catch {
      container.innerHTML = '';
    }
  }

  // ============================================================
  // WIDGET — Entreprise page (for entreprise.html)
  // ============================================================

  async function renderEntrepriseWidget(containerId, entrepriseId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const signaux = await API.fetchBin('signaux');
      if (!Array.isArray(signaux)) return;

      const matching = signaux.filter(s => s.entreprise_id === entrepriseId);
      if (!matching.length) {
        container.innerHTML = `
          <div style="padding:12px;background:#f8fafc;border-radius:8px;">
            <div style="font-weight:500;font-size:0.875rem;margin-bottom:4px;">Signal Engine</div>
            <p style="font-size:0.8125rem;color:#94a3b8;margin:0;">Pas de signaux. <button class="btn btn-secondary se-add-watch-ent" style="font-size:0.6875rem;padding:2px 8px;">Ajouter a la watchlist</button></p>
          </div>`;
        container.querySelector('.se-add-watch-ent')?.addEventListener('click', async () => {
          await addFromATS(entrepriseId);
          UI.toast('Ajoutee. Lancez un scan depuis la page Signaux.');
        });
        return;
      }

      const s = matching.sort((a, b) => b.score_global - a.score_global)[0];
      const scoreColor = s.score_global >= 70 ? '#059669' : s.score_global >= 40 ? '#d97706' : '#94a3b8';
      const sigLabels = (s.signaux || []).map(sig => {
        const t = SIGNAL_TYPES[sig.type] || {};
        return `<span style="font-size:0.8125rem;">${t.icon || ''} ${UI.escHtml(sig.label)}</span>`;
      }).join('<br>');

      container.innerHTML = `
        <div style="padding:12px;background:#f0fdf4;border-radius:8px;border-left:4px solid ${scoreColor};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="font-weight:500;font-size:0.875rem;">Signal Engine</div>
            <span style="font-weight:700;color:${scoreColor};">${s.score_global}/100</span>
          </div>
          ${sigLabels}
          <div style="margin-top:6px;">
            <a href="signaux.html" style="color:#3b82f6;font-size:0.8125rem;">Voir dans Signal Engine →</a>
          </div>
        </div>`;
    } catch {
      // Silent fail
    }
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    renderPage,
    renderDashboardWidget,
    renderEntrepriseWidget,
    addToWatchlist,
    addFromATS,
    removeFromWatchlist,
    analyseEntreprise,
    generateApproche,
    SIGNAL_TYPES,
  };

})();
