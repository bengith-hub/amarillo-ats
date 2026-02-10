// Amarillo ATS — Templates & Trames (importés depuis Notion)

const TEMPLATES = {

  // =============================================
  // TRAME D'ENTRETIEN CANDIDAT
  // =============================================
  entretien: {
    title: "Fiche candidat — Entretien",
    icon: "🎙️",
    sections: [
      {
        title: "Synthèse 30 secondes",
        fields: [
          "Poste actuel :",
          "Entreprise :",
          "Localisation :",
          "Disponibilité :",
          "Préavis :"
        ]
      },
      {
        title: "Parcours ciblé",
        fields: [
          "Intitulé :",
          "Périmètre :",
          "Taille équipe / budget :",
          "Avant : Entreprise – rôle – durée (max 3 lignes)"
        ]
      },
      {
        title: "Package & attentes",
        fields: [
          "Fixe actuel :",
          "Variable actuel :",
          "Package souhaité :",
          "RTT / TT :",
          "Points non négociables :"
        ]
      },
      {
        title: "Motivation & drivers",
        fields: [
          "Pourquoi écouter le marché maintenant ?",
          "Ce qu'il/elle cherche :",
          "Ce qu'il/elle fuit :"
        ]
      },
      {
        title: "Lecture recruteur (interne)",
        fields: [
          "Niveau réel :",
          "Points de différenciation :",
          "Points de vigilance :",
          "Go / No go shortlist :"
        ]
      }
    ]
  },

  // =============================================
  // APPEL DE RÉFÉRENCE
  // =============================================
  reference: {
    title: "Appel de référence",
    icon: "📞",
    sections: [
      {
        title: "Contexte",
        fields: [
          "Relation avec le candidat :",
          "Période de collaboration :",
          "Poste occupé par le candidat :"
        ]
      },
      {
        title: "Performance & compétences",
        fields: [
          "Principales forces :",
          "Points de différenciation :",
          "Axes d'amélioration :"
        ]
      },
      {
        title: "Comportement & posture",
        fields: [
          "Relation au management :",
          "Travail en équipe :",
          "Gestion de la pression / conflits :"
        ]
      },
      {
        title: "Leadership (si applicable)",
        fields: [
          "Style de management :",
          "Capacité de décision :",
          "Capacité à faire grandir les équipes :"
        ]
      },
      {
        title: "Contexte de départ",
        fields: [
          "Conditions du départ :",
          "Raisons évoquées :"
        ]
      },
      {
        title: "Conclusion",
        fields: [
          "Le recommanderiez-vous ?",
          "Pour quel type de contexte ?",
          "Points de vigilance à signaler ?"
        ]
      }
    ]
  },

  // =============================================
  // CADRE DE MISSION
  // =============================================
  cadreMission: {
    title: "Cadre de mission — Conditions & Garanties",
    icon: "📑",
    sections: [
      {
        title: "Identité",
        fields: [
          "Client :",
          "Poste :",
          "Niveau : ☐ Middle  ☐ Top",
          "Décideur identifié : ☐ Oui  ☐ Non",
          "Date de cadrage :"
        ]
      },
      {
        title: "Délais de référence",
        fields: [
          "☐ Cadrage validé sous 48h",
          "☐ 1ers profils sous 10–15 jours ouvrés",
          "☐ 3 à 5 profils max",
          "☐ Feedback client ≤ 5–7 jours / étape",
          "⚠️ Au-delà : risque de perte de candidats"
        ]
      },
      {
        title: "Exclusivité",
        fields: [
          "☐ Exclusivité formelle  ☐ Exclusivité de fait",
          "Durée : ☐ 6 semaines (Middle)  ☐ 8–10 semaines (Top)",
          "☐ Décideur impliqué  ☐ Process validé  ☐ Délais respectés"
        ]
      },
      {
        title: "Honoraires",
        fields: [
          "Middle : ☐ 18% (standard)  ☐ 16–20% (plage)",
          "Top : ☐ 22% (standard)  ☐ 20–25% (plage)",
          "Base : rémunération brute annuelle fixe",
          "Modalité : ☐ Succès  ☐ Acompte"
        ]
      },
      {
        title: "Garantie",
        fields: [
          "☐ 3 mois (Middle)  ☐ 6 mois (Top)",
          "☐ Départ à l'initiative du salarié",
          "☐ Même périmètre de poste  ☐ Un seul remplacement"
        ]
      },
      {
        title: "Checklist d'acceptation",
        fields: [
          "☐ Décideur identifié",
          "☐ Besoin clarifié",
          "☐ Exclusivité actée",
          "☐ Délais validés",
          "☐ Honoraires acceptés",
          "→ 2 ❌ ou plus = mission à risque"
        ]
      }
    ]
  },

  // =============================================
  // SUIVI INTÉGRATION
  // =============================================
  suiviJ3: {
    title: "Suivi intégration — J+3",
    icon: "🧩",
    sections: [
      {
        title: "Checklist sécurisation onboarding",
        fields: [
          "Accès / outils / badge OK ?",
          "Onboarding clair (jour 1 / semaine 1) ?",
          "Premier contact manager / équipe ?",
          "Irritant immédiat ?",
          "Action rapide à déclencher si besoin :"
        ]
      }
    ]
  },

  suiviM1: {
    title: "Suivi intégration — M1",
    icon: "🧩",
    sections: [
      {
        title: "Validation intégration",
        fields: [
          "Onboarding / accès OK ?",
          "Relation manager :",
          "Charge de travail :",
          "Écart promesse / réalité :",
          "Score ressenti (1–10) :",
          "Risques / actions à prévoir :"
        ]
      }
    ]
  },

  suiviM2: {
    title: "Suivi intégration — M2",
    icon: "🧩",
    sections: [
      {
        title: "Détection signaux faibles",
        fields: [
          "Motivation / énergie :",
          "Autonomie sur le poste :",
          "Frictions (équipe, process, culture) :",
          "Projection à 3–6 mois :",
          "Signaux faibles identifiés :",
          "Action préventive à lancer :",
          "→ Statut du placement : ☐ OK  ☐ Alerte"
        ]
      }
    ]
  },

  // =============================================
  // SCRIPTS & PITCHS
  // =============================================
  pitchs: {
    title: "Scripts & Pitchs de prospection",
    icon: "🎯",
    sections: [
      {
        title: "Règle d'or",
        fields: [
          "Un pitch = ouvrir un échange",
          "Pas d'argumentaire, pas de justification",
          "Une question → silence"
        ]
      },
      {
        title: "Pitch standard",
        content: "« Bonjour, Benjamin Fetu, Amarillo Search.\nJ'accompagne des dirigeants de PME et d'ETI sur des recrutements middle et top management.\nJ'interviens surtout dans des contextes de structuration ou de transformation, quand le recrutement est un vrai enjeu de décision.\nJe vous appelle pour savoir si le sujet recrutement est d'actualité chez vous en ce moment. »"
      },
      {
        title: "Pitch 30s — version pro",
        content: "« J'accompagne des dirigeants de PME et d'ETI sur des recrutements middle et top management.\nJ'interviens surtout quand le poste est structurant — croissance, transformation, remplacement sensible — et que le dirigeant veut sécuriser la décision plutôt que multiplier les CV. »"
      },
      {
        title: "Accroche problème (décideur pressé)",
        content: "« Bonjour, Benjamin Fetu, Amarillo Search.\nJ'aide des dirigeants à sécuriser des recrutements clés.\nEst-ce un sujet sensible chez vous en ce moment, ou pas du tout ? »"
      },
      {
        title: "Contexte tiède / recommandation",
        content: "« Bonjour, Benjamin Fetu, Amarillo Search.\nJe travaille avec des dirigeants sur des recrutements middle et top management, et votre nom est revenu dans ce cadre.\nJe voulais simplement échanger quelques minutes avec vous pour comprendre vos enjeux actuels. »"
      },
      {
        title: "Pitch ultra court (15s)",
        content: "« J'accompagne des dirigeants sur des recrutements middle et top management, avec une approche très ciblée et peu de missions en parallèle, pour sécuriser les décisions. »"
      },
      {
        title: "Pitch long (2 min — RDV client)",
        content: "« Mon rôle n'est pas simplement de présenter des profils, mais d'aider un décideur à sécuriser un recrutement clé.\nJe commence toujours par cadrer le besoin réel : enjeux, contexte, critères de décision.\nEnsuite, je travaille en approche directe très ciblée, avec une qualification approfondie des candidats.\nJe présente peu de profils, mais chacun est argumenté, contextualisé et aligné avec vos enjeux.\nJe m'implique personnellement sur chaque mission, ce qui suppose un cadre clair, un décideur impliqué et un process fluide. »"
      }
    ]
  },

  // =============================================
  // MESSAGE LINKEDIN CANDIDATS
  // =============================================
  messageCandidats: {
    title: "Message LinkedIn — Candidats DSI/DSIN",
    icon: "📩",
    sections: [
      {
        title: "Message initial",
        content: "Bonjour {{Prénom}},\n\nJ'échange avec des dirigeants sur des recrutements de direction IT / numérique, notamment dans des contextes de transformation.\n\nVotre parcours m'a semblé correspondre à ce type de réflexion, et je me demandais si un nouveau projet pouvait être d'actualité pour vous.\n\nSeriez-vous ouvert à un échange de moins de 10min, simplement pour voir si le sujet mérite discussion ?"
      },
      {
        title: "Relance J+7",
        content: "Bonjour {{Prénom}},\n\nJe me permets une relance rapide concernant mon message précédent.\n\nL'idée reste simplement un échange très court, pour voir si un nouveau projet pourrait avoir du sens pour vous — ou pas.\n\nDites-moi librement, aucun souci dans les deux cas."
      }
    ]
  },

  // =============================================
  // OBJECTIONS
  // =============================================
  objections: {
    title: "Objections structurantes",
    icon: "❓",
    sections: [
      {
        title: "« On travaille déjà avec un cabinet »",
        content: "→ Mon rôle n'est pas de remplacer, mais de compléter ou sécuriser un recrutement clé, avec une approche plus ciblée et plus impliquée."
      },
      {
        title: "« On veut aller vite »",
        content: "→ Aller vite sans cadrage fait perdre du temps. Je privilégie la justesse à la précipitation."
      },
      {
        title: "« Vos honoraires sont élevés »",
        content: "→ Ils reflètent surtout le niveau d'implication et le risque assumé. Un recrutement raté coûte toujours plus cher."
      },
      {
        title: "« On préfère attendre »",
        content: "→ Attendre est une décision, mais elle a un coût opérationnel et humain."
      }
    ]
  }
};

