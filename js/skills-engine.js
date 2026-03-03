// Amarillo ATS — Skills Engine
// Moteur de Skills IA configurables : CRUD, resolution variables, execution multi-etapes,
// scraping URLs entite, editeur modal, runner modal.
// Depend de : api.js, store.js, components.js, cv-parser.js (pour getOpenAIKey)

const SkillsEngine = (() => {

  // ============================================================
  // CONSTANTES
  // ============================================================

  const ENTITY_LABELS = {
    candidats: 'Candidat',
    entreprises: 'Entreprise',
    decideurs: 'Decideur'
  };

  const ENTITY_ICONS = {
    candidats: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:middle"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
    entreprises: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:middle"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>',
    decideurs: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:middle"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };

  const SKILL_COLORS = [
    '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
    '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'
  ];

  // ============================================================
  // APPEL OPENAI
  // ============================================================

  async function _callOpenAI(systemPrompt, userPrompt) {
    const apiKey = CVParser.getOpenAIKey();
    if (!apiKey) throw new Error('Cle API OpenAI non configuree.');

    const maxRetries = 3;
    let response;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 3000
        })
      });
      if (response.status !== 429 || attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('Cle API OpenAI invalide.');
      if (response.status === 429) throw new Error('Limite OpenAI atteinte. Reessayez dans 30s.');
      throw new Error('Erreur OpenAI (' + response.status + '): ' + (err.error?.message || 'Erreur inconnue'));
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Reponse vide de OpenAI.');
    return content;
  }

  // ============================================================
  // SCRAPING URLs ENTITE
  // ============================================================

  async function _fetchViaProxy(url, timeoutMs) {
    const proxies = [
      { name: 'netlify', buildUrl: (u) => '/.netlify/functions/cors-proxy?url=' + encodeURIComponent(u), parse: (d) => d },
      { name: 'corsproxy', buildUrl: (u) => 'https://corsproxy.io/?' + encodeURIComponent(u), parse: (d) => d },
    ];
    for (const proxy of proxies) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), timeoutMs || 10000);
        const res = await fetch(proxy.buildUrl(url), { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) continue;
        const raw = await res.text();
        if (raw) return proxy.parse(raw);
      } catch { /* next proxy */ }
    }
    return '';
  }

  function _htmlToText(html) {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, svg, noscript, iframe, link, meta').forEach(el => el.remove());
    let text = doc.body?.textContent || '';
    text = text.replace(/[\t\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').replace(/ {2,}/g, ' ').trim();
    return text.length > 5000 ? text.substring(0, 5000) + '...' : text;
  }

  async function _scrapeEntityUrls(entity, entityType) {
    const urls = [];
    if (entityType === 'candidats' && entity.linkedin) urls.push(entity.linkedin);
    if (entityType === 'entreprises') {
      if (entity.site_web) urls.push(entity.site_web);
      if (entity.linkedin) urls.push(entity.linkedin);
    }
    if (entityType === 'decideurs' && entity.linkedin) urls.push(entity.linkedin);

    if (urls.length === 0) return '';

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        let u = url.trim();
        if (!u.startsWith('http')) u = 'https://' + u;
        const html = await _fetchViaProxy(u, 10000);
        return _htmlToText(html);
      })
    );

    return results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value)
      .join('\n\n---\n\n');
  }

  // ============================================================
  // VARIABLES DE TEMPLATE
  // ============================================================

  function getAvailableVariables(entityType) {
    const vars = [];

    if (entityType === 'candidats' || !entityType) {
      vars.push(
        { key: 'candidat.nom', label: 'Nom' },
        { key: 'candidat.prenom', label: 'Prenom' },
        { key: 'candidat.poste_actuel', label: 'Poste actuel' },
        { key: 'candidat.poste_cible', label: 'Poste cible' },
        { key: 'candidat.localisation', label: 'Localisation' },
        { key: 'candidat.email', label: 'Email' },
        { key: 'candidat.linkedin', label: 'LinkedIn' },
        { key: 'candidat.niveau', label: 'Niveau' },
        { key: 'candidat.notes', label: 'Notes' },
        { key: 'candidat.synthese_30s', label: 'Synthese 30s' },
        { key: 'candidat.parcours_cible', label: 'Parcours cible' },
        { key: 'candidat.motivation_drivers', label: 'Motivation' },
        { key: 'candidat.lecture_recruteur', label: 'Lecture recruteur' },
        { key: 'candidat.notes_entretien', label: 'Notes entretien' },
        { key: 'candidat.entreprise_actuelle', label: 'Entreprise actuelle' }
      );
    }

    if (entityType === 'entreprises' || !entityType) {
      vars.push(
        { key: 'entreprise.nom', label: 'Nom' },
        { key: 'entreprise.secteur', label: 'Secteur' },
        { key: 'entreprise.localisation', label: 'Localisation' },
        { key: 'entreprise.taille', label: 'Taille' },
        { key: 'entreprise.ca', label: 'CA' },
        { key: 'entreprise.description', label: 'Description' },
        { key: 'entreprise.notes', label: 'Notes' }
      );
    }

    if (entityType === 'decideurs' || !entityType) {
      vars.push(
        { key: 'decideur.nom', label: 'Nom' },
        { key: 'decideur.prenom', label: 'Prenom' },
        { key: 'decideur.fonction', label: 'Fonction' },
        { key: 'decideur.linkedin', label: 'LinkedIn' },
        { key: 'decideur.email', label: 'Email' },
        { key: 'decideur.notes', label: 'Notes' },
        { key: 'decideur.entreprise', label: 'Entreprise' }
      );
    }

    // Variables speciales (toujours disponibles)
    vars.push(
      { key: 'previous_step_result', label: 'Resultat etape precedente' },
      { key: 'scraped_content', label: 'Contenu scrape (URLs)' }
    );

    return vars;
  }

  async function _buildContext(entityType, entityId) {
    const ctx = {};

    if (entityType === 'candidats' && entityId) {
      const c = Store.findById('candidats', entityId);
      if (c) {
        ctx.candidat = { ...c };
        // Resolve entreprise actuelle
        if (c.entreprise_actuelle_id) {
          const ent = Store.findById('entreprises', c.entreprise_actuelle_id);
          ctx.candidat.entreprise_actuelle = ent ? ent.nom : '';
        }
        // Build interview notes
        const actions = Store.filter('actions', a =>
          a.candidat_id === entityId && a.notes && a.notes.trim()
        );
        ctx.candidat.notes_entretien = actions
          .map(a => '[' + (a.type || '') + ' - ' + (a.canal || '') + ' - ' + (a.date || '') + ']\n' + a.notes)
          .join('\n\n')
          .substring(0, 10000);
        ctx._entity = c;
      }
    }

    if (entityType === 'entreprises' && entityId) {
      const e = Store.findById('entreprises', entityId);
      if (e) {
        ctx.entreprise = { ...e };
        ctx._entity = e;
      }
    }

    if (entityType === 'decideurs' && entityId) {
      const d = Store.findById('decideurs', entityId);
      if (d) {
        ctx.decideur = { ...d };
        if (d.entreprise_id) {
          const ent = Store.findById('entreprises', d.entreprise_id);
          ctx.decideur.entreprise = ent ? ent.nom : '';
        }
        ctx._entity = d;
      }
    }

    return ctx;
  }

  function _resolveTemplate(template, ctx, stepResults) {
    if (!template) return '';
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const k = key.trim();

      // Step results
      if (k === 'previous_step_result') return stepResults.length > 0 ? stepResults[stepResults.length - 1] : '';
      if (/^step_\d+_result$/.test(k)) {
        const idx = parseInt(k.split('_')[1]) - 1;
        return stepResults[idx] || '';
      }
      if (k === 'scraped_content') return ctx._scraped_content || '';

      // Input variables
      if (k.startsWith('input.')) {
        const inputKey = k.substring(6);
        return ctx._inputs?.[inputKey] || '';
      }

      // Entity variables (candidat.nom, entreprise.secteur, etc.)
      const parts = k.split('.');
      if (parts.length === 2) {
        const obj = ctx[parts[0]];
        if (obj) return obj[parts[1]] || '';
      }

      return match; // Leave unresolved
    });
  }

  // ============================================================
  // EXECUTION
  // ============================================================

  async function runSkill(skillId, entityType, entityId, userInputs, onProgress) {
    const skill = Store.findById('skills', skillId);
    if (!skill) throw new Error('Skill introuvable : ' + skillId);
    if (!skill.steps || skill.steps.length === 0) throw new Error('Ce skill n\'a aucune etape.');

    // Build context
    const ctx = await _buildContext(entityType, entityId);
    ctx._inputs = userInputs || {};

    const stepResults = [];

    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      if (onProgress) onProgress(i, step.nom, 'running');

      // Scrape if needed (only on first step that requests it, cache for rest)
      if (step.scrape_entity_urls && !ctx._scraped_content && ctx._entity) {
        if (onProgress) onProgress(i, step.nom, 'scraping');
        ctx._scraped_content = await _scrapeEntityUrls(ctx._entity, entityType);
      }

      const systemPrompt = _resolveTemplate(step.system_prompt, ctx, stepResults);
      const userPrompt = _resolveTemplate(step.user_prompt, ctx, stepResults);

      if (!systemPrompt && !userPrompt) {
        stepResults.push('');
        continue;
      }

      const result = await _callOpenAI(
        systemPrompt || 'Tu es un assistant expert en recrutement executive search.',
        userPrompt
      );
      stepResults.push(result);

      if (onProgress) onProgress(i, step.nom, 'done');
    }

    // Update usage stats
    await Store.update('skills', skillId, {
      usage_count: (skill.usage_count || 0) + 1,
      last_run_at: new Date().toISOString()
    });

    return stepResults[stepResults.length - 1] || '';
  }

  // ============================================================
  // CRUD
  // ============================================================

  function getSkills() {
    return Store.get('skills').filter(s => s.statut !== 'archive');
  }

  function getAllSkills() {
    return Store.get('skills');
  }

  function getSkill(id) {
    return Store.findById('skills', id);
  }

  function getSkillsForEntity(entityType) {
    return getSkills().filter(s =>
      s.statut === 'actif' && s.entity_types && s.entity_types.includes(entityType)
    );
  }

  async function saveSkill(skill) {
    if (skill.id) {
      skill.updated_at = new Date().toISOString();
      await Store.update('skills', skill.id, skill);
    } else {
      skill.id = API.generateId('ski');
      skill.created_at = new Date().toISOString();
      skill.updated_at = skill.created_at;
      skill.usage_count = 0;
      skill.last_run_at = null;
      if (!skill.statut) skill.statut = 'actif';
      await Store.add('skills', skill);
    }
    return skill;
  }

  async function deleteSkill(id) {
    await Store.remove('skills', id);
  }

  async function duplicateSkill(id) {
    const original = getSkill(id);
    if (!original) return null;
    const copy = JSON.parse(JSON.stringify(original));
    delete copy.id;
    copy.nom = original.nom + ' (copie)';
    copy.usage_count = 0;
    copy.last_run_at = null;
    // Regenerate step IDs
    if (copy.steps) {
      copy.steps.forEach((s, i) => { s.id = 'step_' + (i + 1); });
    }
    return saveSkill(copy);
  }

  // ============================================================
  // EDITEUR UI (modale)
  // ============================================================

  function _buildStepHtml(step, index, entityTypes) {
    const allVars = [];
    (entityTypes || []).forEach(et => {
      getAvailableVariables(et).forEach(v => {
        if (!allVars.find(x => x.key === v.key)) allVars.push(v);
      });
    });
    // Always add special vars
    if (!allVars.find(x => x.key === 'previous_step_result')) {
      allVars.push({ key: 'previous_step_result', label: 'Resultat etape prec.' });
    }
    if (!allVars.find(x => x.key === 'scraped_content')) {
      allVars.push({ key: 'scraped_content', label: 'Contenu scrape' });
    }

    return `
      <div class="skill-step-block" data-step-index="${index}" style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;background:#f8fafc;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <strong style="color:#1e293b;">Etape ${index + 1}</strong>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" class="step-nom" value="${UI.escHtml(step.nom || 'Etape ' + (index + 1))}"
              style="border:1px solid #cbd5e1;border-radius:4px;padding:4px 8px;font-size:0.8rem;width:180px;" placeholder="Nom de l'etape" />
            <button type="button" class="btn-remove-step" data-step="${index}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.1rem;" title="Supprimer cette etape">&times;</button>
          </div>
        </div>

        <div style="margin-bottom:8px;">
          <label style="font-size:0.75rem;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Prompt systeme</label>
          <textarea class="step-system-prompt" rows="4" style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:0.8rem;font-family:monospace;resize:vertical;">${UI.escHtml(step.system_prompt || '')}</textarea>
        </div>

        <div style="margin-bottom:8px;">
          <label style="font-size:0.75rem;font-weight:600;color:#64748b;display:block;margin-bottom:4px;">Prompt utilisateur</label>
          <textarea class="step-user-prompt" rows="4" style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:0.8rem;font-family:monospace;resize:vertical;">${UI.escHtml(step.user_prompt || '')}</textarea>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" class="step-scrape" ${step.scrape_entity_urls ? 'checked' : ''} />
            Scraper les URLs de l'entite (LinkedIn, site web)
          </label>
        </div>

        <div style="margin-top:8px;">
          <label style="font-size:0.7rem;font-weight:600;color:#94a3b8;display:block;margin-bottom:4px;">Variables disponibles (cliquez pour inserer)</label>
          <div class="step-vars-bar" style="display:flex;flex-wrap:wrap;gap:4px;">
            ${allVars.map(v => `<button type="button" class="var-btn" data-var="${v.key}" style="background:#e2e8f0;border:none;border-radius:4px;padding:2px 8px;font-size:0.7rem;cursor:pointer;color:#475569;white-space:nowrap;" title="${v.key}">{{${v.key}}}</button>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function showEditor(existingSkill) {
    const isEdit = !!existingSkill;
    const s = existingSkill || {
      nom: '', description: '', icon: 'sparkles', color: SKILL_COLORS[0],
      entity_types: [], steps: [{ id: 'step_1', nom: 'Etape 1', system_prompt: '', user_prompt: '', scrape_entity_urls: false }],
      inputs: [], statut: 'actif'
    };

    const bodyHtml = `
      <div style="max-height:70vh;overflow-y:auto;padding-right:8px;">
        <!-- En-tete -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div class="form-group">
            <label>Nom du skill</label>
            <input type="text" id="ski-nom" value="${UI.escHtml(s.nom)}" placeholder="Ex: Analyse Strategique" />
          </div>
          <div class="form-group">
            <label>Couleur</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:4px;">
              ${SKILL_COLORS.map(c => `<button type="button" class="color-btn" data-color="${c}" style="width:24px;height:24px;border-radius:50%;border:2px solid ${s.color === c ? '#1e293b' : 'transparent'};background:${c};cursor:pointer;"></button>`).join('')}
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label>Description</label>
          <input type="text" id="ski-description" value="${UI.escHtml(s.description || '')}" placeholder="Description courte du skill" />
        </div>

        <!-- Applicable a -->
        <div class="form-group" style="margin-bottom:16px;">
          <label>Applicable a</label>
          <div style="display:flex;gap:16px;">
            ${Object.entries(ENTITY_LABELS).map(([key, label]) => `
              <label style="font-size:0.85rem;display:flex;align-items:center;gap:4px;cursor:pointer;">
                <input type="checkbox" class="entity-type-cb" value="${key}" ${(s.entity_types || []).includes(key) ? 'checked' : ''} />
                ${label}
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Statut -->
        <div class="form-group" style="margin-bottom:16px;">
          <label>Statut</label>
          <select id="ski-statut">
            <option value="actif" ${s.statut === 'actif' ? 'selected' : ''}>Actif</option>
            <option value="brouillon" ${s.statut === 'brouillon' ? 'selected' : ''}>Brouillon</option>
            <option value="archive" ${s.statut === 'archive' ? 'selected' : ''}>Archive</option>
          </select>
        </div>

        <!-- Etapes -->
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label style="font-weight:600;">Etapes</label>
            <button type="button" id="btn-add-step" class="btn btn-secondary" style="font-size:0.75rem;padding:4px 12px;">+ Ajouter une etape</button>
          </div>
          <div id="steps-container">
            ${(s.steps || []).map((step, i) => _buildStepHtml(step, i, s.entity_types)).join('')}
          </div>
        </div>

        <!-- Inputs utilisateur -->
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label style="font-weight:600;">Inputs pre-execution (optionnel)</label>
            <button type="button" id="btn-add-input" class="btn btn-secondary" style="font-size:0.75rem;padding:4px 12px;">+ Ajouter un input</button>
          </div>
          <div id="inputs-container">
            ${(s.inputs || []).map((inp, i) => `
              <div class="skill-input-row" style="display:flex;gap:8px;margin-bottom:6px;align-items:center;">
                <input type="text" class="input-key" value="${UI.escHtml(inp.key || '')}" placeholder="Cle (ex: notes_extra)" style="flex:1;" />
                <input type="text" class="input-label" value="${UI.escHtml(inp.label || '')}" placeholder="Label affiche" style="flex:1;" />
                <select class="input-type" style="width:100px;">
                  <option value="text" ${inp.type === 'text' ? 'selected' : ''}>Texte</option>
                  <option value="textarea" ${inp.type === 'textarea' ? 'selected' : ''}>Zone texte</option>
                </select>
                <button type="button" class="btn-remove-input" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.1rem;">&times;</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    let currentColor = s.color || SKILL_COLORS[0];

    UI.modal(isEdit ? 'Modifier le skill' : 'Nouveau skill', bodyHtml, {
      width: 800,
      saveLabel: 'Enregistrer',
      draftKey: 'skill_editor',
      onSave: async (overlay) => {
        const data = {
          nom: overlay.querySelector('#ski-nom').value.trim(),
          description: overlay.querySelector('#ski-description').value.trim(),
          color: currentColor,
          statut: overlay.querySelector('#ski-statut').value,
          entity_types: [...overlay.querySelectorAll('.entity-type-cb:checked')].map(cb => cb.value),
          steps: [],
          inputs: []
        };

        if (!data.nom) { UI.toast('Le nom est obligatoire', 'error'); return; }
        if (data.entity_types.length === 0) { UI.toast('Selectionnez au moins un type d\'entite', 'error'); return; }

        // Collect steps
        overlay.querySelectorAll('.skill-step-block').forEach((block, i) => {
          data.steps.push({
            id: 'step_' + (i + 1),
            nom: block.querySelector('.step-nom').value.trim() || 'Etape ' + (i + 1),
            system_prompt: block.querySelector('.step-system-prompt').value.trim(),
            user_prompt: block.querySelector('.step-user-prompt').value.trim(),
            scrape_entity_urls: block.querySelector('.step-scrape').checked
          });
        });

        if (data.steps.length === 0) { UI.toast('Ajoutez au moins une etape', 'error'); return; }

        // Collect inputs
        overlay.querySelectorAll('.skill-input-row').forEach(row => {
          const key = row.querySelector('.input-key').value.trim();
          const label = row.querySelector('.input-label').value.trim();
          const type = row.querySelector('.input-type').value;
          if (key && label) data.inputs.push({ key, label, type });
        });

        if (isEdit) data.id = s.id;
        await saveSkill(data);
        UI.toast(isEdit ? 'Skill modifie' : 'Skill cree', 'success');
        if (typeof _onRefresh === 'function') _onRefresh();
        else location.reload();
      }
    });

    // Wire up color buttons
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      overlay.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          overlay.querySelectorAll('.color-btn').forEach(b => b.style.borderColor = 'transparent');
          btn.style.borderColor = '#1e293b';
          currentColor = btn.dataset.color;
        });
      });

      // Add step button
      const addStepBtn = overlay.querySelector('#btn-add-step');
      if (addStepBtn) {
        addStepBtn.addEventListener('click', () => {
          const container = overlay.querySelector('#steps-container');
          const idx = container.querySelectorAll('.skill-step-block').length;
          const entityTypes = [...overlay.querySelectorAll('.entity-type-cb:checked')].map(cb => cb.value);
          const newStep = { id: 'step_' + (idx + 1), nom: 'Etape ' + (idx + 1), system_prompt: '', user_prompt: '', scrape_entity_urls: false };
          container.insertAdjacentHTML('beforeend', _buildStepHtml(newStep, idx, entityTypes));
          _wireStepEvents(overlay);
        });
      }

      // Add input button
      const addInputBtn = overlay.querySelector('#btn-add-input');
      if (addInputBtn) {
        addInputBtn.addEventListener('click', () => {
          const container = overlay.querySelector('#inputs-container');
          container.insertAdjacentHTML('beforeend', `
            <div class="skill-input-row" style="display:flex;gap:8px;margin-bottom:6px;align-items:center;">
              <input type="text" class="input-key" placeholder="Cle (ex: notes_extra)" style="flex:1;" />
              <input type="text" class="input-label" placeholder="Label affiche" style="flex:1;" />
              <select class="input-type" style="width:100px;">
                <option value="text">Texte</option>
                <option value="textarea">Zone texte</option>
              </select>
              <button type="button" class="btn-remove-input" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.1rem;">&times;</button>
            </div>
          `);
          _wireInputEvents(overlay);
        });
      }

      _wireStepEvents(overlay);
      _wireInputEvents(overlay);
    }
  }

  function _wireStepEvents(overlay) {
    // Remove step buttons
    overlay.querySelectorAll('.btn-remove-step').forEach(btn => {
      btn.onclick = () => {
        const blocks = overlay.querySelectorAll('.skill-step-block');
        if (blocks.length <= 1) { UI.toast('Il faut au moins une etape', 'error'); return; }
        btn.closest('.skill-step-block').remove();
        // Re-number
        overlay.querySelectorAll('.skill-step-block').forEach((block, i) => {
          block.querySelector('strong').textContent = 'Etape ' + (i + 1);
          block.dataset.stepIndex = i;
        });
      };
    });

    // Variable insertion buttons
    overlay.querySelectorAll('.var-btn').forEach(btn => {
      btn.onclick = () => {
        const stepBlock = btn.closest('.skill-step-block');
        const textarea = stepBlock.querySelector('.step-user-prompt');
        const varText = '{{' + btn.dataset.var + '}}';
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + varText + textarea.value.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + varText.length;
      };
    });
  }

  function _wireInputEvents(overlay) {
    overlay.querySelectorAll('.btn-remove-input').forEach(btn => {
      btn.onclick = () => btn.closest('.skill-input-row').remove();
    });
  }

  // ============================================================
  // RUNNER UI (modale d'execution)
  // ============================================================

  function showRunner(skill, entityType, entityId) {
    const hasInputs = skill.inputs && skill.inputs.length > 0;
    const stepsCount = skill.steps ? skill.steps.length : 0;

    let bodyHtml = `
      <div style="max-height:70vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="background:${skill.color || '#f59e0b'};width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
          <span style="font-size:0.85rem;color:#64748b;">${stepsCount} etape${stepsCount > 1 ? 's' : ''} &bull; gpt-4o-mini</span>
        </div>
    `;

    // Input fields
    if (hasInputs) {
      bodyHtml += '<div style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f8fafc;">';
      skill.inputs.forEach(inp => {
        if (inp.type === 'textarea') {
          bodyHtml += `<div class="form-group" style="margin-bottom:8px;"><label>${UI.escHtml(inp.label)}</label><textarea id="inp-${inp.key}" rows="3" style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:0.85rem;"></textarea></div>`;
        } else {
          bodyHtml += `<div class="form-group" style="margin-bottom:8px;"><label>${UI.escHtml(inp.label)}</label><input type="text" id="inp-${inp.key}" style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:0.85rem;" /></div>`;
        }
      });
      bodyHtml += '</div>';
    }

    // Progress section
    bodyHtml += `
      <div id="skill-progress" style="display:none;margin-bottom:16px;">
        ${(skill.steps || []).map((step, i) => `
          <div class="progress-step" data-step="${i}" style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:0.85rem;color:#94a3b8;">
            <span class="progress-icon" style="width:20px;text-align:center;">&#9679;</span>
            <span>${UI.escHtml(step.nom || 'Etape ' + (i + 1))}</span>
          </div>
        `).join('')}
      </div>

      <!-- Result section -->
      <div id="skill-result" style="display:none;">
        <label style="font-weight:600;display:block;margin-bottom:4px;">Resultat</label>
        <textarea id="skill-result-text" rows="12" style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:12px;font-size:0.85rem;font-family:-apple-system,sans-serif;resize:vertical;line-height:1.5;"></textarea>
        <div style="margin-top:8px;display:flex;gap:8px;">
          <button type="button" id="btn-copy-result" class="btn btn-secondary" style="font-size:0.8rem;">Copier dans le presse-papier</button>
        </div>
      </div>

      <!-- Error section -->
      <div id="skill-error" style="display:none;color:#ef4444;font-size:0.85rem;padding:12px;border:1px solid #fecaca;border-radius:8px;background:#fef2f2;"></div>
    </div>
    `;

    UI.modal('Executer : ' + (skill.nom || 'Skill'), bodyHtml, {
      width: 700,
      saveLabel: 'Lancer',
      onSave: async (overlay) => {
        const saveBtn = overlay.querySelector('.modal-save-btn') || overlay.querySelector('.btn-primary');
        const origLabel = saveBtn ? saveBtn.textContent : 'Lancer';

        // Collect inputs
        const inputs = {};
        if (skill.inputs) {
          skill.inputs.forEach(inp => {
            const el = overlay.querySelector('#inp-' + inp.key);
            if (el) inputs[inp.key] = el.value.trim();
          });
        }

        // Show progress, hide error
        const progressDiv = overlay.querySelector('#skill-progress');
        const resultDiv = overlay.querySelector('#skill-result');
        const errorDiv = overlay.querySelector('#skill-error');
        progressDiv.style.display = 'block';
        resultDiv.style.display = 'none';
        errorDiv.style.display = 'none';

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Execution en cours...';
        }

        try {
          const result = await runSkill(skill.id, entityType, entityId, inputs, (stepIdx, stepName, status) => {
            const steps = progressDiv.querySelectorAll('.progress-step');
            steps.forEach((el, i) => {
              const icon = el.querySelector('.progress-icon');
              if (i < stepIdx) {
                el.style.color = '#10b981';
                icon.innerHTML = '&#10003;';
              } else if (i === stepIdx) {
                el.style.color = '#f59e0b';
                icon.innerHTML = status === 'scraping' ? '&#8635;' : '&#9654;';
              }
            });
          });

          // Mark all steps done
          progressDiv.querySelectorAll('.progress-step').forEach(el => {
            el.style.color = '#10b981';
            el.querySelector('.progress-icon').innerHTML = '&#10003;';
          });

          // Show result
          resultDiv.style.display = 'block';
          overlay.querySelector('#skill-result-text').value = result;

          // Copy button
          overlay.querySelector('#btn-copy-result').onclick = async () => {
            try {
              await navigator.clipboard.writeText(result);
              UI.toast('Copie dans le presse-papier', 'success');
            } catch {
              // Fallback
              const ta = overlay.querySelector('#skill-result-text');
              ta.select();
              document.execCommand('copy');
              UI.toast('Copie', 'success');
            }
          };

          if (saveBtn) {
            saveBtn.textContent = 'Relancer';
            saveBtn.disabled = false;
          }
        } catch (err) {
          errorDiv.style.display = 'block';
          errorDiv.textContent = err.message || 'Erreur inconnue';
          if (saveBtn) {
            saveBtn.textContent = origLabel;
            saveBtn.disabled = false;
          }
        }
      }
    });
  }

  // ============================================================
  // CARTE SKILLS SUR LES PAGES ENTITE
  // ============================================================

  function renderEntitySkillsCard(containerId, entityType, entityId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const skills = getSkillsForEntity(entityType);
    if (skills.length === 0) {
      container.innerHTML = `
        <div class="card" style="border-left:3px solid #f59e0b;">
          <div class="card-header" style="padding:12px 16px;">
            <h3 style="font-size:0.9rem;margin:0;display:flex;align-items:center;gap:8px;">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Skills IA
            </h3>
            <span style="font-size:0.7rem;color:#94a3b8;background:#f1f5f9;padding:2px 6px;border-radius:4px;">gpt-4o-mini</span>
          </div>
          <div style="padding:12px 16px;font-size:0.85rem;color:#94a3b8;">
            Aucun skill configure pour ce type d'entite.
            <a href="skills.html" style="color:#3b82f6;">Creer un skill</a>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="card" style="border-left:3px solid #f59e0b;">
        <div class="card-header" style="padding:12px 16px;">
          <h3 style="font-size:0.9rem;margin:0;display:flex;align-items:center;gap:8px;">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Skills IA
          </h3>
          <span style="font-size:0.7rem;color:#94a3b8;background:#f1f5f9;padding:2px 6px;border-radius:4px;">gpt-4o-mini</span>
        </div>
        <div style="padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;">
    `;

    skills.forEach(skill => {
      html += `
        <button type="button" class="skill-run-btn" data-skill-id="${skill.id}"
          style="display:flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;background:white;cursor:pointer;font-size:0.8rem;color:#1e293b;transition:all 0.15s;"
          onmouseover="this.style.borderColor='${skill.color || '#f59e0b'}';this.style.background='#fefce8'"
          onmouseout="this.style.borderColor='#e2e8f0';this.style.background='white'">
          <span style="width:8px;height:8px;border-radius:50%;background:${skill.color || '#f59e0b'};display:inline-block;"></span>
          ${UI.escHtml(skill.nom)}
          ${skill.steps && skill.steps.length > 1 ? '<span style="font-size:0.65rem;color:#94a3b8;">(' + skill.steps.length + ' etapes)</span>' : ''}
        </button>
      `;
    });

    html += '</div></div>';
    container.innerHTML = html;

    // Wire events
    container.querySelectorAll('.skill-run-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sk = getSkill(btn.dataset.skillId);
        if (sk) showRunner(sk, entityType, entityId);
      });
    });
  }

  // ============================================================
  // SKILLS EXEMPLES (pre-chargement)
  // ============================================================

  const DEFAULT_SKILLS = [
    {
      nom: 'Lecture Recruteur',
      description: 'Extraction factuelle puis analyse recruteur structuree (Fit poste, culture, risques, positionnement)',
      color: '#8b5cf6',
      entity_types: ['candidats'],
      steps: [
        {
          id: 'step_1',
          nom: 'Extraction factuelle',
          system_prompt: 'Tu es consultant en executive search specialise DSI/DT.\n\nRegles de fiabilite :\n- Utilise UNIQUEMENT les informations des sources fournies\n- Ne jamais inventer, extrapoler ou ajouter d\'informations externes\n- En cas de contradiction entre sources : formulation neutre mentionnant les deux versions\n- Traitement autorise : reformuler, synthetiser, regrouper, hierarchiser, croiser les sources\n\nRedaction : bullet points, 1 idee par ligne, max 14 mots, factuel et decisionnel.',
          user_prompt: 'Sources disponibles :\n\nFICHE ATS :\nNom : {{candidat.prenom}} {{candidat.nom}}\nPoste actuel : {{candidat.poste_actuel}}\nPoste cible : {{candidat.poste_cible}}\nEntreprise actuelle : {{candidat.entreprise_actuelle}}\nLocalisation : {{candidat.localisation}}\nNiveau : {{candidat.niveau}}\n\nSYNTHESE EXISTANTE :\n{{candidat.synthese_30s}}\n\nPARCOURS CIBLE :\n{{candidat.parcours_cible}}\n\nMOTIVATION & DRIVERS :\n{{candidat.motivation_drivers}}\n\nNOTES D\'ENTRETIEN :\n{{candidat.notes_entretien}}\n\nCONTENU WEB (LinkedIn/site) :\n{{scraped_content}}\n\nExtrais toutes les informations factuelles pertinentes pour un recruteur, organisees par theme.',
          scrape_entity_urls: true
        },
        {
          id: 'step_2',
          nom: 'Analyse recruteur',
          system_prompt: 'Tu es consultant en executive search specialise DSI/DT. Tu produis une analyse recruteur structuree, factuelle et sans projection psychologique.',
          user_prompt: 'A partir de l\'extraction factuelle suivante :\n\n{{previous_step_result}}\n\nProduis une analyse recruteur basee UNIQUEMENT sur les faits.\nAutorise : mise en coherence, identification de risques factuels, comparaison marche.\nInterdit : projection psychologique, hypothese non fondee sur les faits.\n\nFormat de sortie :\n\n## FIT POSTE\n(Adequation competences/experience vs poste cible)\n\n## FIT CULTURE\n(Indices sur l\'environnement de travail prefere)\n\n## RISQUES\n(Points d\'attention factuels)\n\n## POSITIONNEMENT MARCHE\n(Attractivite profil, rarete, fourchette remuneration estimee si elements disponibles)',
          scrape_entity_urls: false
        }
      ],
      inputs: [],
      statut: 'actif'
    },
    {
      nom: 'Prospection Decideur',
      description: 'Qualification du contexte puis recommandation d\'approche pour un decideur',
      color: '#3b82f6',
      entity_types: ['decideurs'],
      steps: [
        {
          id: 'step_1',
          nom: 'Qualification du contexte',
          system_prompt: 'Tu es consultant en executive search specialise DSI/DT. Tu analyses le contexte d\'un decideur pour preparer une approche de prospection.\n\nRegles : factuel uniquement, pas de speculation.',
          user_prompt: 'Decideur :\nNom : {{decideur.prenom}} {{decideur.nom}}\nFonction : {{decideur.fonction}}\nEntreprise : {{decideur.entreprise}}\n\nNotes existantes :\n{{decideur.notes}}\n\nContenu web (LinkedIn/site) :\n{{scraped_content}}\n\nExtrais :\n- Parcours professionnel cle\n- Responsabilites actuelles identifiees\n- Enjeux potentiels lies a son poste\n- Signaux d\'ouverture ou de changement',
          scrape_entity_urls: true
        },
        {
          id: 'step_2',
          nom: 'Recommandation d\'approche',
          system_prompt: 'Tu es consultant en executive search. Tu recommandes une strategie d\'approche pour un decideur.',
          user_prompt: 'A partir de la qualification suivante :\n\n{{previous_step_result}}\n\nRecommande :\n\n## ANGLE D\'APPROCHE\n(Le meilleur angle pour engager la conversation)\n\n## PROPOSITION DE VALEUR\n(Ce que nous pouvons lui apporter : talents, benchmark, veille)\n\n## CANAL RECOMMANDE\n(LinkedIn, email, telephone, evenement...)\n\n## MESSAGE D\'ACCROCHE\n(3-4 lignes max, personnalise)',
          scrape_entity_urls: false
        }
      ],
      inputs: [],
      statut: 'actif'
    },
    {
      nom: 'Accroche LinkedIn',
      description: 'Generation d\'un message d\'accroche LinkedIn personnalise pour un decideur DSI/DT',
      color: '#06b6d4',
      entity_types: ['decideurs'],
      steps: [
        {
          id: 'step_1',
          nom: 'Diagnostic et accroche',
          system_prompt: 'Tu es consultant en executive search specialise DSI/DT. Tu rediges des messages d\'accroche LinkedIn courts, percutants et personnalises.\n\nRegles :\n- Max 300 caracteres (limite LinkedIn InMail)\n- Ton professionnel mais humain\n- Personnalise avec des elements du profil\n- Pas de formule generique\n- Une question ouverte en fin de message',
          user_prompt: 'Profil du decideur :\nNom : {{decideur.prenom}} {{decideur.nom}}\nFonction : {{decideur.fonction}}\nEntreprise : {{decideur.entreprise}}\n\nNotes :\n{{decideur.notes}}\n\nContenu web (LinkedIn) :\n{{scraped_content}}\n\n{{input.contexte_mission}}\n\nGenere 3 variantes de messages d\'accroche LinkedIn :\n\n## VARIANTE 1 — Approche directe\n(Mention d\'un enjeu specifique identifie)\n\n## VARIANTE 2 — Approche valeur\n(Partage d\'insight ou benchmark)\n\n## VARIANTE 3 — Approche reseau\n(Mise en relation, recommandation)',
          scrape_entity_urls: true
        }
      ],
      inputs: [
        { key: 'contexte_mission', label: 'Contexte mission (optionnel — ex: "Recherche DSI pour ETI industrielle Lyon")', type: 'textarea' }
      ],
      statut: 'actif'
    }
  ];

  async function _ensureDefaultSkills() {
    const existing = Store.get('skills');
    if (existing && existing.length > 0) return;

    for (const def of DEFAULT_SKILLS) {
      const skill = { ...def };
      skill.id = API.generateId('ski');
      skill.created_at = new Date().toISOString();
      skill.updated_at = skill.created_at;
      skill.usage_count = 0;
      skill.last_run_at = null;
      await Store.add('skills', skill);
    }
  }

  // Callback for page refresh after editor save
  let _onRefresh = null;
  function setOnRefresh(fn) { _onRefresh = fn; }

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    getSkills,
    getAllSkills,
    getSkill,
    getSkillsForEntity,
    saveSkill,
    deleteSkill,
    duplicateSkill,
    runSkill,
    showEditor,
    showRunner,
    renderEntitySkillsCard,
    getAvailableVariables,
    setOnRefresh,
    ensureDefaultSkills: _ensureDefaultSkills,
    ENTITY_LABELS,
    ENTITY_ICONS,
    SKILL_COLORS
  };
})();
