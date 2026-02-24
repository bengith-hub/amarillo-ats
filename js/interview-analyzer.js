// Amarillo ATS — Interview Analyzer
// Analyse les notes d'entretien + CV (optionnel) via OpenAI pour générer/enrichir
// les champs de l'onglet Entretien (synthese_30s, parcours_cible, motivation_drivers, lecture_recruteur).
// Réutilise CVParser.getOpenAIKey() pour la clé API.

const InterviewAnalyzer = (function() {

  // --- Appel OpenAI générique (réutilisable pour d'autres features IA) ---

  async function _callOpenAI(systemPrompt, userPrompt) {
    const apiKey = CVParser.getOpenAIKey();
    if (!apiKey) {
      throw new Error('Clé API OpenAI non configurée.');
    }

    const requestBody = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 3000
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
      if (response.status === 401) {
        throw new Error('Clé API OpenAI invalide. Vérifiez votre configuration.');
      }
      if (response.status === 429) {
        throw new Error('Limite de requêtes OpenAI atteinte. Réessayez dans 30 secondes.');
      }
      throw new Error(`Erreur OpenAI (${response.status}): ${err.error?.message || 'Erreur inconnue'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Réponse vide de l\'API OpenAI.');
    }

    let jsonStr = content;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Impossible de parser la réponse. Réponse brute : ' + content.substring(0, 300));
    }
  }

  // --- Prompts ---

  const SYSTEM_GENERATE = `Tu es un assistant expert en recrutement (cabinet de chasse de têtes) en France.
A partir des notes d'entretien brutes du recruteur (et optionnellement du CV du candidat), tu dois rédiger 4 sections structurées pour la fiche candidat dans un ATS.

Réponds UNIQUEMENT avec un JSON contenant ces 4 clés :
{
  "synthese_30s": "...",
  "parcours_cible": "...",
  "motivation_drivers": "...",
  "lecture_recruteur": "..."
}

Instructions pour chaque section :

1. synthese_30s (Synthèse 30 secondes) :
Résumé percutant en 3-5 phrases max. Doit permettre de pitcher le candidat en 30 secondes à un client. Inclure : poste actuel, entreprise, périmètre, ancienneté approximative, localisation, disponibilité si mentionnée.

2. parcours_cible (Parcours cible) :
Analyse du parcours professionnel orientée vers le poste recherché. Inclure :
- Intitulé cible et périmètre souhaité (équipe, budget, scope)
- Résumé des 2-3 derniers postes (entreprise - rôle - durée) sous forme de tirets
- Formations/diplômes clés si pertinents

3. motivation_drivers (Motivation & Drivers) :
- Pourquoi le candidat écoute le marché maintenant
- Ce qu'il recherche (drivers positifs : type de projet, culture, management, rémunération...)
- Ce qu'il fuit (points de douleur actuels)
- Éléments de timing (préavis, disponibilité, urgence)

4. lecture_recruteur (Lecture recruteur) :
Analyse interne du recruteur, le candidat ne verra jamais cette section. Sois direct et factuel :
- Fit poste : adéquation compétences/expérience avec le type de poste visé
- Fit culture : personnalité, valeurs, soft skills observées pendant l'échange
- Risques : points de vigilance, zones d'ombre, contre-indications éventuelles
- Niveau réel estimé (Junior / Confirmé / Senior / Top Manager)

Règles de formatage :
- Utilise du texte avec des retours à la ligne et des tirets (-) pour les listes
- Pas de markdown gras (**), pas de titres (#), pas de puces numérotées
- Si une information n'est pas disponible dans les notes, écris "Non renseigné" pour cette partie
- Écris en français`;

  const SYSTEM_ENRICH = `Tu es un assistant expert en recrutement (cabinet de chasse de têtes) en France.
On te fournit des sections déjà rédigées pour la fiche d'un candidat dans un ATS, ainsi que le CV du candidat et les notes d'entretien du recruteur.

Ta mission : ENRICHIR les sections existantes avec les informations du CV, sans tout réécrire.

Règles :
- Conserve le contenu existant et le ton utilisé
- Ajoute les informations factuelles du CV qui manquent (dates précises, intitulés exacts, entreprises, formations, chiffres)
- Précise ou corrige les informations vagues grâce au CV
- Ne supprime pas les observations du recruteur issues de l'entretien
- Ne réinvente pas d'informations qui ne sont ni dans les notes ni dans le CV

Réponds UNIQUEMENT avec un JSON contenant ces 4 clés :
{
  "synthese_30s": "...",
  "parcours_cible": "...",
  "motivation_drivers": "...",
  "lecture_recruteur": "..."
}

Règles de formatage :
- Utilise du texte avec des retours à la ligne et des tirets (-) pour les listes
- Pas de markdown gras (**), pas de titres (#)
- Écris en français`;

  const SYSTEM_FEEDBACK = `Tu es un consultant senior en recrutement (cabinet de chasse de têtes) en France.
A partir des notes de débriefing client (raisons du refus, éléments factuels), tu dois rédiger un retour constructif et bienveillant pour le candidat qui n'a pas été retenu.

Ce feedback sera utilisé de deux façons :
1. Le recruteur le lira au téléphone au candidat
2. Il sera ensuite envoyé par email comme confirmation écrite

Réponds UNIQUEMENT avec un JSON contenant ces clés :
{
  "objet_email": "...",
  "feedback_text": "...",
  "points_forts": "...",
  "axes_amelioration": "...",
  "encouragement": "..."
}

Instructions pour chaque section :

1. objet_email : L'objet de l'email de retour. Court et professionnel. Exemple : "Retour suite à votre candidature — [Poste]"

2. feedback_text : Le corps principal du retour. Structure :
- Remercier le candidat pour sa disponibilité et l'échange
- Rappeler brièvement le contexte (poste, entreprise si non confidentiel)
- Expliquer de manière constructive pourquoi la candidature n'a pas été retenue
- Reformuler les raisons du client de façon diplomate et professionnelle
- JAMAIS de critique personnelle, JAMAIS de jugement de valeur
- Tourner les points négatifs en axes de développement

3. points_forts : 2-3 points forts du candidat identifiés pendant le process, à valoriser

4. axes_amelioration : 1-2 axes de progression formulés positivement (pas de critique)

5. encouragement : 1-2 phrases de clôture encourageantes, ouvrant la porte à de futures opportunités

Règles impératives :
- Ton : professionnel, bienveillant, direct mais jamais brutal
- Aucune mention du nom du client si le process était confidentiel
- Aucun détail qui pourrait mettre le recruteur ou le client en difficulté
- Formulations diplomates : préférer "le profil recherché s'orientait davantage vers..." plutôt que "vous n'aviez pas les compétences"
- Écris en français
- Vouvoiement par défaut
- Le texte doit être lisible à voix haute au téléphone (phrases courtes, naturelles)
- Pas de markdown gras (**), pas de titres (#)
- Utilise des tirets (-) pour les listes`;

  // --- Fonctions publiques ---

  async function generateRejectionFeedback(debriefNotes, context) {
    let userPrompt = `--- CONTEXTE ---\n`;
    userPrompt += `Candidat : ${context.candidatNom || 'Non précisé'}\n`;
    userPrompt += `Poste visé : ${context.poste || 'Non précisé'}\n`;
    userPrompt += `Entreprise : ${context.entreprise || 'Entreprise confidentielle'}\n`;
    if (context.datePresentation) {
      userPrompt += `Date de présentation : ${context.datePresentation}\n`;
    }
    userPrompt += '\n';

    if (context.synthese) {
      userPrompt += `--- SYNTHÈSE DU CANDIDAT ---\n${context.synthese.substring(0, 2000)}\n\n`;
    }

    userPrompt += `--- NOTES DE DÉBRIEFING CLIENT (raisons du refus) ---\n`;
    userPrompt += `${debriefNotes.substring(0, 5000)}\n---\n\n`;
    userPrompt += `Rédige un retour constructif pour ce candidat en respectant les consignes.`;

    return await _callOpenAI(SYSTEM_FEEDBACK, userPrompt);
  }

  async function analyze(notesText, cvText) {
    let userPrompt = '';

    if (cvText) {
      userPrompt += `--- CV DU CANDIDAT ---\n${cvText.substring(0, 10000)}\n---\n\n`;
    }

    userPrompt += `--- NOTES D'ENTRETIEN ---\n${notesText.substring(0, 10000)}\n---\n\n`;
    userPrompt += `Analyse ces notes d'entretien${cvText ? ' et le CV ci-dessus' : ''} et rédige les 4 sections.`;

    return await _callOpenAI(SYSTEM_GENERATE, userPrompt);
  }

  async function enrich(existingFields, cvText, notesText) {
    if (!cvText) {
      throw new Error('Le CV est requis pour enrichir les champs existants.');
    }

    let userPrompt = `--- CV DU CANDIDAT ---\n${cvText.substring(0, 10000)}\n---\n\n`;

    userPrompt += `--- CONTENU ACTUEL DES SECTIONS ---\n`;
    userPrompt += `Synthèse 30s :\n${existingFields.synthese_30s || '(vide)'}\n\n`;
    userPrompt += `Parcours cible :\n${existingFields.parcours_cible || '(vide)'}\n\n`;
    userPrompt += `Motivation & Drivers :\n${existingFields.motivation_drivers || '(vide)'}\n\n`;
    userPrompt += `Lecture recruteur :\n${existingFields.lecture_recruteur || '(vide)'}\n---\n\n`;

    if (notesText) {
      userPrompt += `--- NOTES D'ENTRETIEN (pour contexte) ---\n${notesText.substring(0, 8000)}\n---\n\n`;
    }

    userPrompt += `Enrichis les 4 sections ci-dessus avec les informations du CV. Conserve le contenu existant.`;

    return await _callOpenAI(SYSTEM_ENRICH, userPrompt);
  }

  return {
    analyze,
    enrich,
    generateRejectionFeedback,
    _callOpenAI // Exposé pour réutilisation future (screening, etc.)
  };

})();
