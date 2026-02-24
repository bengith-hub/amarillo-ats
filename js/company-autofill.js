// Amarillo ATS — Company Autofill (Pappers + Site web + OpenAI)
// Recherche les informations factuelles d'une entreprise :
// 1. Pappers (registre officiel) : secteur, taille, CA, adresse siège
// 2. Scraping du site web : téléphone, adresse, coordonnées
// 3. OpenAI : complète les champs manquants à partir du contexte
// Propose un modal de revue pour valider/appliquer les champs.

const CompanyAutofill = (function() {

  // ============================================================
  // Pappers API key management
  // ============================================================

  function getPappersKey() {
    return localStorage.getItem('ats_pappers_key') || '';
  }

  function setPappersKey(key) {
    localStorage.setItem('ats_pappers_key', key);
  }

  function showPappersConfigModal(onConfigured) {
    const currentKey = getPappersKey();
    const masked = currentKey ? currentKey.substring(0, 8) + '...' + currentKey.substring(currentKey.length - 4) : '';

    const bodyHtml = `
      <div class="form-group">
        <label>Clé API Pappers</label>
        <input type="password" id="f-pappers-key" value="${currentKey}" placeholder="Votre token Pappers..." style="font-family:monospace;" />
        ${masked ? '<small style="color:#64748b;">Clé actuelle : ' + masked + '</small>' : '<small style="color:#64748b;">Créez un compte gratuit sur <a href="https://www.pappers.fr/api" target="_blank">pappers.fr/api</a> (100 requêtes/mois gratuites)</small>'}
      </div>
    `;

    UI.modal('Configuration Pappers', bodyHtml, {
      width: 450,
      saveLabel: 'Enregistrer',
      onSave: async (overlay) => {
        const key = overlay.querySelector('#f-pappers-key').value.trim();
        if (!key) {
          UI.toast('Veuillez renseigner un token Pappers', 'error');
          throw new Error('validation');
        }
        setPappersKey(key);
        UI.toast('Clé Pappers enregistrée');
        if (onConfigured) onConfigured();
      }
    });
  }

  // ============================================================
  // Pappers API search
  // ============================================================

  async function _searchPappers(companyName) {
    const apiKey = getPappersKey();
    if (!apiKey) return null;

    const params = new URLSearchParams({
      api_token: apiKey,
      q: companyName.trim(),
      par_page: '5',
    });

    const response = await fetch('https://api.pappers.fr/v2/recherche?' + params.toString());

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Clé Pappers invalide ou expirée. Vérifiez votre clé dans la configuration.');
      }
      if (response.status === 429) {
        throw new Error('Quota Pappers atteint. Vérifiez votre consommation sur pappers.fr.');
      }
      // Non-blocking: return null to fall back to OpenAI
      console.warn('Pappers API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.resultats || [];
  }

  // ============================================================
  // Pappers → ATS field mapping
  // ============================================================

  function _mapEffectifToTaille(trancheEffectif) {
    if (!trancheEffectif) return '';
    const text = trancheEffectif.toLowerCase();
    // Extraire le premier nombre
    const nums = text.match(/(\d[\d\s]*)/g);
    if (!nums) return '';
    const firstNum = parseInt(nums[0].replace(/\s/g, ''));
    if (isNaN(firstNum)) return '';

    if (firstNum < 11) return '1-10';
    if (firstNum < 51) return '11-50';
    if (firstNum < 201) return '51-200';
    if (firstNum < 501) return '201-500';
    if (firstNum < 1000) return '501-1000';
    return '1000+';
  }

  function _mapCaToRange(chiffreAffaires) {
    if (!chiffreAffaires || chiffreAffaires <= 0) return '';
    const ca = Number(chiffreAffaires);
    if (ca < 5000000) return '< 5 M€';
    if (ca < 20000000) return '5-20 M€';
    if (ca < 50000000) return '20-50 M€';
    if (ca < 100000000) return '50-100 M€';
    if (ca < 250000000) return '100-250 M€';
    return '250 M€+';
  }

  function _mapNafToSecteur(libelleNaf) {
    if (!libelleNaf) return '';
    const naf = libelleNaf.toLowerCase();

    const mapping = [
      { keywords: ['informatique', 'logiciel', 'programmation', 'données', 'numérique', 'digital', 'saas', 'cloud', 'hébergement', 'traitement de données'], secteur: 'Tech / SaaS' },
      { keywords: ['conseil', 'ingénierie', 'études techniques', 'activités spécialisées', 'consulting'], secteur: 'Conseil / ESN' },
      { keywords: ['fabrication', 'industrie', 'métallurgie', 'mécanique', 'usinage', 'production', 'manufacture'], secteur: 'Industrie' },
      { keywords: ['banque', 'crédit', 'financ', 'investissement', 'gestion de fonds', 'bourse'], secteur: 'Finance / Banque' },
      { keywords: ['assurance', 'réassurance', 'mutuelle', 'prévoyance'], secteur: 'Assurance' },
      { keywords: ['commerce de détail', 'vente', 'e-commerce', 'grande distribution', 'magasin'], secteur: 'Retail / E-commerce' },
      { keywords: ['santé', 'pharma', 'médic', 'hospitalier', 'biotechnolog', 'dispositif médical'], secteur: 'Santé / Pharma' },
      { keywords: ['énergie', 'électricité', 'gaz', 'pétrole', 'environnement', 'déchet', 'eau', 'renouvelable'], secteur: 'Énergie / Environnement' },
      { keywords: ['télécom', 'média', 'édition', 'audiovisuel', 'radio', 'télévision', 'presse', 'communication'], secteur: 'Telecom / Média' },
      { keywords: ['immobilier', 'construction', 'bâtiment', 'btp', 'travaux', 'génie civil', 'promotion immobilière'], secteur: 'Immobilier / BTP' },
      { keywords: ['transport', 'logistique', 'entreposage', 'messagerie', 'fret', 'livraison', 'routier'], secteur: 'Transport / Logistique' },
      { keywords: ['alimentaire', 'agroalimentaire', 'boisson', 'boulangerie', 'viande', 'lait'], secteur: 'Agroalimentaire' },
      { keywords: ['luxe', 'mode', 'textile', 'habillement', 'joaillerie', 'cosmétique', 'parfum', 'maroquinerie'], secteur: 'Luxe / Mode' },
      { keywords: ['administration', 'public', 'collectivité', 'état', 'ministère'], secteur: 'Services publics' },
    ];

    for (const m of mapping) {
      if (m.keywords.some(kw => naf.includes(kw))) return m.secteur;
    }
    return 'Autre';
  }

  function _mapPappersToFields(company) {
    const siege = company.siege || {};
    const secteurs = Referentiels.get('entreprise_secteurs');
    const tailles = Referentiels.get('entreprise_tailles');

    const mappedSecteur = _mapNafToSecteur(company.libelle_code_naf);
    const mappedTaille = _mapEffectifToTaille(company.tranche_effectif);
    const mappedCa = _mapCaToRange(company.chiffre_affaires);

    return {
      nom: company.denomination || '',
      secteur: _matchSelectOption(mappedSecteur, secteurs),
      taille: _matchSelectOption(mappedTaille, tailles),
      ca: mappedCa,
      localisation: siege.ville || '',
      site_web: '',  // Pappers recherche ne retourne pas toujours le site
      telephone: '',  // idem
      siege_adresse: siege.adresse_ligne_1 || '',
      siege_code_postal: siege.code_postal || '',
      siege_ville: siege.ville || '',
      _pappers_siren: company.siren || '',
      _pappers_naf: company.libelle_code_naf || '',
      _pappers_forme: company.forme_juridique || '',
    };
  }

  // ============================================================
  // Pappers selection modal (quand plusieurs résultats)
  // ============================================================

  function _showPappersSelectionModal(results, companyName, callback) {
    let currentResults = results;
    let resolved = false;

    function _resolveWith(value) {
      if (resolved) return;
      resolved = true;
      callback(value);
    }

    function _buildResultsHtml(resultsList) {
      if (resultsList.length === 0) {
        return '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.8125rem;">Aucun résultat trouvé sur Pappers. Essayez un autre nom.</div>';
      }
      return resultsList.map((r, i) => {
        const siege = r.siege || {};
        return '<div class="pappers-result" data-idx="' + i + '" style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;cursor:pointer;transition:background 0.15s;" ' +
          'onmouseover="this.style.background=\'#f0f9ff\'" onmouseout="this.style.background=\'\'">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div>' +
              '<div style="font-weight:600;font-size:0.875rem;color:#1e293b;">' + UI.escHtml(r.denomination || '—') + '</div>' +
              '<div style="font-size:0.75rem;color:#64748b;margin-top:2px;">' +
                UI.escHtml((siege.code_postal || '') + ' ' + (siege.ville || '')) +
                (r.libelle_code_naf ? ' — ' + UI.escHtml(r.libelle_code_naf) : '') +
              '</div>' +
            '</div>' +
            '<div style="font-size:0.6875rem;color:#94a3b8;font-family:monospace;">' + UI.escHtml(r.siren || '') + '</div>' +
          '</div>' +
          (r.tranche_effectif ? '<div style="font-size:0.6875rem;color:#64748b;margin-top:4px;">' + UI.escHtml(r.tranche_effectif) + (r.chiffre_affaires ? ' — CA: ' + (r.chiffre_affaires / 1000000).toFixed(1) + ' M€' : '') + '</div>' : '') +
        '</div>';
      }).join('');
    }

    function _bindResultClicks(closeModal) {
      document.querySelectorAll('.pappers-result').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          closeModal();
          _resolveWith(currentResults[idx]);
        });
      });
    }

    const bodyHtml = `
      <div style="margin-bottom:12px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="pappers-manual-search" value="${UI.escHtml(companyName)}" placeholder="Nom de l'entreprise..." style="flex:1;font-size:0.8125rem;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;" />
          <button type="button" class="btn btn-primary btn-sm" id="pappers-search-btn" style="white-space:nowrap;">Rechercher</button>
        </div>
      </div>
      <div id="pappers-results-label" style="margin-bottom:8px;font-size:0.8125rem;color:#475569;">
        ${results.length > 0 ? 'Sélectionnez la bonne entreprise :' : ''}
      </div>
      <div id="pappers-results-list" style="max-height:350px;overflow-y:auto;">
        ${_buildResultsHtml(results)}
      </div>
      <div style="margin-top:12px;text-align:center;">
        <button type="button" class="btn btn-sm btn-secondary" id="pappers-skip" style="font-size:0.75rem;">Aucune ne correspond — continuer avec l'IA</button>
      </div>
    `;

    const { close } = UI.modal('Recherche Pappers', bodyHtml, {
      width: 560,
      onClose: () => _resolveWith(false),
    });

    setTimeout(() => {
      _bindResultClicks(close);

      document.getElementById('pappers-skip')?.addEventListener('click', () => {
        close();
        _resolveWith(null);
      });

      document.getElementById('pappers-search-btn')?.addEventListener('click', async () => {
        const searchName = document.getElementById('pappers-manual-search')?.value.trim();
        if (!searchName || searchName.length < 2) return;

        const searchBtn = document.getElementById('pappers-search-btn');
        const resultsContainer = document.getElementById('pappers-results-list');
        const resultsLabel = document.getElementById('pappers-results-label');
        searchBtn.disabled = true;
        searchBtn.textContent = '...';

        try {
          const newResults = await _searchPappers(searchName);
          currentResults = newResults || [];
          resultsLabel.textContent = currentResults.length > 0 ? 'Sélectionnez la bonne entreprise :' : '';
          resultsContainer.innerHTML = _buildResultsHtml(currentResults);
          _bindResultClicks(close);
        } catch (err) {
          resultsContainer.innerHTML = '<div style="padding:12px;color:#dc2626;font-size:0.8125rem;">' + UI.escHtml(err.message) + '</div>';
        } finally {
          searchBtn.disabled = false;
          searchBtn.textContent = 'Rechercher';
        }
      });

      document.getElementById('pappers-manual-search')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('pappers-search-btn')?.click();
        }
      });
    }, 50);
  }

  // ============================================================
  // Website scraping — extraction de données factuelles
  // ============================================================

  async function _scrapeWebsite(siteUrl) {
    if (!siteUrl) return '';

    let url = siteUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    const baseUrl = url.replace(/\/+$/, '');

    // Fetch homepage + /contact in parallel via CORS proxy
    const pages = await Promise.all([
      _fetchPageText(baseUrl),
      _fetchPageText(baseUrl + '/contact'),
    ]);

    const parts = [];
    if (pages[0]) parts.push('PAGE ACCUEIL:\n' + pages[0]);
    if (pages[1]) parts.push('PAGE CONTACT:\n' + pages[1]);
    return parts.join('\n\n');
  }

  const _CORS_PROXIES = [
    { name: 'corsproxy', buildUrl: (u) => 'https://corsproxy.io/?' + encodeURIComponent(u), parseHtml: (d) => d },
    { name: 'allorigins', buildUrl: (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), parseHtml: (d) => { try { return JSON.parse(d).contents || ''; } catch { return d; } } },
    { name: 'codetabs', buildUrl: (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u), parseHtml: (d) => d },
  ];

  async function _fetchPageText(url) {
    try {
      let html = '';
      for (const proxy of _CORS_PROXIES) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const response = await fetch(proxy.buildUrl(url), { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!response.ok) continue;
          const raw = await response.text();
          if (!raw) continue;
          html = proxy.parseHtml(raw);
          if (html) break;
        } catch {
          // try next proxy
        }
      }
      if (!html) return '';

      // Parse HTML and extract text
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, svg, noscript, iframe, link, meta').forEach(el => el.remove());

      let text = doc.body?.textContent || '';
      text = text.replace(/[\t\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').replace(/ {2,}/g, ' ').trim();

      // Limit to keep prompt size reasonable
      return text.length > 2500 ? text.substring(0, 2500) + '...' : text;
    } catch (err) {
      return '';
    }
  }

  // ============================================================
  // OpenAI call
  // ============================================================

  async function _callOpenAI(systemPrompt, userPrompt) {
    const apiKey = CVParser.getOpenAIKey();
    if (!apiKey) {
      throw new Error('Clé API OpenAI non configurée. Cliquez sur "Configurer la clé" pour la renseigner.');
    }

    const requestBody = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const maxRetries = 3;
    let response;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: requestBody
      });

      if (response.status !== 429 || attempt === maxRetries) break;
      const wait = Math.pow(2, attempt + 1) * 1000;
      await new Promise(r => setTimeout(r, wait));
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('Clé API OpenAI invalide.');
      if (response.status === 429) throw new Error('Limite de requêtes OpenAI atteinte.');
      throw new Error(`Erreur OpenAI (${response.status}): ${err.error?.message || 'Erreur inconnue'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Réponse vide de l\'API OpenAI.');

    let jsonStr = content;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Impossible de parser la réponse OpenAI. Réponse brute : ' + content.substring(0, 200));
    }
  }

  // Matching fuzzy pour les champs select
  function _matchSelectOption(aiValue, options) {
    if (!aiValue) return '';
    if (options.includes(aiValue)) return aiValue;
    const lower = aiValue.toLowerCase().trim();
    const exactCI = options.find(o => o.toLowerCase().trim() === lower);
    if (exactCI) return exactCI;
    const contained = options.find(o =>
      lower.includes(o.toLowerCase().trim()) || o.toLowerCase().trim().includes(lower)
    );
    if (contained) return contained;
    return '';
  }

  // Construire un résumé des données existantes pour le contexte OpenAI
  function _buildExistingContext(currentValues) {
    if (!currentValues) return '';

    const lines = [];
    const fieldLabels = {
      nom: 'Nom', secteur: 'Secteur', taille: 'Taille', ca: 'CA',
      localisation: 'Localisation', site_web: 'Site web', telephone: 'Téléphone',
      siege_adresse: 'Adresse siège', siege_code_postal: 'Code postal',
      siege_ville: 'Ville',
    };

    for (const [key, label] of Object.entries(fieldLabels)) {
      const val = (currentValues[key] || '').toString().trim();
      if (val) lines.push(`- ${label} : ${val}`);
    }

    if (currentValues._pappers_naf) lines.push(`- Code NAF : ${currentValues._pappers_naf}`);
    if (currentValues._pappers_forme) lines.push(`- Forme juridique : ${currentValues._pappers_forme}`);
    if (currentValues._pappers_siren) lines.push(`- SIREN : ${currentValues._pappers_siren}`);

    if (currentValues._decideurs && currentValues._decideurs.length > 0) {
      const decList = currentValues._decideurs.map(d =>
        `${d.prenom || ''} ${d.nom || ''}`.trim() + (d.fonction ? ` (${d.fonction})` : '')
      ).join(', ');
      lines.push(`- Décideurs connus : ${decList}`);
    }

    return lines.length > 0 ? lines.join('\n') : '';
  }

  // ============================================================
  // OpenAI enrichment (données factuelles manquantes)
  // ============================================================

  async function _enrichWithOpenAI(companyName, baseData, currentValues, websiteContent) {
    const openAIKey = CVParser.getOpenAIKey();
    if (!openAIKey) return baseData; // No OpenAI → return Pappers data as-is

    const secteurs = Referentiels.get('entreprise_secteurs');
    const tailles = Referentiels.get('entreprise_tailles');
    const caOptions = ['< 5 M€', '5-20 M€', '20-50 M€', '50-100 M€', '100-250 M€', '250 M€+'];

    // Merge baseData into currentValues for context
    const mergedContext = { ...currentValues };
    for (const [k, v] of Object.entries(baseData)) {
      if (v && !k.startsWith('_')) mergedContext[k] = v;
    }
    if (baseData._pappers_naf) mergedContext._pappers_naf = baseData._pappers_naf;
    if (baseData._pappers_forme) mergedContext._pappers_forme = baseData._pappers_forme;
    if (baseData._pappers_siren) mergedContext._pappers_siren = baseData._pappers_siren;

    const existingContext = _buildExistingContext(mergedContext);

    const systemPrompt = `Tu es un assistant spécialisé dans l'extraction de DONNÉES FACTUELLES sur les entreprises.
Des données du registre officiel (Pappers) sont fournies. ATTENTION : Pappers retourne les données de l'entité juridique (holding), qui peut être très différente de la réalité du groupe.
Exemple : un holding "Groupe XYZ" peut avoir 2 salariés et 1M€ de CA sur Pappers, alors que le groupe emploie 5000 personnes avec 500M€ de CA.

TON RÔLE :
1. COMPLÈTE les champs vides (téléphone, adresse, code postal, site web).
2. CORRIGE les champs "taille" et "ca" si le site web ou tes connaissances montrent que les données Pappers sont fausses (cas des holdings).
3. Pour les champs factuels fiables de Pappers (adresse siège, nom, secteur), conserve-les.
4. NE PAS rédiger d'analyse, de notes stratégiques, ni d'angle d'approche.
5. Si le contenu du site web est fourni, extrais-en : téléphone, adresse, nombre de collaborateurs, CA.
6. Si une information n'est pas trouvable avec certitude, laisse vide "".

Pour les champs select, choisis parmi :
Secteur: ${secteurs.join(', ')}
Taille: ${tailles.join(', ')}
CA: ${caOptions.join(', ')}

Réponds UNIQUEMENT avec le JSON, sans commentaires ni markdown.`;

    let userPrompt = `Complète et vérifie les données sur l'entreprise "${companyName.trim()}"

Données registre (Pappers — attention, peut être le holding seul) :
${existingContext}`;

    if (websiteContent) {
      userPrompt += `\n\nContenu extrait du site web de l'entreprise :\n${websiteContent}`;
    }

    userPrompt += `

Format JSON attendu. Pour "taille" et "ca", propose la valeur qui reflète la RÉALITÉ DU GROUPE (pas du holding juridique) :
{
  "nom": "", "secteur": "", "taille": "", "ca": "",
  "localisation": "", "site_web": "", "telephone": "",
  "siege_adresse": "", "siege_code_postal": "", "siege_ville": ""
}

Pour "site_web", URL complète avec https://. Si déjà renseigné, conserve-le.
Pour "telephone", format français (+33 ou 0x xx xx xx xx). Cherche sur le site web.
Pour "siege_adresse", l'adresse complète du siège social. Cherche sur le site web.
Pour "siege_code_postal", le code postal du siège.
Pour "taille", le nombre réel de collaborateurs du GROUPE (pas du holding). Cherche sur le site web ("X collaborateurs", "X salariés").
Pour "ca", la tranche de CA réelle du GROUPE. Cherche sur le site web ou dans tes connaissances.`;

    try {
      const aiResult = await _callOpenAI(systemPrompt, userPrompt);

      if (aiResult.secteur) aiResult.secteur = _matchSelectOption(aiResult.secteur, secteurs);
      if (aiResult.taille) aiResult.taille = _matchSelectOption(aiResult.taille, tailles);
      if (aiResult.ca) aiResult.ca = _matchSelectOption(aiResult.ca, caOptions);

      // Fields where OpenAI can override Pappers (holding vs group reality)
      const overridableFields = new Set(['taille', 'ca', 'secteur']);

      const merged = { ...baseData };
      for (const [k, v] of Object.entries(aiResult)) {
        if (k.startsWith('_')) continue;
        const val = (v || '').toString().trim();
        if (!val) continue;

        const baseVal = (merged[k] || '').toString().trim();
        if (!baseVal) {
          // Empty in Pappers → fill from OpenAI
          merged[k] = val;
        } else if (overridableFields.has(k) && val !== baseVal) {
          // OpenAI proposes different value for taille/ca/secteur → trust OpenAI
          merged[k] = val;
        }
      }
      return merged;
    } catch (err) {
      console.warn('OpenAI enrichment failed, using Pappers data only:', err.message);
      return baseData;
    }
  }

  // ============================================================
  // Main function: fetch company info (Pappers + OpenAI)
  // ============================================================

  async function fetchCompanyInfo(companyName, currentValues, { onStatusUpdate, autoSelectFirst } = {}) {
    if (!companyName || companyName.trim().length < 2) {
      throw new Error('Veuillez saisir un nom d\'entreprise valide.');
    }

    const hasPappers = !!getPappersKey();
    const hasOpenAI = !!CVParser.getOpenAIKey();

    if (!hasPappers && !hasOpenAI) {
      throw new Error('Aucune clé API configurée. Configurez Pappers et/ou OpenAI.');
    }

    let pappersData = null;

    // Step 1: Try Pappers
    if (hasPappers) {
      if (onStatusUpdate) onStatusUpdate('Recherche sur Pappers...');

      const results = await _searchPappers(companyName);

      if (results && results.length === 1 && autoSelectFirst) {
        // Auto-select mode with single result → use directly
        pappersData = _mapPappersToFields(results[0]);
      } else {
        // 0 or 2+ results (or 1 without autoSelect) → let user choose or search
        const selection = await new Promise((resolve) => {
          _showPappersSelectionModal(results || [], companyName, resolve);
        });

        if (selection === false) {
          // User dismissed the modal → cancel
          return null;
        }
        if (selection) {
          pappersData = _mapPappersToFields(selection);
        }
        // selection === null → skip Pappers, continue with OpenAI
      }
    }

    // Step 2: Scrape company website for factual data
    const siteUrl = (pappersData && pappersData.site_web) || (currentValues && currentValues.site_web) || '';
    let websiteContent = '';
    if (siteUrl && hasOpenAI) {
      if (onStatusUpdate) onStatusUpdate('Analyse du site web...');
      websiteContent = await _scrapeWebsite(siteUrl);
    }

    // Step 3: Enrich with OpenAI (or use OpenAI-only if no Pappers)
    if (pappersData) {
      if (hasOpenAI) {
        if (onStatusUpdate) onStatusUpdate('Extraction des données via IA...');
        return await _enrichWithOpenAI(companyName, pappersData, currentValues, websiteContent);
      }
      return pappersData;
    }

    // Fallback: OpenAI only
    if (!hasOpenAI) {
      throw new Error('Aucun résultat Pappers trouvé et OpenAI non configuré.');
    }

    if (onStatusUpdate) onStatusUpdate('Recherche via IA...');
    return await _fetchWithOpenAIOnly(companyName, currentValues, websiteContent);
  }

  // OpenAI-only fallback
  async function _fetchWithOpenAIOnly(companyName, currentValues, websiteContent) {
    const secteurs = Referentiels.get('entreprise_secteurs');
    const tailles = Referentiels.get('entreprise_tailles');
    const caOptions = ['< 5 M€', '5-20 M€', '20-50 M€', '50-100 M€', '100-250 M€', '250 M€+'];

    const existingContext = _buildExistingContext(currentValues);

    const systemPrompt = `Tu es un assistant spécialisé dans l'extraction de DONNÉES FACTUELLES sur les entreprises françaises et internationales.
Ton objectif est de trouver les données concrètes et vérifiables : numéro de téléphone, adresse complète du siège social, code postal, ville, site web, chiffre d'affaires, taille (nombre d'employés), secteur d'activité.

RÈGLES STRICTES :
- Si un champ existant est déjà renseigné et correct, REPRENDS-LE tel quel.
- Complète UNIQUEMENT les champs vides avec des données factuelles.
- NE PAS rédiger d'analyse, de notes stratégiques, ni d'angle d'approche.
- Si le contenu du site web est fourni, extrais-en prioritairement : téléphone, adresse postale, code postal.
- Si une information n'est pas trouvable avec certitude, laisse vide "".

Pour les champs select, choisis parmi :
Secteur: ${secteurs.join(', ')}
Taille: ${tailles.join(', ')}
CA: ${caOptions.join(', ')}

Réponds UNIQUEMENT avec le JSON, sans commentaires ni markdown.`;

    let userPrompt = `Recherche les données factuelles sur l'entreprise : "${companyName.trim()}"`;

    if (existingContext) {
      userPrompt += `\n\nDonnées déjà connues :\n${existingContext}`;
    }

    if (websiteContent) {
      userPrompt += `\n\nContenu extrait du site web de l'entreprise :\n${websiteContent}`;
    }

    userPrompt += `

Format JSON attendu :
{
  "nom": "", "secteur": "", "taille": "", "ca": "",
  "localisation": "", "site_web": "", "telephone": "",
  "siege_adresse": "", "siege_code_postal": "", "siege_ville": ""
}

Pour "nom", le nom officiel/complet.
Pour "localisation", la région ou grande ville du siège.
Pour "site_web", URL complète avec https://. Si déjà renseigné, conserve-le.
Pour "telephone", format français (+33 ou 0x xx xx xx xx). Cherche dans le contenu du site web.
Pour "siege_adresse", l'adresse complète du siège. Cherche dans le contenu du site web (mentions légales, page contact).
Pour "siege_code_postal", le code postal du siège.
Pour "ca", la tranche de chiffre d'affaires.`;

    const result = await _callOpenAI(systemPrompt, userPrompt);

    if (result.secteur) result.secteur = _matchSelectOption(result.secteur, secteurs);
    if (result.taille) result.taille = _matchSelectOption(result.taille, tailles);
    if (result.ca) result.ca = _matchSelectOption(result.ca, caOptions);

    return result;
  }

  // ============================================================
  // Définition des champs + Modale de revue
  // ============================================================

  const COMPANY_FIELDS = [
    { key: 'nom', label: 'Nom' },
    { key: 'secteur', label: 'Secteur', type: 'select', options: () => Referentiels.get('entreprise_secteurs') },
    { key: 'taille', label: 'Taille', type: 'select', options: () => Referentiels.get('entreprise_tailles') },
    { key: 'ca', label: 'CA', type: 'select', options: () => ['< 5 M€','5-20 M€','20-50 M€','50-100 M€','100-250 M€','250 M€+'] },
    { key: 'localisation', label: 'Localisation' },
    { key: 'site_web', label: 'Site web' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'siege_adresse', label: 'Adresse siège' },
    { key: 'siege_code_postal', label: 'Code postal' },
    { key: 'siege_ville', label: 'Ville' },
  ];

  function showReviewModal(extracted, currentValues, { onApply, title }) {
    const changes = [];
    for (const f of COMPANY_FIELDS) {
      const extractedVal = (extracted[f.key] || '').toString().trim();
      if (!extractedVal) continue;

      const currentVal = (currentValues[f.key] || '').toString().trim();
      const isSame = extractedVal === currentVal;

      changes.push({
        ...f,
        currentVal,
        extractedVal,
        isEmpty: !currentVal,
        isSame,
      });
    }

    if (changes.length === 0) {
      UI.toast('Aucune information trouvée pour cette entreprise', 'info');
      return;
    }

    // Source badge
    const hasPappersData = extracted._pappers_siren;
    const sourceBadge = hasPappersData
      ? '<span style="font-size:0.6875rem;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:4px;margin-left:8px;">Pappers</span>'
      : '<span style="font-size:0.6875rem;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;margin-left:8px;">IA</span>';

    const bodyHtml = `
      <div style="margin-bottom:12px;font-size:0.8125rem;color:#475569;">
        Cochez les champs à appliquer. Les valeurs proposées sont éditables.${sourceBadge}
      </div>
      ${changes.map((c, i) => {
        let inputHtml;
        if (c.type === 'select') {
          const opts = c.options();
          inputHtml = '<select id="ent-field-val-' + i + '" ' + (c.isSame ? 'disabled' : '') +
            ' style="width:100%;font-size:0.8125rem;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;' + (c.isSame ? 'background:#f9fafb;color:#9ca3af;' : '') + '">' +
            '<option value="">--</option>' +
            opts.map(o => '<option value="' + UI.escHtml(o) + '" ' + (o === c.extractedVal ? 'selected' : '') + '>' + UI.escHtml(o) + '</option>').join('') +
            '</select>';
        } else {
          inputHtml = '<input type="text" id="ent-field-val-' + i + '" value="' + UI.escHtml(c.extractedVal) + '" ' + (c.isSame ? 'disabled' : '') +
            ' style="width:100%;font-size:0.8125rem;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;' + (c.isSame ? 'background:#f9fafb;color:#9ca3af;' : '') + '" />';
        }

        return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;' + (c.isSame ? 'opacity:0.55;' : '') + '">' +
          '<input type="checkbox" id="ent-field-check-' + i + '" ' + (c.isEmpty ? 'checked' : '') + ' ' + (c.isSame ? 'disabled' : '') + ' style="margin-top:4px;accent-color:#3b82f6;" />' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
              '<label for="ent-field-check-' + i + '" style="font-size:0.8125rem;font-weight:600;color:#1e293b;cursor:pointer;">' + c.label + '</label>' +
              (c.isSame
                ? '<span style="font-size:0.6875rem;color:#6b7280;background:#f3f4f6;padding:1px 6px;border-radius:4px;">identique</span>'
                : c.isEmpty
                  ? '<span style="font-size:0.6875rem;color:#059669;background:#ecfdf5;padding:1px 6px;border-radius:4px;">nouveau</span>'
                  : '<span style="font-size:0.6875rem;color:#d97706;background:#fffbeb;padding:1px 6px;border-radius:4px;">modification</span>') +
            '</div>' +
            (c.currentVal && !c.isSame ? '<div style="font-size:0.75rem;color:#94a3b8;text-decoration:line-through;margin-bottom:4px;">' + UI.escHtml(c.currentVal) + '</div>' : '') +
            inputHtml +
          '</div>' +
        '</div>';
      }).join('')}
    `;

    UI.modal(title || 'Compléter les informations entreprise', bodyHtml, {
      width: 600,
      saveLabel: 'Appliquer les modifications',
      onSave: async (overlay) => {
        const updates = {};
        for (let i = 0; i < changes.length; i++) {
          const checkbox = overlay.querySelector('#ent-field-check-' + i);
          if (!checkbox || !checkbox.checked) continue;

          const val = overlay.querySelector('#ent-field-val-' + i).value.trim();
          if (!val) continue;

          updates[changes[i].key] = val;
        }

        if (Object.keys(updates).length === 0) {
          UI.toast('Aucune modification sélectionnée', 'info');
          return;
        }

        if (onApply) await onApply(updates);
      }
    });
  }

  // ============================================================
  // Public API
  // ============================================================

  return {
    fetchCompanyInfo,
    showReviewModal,
    getPappersKey,
    setPappersKey,
    showPappersConfigModal
  };

})();
