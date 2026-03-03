// Amarillo ATS — Skills Engine v2
// Moteur de Skills IA simplifie : contexte auto, editeur minimal, runner conversationnel.
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

  const DEFAULT_SYSTEM_PROMPT = 'Tu es un assistant expert en recrutement executive search, specialise dans les profils DSI/CTO/CDO.';

  const FIELD_LABELS = {
    // Candidats
    prenom: 'Prenom', nom: 'Nom', poste_actuel: 'Poste actuel', poste_cible: 'Poste cible',
    entreprise_actuelle: 'Entreprise actuelle', localisation: 'Localisation', niveau: 'Niveau',
    diplome: 'Diplome', email: 'Email', telephone: 'Telephone', linkedin: 'LinkedIn',
    statut: 'Statut', open_to_work: 'Open to work', date_disponibilite: 'Disponibilite',
    preavis: 'Preavis', ambassadeur: 'Ambassadeur', salaire_fixe_actuel: 'Salaire fixe actuel',
    variable_actuel: 'Variable actuel', package_souhaite_min: 'Package min souhaite',
    package_souhaite: 'Package souhaite', origine: 'Origine', profile_code: 'Code profiling',
    notes: 'Notes', synthese_30s: 'Synthese 30s', parcours_cible: 'Parcours cible',
    motivation_drivers: 'Motivation & drivers', lecture_recruteur: 'Lecture recruteur',
    notes_entretien: 'Notes d\'entretien',
    // Entreprises
    secteur: 'Secteur', taille: 'Taille', ca: 'CA', priorite: 'Priorite',
    siege_adresse: 'Adresse siege', siege_code_postal: 'Code postal siege',
    siege_ville: 'Ville siege', site_web: 'Site web', groupe: 'Groupe',
    source: 'Source', angle_approche: 'Angle d\'approche', description: 'Description',
    // Decideurs
    fonction: 'Fonction', fonction_macro: 'Fonction macro',
    niveau_hierarchique: 'Niveau hierarchique', role_decision: 'Role decision',
    niveau_relation: 'Niveau relation', priorite_prospection: 'Priorite prospection',
    perimetre: 'Perimetre', telephone_mobile: 'Tel mobile',
    notes_relation: 'Notes relation', entreprise: 'Entreprise'
  };

  // ============================================================
  // APPEL OPENAI
  // ============================================================

  async function _callOpenAI(messages) {
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
          messages,
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
    let text = (doc.body || doc.documentElement).textContent || '';
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return text.substring(0, 8000);
  }

  async function _scrapeEntityUrls(entity, entityType) {
    const urls = [];
    if (entity.linkedin) urls.push(entity.linkedin);
    if (entityType === 'entreprises' && entity.site_web) urls.push(entity.site_web);
    if (urls.length === 0) return '';

    const results = [];
    for (const url of urls) {
      const html = await _fetchViaProxy(url, 10000);
      const text = _htmlToText(html);
      if (text) results.push('--- ' + url + ' ---\n' + text);
    }
    return results.join('\n\n').substring(0, 12000);
  }

  // ============================================================
  // CONTEXTE AUTOMATIQUE
  // ============================================================

  async function _buildContextText(entityType, entityId) {
    const SKIP_FIELDS = ['id', 'created_at', 'updated_at', 'presentations', 'entreprises_cibles',
      '_pappers_siren', '_pappers_naf', 'google_drive_url', 'entreprise_actuelle_id',
      'entreprise_id', 'manager_direct_id', 'missions_ids', 'profil_candidat_id',
      'candidats_ids', 'decideurs_ids', 'candidat_place_id', 'factures_ids',
      'recommande_par', 'candidat_id', 'decideur_id', 'mission_id'];
    let lines = [];

    if (entityType === 'candidats' && entityId) {
      const c = Store.findById('candidats', entityId);
      if (!c) return '';

      // Resolve entreprise actuelle
      let entNom = c.entreprise_nom || '';
      if (c.entreprise_actuelle_id) {
        const ent = Store.findById('entreprises', c.entreprise_actuelle_id);
        if (ent) entNom = ent.nom;
      }
      if (entNom) lines.push('- Entreprise actuelle : ' + entNom);

      // All non-empty fields
      for (const [key, val] of Object.entries(c)) {
        if (SKIP_FIELDS.includes(key) || key.startsWith('_')) continue;
        if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) continue;
        const label = FIELD_LABELS[key] || key;
        lines.push('- ' + label + ' : ' + (typeof val === 'object' ? JSON.stringify(val) : val));
      }

      // Build interview notes from actions
      const actions = Store.filter('actions', a =>
        a.candidat_id === entityId && ((a.message_notes && a.message_notes.trim()) || (a.notes && a.notes.trim()))
      );
      if (actions.length > 0) {
        const notesText = actions
          .map(a => '[' + (a.type_action || '') + ' - ' + (a.canal || '') + ' - ' + (a.date_action || '') + ']\n' + (a.message_notes || a.notes || ''))
          .join('\n\n')
          .substring(0, 10000);
        lines.push('- Notes d\'entretien :\n' + notesText);
      }

      return 'Fiche Candidat :\n' + lines.join('\n');
    }

    if (entityType === 'entreprises' && entityId) {
      const e = Store.findById('entreprises', entityId);
      if (!e) return '';
      for (const [key, val] of Object.entries(e)) {
        if (SKIP_FIELDS.includes(key) || key.startsWith('_')) continue;
        if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) continue;
        const label = FIELD_LABELS[key] || key;
        lines.push('- ' + label + ' : ' + (typeof val === 'object' ? JSON.stringify(val) : val));
      }
      return 'Fiche Entreprise :\n' + lines.join('\n');
    }

    if (entityType === 'decideurs' && entityId) {
      const d = Store.findById('decideurs', entityId);
      if (!d) return '';

      // Resolve entreprise
      if (d.entreprise_id) {
        const ent = Store.findById('entreprises', d.entreprise_id);
        if (ent) lines.push('- Entreprise : ' + ent.nom);
      }

      for (const [key, val] of Object.entries(d)) {
        if (SKIP_FIELDS.includes(key) || key.startsWith('_')) continue;
        if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) continue;
        const label = FIELD_LABELS[key] || key;
        lines.push('- ' + label + ' : ' + (typeof val === 'object' ? JSON.stringify(val) : val));
      }
      return 'Fiche Decideur :\n' + lines.join('\n');
    }

    return '';
  }

  // ============================================================
  // EXECUTION
  // ============================================================

  async function runSkill(skillId, entityType, entityId, onProgress) {
    const skill = Store.findById('skills', skillId);
    if (!skill) throw new Error('Skill introuvable : ' + skillId);
    if (!skill.steps || skill.steps.length === 0) throw new Error('Ce skill n\'a aucune etape.');

    // Build context text
    const contextText = await _buildContextText(entityType, entityId);

    // Scrape if any step requests it
    let scrapedContent = '';
    const needsScraping = skill.steps.some(s => s.scrape_entity_urls);
    if (needsScraping && entityId) {
      const entity = Store.findById(entityType, entityId);
      if (entity) {
        if (onProgress) onProgress(-1, 'Scraping web...', 'scraping');
        scrapedContent = await _scrapeEntityUrls(entity, entityType);
      }
    }

    // Build system prompt with auto context
    let systemContent = skill.steps[0].system_prompt || DEFAULT_SYSTEM_PROMPT;
    systemContent += '\n\n' + contextText;
    if (scrapedContent) {
      systemContent += '\n\nContenu web extrait (LinkedIn, site) :\n' + scrapedContent;
    }

    const stepResults = [];
    const messages = [{ role: 'system', content: systemContent }];

    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      if (onProgress) onProgress(i, step.nom || 'Etape ' + (i + 1), 'running');

      let userPrompt = step.user_prompt || '';

      // For multi-step: inject previous results into context
      if (i > 0 && stepResults.length > 0) {
        userPrompt = 'Resultat de l\'etape precedente :\n\n' + stepResults[stepResults.length - 1] + '\n\n' + userPrompt;
      }

      messages.push({ role: 'user', content: userPrompt });

      const result = await _callOpenAI(messages);
      stepResults.push(result);
      messages.push({ role: 'assistant', content: result });

      if (onProgress) onProgress(i, step.nom || 'Etape ' + (i + 1), 'done');
    }

    // Update usage stats
    await Store.update('skills', skillId, {
      usage_count: (skill.usage_count || 0) + 1,
      last_run_at: new Date().toISOString()
    });

    // Return final result and messages for conversation
    return {
      result: stepResults[stepResults.length - 1] || '',
      messages
    };
  }

  // Continue a conversation (affiner)
  async function refineResult(conversationMessages, refinement) {
    conversationMessages.push({ role: 'user', content: refinement });
    const result = await _callOpenAI(conversationMessages);
    conversationMessages.push({ role: 'assistant', content: result });
    return result;
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
      await Store.add('skills', skill);
    }
    return skill;
  }

  async function deleteSkill(id) {
    await Store.remove('skills', id);
  }

  async function duplicateSkill(id) {
    const original = Store.findById('skills', id);
    if (!original) return;
    const copy = JSON.parse(JSON.stringify(original));
    delete copy.id;
    copy.nom = (copy.nom || 'Skill') + ' (copie)';
    copy.usage_count = 0;
    copy.last_run_at = null;
    return await saveSkill(copy);
  }

  // ============================================================
  // AUTO-NOM VIA IA
  // ============================================================

  let _autoNameTimer = null;

  async function _generateSkillName(promptText) {
    if (!promptText || promptText.length < 20) return '';
    try {
      const result = await _callOpenAI([
        { role: 'system', content: 'Tu donnes un nom court (2-4 mots, en francais) pour un skill de recrutement. Reponds uniquement le nom, sans ponctuation.' },
        { role: 'user', content: promptText.substring(0, 500) }
      ]);
      return result.replace(/[."']/g, '').trim().substring(0, 40);
    } catch {
      return '';
    }
  }

  // ============================================================
  // DETECTION SKILL SIMPLE / AVANCE
  // ============================================================

  function _isSimpleSkill(skill) {
    if (!skill) return true;
    if (skill.steps && skill.steps.length > 1) return false;
    if (skill.inputs && skill.inputs.length > 0) return false;
    const sp = (skill.steps && skill.steps[0] && skill.steps[0].system_prompt) || '';
    if (sp && sp !== DEFAULT_SYSTEM_PROMPT && sp !== '') return false;
    return true;
  }

  // ============================================================
  // EDITEUR UI (modale simplifiee)
  // ============================================================

  function showEditor(existingSkill) {
    const isEdit = !!existingSkill;
    const s = existingSkill || {
      nom: '', description: '', color: SKILL_COLORS[0],
      entity_types: [], steps: [{ id: 'step_1', nom: '', system_prompt: '', user_prompt: '', scrape_entity_urls: false }],
      inputs: [], statut: 'actif'
    };

    const isSimple = _isSimpleSkill(s);
    let _nameManuallySet = isEdit && !!s.nom;

    const bodyHtml = `
      <div style="max-height:70vh;overflow-y:auto;padding-right:8px;">
        <!-- Nom editable (titre) -->
        <div id="ski-name-display" style="margin-bottom:16px;cursor:pointer;${_nameManuallySet || !isEdit ? '' : 'display:none;'}" title="Cliquer pour modifier le nom">
          <span id="ski-name-text" style="font-size:1.1rem;font-weight:600;color:#1e293b;">${UI.escHtml(s.nom || 'Nouveau skill')}</span>
          <span style="font-size:0.7rem;color:#94a3b8;margin-left:6px;">&#9998;</span>
        </div>
        <div id="ski-name-input-wrap" style="margin-bottom:16px;${_nameManuallySet && isEdit ? 'display:none;' : isEdit ? 'display:none;' : ''}">
          <input type="text" id="ski-nom" value="${UI.escHtml(s.nom)}" placeholder="Nom du skill (auto-genere si vide)" style="width:100%;font-size:1rem;padding:8px;border:1px solid #cbd5e1;border-radius:6px;" />
        </div>

        <!-- Applicable a -->
        <div class="form-group" style="margin-bottom:16px;">
          <label style="font-weight:600;font-size:0.85rem;">Applicable a</label>
          <div style="display:flex;gap:16px;margin-top:4px;">
            ${Object.entries(ENTITY_LABELS).map(([key, label]) => `
              <label style="font-size:0.85rem;display:flex;align-items:center;gap:4px;cursor:pointer;">
                <input type="checkbox" class="entity-type-cb" value="${key}" ${(s.entity_types || []).includes(key) ? 'checked' : ''} />
                ${label}
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Prompt principal -->
        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-weight:600;font-size:0.85rem;">Prompt</label>
          <textarea id="ski-prompt" rows="10" style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:10px;font-size:0.85rem;resize:vertical;line-height:1.5;" placeholder="Ecrivez votre prompt en langage naturel. Les donnees de la fiche sont automatiquement injectees.">${UI.escHtml((s.steps && s.steps[0] && s.steps[0].user_prompt) || '')}</textarea>
        </div>

        <!-- Chercher sur le web -->
        <div style="margin-bottom:16px;">
          <label style="font-size:0.85rem;display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="ski-scrape" ${(s.steps && s.steps[0] && s.steps[0].scrape_entity_urls) ? 'checked' : ''} />
            Chercher sur le web (LinkedIn, site web de l'entite)
          </label>
        </div>

        <!-- Options avancees (toggle) -->
        <div style="margin-bottom:16px;">
          <a href="#" id="ski-advanced-toggle" style="font-size:0.8rem;color:#64748b;text-decoration:none;display:flex;align-items:center;gap:4px;">
            <span id="ski-advanced-arrow">${isSimple ? '&#9656;' : '&#9662;'}</span> Options avancees
          </a>
          <div id="ski-advanced-section" style="display:${isSimple ? 'none' : 'block'};margin-top:12px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">

            <!-- Description -->
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-size:0.8rem;color:#64748b;">Description</label>
              <input type="text" id="ski-description" value="${UI.escHtml(s.description || '')}" placeholder="Description courte (affichee dans la bibliotheque)" style="font-size:0.85rem;" />
            </div>

            <!-- Prompt systeme -->
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-size:0.8rem;color:#64748b;">Personnalite IA (prompt systeme)</label>
              <textarea id="ski-system-prompt" rows="3" style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:0.8rem;font-family:monospace;resize:vertical;" placeholder="${DEFAULT_SYSTEM_PROMPT}">${UI.escHtml((s.steps && s.steps[0] && s.steps[0].system_prompt) || '')}</textarea>
            </div>

            <!-- Couleur -->
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-size:0.8rem;color:#64748b;">Couleur</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:4px;">
                ${SKILL_COLORS.map(c => `<button type="button" class="color-btn" data-color="${c}" style="width:24px;height:24px;border-radius:50%;border:2px solid ${s.color === c ? '#1e293b' : 'transparent'};background:${c};cursor:pointer;"></button>`).join('')}
              </div>
            </div>

            <!-- Statut -->
            <div class="form-group" style="margin-bottom:12px;">
              <label style="font-size:0.8rem;color:#64748b;">Statut</label>
              <select id="ski-statut" style="font-size:0.85rem;">
                <option value="actif" ${s.statut === 'actif' ? 'selected' : ''}>Actif</option>
                <option value="brouillon" ${s.statut === 'brouillon' ? 'selected' : ''}>Brouillon</option>
                <option value="archive" ${s.statut === 'archive' ? 'selected' : ''}>Archive</option>
              </select>
            </div>

            <!-- Multi-etapes (future) -->
            ${(s.steps && s.steps.length > 1) ? _buildMultiStepSection(s) : `
            <div style="padding:8px 0;font-size:0.8rem;color:#94a3b8;">
              Ce skill est mono-etape. Le support multi-etapes est disponible pour les skills avances existants.
            </div>
            `}
          </div>
        </div>
      </div>
    `;

    let currentColor = s.color || SKILL_COLORS[0];

    UI.modal(isEdit ? 'Modifier le skill' : 'Nouveau skill', bodyHtml, {
      width: 650,
      saveLabel: 'Enregistrer',
      draftKey: 'skill_editor_v2',
      onSave: async (overlay) => {
        const nomInput = overlay.querySelector('#ski-nom');
        const promptArea = overlay.querySelector('#ski-prompt');
        const promptText = promptArea.value.trim();

        if (!promptText) { UI.toast('Le prompt est obligatoire', 'error'); return; }

        const entityTypes = [...overlay.querySelectorAll('.entity-type-cb:checked')].map(cb => cb.value);
        if (entityTypes.length === 0) { UI.toast('Selectionnez au moins un type d\'entite', 'error'); return; }

        // Auto-generate name if empty
        let nom = nomInput.value.trim();
        if (!nom) {
          nom = await _generateSkillName(promptText);
          if (!nom) nom = 'Skill ' + new Date().toLocaleDateString('fr-FR');
        }

        const systemPrompt = (overlay.querySelector('#ski-system-prompt')?.value?.trim()) || '';
        const scrape = overlay.querySelector('#ski-scrape')?.checked || false;

        const data = {
          nom,
          description: overlay.querySelector('#ski-description')?.value?.trim() || '',
          color: currentColor,
          statut: overlay.querySelector('#ski-statut')?.value || 'actif',
          entity_types: entityTypes,
          steps: [],
          inputs: []
        };

        // Handle multi-step skills
        if (isEdit && s.steps && s.steps.length > 1) {
          // Preserve multi-step structure, update first step prompt
          data.steps = s.steps.map((step, i) => ({
            ...step,
            user_prompt: i === 0 ? promptText : step.user_prompt,
            system_prompt: i === 0 ? systemPrompt : step.system_prompt,
            scrape_entity_urls: i === 0 ? scrape : step.scrape_entity_urls
          }));
        } else {
          data.steps = [{
            id: 'step_1',
            nom: nom,
            system_prompt: systemPrompt,
            user_prompt: promptText,
            scrape_entity_urls: scrape
          }];
        }

        if (isEdit) data.id = s.id;
        await saveSkill(data);
        UI.toast(isEdit ? 'Skill modifie' : 'Skill cree', 'success');
        if (typeof _onRefresh === 'function') _onRefresh();
        else location.reload();
      }
    });

    // Wire up UI events
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    // Name click to edit
    const nameDisplay = overlay.querySelector('#ski-name-display');
    const nameInputWrap = overlay.querySelector('#ski-name-input-wrap');
    const nameInput = overlay.querySelector('#ski-nom');

    if (nameDisplay) {
      nameDisplay.addEventListener('click', () => {
        nameDisplay.style.display = 'none';
        nameInputWrap.style.display = 'block';
        nameInput.focus();
        _nameManuallySet = true;
      });
    }

    // Auto-name on prompt blur
    const promptArea = overlay.querySelector('#ski-prompt');
    if (promptArea) {
      promptArea.addEventListener('blur', async () => {
        if (_nameManuallySet) return;
        const text = promptArea.value.trim();
        if (text.length < 20) return;

        const nameText = overlay.querySelector('#ski-name-text');
        if (nameText) nameText.textContent = 'Generation du nom...';
        if (nameDisplay) nameDisplay.style.display = 'block';

        const generatedName = await _generateSkillName(text);
        if (generatedName && !_nameManuallySet) {
          nameInput.value = generatedName;
          if (nameText) nameText.textContent = generatedName;
        } else {
          if (nameText) nameText.textContent = nameInput.value || 'Nouveau skill';
        }
      });
    }

    // Name input change → update display
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        _nameManuallySet = true;
        const nameText = overlay.querySelector('#ski-name-text');
        if (nameText) nameText.textContent = nameInput.value || 'Nouveau skill';
      });
    }

    // Color buttons
    overlay.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.color-btn').forEach(b => b.style.borderColor = 'transparent');
        btn.style.borderColor = '#1e293b';
        currentColor = btn.dataset.color;
      });
    });

    // Advanced toggle
    const toggle = overlay.querySelector('#ski-advanced-toggle');
    const section = overlay.querySelector('#ski-advanced-section');
    const arrow = overlay.querySelector('#ski-advanced-arrow');
    if (toggle && section) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const visible = section.style.display !== 'none';
        section.style.display = visible ? 'none' : 'block';
        if (arrow) arrow.innerHTML = visible ? '&#9656;' : '&#9662;';
      });
    }
  }

  function _buildMultiStepSection(skill) {
    return `
      <div style="margin-top:8px;">
        <label style="font-size:0.8rem;color:#64748b;font-weight:600;">Etapes (${skill.steps.length})</label>
        ${skill.steps.map((step, i) => `
          <div style="margin-top:8px;padding:8px;background:white;border:1px solid #e2e8f0;border-radius:6px;">
            <div style="font-size:0.8rem;font-weight:600;color:#1e293b;margin-bottom:4px;">Etape ${i + 1} : ${UI.escHtml(step.nom || '')}</div>
            <div style="font-size:0.75rem;color:#94a3b8;">${step.user_prompt ? step.user_prompt.substring(0, 100) + '...' : '(vide)'}</div>
          </div>
        `).join('')}
        <div style="font-size:0.75rem;color:#94a3b8;margin-top:8px;">Le prompt principal edite la premiere etape. Les etapes suivantes sont preservees.</div>
      </div>
    `;
  }

  // ============================================================
  // RUNNER UI (modale d'execution conversationnelle)
  // ============================================================

  function showRunner(skill, entityType, entityId) {
    let _conversationMessages = [];
    let _currentResult = '';

    const bodyHtml = `
      <div style="max-height:70vh;overflow-y:auto;">
        <!-- Loader -->
        <div id="skill-loader" style="text-align:center;padding:40px 0;">
          <div style="display:inline-block;width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:${skill.color || '#f59e0b'};border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <div id="skill-loader-text" style="margin-top:12px;font-size:0.85rem;color:#64748b;">Execution en cours...</div>
        </div>

        <!-- Result -->
        <div id="skill-result" style="display:none;">
          <div id="skill-result-content" style="white-space:pre-wrap;font-size:0.85rem;line-height:1.6;color:#1e293b;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;max-height:50vh;overflow-y:auto;user-select:text;"></div>

          <div style="display:flex;justify-content:flex-end;margin-top:8px;">
            <button type="button" id="btn-copy-result" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border:1px solid #e2e8f0;border-radius:6px;background:white;cursor:pointer;font-size:0.8rem;color:#64748b;" title="Copier dans le presse-papier">
              <svg id="copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              <span id="copy-label">Copier</span>
            </button>
          </div>

          <!-- Affiner -->
          <div style="margin-top:12px;display:flex;gap:8px;">
            <input type="text" id="skill-refine-input" placeholder="Affiner : ex. 'Sois plus concis', 'Ajoute les risques'..." style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.85rem;" />
            <button type="button" id="btn-refine" style="padding:8px 16px;background:${skill.color || '#f59e0b'};color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">Envoyer</button>
          </div>
        </div>

        <!-- Error -->
        <div id="skill-error" style="display:none;color:#ef4444;font-size:0.85rem;padding:12px;border:1px solid #fecaca;border-radius:8px;background:#fef2f2;"></div>
      </div>
    `;

    UI.modal(skill.nom || 'Skill', bodyHtml, { width: 700 });

    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    // Add spin animation if not present
    if (!document.getElementById('skill-spin-style')) {
      const style = document.createElement('style');
      style.id = 'skill-spin-style';
      style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    // Execute immediately
    const loaderDiv = overlay.querySelector('#skill-loader');
    const loaderText = overlay.querySelector('#skill-loader-text');
    const resultDiv = overlay.querySelector('#skill-result');
    const resultContent = overlay.querySelector('#skill-result-content');
    const errorDiv = overlay.querySelector('#skill-error');

    (async () => {
      try {
        const { result, messages } = await runSkill(skill.id, entityType, entityId, (stepIdx, stepName, status) => {
          if (loaderText) {
            if (status === 'scraping') loaderText.textContent = 'Recherche web en cours...';
            else loaderText.textContent = stepName ? 'Etape : ' + stepName + '...' : 'Execution en cours...';
          }
        });

        _conversationMessages = messages;
        _currentResult = result;

        // Show result
        loaderDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        resultContent.textContent = result;

      } catch (err) {
        loaderDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = err.message || 'Erreur inconnue';
      }
    })();

    // Copy button
    const copyBtn = overlay.querySelector('#btn-copy-result');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(_currentResult);
        } catch {
          const range = document.createRange();
          range.selectNodeContents(resultContent);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
          document.execCommand('copy');
          window.getSelection().removeAllRanges();
        }
        const label = overlay.querySelector('#copy-label');
        if (label) {
          label.textContent = 'Copie !';
          setTimeout(() => { label.textContent = 'Copier'; }, 2000);
        }
      });
    }

    // Refine button
    const refineInput = overlay.querySelector('#skill-refine-input');
    const refineBtn = overlay.querySelector('#btn-refine');

    async function doRefine() {
      const text = refineInput.value.trim();
      if (!text || _conversationMessages.length === 0) return;

      refineInput.value = '';
      refineBtn.disabled = true;
      refineBtn.textContent = '...';
      resultContent.style.opacity = '0.5';

      try {
        const refined = await refineResult(_conversationMessages, text);
        _currentResult = refined;
        resultContent.textContent = refined;
        resultContent.style.opacity = '1';
      } catch (err) {
        UI.toast('Erreur : ' + err.message, 'error');
        resultContent.style.opacity = '1';
      }

      refineBtn.disabled = false;
      refineBtn.textContent = 'Envoyer';
      refineInput.focus();
    }

    if (refineBtn) refineBtn.addEventListener('click', doRefine);
    if (refineInput) refineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doRefine(); }
    });
  }

  // ============================================================
  // SKILLS EXEMPLES (pre-chargement v2 — prompts langage naturel)
  // ============================================================

  const DEFAULT_SKILLS = [
    {
      nom: 'Lecture Recruteur',
      description: 'Analyse complete du profil candidat : fit poste, fit culture, risques, positionnement marche',
      color: '#8b5cf6',
      entity_types: ['candidats'],
      steps: [
        {
          id: 'step_1',
          nom: 'Extraction factuelle',
          system_prompt: 'Tu es consultant en executive search specialise DSI/DT.\n\nRegles de fiabilite :\n- Utilise UNIQUEMENT les informations des sources fournies (fiche ATS + contenu web)\n- Ne jamais inventer, extrapoler ou ajouter d\'informations externes\n- En cas de contradiction entre sources : formulation neutre mentionnant les deux versions\n- Traitement autorise : reformuler, synthetiser, regrouper, hierarchiser, croiser les sources\n\nRedaction : bullet points, 1 idee par ligne, max 14 mots, factuel et decisionnel.',
          user_prompt: 'A partir de toutes les informations disponibles sur ce candidat (fiche ATS et contenu web), extrais toutes les informations factuelles pertinentes pour un recruteur, organisees par theme.',
          scrape_entity_urls: true
        },
        {
          id: 'step_2',
          nom: 'Analyse recruteur',
          system_prompt: 'Tu es consultant en executive search specialise DSI/DT. Tu produis une analyse recruteur structuree, factuelle et sans projection psychologique.',
          user_prompt: 'A partir de l\'extraction factuelle, produis une analyse recruteur basee UNIQUEMENT sur les faits.\nAutorise : mise en coherence, identification de risques factuels, comparaison marche.\nInterdit : projection psychologique, hypothese non fondee sur les faits.\n\nFormat de sortie :\n\n## FIT POSTE\n(Adequation competences/experience vs poste cible)\n\n## FIT CULTURE\n(Indices sur l\'environnement de travail prefere)\n\n## RISQUES\n(Points d\'attention factuels)\n\n## POSITIONNEMENT MARCHE\n(Attractivite profil, rarete, fourchette remuneration estimee si elements disponibles)',
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
          user_prompt: 'A partir des informations disponibles sur ce decideur (fiche ATS et contenu web), extrais :\n- Parcours professionnel cle\n- Responsabilites actuelles identifiees\n- Enjeux potentiels lies a son poste\n- Signaux d\'ouverture ou de changement',
          scrape_entity_urls: true
        },
        {
          id: 'step_2',
          nom: 'Recommandation d\'approche',
          system_prompt: 'Tu es consultant en executive search. Tu recommandes une strategie d\'approche pour un decideur.',
          user_prompt: 'A partir de la qualification, recommande :\n\n## ANGLE D\'APPROCHE\n(Le meilleur angle pour engager la conversation)\n\n## PROPOSITION DE VALEUR\n(Ce que nous pouvons lui apporter : talents, benchmark, veille)\n\n## CANAL RECOMMANDE\n(LinkedIn, email, telephone, evenement...)\n\n## MESSAGE D\'ACCROCHE\n(3-4 lignes max, personnalise)',
          scrape_entity_urls: false
        }
      ],
      inputs: [],
      statut: 'actif'
    },
    {
      nom: 'Accroche LinkedIn',
      description: 'Generation de 3 variantes de messages d\'accroche LinkedIn personnalises',
      color: '#06b6d4',
      entity_types: ['decideurs'],
      steps: [
        {
          id: 'step_1',
          nom: 'Diagnostic et accroche',
          system_prompt: 'Tu es consultant en executive search specialise DSI/DT. Tu rediges des messages d\'accroche LinkedIn courts, percutants et personnalises.\n\nRegles :\n- Max 300 caracteres (limite LinkedIn InMail)\n- Ton professionnel mais humain\n- Personnalise avec des elements du profil\n- Pas de formule generique\n- Une question ouverte en fin de message',
          user_prompt: 'A partir des informations disponibles sur ce decideur, genere 3 variantes de messages d\'accroche LinkedIn :\n\n## VARIANTE 1 — Approche directe\n(Mention d\'un enjeu specifique identifie)\n\n## VARIANTE 2 — Approche valeur\n(Partage d\'insight ou benchmark)\n\n## VARIANTE 3 — Approche reseau\n(Mise en relation, recommandation)',
          scrape_entity_urls: true
        }
      ],
      inputs: [],
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
    refineResult,
    showEditor,
    showRunner,
    setOnRefresh,
    ensureDefaultSkills: _ensureDefaultSkills,
    ENTITY_LABELS,
    ENTITY_ICONS,
    SKILL_COLORS
  };
})();
