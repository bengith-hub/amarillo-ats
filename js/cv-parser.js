// Amarillo ATS — CV Parser (extraction via OpenAI)
// Lit un fichier CV (PDF ou texte) et extrait les données candidat via l'API OpenAI.

const CVParser = (function() {

  function getOpenAIKey() {
    return localStorage.getItem('ats_openai_key') || ATS_CONFIG.openaiApiKey || '';
  }

  function setOpenAIKey(key) {
    localStorage.setItem('ats_openai_key', key);
  }

  // Extraire le texte d'un fichier PDF via pdf.js
  async function extractTextFromPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('pdf.js n\'est pas chargé. Impossible de lire les PDF.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      pages.push(text);
    }
    return pages.join('\n\n');
  }

  // Lire le texte brut d'un fichier texte
  async function extractTextFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
      reader.readAsText(file);
    });
  }

  // Extraire le texte selon le type de fichier
  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      return await extractTextFromPDF(file);
    } else if (['txt', 'text', 'md'].includes(ext)) {
      return await extractTextFromFile(file);
    } else if (['doc', 'docx'].includes(ext)) {
      throw new Error('Les fichiers Word (.doc/.docx) ne sont pas supportés directement. Veuillez convertir en PDF ou copier le texte.');
    } else {
      // Tenter la lecture en texte brut
      return await extractTextFromFile(file);
    }
  }

  // Appeler l'API OpenAI pour extraire les données structurées
  async function extractWithOpenAI(textContent) {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
      throw new Error('Clé API OpenAI non configurée. Cliquez sur "Configurer la clé" pour la renseigner.');
    }

    const systemPrompt = `Tu es un assistant spécialisé dans l'extraction de données de CV pour un ATS (Applicant Tracking System) de recrutement en France.
À partir du texte d'un CV, extrais les informations suivantes au format JSON strict.
Si une information n'est pas trouvée, laisse la valeur comme chaîne vide "".
Pour les salaires, donne uniquement le nombre en K€ (ex: 55 pour 55K€). Si un package global est mentionné, répartis entre fixe et variable si possible.
Pour les dates, utilise le format YYYY-MM-DD pour les dates complètes et YYYY-MM pour les mois.
Pour le diplôme, choisis parmi : "Bac+2 (BTS/DUT)", "Bac+3 (Licence)", "Bac+4 (Maîtrise)", "Bac+5 (Master/Ingénieur)", "Bac+8 (Doctorat)", "Autre".

Réponds UNIQUEMENT avec le JSON, sans commentaires ni markdown.`;

    const userPrompt = `Extrais les données candidat du CV suivant :

---
${textContent.substring(0, 12000)}
---

Format JSON attendu :
{
  "prenom": "",
  "nom": "",
  "email": "",
  "telephone": "",
  "linkedin": "",
  "adresse_ligne1": "",
  "code_postal": "",
  "ville": "",
  "localisation": "",
  "poste_actuel": "",
  "entreprise_nom": "",
  "diplome": "",
  "date_naissance": "",
  "debut_carriere": "",
  "debut_poste_actuel": "",
  "synthese_30s": "",
  "notes": ""
}

Pour "synthese_30s", rédige un résumé professionnel de 2-3 phrases.
Pour "notes", liste les compétences clés et technologies mentionnées.
Pour "localisation", indique la région ou grande ville (ex: "Paris", "Lyon", "Île-de-France").`;

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

  // Fonction principale : fichier → données candidat
  async function parseCV(file) {
    const text = await parseFile(file);
    if (!text || text.trim().length < 20) {
      throw new Error('Le fichier semble vide ou contient trop peu de texte.');
    }
    return await extractWithOpenAI(text);
  }

  // UI : modale de configuration de la clé OpenAI
  function showKeyConfigModal(onConfigured) {
    const currentKey = getOpenAIKey();
    const masked = currentKey ? currentKey.substring(0, 7) + '...' + currentKey.substring(currentKey.length - 4) : '';

    const bodyHtml = `
      <div class="form-group">
        <label>Clé API OpenAI</label>
        <input type="password" id="f-openai-key" value="${currentKey}" placeholder="sk-..." style="font-family:monospace;" />
        ${masked ? `<small style="color:#64748b;">Clé actuelle : ${masked}</small>` : '<small style="color:#64748b;">Obtenez votre clé sur <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a></small>'}
      </div>
    `;

    UI.modal('Configuration OpenAI', bodyHtml, {
      width: 450,
      saveLabel: 'Enregistrer',
      onSave: async (overlay) => {
        const key = overlay.querySelector('#f-openai-key').value.trim();
        if (!key) {
          UI.toast('Veuillez renseigner une clé API', 'error');
          throw new Error('validation');
        }
        if (!key.startsWith('sk-')) {
          UI.toast('La clé doit commencer par "sk-"', 'error');
          throw new Error('validation');
        }
        setOpenAIKey(key);
        UI.toast('Clé OpenAI enregistrée');
        if (onConfigured) onConfigured();
      }
    });
  }

  return {
    parseCV,
    parseFile,
    extractWithOpenAI,
    getOpenAIKey,
    setOpenAIKey,
    showKeyConfigModal
  };

})();
