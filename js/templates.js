// Amarillo ATS — Templates & Trames (importés depuis Notion)

const DEFAULT_TEMPLATES = {

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

// ============================================================
// TEMPLATES STORE — persistence layer (localStorage)
// ============================================================
const TemplatesStore = (() => {
  const STORAGE_KEY = 'ats_templates';
  const CATEGORIES_KEY = 'ats_templates_categories';

  const DEFAULT_CATEGORIES = {
    'Candidats': ['entretien', 'reference', 'messageCandidats'],
    'Missions': ['cadreMission', 'suiviJ3', 'suiviM1', 'suiviM2'],
    'Prospection': ['pitchs', 'objections']
  };

  function loadAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TEMPLATES };
    try {
      const saved = JSON.parse(raw);
      // Merge: saved overrides defaults, add new defaults
      const merged = { ...DEFAULT_TEMPLATES, ...saved };
      return merged;
    } catch { return { ...DEFAULT_TEMPLATES }; }
  }

  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function get(key) {
    return loadAll()[key] || null;
  }

  function save(key, tplData) {
    const all = loadAll();
    all[key] = tplData;
    saveAll(all);
  }

  function remove(key) {
    const all = loadAll();
    delete all[key];
    saveAll(all);
    // Also remove from categories
    const cats = getCategories();
    for (const cat of Object.keys(cats)) {
      cats[cat] = cats[cat].filter(k => k !== key);
    }
    saveCategories(cats);
  }

  function getCategories() {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return { ...DEFAULT_CATEGORIES };
    try {
      return JSON.parse(raw);
    } catch { return { ...DEFAULT_CATEGORIES }; }
  }

  function saveCategories(cats) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
  }

  function addToCategory(category, key) {
    const cats = getCategories();
    if (!cats[category]) cats[category] = [];
    if (!cats[category].includes(key)) cats[category].push(key);
    saveCategories(cats);
  }

  function resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CATEGORIES_KEY);
  }

  return { loadAll, saveAll, get, save, remove, getCategories, saveCategories, addToCategory, resetAll, DEFAULT_CATEGORIES };
})();

// Backward compat: global TEMPLATES alias (supports Object.entries/keys)
const TEMPLATES = new Proxy({}, {
  get: (_, key) => {
    if (key === Symbol.iterator) return undefined;
    return TemplatesStore.loadAll()[key];
  },
  ownKeys: () => Object.keys(TemplatesStore.loadAll()),
  getOwnPropertyDescriptor: (_, key) => {
    const all = TemplatesStore.loadAll();
    if (key in all) return { configurable: true, enumerable: true, value: all[key] };
    return undefined;
  },
  has: (_, key) => key in TemplatesStore.loadAll()
});