// Render a template as HTML for display in a modal
function renderTemplate(templateKey) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) return '';

  let html = '';
  for (const section of tpl.sections) {
    html += `<div style="margin-bottom:20px;">`;
    html += `<h3 style="font-size:0.875rem;font-weight:700;color:#1e293b;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #FECC02;">${section.title}</h3>`;

    if (section.content) {
      html += `<div style="background:#f8fafc;border-radius:8px;padding:12px 16px;font-size:0.8125rem;color:#334155;white-space:pre-wrap;line-height:1.6;border-left:3px solid #FECC02;">${section.content}</div>`;
    }

    if (section.fields) {
      html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
      for (const field of section.fields) {
        html += `<div style="font-size:0.8125rem;color:#475569;padding:4px 0;">• ${field}</div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
  }
  return html;
}

// Render template as copyable text for notes
function renderTemplateText(templateKey) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) return '';

  let text = tpl.icon + ' ' + tpl.title + '\n' + '='.repeat(40) + '\n\n';

  for (const section of tpl.sections) {
    text += '▸ ' + section.title + '\n';
    text += '-'.repeat(30) + '\n';

    if (section.content) {
      text += section.content + '\n';
    }

    if (section.fields) {
      for (const field of section.fields) {
        text += '  ' + field + '\n';
      }
    }

    text += '\n';
  }

  return text;
}

// Show template selector modal
function showTemplatesModal(context) {
  const categories = {
    'Candidats': ['entretien', 'messageCandidats'],
    'Missions': ['cadreMission', 'suiviJ3', 'suiviM1', 'suiviM2'],
    'Prospection': ['pitchs', 'objections']
  };

  let bodyHtml = '';

  for (const [cat, keys] of Object.entries(categories)) {
    bodyHtml += `<div style="margin-bottom:16px;">`;
    bodyHtml += `<div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">${cat}</div>`;

    for (const key of keys) {
      const tpl = TEMPLATES[key];
      bodyHtml += `
        <div class="template-item" data-key="${key}"
          style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all 0.15s;"
          onmouseenter="this.style.borderColor='#FECC02';this.style.background='#FFFDF0'"
          onmouseleave="this.style.borderColor='#e2e8f0';this.style.background='transparent'">
          <span style="font-size:1.25rem;">${tpl.icon}</span>
          <div>
            <div style="font-size:0.8125rem;font-weight:600;color:#1e293b;">${tpl.title}</div>
            <div style="font-size:0.75rem;color:#94a3b8;">${tpl.sections.length} sections</div>
          </div>
        </div>
      `;
    }

    bodyHtml += `</div>`;
  }

  const { close } = UI.modal('Trames & Templates', bodyHtml, { width: 480 });

  // Click handlers
  setTimeout(() => {
    document.querySelectorAll('.template-item').forEach(item => {
      item.addEventListener('click', () => {
        close();
        const key = item.dataset.key;
        showTemplateDetail(key, context);
      });
    });
  }, 50);
}

// Show template detail with copy-to-notes option
function showTemplateDetail(templateKey, context) {
  const tpl = TEMPLATES[templateKey];
  const html = renderTemplate(templateKey);

  const bodyHtml = `
    <div style="max-height:60vh;overflow-y:auto;padding-right:8px;">
      ${html}
    </div>
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;gap:8px;">
      <button class="btn btn-secondary" id="tpl-copy" style="flex:1;">Copier le texte</button>
      ${context && context.candidatId ? '<button class="btn btn-primary" id="tpl-to-notes" style="flex:1;">Coller dans les notes</button>' : ''}
    </div>
  `;

  UI.modal(tpl.icon + ' ' + tpl.title, bodyHtml, { width: 600 });

  setTimeout(() => {
    const copyBtn = document.getElementById('tpl-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = renderTemplateText(templateKey);
        navigator.clipboard.writeText(text).then(() => {
          UI.toast('Template copié !');
        });
      });
    }

    const notesBtn = document.getElementById('tpl-to-notes');
    if (notesBtn && context && context.candidatId) {
      notesBtn.addEventListener('click', async () => {
        const text = renderTemplateText(templateKey);
        const candidat = Store.findById('candidats', context.candidatId);
        if (candidat) {
          const currentNotes = candidat.notes || '';
          const newNotes = currentNotes + (currentNotes ? '\n\n' : '') + text;
          await Store.update('candidats', context.candidatId, { notes: newNotes });
          UI.toast('Template ajouté aux notes du candidat');
          setTimeout(() => location.reload(), 500);
        }
      });
    }
  }, 50);
}
