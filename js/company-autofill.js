// Amarillo ATS — Company Autofill (recherche d'infos entreprise via OpenAI)
// Recherche les informations publiques d'une entreprise via l'API OpenAI
// et propose un modal de revue pour valider/appliquer les champs.
// Réutilise CVParser.getOpenAIKey() pour la clé API.

const CompanyAutofill = (function() {

  // Appeler l'API OpenAI pour rechercher les infos entreprise
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

      // Backoff exponentiel : 2s, 4s, 8s
      const wait = Math.pow(2, attempt + 1) * 1000;
      await new Promise(r => setTimeout(r, wait));
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('Clé API OpenAI invalide. Vérifiez votre clé dans la configuration.');
      }
      if (response.status === 429) {
        throw new Error('Limite de requêtes OpenAI atteinte. Réessayez dans 30 secondes. Si le problème persiste, vérifiez votre quota sur platform.openai.com.');
      }
      throw new Error(`Erreur OpenAI (${response.status}): ${err.error?.message || 'Erreur inconnue'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Réponse vide de l\'API OpenAI.');
    }

    // Parser le JSON (enlever les backticks markdown si présents)
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

    // Exact match
    if (options.includes(aiValue)) return aiValue;

    // Case-insensitive exact match
    const lower = aiValue.toLowerCase().trim();
    const exactCI = options.find(o => o.toLowerCase().trim() === lower);
    if (exactCI) return exactCI;

    // Containment match
    const contained = options.find(o =>
      lower.includes(o.toLowerCase().trim()) || o.toLowerCase().trim().includes(lower)
    );
    if (contained) return contained;

    // No match — return empty to avoid invalid data
    return '';
  }

  // Construire un résumé des données existantes pour le contexte du prompt
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

    // Décideurs connus
    if (currentValues._decideurs && currentValues._decideurs.length > 0) {
      const decList = currentValues._decideurs.map(d =>
        `${d.prenom || ''} ${d.nom || ''}`.trim() + (d.fonction ? ` (${d.fonction})` : '')
      ).join(', ');
      lines.push(`- Décideurs connus : ${decList}`);
    }

    return lines.length > 0 ? lines.join('\n') : '';
  }

  // Rechercher les informations d'une entreprise via OpenAI
  async function fetchCompanyInfo(companyName, currentValues) {
    if (!companyName || companyName.trim().length < 2) {
      throw new Error('Veuillez saisir un nom d\'entreprise valide.');
    }

    const secteurs = Referentiels.get('entreprise_secteurs');
    const tailles = Referentiels.get('entreprise_tailles');
    const caOptions = ['< 5 M€', '5-20 M€', '20-50 M€', '50-100 M€', '100-250 M€', '250 M€+'];

    const existingContext = _buildExistingContext(currentValues);

    const systemPrompt = `Tu es un assistant spécialisé dans la recherche d'informations sur les entreprises françaises et internationales pour un outil de CRM/ATS de recrutement.
À partir du nom d'une entreprise, recherche dans tes connaissances les informations publiques disponibles et retourne-les au format JSON strict.
Si une information n'est pas connue ou incertaine, laisse la valeur comme chaîne vide "".
Pour les champs à choix multiples, choisis OBLIGATOIREMENT parmi les options fournies ci-dessous. Si aucune option ne correspond, laisse vide.

IMPORTANT : Des informations sur cette entreprise sont peut-être déjà connues et te seront fournies comme contexte.
- Si un champ existant est déjà renseigné et correct, REPRENDS-LE tel quel dans ta réponse (ne le remplace pas par une autre valeur).
- Utilise ces informations existantes pour mieux identifier l'entreprise et fournir des données plus précises.
- Complète uniquement les champs vides ou améliore ceux qui semblent incomplets.

Secteur (champ "secteur"), choisis parmi :
${secteurs.join(', ')}

Taille (champ "taille"), choisis parmi :
${tailles.join(', ')}

Chiffre d'affaires (champ "ca"), choisis parmi :
${caOptions.join(', ')}

Réponds UNIQUEMENT avec le JSON, sans commentaires ni markdown.`;

    let userPrompt = `Recherche les informations publiques sur l'entreprise suivante : "${companyName.trim()}"`;

    if (existingContext) {
      userPrompt += `

Voici les informations DÉJÀ CONNUES sur cette entreprise dans notre base (à conserver si correctes, à utiliser comme contexte) :
${existingContext}`;
    }

    userPrompt += `

Format JSON attendu :
{
  "nom": "",
  "secteur": "",
  "taille": "",
  "ca": "",
  "localisation": "",
  "site_web": "",
  "telephone": "",
  "siege_adresse": "",
  "siege_code_postal": "",
  "siege_ville": "",
  "angle_approche": "",
  "notes": ""
}

Pour "nom", retourne le nom officiel/complet de l'entreprise.
Pour "localisation", indique la région ou grande ville où se situe le siège (ex: "Paris", "Lyon", "Île-de-France").
Pour "angle_approche", suggère 1-2 phrases sur comment approcher cette entreprise dans un contexte de recrutement IT/Digital (projets en cours, transformation digitale, croissance, etc.).
Pour "notes", fournis un résumé factuel de 2-3 phrases sur l'entreprise (activité principale, positionnement marché, fait notable récent si connu).
Pour "site_web", donne l'URL complète avec https://. Si un site web est déjà renseigné dans les données existantes, conserve-le.
Pour "telephone", donne le numéro du standard si connu, au format français (+33 ou 0x xx xx xx xx).`;

    const result = await _callOpenAI(systemPrompt, userPrompt);

    // Post-process: validate select fields
    if (result.secteur) result.secteur = _matchSelectOption(result.secteur, secteurs);
    if (result.taille) result.taille = _matchSelectOption(result.taille, tailles);
    if (result.ca) result.ca = _matchSelectOption(result.ca, caOptions);

    return result;
  }

  // Définition des champs entreprise pour la modale de revue
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

  // Modale de revue des informations extraites (pattern identique à candidat-detail.js showProfileReviewModal)
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

    const bodyHtml = `
      <div style="margin-bottom:12px;font-size:0.8125rem;color:#475569;">
        Cochez les champs à appliquer. Les valeurs proposées sont éditables.
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

  return {
    fetchCompanyInfo,
    showReviewModal
  };

})();