// Render a template as HTML for display in a modal
function renderTemplate(templateKey) {
  const tpl = TemplatesStore.get(templateKey);
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
  const tpl = TemplatesStore.get(templateKey);
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
  const categories = TemplatesStore.getCategories();
  const allTemplates = TemplatesStore.loadAll();

  let bodyHtml = '';

  for (const [cat, keys] of Object.entries(categories)) {
    const validKeys = keys.filter(k => allTemplates[k]);
    if (validKeys.length === 0) continue;

    bodyHtml += `<div style="margin-bottom:16px;">`;
    bodyHtml += `<div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">${cat}</div>`;

    for (const key of validKeys) {
      const tpl = allTemplates[key];
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
  const tpl = TemplatesStore.get(templateKey);
  if (!tpl) return;
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

// ============================================================
// TEMPLATE EDITOR — modal for creating / editing a template
// ============================================================
function showTemplateEditor(key, onSaved) {
  const allTemplates = TemplatesStore.loadAll();
  const isNew = !key;
  const tpl = isNew ? { title: '', icon: '📝', sections: [{ title: '', fields: [''] }] } : JSON.parse(JSON.stringify(allTemplates[key]));
  const tplKey = key || 'tpl_' + Date.now();

  function buildEditorHtml() {
    return `
      <div style="max-height:65vh;overflow-y:auto;padding-right:8px;">
        <div class="form-row">
          <div class="form-group" style="flex:0 0 60px;">
            <label>Icône</label>
            <input type="text" id="tpl-ed-icon" value="${tpl.icon}" style="text-align:center;font-size:1.25rem;" />
          </div>
          <div class="form-group" style="flex:1;">
            <label>Titre</label>
            <input type="text" id="tpl-ed-title" value="${UI.escHtml(tpl.title)}" placeholder="Nom de la trame..." />
          </div>
        </div>
        <div class="form-group">
          <label>Catégorie</label>
          <select id="tpl-ed-category">
            ${Object.keys(TemplatesStore.getCategories()).map(cat => {
              const cats = TemplatesStore.getCategories();
              const selected = key && cats[cat] && cats[cat].includes(key) ? 'selected' : '';
              return `<option value="${cat}" ${selected}>${cat}</option>`;
            }).join('')}
          </select>
        </div>
        <div style="margin-top:16px;margin-bottom:8px;font-weight:600;font-size:0.875rem;">Sections</div>
        <div id="tpl-ed-sections">
          ${tpl.sections.map((sec, i) => `
            <div class="tpl-section-block" data-idx="${i}" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;">
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <input type="text" class="tpl-sec-title" value="${UI.escHtml(sec.title)}" placeholder="Titre de la section" style="flex:1;font-weight:600;" />
                <button class="btn btn-sm" onclick="this.closest('.tpl-section-block').remove()" style="color:#dc2626;padding:4px 8px;">✕</button>
              </div>
              <div style="margin-bottom:6px;font-size:0.75rem;color:#64748b;">
                <label style="cursor:pointer;"><input type="radio" name="sec-type-${i}" value="fields" ${sec.fields ? 'checked' : ''} class="tpl-sec-type" /> Champs (liste)</label>
                <label style="cursor:pointer;margin-left:12px;"><input type="radio" name="sec-type-${i}" value="content" ${sec.content !== undefined && !sec.fields ? 'checked' : ''} class="tpl-sec-type" /> Texte libre</label>
              </div>
              ${sec.fields ? `
                <div class="tpl-sec-fields">
                  ${sec.fields.map(f => `<div style="display:flex;gap:4px;margin-bottom:4px;">
                    <input type="text" class="tpl-field-input" value="${UI.escHtml(f)}" style="flex:1;font-size:0.8125rem;" placeholder="Champ..." />
                    <button class="btn btn-sm" onclick="this.parentElement.remove()" style="color:#dc2626;padding:2px 6px;font-size:0.75rem;">✕</button>
                  </div>`).join('')}
                  <button class="btn btn-sm btn-secondary tpl-add-field" style="font-size:0.75rem;margin-top:4px;">+ Champ</button>
                </div>
              ` : `
                <textarea class="tpl-sec-content" style="width:100%;min-height:80px;font-size:0.8125rem;">${UI.escHtml(sec.content || '')}</textarea>
              `}
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary btn-sm" id="tpl-add-section" style="width:100%;">+ Ajouter une section</button>
      </div>
    `;
  }

  UI.modal(isNew ? 'Nouvelle trame' : 'Modifier la trame', buildEditorHtml(), {
    width: 650,
    saveLabel: 'Enregistrer',
    onSave: () => {
      const overlay = document.querySelector('.modal-overlay');
      const title = overlay.querySelector('#tpl-ed-title').value.trim();
      const icon = overlay.querySelector('#tpl-ed-icon').value.trim() || '📝';
      const category = overlay.querySelector('#tpl-ed-category').value;

      if (!title) { UI.toast('Le titre est requis'); return; }

      // Collect sections
      const sections = [];
      overlay.querySelectorAll('.tpl-section-block').forEach(block => {
        const secTitle = block.querySelector('.tpl-sec-title').value.trim();
        const typeRadio = block.querySelector('.tpl-sec-type:checked');
        const type = typeRadio ? typeRadio.value : 'fields';

        if (type === 'fields') {
          const fields = [];
          block.querySelectorAll('.tpl-field-input').forEach(inp => {
            const v = inp.value.trim();
            if (v) fields.push(v);
          });
          sections.push({ title: secTitle, fields });
        } else {
          const content = block.querySelector('.tpl-sec-content')?.value || '';
          sections.push({ title: secTitle, content });
        }
      });

      // Save template
      TemplatesStore.save(tplKey, { title, icon, sections });

      // Save category assignment
      const cats = TemplatesStore.getCategories();
      // Remove from all categories first
      for (const cat of Object.keys(cats)) {
        cats[cat] = cats[cat].filter(k => k !== tplKey);
      }
      // Add to selected category
      if (!cats[category]) cats[category] = [];
      cats[category].push(tplKey);
      TemplatesStore.saveCategories(cats);

      UI.toast(isNew ? 'Trame créée' : 'Trame mise à jour');
      if (onSaved) onSaved();
    }
  });

  // Bind dynamic behaviors after modal renders
  setTimeout(() => {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    // Add section button
    overlay.querySelector('#tpl-add-section')?.addEventListener('click', () => {
      const container = overlay.querySelector('#tpl-ed-sections');
      const idx = container.querySelectorAll('.tpl-section-block').length;
      const div = document.createElement('div');
      div.className = 'tpl-section-block';
      div.dataset.idx = idx;
      div.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;';
      div.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" class="tpl-sec-title" value="" placeholder="Titre de la section" style="flex:1;font-weight:600;" />
          <button class="btn btn-sm" onclick="this.closest('.tpl-section-block').remove()" style="color:#dc2626;padding:4px 8px;">✕</button>
        </div>
        <div style="margin-bottom:6px;font-size:0.75rem;color:#64748b;">
          <label style="cursor:pointer;"><input type="radio" name="sec-type-${idx}" value="fields" checked class="tpl-sec-type" /> Champs (liste)</label>
          <label style="cursor:pointer;margin-left:12px;"><input type="radio" name="sec-type-${idx}" value="content" class="tpl-sec-type" /> Texte libre</label>
        </div>
        <div class="tpl-sec-fields">
          <div style="display:flex;gap:4px;margin-bottom:4px;">
            <input type="text" class="tpl-field-input" value="" style="flex:1;font-size:0.8125rem;" placeholder="Champ..." />
            <button class="btn btn-sm" onclick="this.parentElement.remove()" style="color:#dc2626;padding:2px 6px;font-size:0.75rem;">✕</button>
          </div>
          <button class="btn btn-sm btn-secondary tpl-add-field" style="font-size:0.75rem;margin-top:4px;">+ Champ</button>
        </div>
      `;
      container.appendChild(div);
      bindAddFieldButtons(overlay);
    });

    // Bind add field buttons
    bindAddFieldButtons(overlay);

    // Bind type radio changes
    overlay.querySelectorAll('.tpl-sec-type').forEach(radio => {
      radio.addEventListener('change', () => {
        const block = radio.closest('.tpl-section-block');
        const type = block.querySelector('.tpl-sec-type:checked').value;
        const existingFields = block.querySelector('.tpl-sec-fields');
        const existingContent = block.querySelector('.tpl-sec-content');

        if (type === 'fields' && !existingFields) {
          if (existingContent) existingContent.remove();
          const div = document.createElement('div');
          div.className = 'tpl-sec-fields';
          div.innerHTML = `
            <div style="display:flex;gap:4px;margin-bottom:4px;">
              <input type="text" class="tpl-field-input" value="" style="flex:1;font-size:0.8125rem;" placeholder="Champ..." />
              <button class="btn btn-sm" onclick="this.parentElement.remove()" style="color:#dc2626;padding:2px 6px;font-size:0.75rem;">✕</button>
            </div>
            <button class="btn btn-sm btn-secondary tpl-add-field" style="font-size:0.75rem;margin-top:4px;">+ Champ</button>
          `;
          block.appendChild(div);
          bindAddFieldButtons(overlay);
        } else if (type === 'content' && !existingContent) {
          if (existingFields) existingFields.remove();
          const ta = document.createElement('textarea');
          ta.className = 'tpl-sec-content';
          ta.style.cssText = 'width:100%;min-height:80px;font-size:0.8125rem;';
          block.appendChild(ta);
        }
      });
    });
  }, 100);
}

function bindAddFieldButtons(overlay) {
  overlay.querySelectorAll('.tpl-add-field').forEach(btn => {
    // Remove old listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.replaceWith(newBtn);
    newBtn.addEventListener('click', () => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;';
      div.innerHTML = `
        <input type="text" class="tpl-field-input" value="" style="flex:1;font-size:0.8125rem;" placeholder="Champ..." />
        <button class="btn btn-sm" onclick="this.parentElement.remove()" style="color:#dc2626;padding:2px 6px;font-size:0.75rem;">✕</button>
      `;
      newBtn.parentElement.insertBefore(div, newBtn);
    });
  });
}
