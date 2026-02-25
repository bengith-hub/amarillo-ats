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
    nomination:          { label: 'Nomination / Gouvernance',  icon: '👔', color: '#b45309' },
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

  // Geographic/generic terms that commonly cause search disambiguation issues
  const GEO_GENERIC_TERMS = /^(bocage|plaine|vallee|vallon|foret|coteau|marais|campagne|prairie|colline|source|riviere|cascade|domaine|terroir|verger|moulin|hameau|clos|jardin|fontaine|chapelle|bastide|manoir|chateau|abbaye|prieure|grange|ferme|maison|atelier|comptoir|fabrique|forge|halle|halles|place|pont|port|cap|ile|mont|pic|roche|pierre|vent|soleil|lune|etoile|horizon|aurore|nature|terre|mer|lac|nord|sud|est|ouest|sommet|crete|corniche|arbre|chene|pin|sapin|cedre|erable|peuplier|tilleul|olivier|vigne)s?$/i;

  // Extended geo context terms found in articles about landscape/nature (not business)
  const GEO_CONTEXT_TERMS = /\b(paysage|paysages|biodiversit[eé]|haies?\b|bocag[eè]re?s?|faune|flore|[eé]cologique|[eé]cosyst[eè]me|habitat naturel|zone naturelle|randonnée|sentier|ornitholog|agricole|parcelle|prairie|p[aâ]turage|zone humide|protection|conservation|environnement)\b/i;

  // Detect if a company name is likely ambiguous (common word that generates false positives)
  function _isAmbiguousName(nom) {
    if (!nom) return false;
    const lower = nom.toLowerCase().trim();
    const words = lower.split(/\s+/);
    // Multi-word names (3+) are rarely ambiguous
    if (words.length > 2) return false;
    // Check each word against known geo/generic terms
    return words.some(w => w.length > 2 && GEO_GENERIC_TERMS.test(w));
  }

  // ============================================================
  // STATE
  // ============================================================

  let _config = null;
  let _watchlist = null;
  let _signaux = null;
  let _activeTab = 'signaux';
  let _filters = { score: null, type: null, departement: null };

  // Auto-scan & notifications
  const AUTO_SCAN_INTERVAL_DAYS = 7;
  let _autoScanRunning = false;

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
    // Auto-dedup watchlist on load (cleanup legacy duplicates)
    _watchlist = _dedup(_watchlist, w => w.nom?.toLowerCase().trim());
    // Auto-repair: ensure every entry has an id (fixes legacy data without ids)
    let repaired = false;
    for (const w of _watchlist) {
      if (!w.id) {
        w.id = 'wl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        repaired = true;
      }
    }
    if (repaired) {
      console.log('[SignalEngine] Repaired missing ids in watchlist');
      await _saveWatchlist();
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
    // Auto-dedup signals on load (keep most recent by date_mise_a_jour)
    _signaux = _dedup(_signaux, s => s.entreprise_nom?.toLowerCase().trim());
    return _signaux;
  }

  function _dedup(arr, keyFn) {
    const seen = new Map();
    for (const item of arr) {
      const key = keyFn(item);
      if (!key) { seen.set(Symbol(), item); continue; }
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, item);
      } else {
        // Keep the one with the most data (more recent or more filled)
        const existingDate = existing.date_mise_a_jour || existing.date_ajout || '';
        const itemDate = item.date_mise_a_jour || item.date_ajout || '';
        if (itemDate > existingDate) seen.set(key, item);
      }
    }
    return [...seen.values()];
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
    let lastStatus = 0;
    for (const proxy of CORS_PROXIES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(proxy.buildUrl(url), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          lastStatus = response.status;
          // Only log non-404 errors (404s are expected for probing paths like /news)
          if (response.status !== 404) {
            console.warn('[SignalEngine] Proxy ' + proxy.name + ' returned ' + response.status + ' for ' + url);
          }
          continue;
        }
        const raw = await response.text();
        if (!raw) continue;
        const result = proxy.parseHtml(raw);
        if (result) return result;
      } catch (e) {
        // Suppress CORS/abort noise — only log unexpected errors
        if (e.name !== 'AbortError' && !e.message?.includes('CORS')) {
          console.warn('[SignalEngine] Proxy ' + proxy.name + ' failed for ' + url + ':', e.message || 'error');
        }
      }
    }
    // Only log "all proxies failed" for non-404 cases (404 = page simply doesn't exist)
    if (lastStatus !== 404) {
      console.warn('[SignalEngine] All proxies failed for ' + url);
    }
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

    // Phase 1: Scrape homepage first (always needed)
    const homeResult = await _fetchPageTextWithLinks(baseUrl, baseUrl);

    const parts = [];
    const articleLinks = [];
    if (homeResult?.text) {
      parts.push('ACCUEIL:\n' + homeResult.text);
      if (homeResult.links) articleLinks.push(...homeResult.links);
    }

    // Phase 1b: Only try /actualites and /news if the homepage suggests they exist
    // (i.e. the homepage HTML contains links or mentions of these sections)
    const homeHtml = (homeResult?.text || '').toLowerCase();
    const hasActuLink = homeHtml.includes('actualit') || homeHtml.includes('/actualites') || homeHtml.includes('/news');

    if (hasActuLink) {
      const extraPaths = ['/actualites', '/news'];
      const extraResults = await Promise.allSettled(
        extraPaths.map(p => _fetchPageTextWithLinks(baseUrl + p, baseUrl))
      );
      const extraLabels = ['ACTUALITES', 'NEWS'];
      extraResults.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value?.text) {
          parts.push(extraLabels[i] + ':\n' + r.value.text);
          if (r.value.links) articleLinks.push(...r.value.links);
        }
      });
    }

    // Phase 1c: Only try subdomains if /actualites was not found AND
    // the homepage references subdomains (e.g., links to corporate.xxx.fr)
    const hasActuContent = parts.some(p => p.startsWith('ACTUALITES:'));
    if (!hasActuContent && homeResult?.text) {
      try {
        const parsedUrl = new URL(baseUrl);
        const domain = parsedUrl.hostname.replace(/^www\./, '');
        // Only try subdomains if the homepage actually references them
        const subdomains = ['corporate', 'pro'].filter(sub => {
          return homeHtml.includes(sub + '.' + domain) && !parsedUrl.hostname.startsWith(sub + '.');
        });
        for (const sub of subdomains.slice(0, 1)) {
          const subUrl = `${parsedUrl.protocol}//${sub}.${domain}`;
          const subResult = await _fetchPageTextWithLinks(subUrl + '/actualites', subUrl);
          if (subResult?.text?.length > 50) {
            parts.push('ACTUALITES_' + sub.toUpperCase() + ':\n' + subResult.text);
            if (subResult.links) articleLinks.push(...subResult.links);
            console.log('[SignalEngine] Found /actualites on subdomain ' + sub + '.' + domain);
            break;
          }
        }
      } catch { /* best effort */ }
    }

    // Phase 2: Follow up to 3 article links found on /actualites or /news pages
    if (articleLinks.length > 0) {
      const uniqueLinks = [...new Set(articleLinks)].slice(0, 3);
      const articleResults = await Promise.allSettled(
        uniqueLinks.map(link => _fetchPageText(link))
      );
      articleResults.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value && r.value.length > 100) {
          parts.push('ARTICLE_' + (i + 1) + ':\n' + r.value);
        }
      });
    }

    return { site_texte: parts.join('\n\n'), offres_emploi: [] };
  }

  // Fetch page text AND extract article-like links (for following /actualites pages)
  async function _fetchPageTextWithLinks(url, baseUrl) {
    try {
      const html = await _fetchViaProxy(url, 10000);
      if (!html) return null;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract article links before stripping elements
      const links = [];
      const articleKeywords = /actual|news|article|blog|communique|presse|gouvernance|nomination|direction/i;
      doc.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (!href || href === '/' || href === '#') return;
        // Only keep links that look like article pages (deeper paths)
        const fullUrl = href.startsWith('http') ? href : (baseUrl + (href.startsWith('/') ? '' : '/') + href);
        const pathParts = new URL(fullUrl, baseUrl).pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2 && articleKeywords.test(fullUrl)) {
          links.push(fullUrl);
        }
      });

      doc.querySelectorAll('script, style, svg, noscript, iframe, link, meta').forEach(el => el.remove());
      let text = doc.body?.textContent || '';
      text = text.replace(/[\t\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').replace(/ {2,}/g, ' ').trim();
      if (text.length > 3000) text = text.substring(0, 3000) + '...';

      return { text, links };
    } catch {
      return null;
    }
  }

  // ============================================================
  // SCRAPING — Google News RSS
  // ============================================================

  async function _scrapeGoogleNews(entrepriseNom, region, ville, extra) {
    try {
      const { nomOfficiel, libelleNaf, pappers, siteWeb } = extra || {};
      const ambiguous = _isAmbiguousName(entrepriseNom);

      // ── For ambiguous names: use MULTIPLE targeted queries in parallel ──
      if (ambiguous) {
        console.log('[SignalEngine] Ambiguous name "' + entrepriseNom + '" — launching multi-query strategy');
        const queries = [];

        // Query 1: Official name + sector (e.g. "BOCAGE SAS" chaussures)
        if (nomOfficiel && nomOfficiel.toLowerCase() !== entrepriseNom.toLowerCase()) {
          const sectorWords = libelleNaf ? libelleNaf.split(/[\s,/]+/).filter(w => w.length > 4).slice(0, 2).join(' OR ') : '';
          const q1 = `"${nomOfficiel}" ${sectorWords}`;
          queries.push({ label: 'officiel+secteur', query: q1 });
        }

        // Query 2: Name + lead executive name (powerful disambiguator)
        const dirigeants = pappers?.dirigeants || [];
        const topDirigeant = dirigeants.find(d => /PDG|Directeur|Gérant|Président|DG\b/i.test(d.fonction)) || dirigeants[0];
        if (topDirigeant?.nom) {
          const q2 = `"${entrepriseNom}" "${topDirigeant.nom}"`;
          queries.push({ label: 'nom+dirigeant', query: q2 });
        }

        // Query 3: Website domain (uniquely identifies the company)
        if (siteWeb) {
          const domain = siteWeb.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
          if (domain && domain.length > 3) {
            const q3 = `${domain} investissement OR recrutement OR nomination OR croissance OR acquisition`;
            queries.push({ label: 'domaine', query: q3 });
          }
        }

        // Query 4: Fallback — name + city + sector (improved version of original)
        if (ville) {
          const sectorKeywords = libelleNaf ? libelleNaf.split(/[\s,/]+/).filter(w => w.length > 4).slice(0, 2).join(' OR ') : '';
          const sectorClause = sectorKeywords ? `(${sectorKeywords})` : 'entreprise';
          const q4 = `"${entrepriseNom}" "${ville}" ${sectorClause}`;
          queries.push({ label: 'nom+ville+secteur', query: q4 });
        }

        if (queries.length === 0) {
          // No disambiguation data available — fall through to standard query below
          console.warn('[SignalEngine] No disambiguation data for "' + entrepriseNom + '" — using standard query');
        } else {
          // Launch all queries in parallel, collect results
          const allArticles = [];
          const rssResults = await Promise.allSettled(
            queries.map(q => _fetchGoogleNewsRSS(q.query, 3))
          );

          rssResults.forEach((r, i) => {
            if (r.status === 'fulfilled' && r.value.length > 0) {
              console.log('[SignalEngine] Multi-query "' + queries[i].label + '": ' + r.value.length + ' articles');
              allArticles.push(...r.value);
            }
          });

          // Deduplicate by normalized title
          const deduped = _deduplicateArticles(allArticles);
          console.log('[SignalEngine] Ambiguous multi-query for "' + entrepriseNom + '": ' + queries.length + ' queries, ' + allArticles.length + ' raw → ' + deduped.length + ' unique articles');

          // Enrich articles content (best effort)
          await _enrichArticlesContent(deduped);
          return deduped;
        }
      }

      // ── Standard single query for non-ambiguous names ──
      let searchName = entrepriseNom;
      if (nomOfficiel && nomOfficiel.length > entrepriseNom.length + 2) {
        searchName = nomOfficiel;
      }

      const sectorKeywords = libelleNaf ? libelleNaf.split(/[\s,/]+/).filter(w => w.length > 4).slice(0, 3).join(' OR ') : '';
      const sectorClause = sectorKeywords ? `(${sectorKeywords}) OR` : '';
      const villeClause = ville ? `"${ville}" OR` : '';
      const query = `"${searchName}" ${villeClause} ${sectorClause} investissement OR industrie OR nomination OR direction OR cession OR acquisition OR croissance OR recrutement OR transformation ${region || ''}`;

      const articles = await _fetchGoogleNewsRSS(query, 5);
      await _enrichArticlesContent(articles);
      return articles;
    } catch {
      return [];
    }
  }

  // Fetch Google News RSS for a given query string, return up to maxResults articles
  async function _fetchGoogleNewsRSS(queryStr, maxResults) {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryStr)}&hl=fr&gl=FR&ceid=FR:fr`;
    const xmlText = await _fetchViaProxy(rssUrl, 10000);
    if (!xmlText) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const items = doc.querySelectorAll('item');

    const articles = [];
    items.forEach((item, i) => {
      if (i >= maxResults) return;
      const titre = item.querySelector('title')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
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
  }

  // Deduplicate articles by normalized title (keeps the one with richer content)
  function _deduplicateArticles(articles) {
    const seen = new Map();
    for (const article of articles) {
      const key = (article.titre || '').toLowerCase().replace(/[^a-z0-9àâéèêëïîôùûüç]+/g, ' ').trim();
      if (!key) continue;
      const existing = seen.get(key);
      if (!existing || (article.enriched && !existing.enriched) || (article.extrait || '').length > (existing.extrait || '').length) {
        seen.set(key, article);
      }
    }
    return [...seen.values()];
  }

  // Fetch full article content for richer AI analysis (best effort, parallel)
  async function _enrichArticlesContent(articles) {
    const enrichPromises = articles.slice(0, 3).map(async (article, i) => {
      try {
        if (!article.url) return;
        const fullText = await _fetchPageText(article.url);
        if (fullText && fullText.length > article.extrait.length) {
          // Keep enriched content (truncated to reasonable length for AI)
          article.extrait = fullText.substring(0, 1500);
          article.enriched = true;
        }
      } catch { /* best effort — keep RSS description */ }
    });
    await Promise.allSettled(enrichPromises);
  }

  // Post-filter: discard articles that are clearly NOT about the target company
  // This is critical for generic company names like "Bocage" (also a geographic term)
  function _filterRelevantArticles(articles, nom, nomOfficiel, ville, libelleNaf) {
    if (!articles || articles.length === 0) return [];

    const nomLower = nom.toLowerCase();
    const nomWords = nomLower.split(/\s+/).filter(w => w.length > 2);
    const ambiguous = _isAmbiguousName(nom);

    // Build relevance keywords: company name variations, city, NAF terms
    const relevanceTerms = [...nomWords];
    if (nomOfficiel) {
      nomOfficiel.toLowerCase().split(/\s+/).filter(w => w.length > 3).forEach(w => relevanceTerms.push(w));
    }
    if (ville) relevanceTerms.push(ville.toLowerCase());
    if (libelleNaf) {
      libelleNaf.toLowerCase().split(/[\s,/]+/).filter(w => w.length > 4).forEach(w => relevanceTerms.push(w));
    }

    // Corporate/business terms
    const businessTerms = /entreprise|societe|société|groupe|sas\b|sarl\b|investissement|recrutement|nomination|acquisition|chiffre d'affaires|effectif|site industriel|site de production|filiale|direction|PDG|directeur|g[eé]rant/i;

    // Brand/commercial terms: broader context that indicates the article is about a company or brand
    const brandTerms = /\b(marque|enseigne|boutique|magasin|collection|ouverture|fermeture|vente|client|consommateur|franchise|r[eé]seau|commerce|retail|chiffre|ca\b|employ[eé]|salari[eé]|siège|usine|atelier|fabrication|production|fournisseur|partenaire|concurrent|secteur|industrie|activit[eé])\b/i;

    // Check if NAF sector terms appear in the article (e.g. "chaussure" for Bocage)
    const hasNafTerms = (text) => {
      if (!libelleNaf) return false;
      const nafWords = libelleNaf.toLowerCase().split(/[\s,/]+/).filter(w => w.length > 4);
      return nafWords.some(w => text.includes(w));
    };

    return articles.filter(article => {
      const text = ((article.titre || '') + ' ' + (article.extrait || '')).toLowerCase();

      const mentionsName = text.includes(nomLower) || (nomOfficiel && text.includes(nomOfficiel.toLowerCase()));
      const hasBusinessContext = businessTerms.test(text);
      const hasBrandContext = brandTerms.test(text);
      const hasGeoContext = GEO_CONTEXT_TERMS.test(text);
      const hasCompanyContext = hasBusinessContext || hasBrandContext || hasNafTerms(text);

      // If the article contains the company name in a business/brand context, keep it
      if (mentionsName && hasCompanyContext) return true;

      // If article mentions city + any company-related term, keep it
      if (ville && text.includes(ville.toLowerCase())) {
        if (hasCompanyContext) return true;
      }

      // For ambiguous names: apply strict filtering
      if (ambiguous) {
        // Discard if geo/nature context detected without any company context
        if (hasGeoContext && !hasCompanyContext) return false;
        // For ambiguous names, require at least some company context
        if (!hasCompanyContext) return false;
      }

      // Discard if geo context detected and no company context
      if (hasGeoContext && !hasCompanyContext) return false;

      // If article is enriched (full content) and doesn't mention the name at all, discard
      if (article.enriched && !mentionsName) return false;

      // For non-ambiguous names: keep by default for non-enriched articles
      return true;
    });
  }

  // ============================================================
  // SCRAPING — Google Search (web results, not just news)
  // ============================================================

  async function _scrapeGoogleSearch(entrepriseNom, region, extra) {
    try {
      const { ville, nomOfficiel, libelleNaf } = extra || {};
      const ambiguous = _isAmbiguousName(entrepriseNom);

      // Use official name for ambiguous company names
      let searchName = entrepriseNom;
      if (ambiguous && nomOfficiel && nomOfficiel !== entrepriseNom) {
        searchName = nomOfficiel;
      }

      // Build disambiguation terms
      const villeStr = ville ? `"${ville}"` : '';
      const sectorStr = libelleNaf ? libelleNaf.split(/[\s,/]+/).filter(w => w.length > 4).slice(0, 2).join(' ') : '';
      const exclusions = ambiguous ? ' -paysage -biodiversite -haie -ecologique -randonnee' : '';

      const query = encodeURIComponent(`"${searchName}" ${villeStr} ${sectorStr} entreprise activite ${region || ''}${exclusions}`);
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

  async function _detectSignaux(entrepriseNom, siteTexte, articles, pappers, extra) {
    const { nomOfficiel, ville, libelleNaf } = extra || {};
    const identityClause = [
      nomOfficiel ? `Nom officiel: "${nomOfficiel}"` : '',
      ville ? `Ville: ${ville}` : '',
      libelleNaf ? `Secteur: ${libelleNaf}` : '',
    ].filter(Boolean).join(', ');

    const system = `Tu es un analyste business specialise dans la detection de signaux declencheurs de besoins en DSI (Directeur des Systemes d'Information) pour tout type d'entreprise.

Analyse TOUTES les donnees fournies (site web, articles de presse, donnees Pappers) et detecte le maximum de signaux pertinents parmi :
- investissement : Investissement significatif, levee de fonds, nouveau projet, demenagement, nouveaux locaux
- expansion : Extension multi-sites, ouverture de filiales, nouveaux bureaux, croissance geographique
- erp_mes : Projet ERP, SAP, MES, CRM, transformation digitale, migration SI, cybersecurite, cloud
- croissance : Croissance du CA, augmentation des effectifs, nouveaux clients, nouveaux contrats importants
- rachat_lbo : Rachat, acquisition, LBO, fusion, cession, changement d'actionnariat
- internationalisation : Expansion internationale, export, nouveaux marches etrangers
- recrutement_it : Recrutement IT, DSI, CTO, developpeurs, postes tech ouverts
- nomination : Nomination d'un nouveau PDG, DG, DAF, DSI, directeur, changement de gouvernance, nouvelle equipe de direction

IMPORTANT :
- Sois EXHAUSTIF : detecte tout signal meme faible ou indirect. Un recrutement, un demenagement, un nouveau client important sont des signaux.
- Analyse CHAQUE article de presse individuellement — chacun peut contenir un signal different.
- Si le site web mentionne des projets, actualites ou recrutements, ce sont des signaux.
- Meme des indices faibles (nouvelle certification, nouveau partenariat, prix recu) meritent d'etre mentionnes avec une confiance basse.
- ATTENTION HOMONYMES : Le nom "${entrepriseNom}" peut etre un terme courant (geographique, generique). IGNORE tout article qui parle d'un lieu, d'une region, ou d'une autre entite portant ce nom. Ne retiens QUE les articles qui parlent clairement de L'ENTREPRISE ciblee (${identityClause || entrepriseNom}).

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

Si vraiment AUCUNE information exploitable n'est disponible, retourne {"signaux":[],"score_besoin_dsi":10,"score_urgence":5,"score_complexite_si":5,"justification":"Aucune donnee exploitable trouvee."}`;

    const articlesSummary = (articles || []).map(a => `[${a.date}] ${a.titre}\n${a.extrait}`).join('\n\n');

    const user = `ENTREPRISE: ${entrepriseNom}${nomOfficiel && nomOfficiel !== entrepriseNom ? ' (nom officiel: ' + nomOfficiel + ')' : ''}
${ville ? 'VILLE: ' + ville : ''}

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
        case 'nomination': score += 20; break;
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
    // Reuse previously persisted Pappers data to avoid redundant lookups
    let nomOfficiel = watchlistEntry.nom_officiel || '';
    let libelleNaf = watchlistEntry.libelle_naf || '';
    let watchlistDirty = false;

    // 0. Auto-enrich via Pappers name search (BEFORE news scraping for disambiguation)
    if (!siren || !siteWeb) {
      const lookup = await _searchPappersByName(nom, watchlistEntry.ville);
      if (lookup) {
        if (!siren && lookup.siren) {
          siren = lookup.siren;
          watchlistEntry.siren = siren;
          watchlistDirty = true;
          console.log('[SignalEngine] Auto-found SIREN for ' + nom + ': ' + siren);
        }
        if (!siteWeb && lookup.site_web) {
          siteWeb = lookup.site_web;
          watchlistEntry.site_web = siteWeb;
          watchlistDirty = true;
          console.log('[SignalEngine] Auto-found site_web for ' + nom + ': ' + siteWeb);
        }
        if (!nomOfficiel && lookup.nom_officiel) {
          nomOfficiel = lookup.nom_officiel;
        }
        if (!libelleNaf && lookup.libelle_naf) {
          libelleNaf = lookup.libelle_naf;
        }
      }
    }

    // 0b. Enrich Pappers early so we can use libelle_naf for Google News query
    const pappers = siren ? await _enrichPappers(siren) : null;
    if (pappers?.libelle_naf && !libelleNaf) libelleNaf = pappers.libelle_naf;

    // If Pappers found a site_web and we didn't have one, use it
    if (pappers?.site_web && !siteWeb) {
      siteWeb = pappers.site_web;
      watchlistEntry.site_web = siteWeb;
      watchlistDirty = true;
    }

    // Persist enriched Pappers data (SIREN, nom_officiel, libelle_naf) in watchlist
    // so subsequent analyses don't need to re-search Pappers by name
    if (nomOfficiel && !watchlistEntry.nom_officiel) {
      watchlistEntry.nom_officiel = nomOfficiel;
      watchlistDirty = true;
    }
    if (libelleNaf && !watchlistEntry.libelle_naf) {
      watchlistEntry.libelle_naf = libelleNaf;
      watchlistDirty = true;
    }
    if (watchlistDirty) {
      await _saveWatchlist();
      console.log('[SignalEngine] Persisted enriched data for ' + nom + ' (SIREN=' + siren + ', officiel=' + nomOfficiel + ')');
    }

    // 1. Scrape site + Google News + Google Search in parallel
    const ville = watchlistEntry.ville || '';
    const [siteData, articles, searchContext] = await Promise.all([
      _scrapeSite(siteWeb),
      _scrapeGoogleNews(nom, region, ville, { nomOfficiel, libelleNaf, pappers, siteWeb }),
      _scrapeGoogleSearch(nom, region, { ville, nomOfficiel, libelleNaf }),
    ]);

    // Post-filter articles: discard those clearly not about this company
    const filteredArticles = _filterRelevantArticles(articles, nom, nomOfficiel, ville, libelleNaf);
    if (filteredArticles.length < articles.length) {
      console.log('[SignalEngine] Filtered ' + (articles.length - filteredArticles.length) + '/' + articles.length + ' irrelevant articles for "' + nom + '"');
    }

    // For ambiguous names: clean searchContext to remove paragraphs about the geographic term
    let cleanedSearchContext = searchContext;
    if (_isAmbiguousName(nom) && searchContext) {
      const paragraphs = searchContext.split('\n');
      const filtered = paragraphs.filter(p => {
        if (p.trim().length < 20) return true; // keep short lines (headers, etc.)
        const hasGeo = GEO_CONTEXT_TERMS.test(p);
        const hasBusiness = /entreprise|societe|société|groupe|investissement|recrutement|nomination|acquisition|chiffre|effectif|filiale|direction/i.test(p);
        // Discard paragraphs with geo context and no business context
        return !hasGeo || hasBusiness;
      });
      cleanedSearchContext = filtered.join('\n');
      if (cleanedSearchContext.length < searchContext.length * 0.5) {
        console.log('[SignalEngine] Cleaned ' + Math.round((1 - cleanedSearchContext.length / searchContext.length) * 100) + '% of search context for ambiguous name "' + nom + '"');
      }
    }

    // Combine all text sources
    const allText = [siteData.site_texte, cleanedSearchContext].filter(Boolean).join('\n\n');

    // 3. Detect signals via OpenAI
    const aiResult = await _detectSignaux(nom, allText, filteredArticles, pappers, { nomOfficiel, ville, libelleNaf });

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
        actualites: filteredArticles,
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
    // Find the entry before removing (to also remove its signal)
    const entry = _watchlist.find(w => w.id === id);
    _watchlist = _watchlist.filter(w => w.id !== id);
    await _saveWatchlist();

    // Also remove the associated signal record
    if (entry) {
      await _loadSignaux();
      const prevLen = _signaux.length;
      _signaux = _signaux.filter(s =>
        !(
          (entry.entreprise_id && s.entreprise_id === entry.entreprise_id) ||
          (entry.siren && s.entreprise_siren === entry.siren) ||
          (s.entreprise_nom?.toLowerCase() === entry.nom?.toLowerCase())
        )
      );
      if (_signaux.length < prevLen) {
        await _saveSignaux();
        console.log('[SignalEngine] Removed signal for "' + entry.nom + '"');
      }
    }
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
        <div style="display:flex;gap:8px;align-items:center;">
          <div id="se-notif-bell-container">${_renderNotificationBell(signaux)}</div>
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

      ${_renderAutoScanStatus(config)}

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

    // Notification bell listener
    _attachBellListener(signaux);

    // Nav badge
    _updateNavBadge(_getNewSignauxCount(signaux));

    // Auto-scan check (delayed to not block page render)
    setTimeout(() => _checkAutoScan(containerId), 2000);
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

    const hasArticles = (s.donnees_scraping?.actualites || []).length > 0;
    const hasSiteText = !!(s.donnees_scraping?.site_texte);
    const hasData = hasArticles || hasSiteText || s.donnees_pappers?.ca;
    const hasDataButNoSignals = hasData && (s.signaux || []).length === 0;

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
          ${hasDataButNoSignals ? '<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:6px 10px;font-size:0.8125rem;color:#92400e;margin-bottom:8px;">Des donnees sont disponibles mais aucun signal detecte — un re-scan avec le moteur ameliore est recommande.</div>' : ''}
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
        try {
          btn.disabled = true;
          btn.textContent = '...';
          await removeFromWatchlist(btn.dataset.id);
          _watchlist = null;
          _signaux = null;
          await renderPage('signaux-content');
        } catch (e) {
          console.error('[SignalEngine] Remove failed:', e);
          UI.toast('Erreur lors de la suppression: ' + e.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Retirer';
        }
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
    container.innerHTML = `
      <div style="font-size:0.8125rem;color:#64748b;margin-bottom:8px;">Geocodage de ${signaux.length} signal(s)...</div>
      <div id="se-map" style="height:500px;border-radius:8px;overflow:hidden;"></div>
    `;

    // Wait for DOM then init Leaflet
    setTimeout(async () => {
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

      // Geocode and add markers for each signal
      let placed = 0;
      for (const s of signaux) {
        if (!s.ville && !s.code_postal) continue;

        // Try geocoding: ville + code_postal for precision
        const locationStr = [s.ville, s.code_postal].filter(Boolean).join(' ');
        let coords = _approxCoords(s.ville);

        // Use Geocoder API for unknown cities
        if (!coords && typeof Geocoder !== 'undefined') {
          try {
            const geo = await Geocoder.geocodeLocation(locationStr);
            if (geo) coords = [geo.lat, geo.lng];
          } catch { /* fallback: skip */ }
        }

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
          ${sigLabels || '<em>Aucun signal</em>'}
        `);
        placed++;
      }

      // Update status
      const statusEl = container.querySelector('div:first-child');
      if (statusEl) statusEl.textContent = placed + '/' + signaux.length + ' entreprise(s) placee(s) sur la carte';
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

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;gap:8px;">
        <button class="btn btn-primary se-btn-rescan-detail" data-siren="${UI.escHtml(s.entreprise_siren || '')}" data-nom="${UI.escHtml(s.entreprise_nom)}" style="font-size:0.8125rem;">Re-scanner cette entreprise</button>
      </div>
    `;

    UI.modal(s.entreprise_nom + ' — Detail signal', bodyHtml, { width: 700 });

    // Copy LinkedIn button + rescan button
    setTimeout(() => {
      document.querySelector('.se-copy-linkedin')?.addEventListener('click', () => {
        if (s.generation?.message_linkedin) {
          navigator.clipboard.writeText(s.generation.message_linkedin);
          UI.toast('Message LinkedIn copie');
        }
      });
      document.querySelector('.se-btn-rescan-detail')?.addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Scan en cours...';
        // Find watchlist entry for this signal
        await _loadWatchlist();
        const wl = _watchlist.find(w =>
          (s.entreprise_id && w.entreprise_id === s.entreprise_id) ||
          (s.entreprise_siren && w.siren === s.entreprise_siren) ||
          (w.nom.toLowerCase() === s.entreprise_nom.toLowerCase())
        );
        if (!wl) { UI.toast('Entreprise non trouvee dans la watchlist', 'error'); return; }
        await _scanOneEntreprise(wl.id);
        // Close modal
        document.getElementById('modal-overlay')?.classList.remove('visible');
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

  function _upsertSignal(result, watchlistEntry) {
    // Find existing signal: by entreprise_id, then SIREN, then nom (case-insensitive)
    const existingIdx = _signaux.findIndex(s =>
      (watchlistEntry.entreprise_id && s.entreprise_id === watchlistEntry.entreprise_id) ||
      (watchlistEntry.siren && s.entreprise_siren === watchlistEntry.siren) ||
      (s.entreprise_nom.toLowerCase() === watchlistEntry.nom.toLowerCase())
    );
    if (existingIdx >= 0) {
      // Preserve original id and creation date
      _signaux[existingIdx] = { ...result, id: _signaux[existingIdx].id, date_creation: _signaux[existingIdx].date_creation };
    } else {
      _signaux.push(result);
    }
  }

  function _showScanProgress(containerId, current, total, currentName, status) {
    let bar = document.getElementById('se-scan-progress');
    if (!bar) {
      const div = document.createElement('div');
      div.id = 'se-scan-progress';
      div.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border-radius:12px;padding:16px 20px;min-width:340px;max-width:420px;box-shadow:0 8px 24px rgba(30,64,175,0.4);font-family:Inter,sans-serif;';
      document.body.appendChild(div);
      bar = div;
    }
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const dots = status === 'running' ? '<span class="se-scan-dots"></span>' : '';
    bar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-weight:600;font-size:0.9375rem;">
          ${status === 'running' ? 'Scan en cours' + dots : status === 'done' ? 'Scan termine' : 'Scan interrompu'}
        </div>
        <div style="font-size:0.8125rem;opacity:0.9;">${current}/${total}</div>
      </div>
      <div style="background:rgba(255,255,255,0.25);border-radius:6px;height:8px;overflow:hidden;">
        <div style="background:#fff;height:100%;border-radius:6px;width:${pct}%;transition:width 0.4s ease;"></div>
      </div>
      ${currentName ? '<div style="font-size:0.8125rem;margin-top:6px;opacity:0.85;">Analyse: ' + UI.escHtml(currentName) + '...</div>' : ''}
      <style>.se-scan-dots::after{content:"...";animation:se-dots 1.5s infinite}@keyframes se-dots{0%{content:"."}33%{content:".."}66%{content:"..."}}</style>
    `;

    if (status === 'done') {
      bar.style.background = 'linear-gradient(135deg,#059669,#10b981)';
      setTimeout(() => { bar?.remove(); }, 5000);
    }
  }

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

    // Disable scan button
    const scanBtn = document.getElementById('se-btn-scan');
    if (scanBtn) { scanBtn.disabled = true; scanBtn.textContent = 'Scan en cours...'; }

    _showScanProgress(containerId, 0, toScan.length, toScan[0]?.nom, 'running');

    await _loadSignaux();
    // Mark current signals as "seen" so only truly NEW ones trigger notifications
    _markSignalsSeen((_signaux || []).map(s => s.id));
    let count = 0;

    for (let i = 0; i < toScan.length; i++) {
      const wl = toScan[i];
      _showScanProgress(containerId, i, toScan.length, wl.nom, 'running');

      try {
        const result = await analyseEntreprise(wl);
        _upsertSignal(result, wl);
        wl.derniere_analyse = new Date().toISOString().split('T')[0];
        count++;

        // Incremental save every 3 companies (prevents data loss)
        if (count % 3 === 0) {
          await _saveSignaux();
          await _saveWatchlist();
        }
      } catch (e) {
        console.error('Scan error for ' + wl.nom + ':', e);
      }
    }

    // Final save
    await _saveSignaux();
    await _saveWatchlist();

    // Update last execution time (resets auto-scan timer)
    _config.derniere_execution = new Date().toISOString();
    await _saveConfig();

    _showScanProgress(containerId, toScan.length, toScan.length, null, 'done');

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

    // Visual feedback on the button
    const btn = document.querySelector(`.se-btn-scan-one[data-id="${watchlistId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Scan...'; btn.style.opacity = '0.6'; }

    _showScanProgress('signaux-content', 0, 1, wl.nom, 'running');

    try {
      const result = await analyseEntreprise(wl);
      // Force fresh load from storage (clear cache to avoid stale data on rescan)
      _signaux = null;
      await _loadSignaux();

      _upsertSignal(result, wl);

      wl.derniere_analyse = new Date().toISOString().split('T')[0];
      await _saveSignaux();
      await _saveWatchlist();

      _showScanProgress('signaux-content', 1, 1, null, 'done');

      _signaux = null;
      _watchlist = null;
      renderPage('signaux-content');
    } catch (e) {
      UI.toast('Erreur: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Scanner'; btn.style.opacity = '1'; }
      document.getElementById('se-scan-progress')?.remove();
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
  // AUTO-SCAN STATUS — Info bar showing next scan date
  // ============================================================

  function _renderAutoScanStatus(config) {
    const lastExec = config.derniere_execution;
    if (!lastExec) {
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:#fef3c7;border-radius:8px;font-size:0.75rem;color:#92400e;">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Scan automatique actif — lancez un premier scan pour demarrer le cycle hebdomadaire
      </div>`;
    }

    const lastDate = new Date(lastExec);
    const nextDate = new Date(lastDate.getTime() + AUTO_SCAN_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    const daysUntil = Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const lastStr = lastDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

    if (daysUntil <= 0) {
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:#dbeafe;border-radius:8px;font-size:0.75rem;color:#1e40af;">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Scan automatique en attente — dernier scan : ${lastStr}
      </div>`;
    }

    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:#f0fdf4;border-radius:8px;font-size:0.75rem;color:#166534;">
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      Prochain scan auto dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''} — dernier : ${lastStr}
    </div>`;
  }

  // ============================================================
  // NOTIFICATIONS — Track new signals since last visit
  // ============================================================

  function _getSeenSignalIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem('se_signaux_vus') || '[]'));
    } catch { return new Set(); }
  }

  function _markSignalsSeen(signalIds) {
    const seen = _getSeenSignalIds();
    signalIds.forEach(id => seen.add(id));
    localStorage.setItem('se_signaux_vus', JSON.stringify([...seen]));
    // Clean up: remove IDs that no longer exist in signaux (prevents unbounded growth)
    if (_signaux && seen.size > _signaux.length * 2) {
      const currentIds = new Set(_signaux.map(s => s.id));
      const cleaned = [...seen].filter(id => currentIds.has(id));
      localStorage.setItem('se_signaux_vus', JSON.stringify(cleaned));
    }
  }

  function _getNewSignaux(signaux) {
    const seen = _getSeenSignalIds();
    return (signaux || []).filter(s => !seen.has(s.id));
  }

  function _getNewSignauxCount(signaux) {
    return _getNewSignaux(signaux).length;
  }

  // ============================================================
  // AUTO-SCAN — Weekly background scan
  // ============================================================

  async function _checkAutoScan(containerId) {
    if (_autoScanRunning) return;

    const config = await _loadConfig();
    const lastExec = config.derniere_execution;

    if (lastExec) {
      const daysSince = (Date.now() - new Date(lastExec).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < AUTO_SCAN_INTERVAL_DAYS) return;
    }

    // Check prerequisites
    if (!CVParser.getOpenAIKey()) return;
    await _loadWatchlist();
    const activeRegion = config.regions_actives?.[0];
    const toScan = _watchlist.filter(w => w.actif && (!activeRegion || w.region === activeRegion));
    if (!toScan.length) return;

    console.log('[SignalEngine] Auto-scan triggered (' + (lastExec ? Math.floor((Date.now() - new Date(lastExec).getTime()) / 86400000) + ' days since last' : 'never run') + ')');
    _autoScanRunning = true;

    // Show a subtle notification that auto-scan is starting
    _showAutoScanBanner(containerId, toScan.length);

    await _loadSignaux();
    const prevIds = new Set((_signaux || []).map(s => s.id));
    let count = 0;

    for (let i = 0; i < toScan.length; i++) {
      const wl = toScan[i];
      _updateAutoScanBanner(i, toScan.length, wl.nom);

      try {
        const result = await analyseEntreprise(wl);
        _upsertSignal(result, wl);
        wl.derniere_analyse = new Date().toISOString().split('T')[0];
        count++;

        if (count % 3 === 0) {
          await _saveSignaux();
          await _saveWatchlist();
        }
      } catch (e) {
        console.error('[SignalEngine] Auto-scan error for ' + wl.nom + ':', e);
      }
    }

    await _saveSignaux();
    await _saveWatchlist();

    // Update last execution
    _config.derniere_execution = new Date().toISOString();
    await _saveConfig();

    // Compute new signals found in this scan
    const newInScan = (_signaux || []).filter(s => !prevIds.has(s.id));
    console.log('[SignalEngine] Auto-scan done: ' + count + ' scanned, ' + newInScan.length + ' new signals');

    _removeAutoScanBanner();
    _autoScanRunning = false;

    // Refresh the page to show new results + notification
    _signaux = null;
    _watchlist = null;
    renderPage(containerId);
  }

  function _showAutoScanBanner(containerId, total) {
    let banner = document.getElementById('se-auto-scan-banner');
    if (banner) return;
    banner = document.createElement('div');
    banner.id = 'se-auto-scan-banner';
    banner.style.cssText = 'position:fixed;top:12px;right:24px;z-index:9999;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;border-radius:12px;padding:12px 16px;min-width:300px;box-shadow:0 4px 16px rgba(124,58,237,0.3);font-family:Inter,sans-serif;font-size:0.8125rem;';
    banner.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;">Scan automatique hebdomadaire</div>
      <div id="se-auto-scan-status">Demarrage... (${total} entreprises)</div>
    `;
    document.body.appendChild(banner);
  }

  function _updateAutoScanBanner(current, total, name) {
    const status = document.getElementById('se-auto-scan-status');
    if (status) {
      status.textContent = `${current + 1}/${total} — ${name}...`;
    }
  }

  function _removeAutoScanBanner() {
    const banner = document.getElementById('se-auto-scan-banner');
    if (banner) {
      banner.style.background = 'linear-gradient(135deg,#059669,#10b981)';
      const status = document.getElementById('se-auto-scan-status');
      if (status) status.textContent = 'Scan termine !';
      setTimeout(() => banner.remove(), 4000);
    }
  }

  // ============================================================
  // NOTIFICATION BELL — UI component
  // ============================================================

  function _renderNotificationBell(signaux) {
    const newSignaux = _getNewSignaux(signaux);
    const count = newSignaux.length;

    const badge = count > 0
      ? `<span style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:0.625rem;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;">${count > 99 ? '99+' : count}</span>`
      : '';

    return `
      <div id="se-notif-bell" style="position:relative;cursor:pointer;padding:6px;border-radius:8px;transition:background 0.2s;" title="${count} nouveau${count !== 1 ? 'x' : ''} signal${count !== 1 ? 'x' : ''}">
        <svg width="20" height="20" fill="none" stroke="${count > 0 ? '#ef4444' : '#64748b'}" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        ${badge}
      </div>
    `;
  }

  function _showNotificationDropdown(signaux) {
    // Remove existing dropdown
    document.getElementById('se-notif-dropdown')?.remove();

    const newSignaux = _getNewSignaux(signaux);
    const dropdown = document.createElement('div');
    dropdown.id = 'se-notif-dropdown';
    dropdown.style.cssText = 'position:fixed;top:60px;right:24px;z-index:10000;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);border:1px solid #e2e8f0;width:380px;max-height:440px;overflow-y:auto;font-family:Inter,sans-serif;';

    if (!newSignaux.length) {
      dropdown.innerHTML = `
        <div style="padding:20px;text-align:center;">
          <div style="font-size:1.5rem;margin-bottom:8px;">&#128276;</div>
          <div style="color:#64748b;font-size:0.8125rem;">Aucun nouveau signal</div>
          <div style="color:#94a3b8;font-size:0.75rem;margin-top:4px;">Les nouveaux signaux apparaitront ici apres un scan</div>
        </div>
      `;
    } else {
      const items = newSignaux.slice(0, 10).map(s => {
        const mainSignal = s.signaux?.[0];
        const typeInfo = mainSignal ? SIGNAL_TYPES[mainSignal.type] : null;
        const scoreColor = s.score_global >= 70 ? '#059669' : s.score_global >= 40 ? '#d97706' : '#94a3b8';
        return `
          <div style="padding:10px 16px;border-bottom:1px solid #f1f5f9;display:flex;gap:10px;align-items:flex-start;">
            <span style="font-size:1.1rem;margin-top:2px;">${typeInfo?.icon || '📊'}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.8125rem;color:#1e293b;">${UI.escHtml(s.entreprise_nom)}</div>
              <div style="font-size:0.75rem;color:#64748b;margin-top:2px;">${mainSignal ? UI.escHtml(mainSignal.label).substring(0, 80) : 'Signal detecte'}</div>
              <div style="font-size:0.6875rem;color:#94a3b8;margin-top:2px;">${s.ville || ''} — ${s.date_creation || ''}</div>
            </div>
            <span style="font-weight:700;color:${scoreColor};font-size:0.875rem;white-space:nowrap;">${s.score_global}/100</span>
          </div>
        `;
      }).join('');

      dropdown.innerHTML = `
        <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;font-size:0.875rem;">${newSignaux.length} nouveau${newSignaux.length > 1 ? 'x' : ''} signal${newSignaux.length > 1 ? 'x' : ''}</span>
          <button id="se-notif-mark-read" style="font-size:0.75rem;color:#3b82f6;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:4px;">Tout marquer comme lu</button>
        </div>
        ${items}
        ${newSignaux.length > 10 ? '<div style="padding:8px 16px;text-align:center;font-size:0.75rem;color:#94a3b8;">et ' + (newSignaux.length - 10) + ' autre' + (newSignaux.length - 10 > 1 ? 's' : '') + '...</div>' : ''}
      `;
    }

    document.body.appendChild(dropdown);

    // Mark as read button
    dropdown.querySelector('#se-notif-mark-read')?.addEventListener('click', () => {
      _markSignalsSeen(signaux.map(s => s.id));
      dropdown.remove();
      // Refresh bell badge
      const bellContainer = document.getElementById('se-notif-bell')?.parentElement;
      if (bellContainer) {
        bellContainer.innerHTML = _renderNotificationBell(signaux);
        _attachBellListener(signaux);
      }
      _updateNavBadge(0);
    });

    // Close dropdown when clicking outside
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && !document.getElementById('se-notif-bell')?.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 50);
  }

  function _attachBellListener(signaux) {
    document.getElementById('se-notif-bell')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.getElementById('se-notif-dropdown');
      if (existing) {
        existing.remove();
      } else {
        _showNotificationDropdown(signaux);
      }
    });
  }

  // Nav badge: inject/update a badge on the "Signaux" sidebar link
  function _updateNavBadge(count) {
    const signauxLink = document.querySelector('a[href="signaux.html"]');
    if (!signauxLink) return;

    // Remove existing badge
    signauxLink.querySelector('.se-nav-badge')?.remove();

    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'se-nav-badge';
      badge.style.cssText = 'background:#ef4444;color:#fff;font-size:0.625rem;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px;margin-left:auto;';
      badge.textContent = count > 99 ? '99+' : count;
      signauxLink.style.display = 'flex';
      signauxLink.style.alignItems = 'center';
      signauxLink.appendChild(badge);
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
