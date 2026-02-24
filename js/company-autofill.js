// Amarillo ATS — Company Autofill (Pappers + OpenAI)
// Recherche les informations d'une entreprise via l'API Pappers (données officielles)
// puis enrichit avec OpenAI (angle d'approche, notes).
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
      angle_approche: '',  // Enrichi par OpenAI
      notes: '',  // Enrichi par OpenAI
      _pappers_siren: company.siren || '',
      _pappers_naf: company.libelle_code_naf || '',
      _pappers_forme: company.forme_juridique || '',
    };
  }

  // ============================================================
  // Pappers selection modal (quand plusieurs résultats)
  // ============================================================

  function _showPappersSelectionModal(results, callback) {
    const bodyHtml = `
      <div style="margin-bottom:12px;font-size:0.8125rem;color:#475569;">
        Plusieurs entreprises trouvées sur Pappers. Sélectionnez la bonne :
      </div>
      ${results.map((r, i) => {
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
      }).join('')}
      <div style="margin-top:12px;text-align:center;">
        <button type="button" class="btn btn-sm btn-secondary" id="pappers-skip" style="font-size:0.75rem;">Aucune ne correspond — continuer avec l'IA</button>
      </div>
    `;

    const { close } = UI.modal('Résultats Pappers', bodyHtml, { width: 560 });

    setTimeout(() => {
      document.querySelectorAll('.pappers-result').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          close();
          callback(results[idx]);
        });
      });
      document.getElementById('pappers-skip')?.addEventListener('click', () => {
        close();
        callback(null);
      });
    }, 50);
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
      siege_ville: 'Ville', angle_approche: "Angle d'approche", notes: 'Notes',
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
  // OpenAI enrichment (angle_approche, notes, champs manquants)
  // ============================================================

  async function _enrichWithOpenAI(companyName, baseData, currentValues) {
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
    // Carry over Pappers metadata
    if (baseData._pappers_naf) mergedContext._pappers_naf = baseData._pappers_naf;
    if (baseData._pappers_forme) mergedContext._pappers_forme = baseData._pappers_forme;
    if (baseData._pappers_siren) mergedContext._pappers_siren = baseData._pappers_siren;

    const existingContext = _buildExistingContext(mergedContext);

    const systemPrompt = `Tu es un assistant spécialisé dans la recherche d'informations sur les entreprises pour un ATS de recrutement.
Des données officielles sur cette entreprise sont déjà connues (via Pappers/registres). Ton rôle est de les COMPLÉTER :
- CONSERVE toutes les données existantes telles quelles (ne modifie PAS les champs déjà renseignés).
- COMPLÈTE uniquement les champs vides : site_web, telephone, angle_approche, notes, et éventuellement localisation.
- Pour "angle_approche", rédige 1-2 phrases sur comment approcher cette entreprise pour du recrutement IT/Digital.
- Pour "notes", rédige 2-3 phrases factuelles sur l'activité et le positionnement de l'entreprise.
Si une information n'est pas connue, laisse vide "".

Pour les champs select, choisis parmi :
Secteur: ${secteurs.join(', ')}
Taille: ${tailles.join(', ')}
CA: ${caOptions.join(', ')}

Réponds UNIQUEMENT avec le JSON, sans commentaires ni markdown.`;

    const userPrompt = `Complète les informations sur l'entreprise "${companyName.trim()}"

Données déjà connues :
${existingContext}

Format JSON attendu (reprends les valeurs existantes, complète les champs vides) :
{
  "nom": "", "secteur": "", "taille": "", "ca": "",
  "localisation": "", "site_web": "", "telephone": "",
  "siege_adresse": "", "siege_code_postal": "", "siege_ville": "",
  "angle_approche": "", "notes": ""
}

Pour "site_web", donne l'URL complète avec https://. Si déjà renseigné, conserve-le.
Pour "telephone", format français (+33 ou 0x xx xx xx xx).`;

    try {
      const aiResult = await _callOpenAI(systemPrompt, userPrompt);

      // Post-process select fields
      if (aiResult.secteur) aiResult.secteur = _matchSelectOption(aiResult.secteur, secteurs);
      if (aiResult.taille) aiResult.taille = _matchSelectOption(aiResult.taille, tailles);
      if (aiResult.ca) aiResult.ca = _matchSelectOption(aiResult.ca, caOptions);

      // Merge: Pappers data takes priority, OpenAI fills gaps
      const merged = { ...baseData };
      for (const [k, v] of Object.entries(aiResult)) {
        if (k.startsWith('_')) continue;
        const val = (v || '').toString().trim();
        if (!val) continue;
        // Only fill if baseData is empty for this field
        if (!merged[k] || !merged[k].toString().trim()) {
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

      if (results && results.length > 0) {
        if (results.length === 1 || autoSelectFirst) {
          // Single result or auto-select mode → use first result directly
          pappersData = _mapPappersToFields(results[0]);
        } else {
          // Multiple results → let user choose
          pappersData = await new Promise((resolve) => {
            _showPappersSelectionModal(results, (selected) => {
              if (selected) {
                resolve(_mapPappersToFields(selected));
              } else {
                resolve(null); // User skipped
              }
            });
          });
        }
      }
    }

    // Step 2: Enrich with OpenAI (or use OpenAI-only if no Pappers)
    if (pappersData) {
      if (hasOpenAI) {
        if (onStatusUpdate) onStatusUpdate('Enrichissement via IA...');
        return await _enrichWithOpenAI(companyName, pappersData, currentValues);
      }
      return pappersData;
    }

    // Fallback: OpenAI only
    if (!hasOpenAI) {
      throw new Error('Aucun résultat Pappers trouvé et OpenAI non configuré.');
    }

    if (onStatusUpdate) onStatusUpdate('Recherche via IA...');
    return await _fetchWithOpenAIOnly(companyName, currentValues);
  }

  // OpenAI-only fallback (original behavior)
  async function _fetchWithOpenAIOnly(companyName, currentValues) {
    const secteurs = Referentiels.get('entreprise_secteurs');
    const tailles = Referentiels.get('entreprise_tailles');
    const caOptions = ['< 5 M€', '5-20 M€', '20-50 M€', '50-100 M€', '100-250 M€', '250 M€+'];

    const existingContext = _buildExistingContext(currentValues);

    const systemPrompt = `Tu es un assistant spécialisé dans la recherche d'informations sur les entreprises françaises et internationales pour un outil de CRM/ATS de recrutement.
À partir du nom d'une entreprise, recherche dans tes connaissances les informations publiques disponibles et retourne-les au format JSON strict.
Si une information n'est pas connue ou incertaine, laisse la valeur comme chaîne vide "".

IMPORTANT : Des informations sur cette entreprise sont peut-être déjà connues et te seront fournies comme contexte.
- Si un champ existant est déjà renseigné et correct, REPRENDS-LE tel quel.
- Utilise ces informations existantes pour mieux identifier l'entreprise.
- Complète uniquement les champs vides.

Pour les champs select, choisis parmi :
Secteur: ${secteurs.join(', ')}
Taille: ${tailles.join(', ')}
CA: ${caOptions.join(', ')}

Réponds UNIQUEMENT avec le JSON, sans commentaires ni markdown.`;

    let userPrompt = `Recherche les informations publiques sur l'entreprise suivante : "${companyName.trim()}"`;

    if (existingContext) {
      userPrompt += `\n\nDonnées déjà connues :\n${existingContext}`;
    }

    userPrompt += `

Format JSON attendu :
{
  "nom": "", "secteur": "", "taille": "", "ca": "",
  "localisation": "", "site_web": "", "telephone": "",
  "siege_adresse": "", "siege_code_postal": "", "siege_ville": "",
  "angle_approche": "", "notes": ""
}

Pour "nom", retourne le nom officiel/complet.
Pour "localisation", la région ou grande ville du siège.
Pour "angle_approche", 1-2 phrases sur l'approche recrutement IT/Digital.
Pour "notes", résumé factuel 2-3 phrases.
Pour "site_web", URL complète avec https://. Si déjà renseigné, conserve-le.
Pour "telephone", format français.`;

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
    { key: 'angle_approche', label: "Angle d'approche" },
    { key: 'notes', label: 'Notes' },
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
