// Amarillo ATS — Actions / CRM logic

// --- Action Timer helpers ---
const TIMER_LS_KEY = 'ats_action_timer';

function getTimerState() {
  try { return JSON.parse(localStorage.getItem(TIMER_LS_KEY)) || null; }
  catch { return null; }
}

function setTimerState(state) {
  if (state) localStorage.setItem(TIMER_LS_KEY, JSON.stringify(state));
  else localStorage.removeItem(TIMER_LS_KEY);
}

function formatTimer(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }

  await Store.loadAll();
  UI.initGlobalSearch();

  const allActions = Store.get('actions');

  // KPIs
  const pending = allActions.filter(a => a.statut === 'À faire' || a.statut === 'A faire');
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const doneThisWeek = allActions.filter(a => a.statut === 'Fait' && a.date_action >= weekAgo);
  const withResponse = allActions.filter(a => a.reponse);
  const total = allActions.length;

  document.getElementById('kpi-todo').textContent = pending.length;
  document.getElementById('kpi-done-week').textContent = doneThisWeek.length;
  document.getElementById('kpi-response').textContent = total > 0 ? Math.round(withResponse.length / total * 100) + '%' : '—';
  document.getElementById('kpi-total').textContent = total;

  // Quick views (pre-defined filters like Notion views)
  const today = new Date().toISOString().split('T')[0];
  const VIEWS = {
    all: { label: 'Toutes', icon: '📋', filter: () => allActions },
    todo: { label: 'À faire', icon: '🎯', filter: () => allActions.filter(a => a.statut === 'À faire' || a.statut === 'A faire') },
    overdue: { label: 'En retard', icon: '🔴', filter: () => allActions.filter(a => a.statut !== 'Fait' && a.statut !== 'Annulé' && a.date_action && a.date_action < today) },
    relances: { label: 'Relances à faire', icon: '🔔', filter: () => allActions.filter(a => a.date_relance && a.date_relance <= today && a.statut !== 'Fait' && a.statut !== 'Annulé') },
    today: { label: 'Aujourd\'hui', icon: '📅', filter: () => allActions.filter(a => a.date_action === today) },
    week: { label: 'Cette semaine', icon: '📆', filter: () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      return allActions.filter(a => a.date_action >= weekAgo);
    }},
    prospection: { label: 'Prospection', icon: '🎯', filter: () => allActions.filter(a => a.decideur_id && (a.type_action === 'Prospection' || a.type_action === 'Prise de contact' || a.type_action === 'Relance décideur')) },
    teasers: { label: 'Teasers', icon: '✈️', filter: () => allActions.filter(a => a.type_action === 'Envoi teaser' || a.type_action === 'Retour teaser' || a.type_action === 'Relance teaser') },
    done: { label: 'Fait', icon: '✅', filter: () => allActions.filter(a => a.statut === 'Fait') },
  };

  // ---- Auto-create follow-up when action is marked "Fait" with a next_step ----
  async function createFollowUp(action) {
    if (!action || !action.next_step) return null;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const followUp = {
      id: API.generateId('act'),
      action: action.next_step,
      type_action: action.type_action || '',
      canal: action.canal || '',
      statut: 'À faire',
      priorite: action.priorite || null,
      date_action: action.date_relance || tomorrow,
      date_relance: null,
      candidat_id: action.candidat_id || null,
      decideur_id: action.decideur_id || null,
      mission_id: action.mission_id || null,
      entreprise_id: action.entreprise_id || null,
      reponse: false,
      message_notes: `Suite de : ${action.action || ''}`,
      next_step: '',
      phase: '', finalite: '', objectif: '', moment_suivi: '',
    };
    await Store.add('actions', followUp);
    return followUp;
  }

  let currentView = 'todo'; // Default to "À faire" view
  const hashView = window.location.hash.replace('#', '');
  if (hashView && VIEWS[hashView]) currentView = hashView;
  let searchValue = '';
  let filterValues = {};

  function applyFilters() {
    let filtered = VIEWS[currentView].filter();
    if (searchValue) {
      const q = searchValue.toLowerCase();
      filtered = filtered.filter(a => (a.action || '').toLowerCase().includes(q) || (a.message_notes || '').toLowerCase().includes(q) || (a.next_step || '').toLowerCase().includes(q));
    }
    if (filterValues.canal) filtered = filtered.filter(a => a.canal === filterValues.canal);
    if (filterValues.type_action) filtered = filtered.filter(a => a.type_action === filterValues.type_action);
    if (filterValues.priorite) filtered = filtered.filter(a => a.priorite === filterValues.priorite);
    if (filterValues.statut) filtered = filtered.filter(a => (a.statut || 'À faire') === filterValues.statut);
    renderTable(filtered);
    // Update view count badges
    document.querySelectorAll('.view-tab').forEach(tab => {
      const count = tab.querySelector('.view-count');
      if (count) {
        const vKey = tab.dataset.view;
        count.textContent = VIEWS[vKey].filter().length;
      }
    });
  }

  // Render view tabs
  const viewTabsHtml = Object.entries(VIEWS).map(([key, v]) => {
    const count = v.filter().length;
    return `<button class="view-tab ${key === currentView ? 'active' : ''}" data-view="${key}">
      <span>${v.icon}</span> ${v.label} <span class="view-count">${count}</span>
    </button>`;
  }).join('');

  const filtersContainer = document.getElementById('actions-filters');
  filtersContainer.innerHTML = `
    <div class="view-tabs-row">${viewTabsHtml}</div>
    <div class="filters-bar" style="margin-top:8px;">
      <input type="text" class="filter-search" placeholder="Rechercher une action, next step..." />
      <select class="filter-select" data-filter="type_action">
        <option value="">Tous les types</option>
        ${Referentiels.get('action_types').map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select class="filter-select" data-filter="canal">
        <option value="">Tous les canaux</option>
        ${Referentiels.get('action_canaux').map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select class="filter-select" data-filter="priorite">
        <option value="">Toutes priorités</option>
        ${Referentiels.get('action_priorites').map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select class="filter-select" data-filter="statut">
        <option value="">Tous statuts</option>
        <option value="À faire">À faire</option>
        <option value="Fait">Fait</option>
        <option value="Annulé">Annulé</option>
      </select>
    </div>
  `;

  // Bind view tabs
  filtersContainer.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      filtersContainer.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      window.location.hash = currentView;
      applyFilters();
    });
  });

  // Bind search + filters
  filtersContainer.querySelector('.filter-search').addEventListener('input', (e) => {
    searchValue = e.target.value;
    applyFilters();
  });
  filtersContainer.querySelectorAll('.filter-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      filterValues[sel.dataset.filter] = e.target.value;
      applyFilters();
    });
  });

  applyFilters();

  function renderTable(data) {
    const todayStr = new Date().toISOString().split('T')[0];
    const sorted = [...data].sort((a, b) => {
      // Sort: overdue first, then by date
      const aOverdue = (a.statut === 'À faire' || a.statut === 'A faire') && a.date_action && a.date_action < todayStr ? 0 : 1;
      const bOverdue = (b.statut === 'À faire' || b.statut === 'A faire') && b.date_action && b.date_action < todayStr ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return (b.date_action || '').localeCompare(a.date_action || '');
    });

    UI.dataTable('actions-table', {
      columns: [
        { key: 'priorite', label: '', render: r => {
          if (r.priorite === 'Haute') return '<span title="Haute priorité" style="color:#dc2626;">🔴</span>';
          if (r.priorite === 'Moyenne') return '<span title="Priorité moyenne" style="color:#c9a000;">🟡</span>';
          if (r.priorite === 'Basse') return '<span title="Basse priorité" style="color:#16a34a;">🟢</span>';
          return '';
        }},
        { key: 'action', label: 'Action', render: r => {
          const overdue = (r.statut === 'À faire' || r.statut === 'A faire') && r.date_action && r.date_action < todayStr;
          return `<strong${overdue ? ' style="color:#dc2626;"' : ''}>${UI.escHtml(r.action || '')}</strong>`;
        }},
        { key: 'type_action', label: 'Type', render: r => `<span style="font-size:0.75rem;color:#64748b;">${UI.escHtml(r.type_action || '')}</span>` },
        { key: 'canal', label: 'Canal', render: r => UI.badge(r.canal) },
        { key: 'candidat', label: 'Candidat', render: r => r.candidat_id ? UI.resolveLink('candidats', r.candidat_id) : '—' },
        { key: 'decideur', label: 'Décideur', render: r => r.decideur_id ? UI.resolveLink('decideurs', r.decideur_id) : '—' },
        { key: 'mission', label: 'Mission', render: r => r.mission_id ? UI.resolveLink('missions', r.mission_id) : '—' },
        { key: 'date_action', label: 'Date', render: r => {
          const overdue = (r.statut === 'À faire' || r.statut === 'A faire') && r.date_action && r.date_action < todayStr;
          return `<span${overdue ? ' style="color:#dc2626;font-weight:600;"' : ''}>${UI.formatDate(r.date_action)}</span>`;
        }},
        { key: 'next_step', label: 'Next step', render: r => r.next_step ? `<span style="font-size:0.75rem;color:#c9a000;">→ ${UI.escHtml(r.next_step)}</span>` : '' },
        { key: 'relance', label: 'Relance', render: r => r.date_relance ? `<span style="font-size:0.75rem;${r.date_relance <= todayStr ? 'color:#dc2626;font-weight:600;' : 'color:#64748b;'}">${UI.formatDate(r.date_relance)}</span>` : '' },
        { key: 'duree_minutes', label: 'Durée', render: r => {
          if (!r.duree_minutes) return '';
          const h = Math.floor(r.duree_minutes / 60);
          const m = r.duree_minutes % 60;
          return `<span style="font-size:0.75rem;color:#0369a1;">${h > 0 ? h + 'h' : ''}${m > 0 ? m + 'min' : (h > 0 ? '' : '0min')}</span>`;
        }},
        { key: 'statut', label: 'Statut', render: r => UI.statusBadge(r.statut || 'À faire', ['À faire', 'En cours', 'Fait', 'Annulé'], { entity: 'actions', recordId: r.id, fieldName: 'statut', onUpdate: async (newStatus) => {
          if (newStatus === 'Fait' && r.next_step) {
            const fu = await createFollowUp(r);
            if (fu) UI.toast(`Action suivante créée : ${fu.action}`);
          }
          location.reload();
        } }) },
      ],
      data: sorted,
      onRowClick: (id) => editAction(id),
      emptyMessage: 'Aucune action dans cette vue',
      storageKey: 'actions'
    });
  }

  // New action
  document.getElementById('btn-new-action').addEventListener('click', () => showActionModal());

  function showActionModal(existing = null) {
    const isEdit = !!existing;
    const a = existing || {};
    const candidats = Store.get('candidats');
    const decideurs = Store.get('decideurs');
    const missions = Store.get('missions');
    const entreprises = Store.get('entreprises');

    // Build template options for dropdown
    const templateOptions = typeof TEMPLATES !== 'undefined' ? Object.entries(TEMPLATES).map(([key, tpl]) =>
      `<option value="${key}">${tpl.icon} ${tpl.title}</option>`
    ).join('') : '';

    const bodyHtml = `
      <div class="form-group">
        <label>Action</label>
        <input type="text" id="a-action" value="${UI.escHtml(a.action || '')}" placeholder="Ex: Message LinkedIn, Appel..." />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type d'action</label>
          <select id="a-type">
            ${Referentiels.get('action_types').map(s => `<option value="${s}" ${a.type_action===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Canal</label>
          <select id="a-canal">
            ${Referentiels.get('action_canaux').map(s => `<option value="${s}" ${a.canal===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="a-statut">
            <option value="À faire" ${(a.statut==='À faire'||a.statut==='A faire')?'selected':''}>À faire</option>
            <option value="En cours" ${a.statut==='En cours'?'selected':''}>En cours</option>
            <option value="Fait" ${a.statut==='Fait'?'selected':''}>Fait</option>
            <option value="Annulé" ${a.statut==='Annulé'?'selected':''}>Annulé</option>
          </select>
        </div>
        <div class="form-group">
          <label>Priorité</label>
          <select id="a-priorite">
            <option value="" ${!a.priorite?'selected':''}>—</option>
            <option value="Haute" ${a.priorite==='Haute'?'selected':''}>🔴 Haute</option>
            <option value="Moyenne" ${a.priorite==='Moyenne'?'selected':''}>🟡 Moyenne</option>
            <option value="Basse" ${a.priorite==='Basse'?'selected':''}>🟢 Basse</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="a-date" value="${a.date_action || new Date().toISOString().split('T')[0]}" />
        </div>
        <div class="form-group">
          <label>Date relance</label>
          <input type="date" id="a-relance" value="${a.date_relance || ''}" />
        </div>
      </div>
      <div class="form-group" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px;text-align:center;">
        <label style="margin-bottom:8px;display:block;">Temps passé</label>
        <div id="timer-display" style="font-size:2rem;font-weight:700;color:#0369a1;font-variant-numeric:tabular-nums;letter-spacing:0.05em;">00:00</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;">
          <button type="button" class="btn btn-primary btn-sm" id="timer-start">Démarrer</button>
          <button type="button" class="btn btn-sm" id="timer-pause" style="display:none;">Pause</button>
          <button type="button" class="btn btn-sm" id="timer-reset" style="display:none;">Reset</button>
        </div>
        ${a.duree_minutes ? `<div style="font-size:0.75rem;color:#64748b;margin-top:6px;">Précédemment : ${a.duree_minutes} min</div>` : ''}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Candidat</label>
          <div id="ac-candidat"></div>
        </div>
        <div class="form-group">
          <label>Décideur</label>
          <div id="ac-decideur"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Mission</label>
          <select id="a-mission">
            <option value="">— Aucune —</option>
            ${missions.map(m => `<option value="${m.id}" ${a.mission_id===m.id?'selected':''}>${UI.escHtml(m.nom||m.ref||'')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Entreprise</label>
          <div id="ac-entreprise"></div>
        </div>
      </div>
      <div class="form-group">
        <label>Réponse reçue ?</label>
        <select id="a-reponse">
          <option value="false" ${!a.reponse?'selected':''}>Non</option>
          <option value="true" ${a.reponse?'selected':''}>Oui</option>
        </select>
      </div>
      ${templateOptions ? `
      <div class="form-group" style="background:#FFFDF0;border:1px solid #FEE566;border-radius:8px;padding:12px;">
        <label style="color:#c9a000;">📋 Utiliser une trame</label>
        <select id="a-template" style="margin-bottom:8px;">
          <option value="">— Choisir un template —</option>
          ${templateOptions}
        </select>
        <div id="a-template-preview" style="display:none;max-height:200px;overflow-y:auto;font-size:0.8125rem;color:#475569;background:#fff;border-radius:6px;padding:10px;border:1px solid #e2e8f0;"></div>
      </div>
      ` : ''}
      <div class="form-group">
        <label>Message / Notes</label>
        <textarea id="a-notes" style="min-height:120px;">${UI.escHtml(a.message_notes || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Next step</label>
        <input type="text" id="a-next" value="${UI.escHtml(a.next_step || '')}" />
      </div>
    `;

    UI.modal(isEdit ? 'Modifier l\'action' : 'Nouvelle action', bodyHtml, {
      width: 640,
      draftKey: isEdit ? 'action_edit_' + a.id : 'action_new',
      onSave: async (overlay) => {
        const data = {
          action: overlay.querySelector('#a-action').value.trim(),
          type_action: overlay.querySelector('#a-type').value,
          canal: overlay.querySelector('#a-canal').value,
          statut: overlay.querySelector('#a-statut').value,
          priorite: overlay.querySelector('#a-priorite').value || null,
          date_action: overlay.querySelector('#a-date').value,
          candidat_id: document.getElementById('ac-candidat')?._getSelectedId?.() || null,
          decideur_id: document.getElementById('ac-decideur')?._getSelectedId?.() || null,
          mission_id: overlay.querySelector('#a-mission').value || null,
          entreprise_id: document.getElementById('ac-entreprise')?._getSelectedId?.() || null,
          reponse: overlay.querySelector('#a-reponse').value === 'true',
          message_notes: overlay.querySelector('#a-notes').value.trim(),
          next_step: overlay.querySelector('#a-next').value.trim(),
          date_relance: overlay.querySelector('#a-relance').value || null,
          duree_minutes: (() => {
            const ts = getTimerState();
            if (!ts) return a.duree_minutes || null;
            let secs = ts.accumulatedSeconds || 0;
            if (ts.running && ts.startedAt) secs += Math.floor((Date.now() - ts.startedAt) / 1000);
            return secs > 0 ? Math.ceil(secs / 60) : null;
          })(),
        };

        // Clear timer state after saving
        setTimerState(null);

        if (isEdit) {
          await Store.update('actions', a.id, data);
          UI.toast('Action mise à jour');
          // Auto-create follow-up if just marked Fait with a next_step
          const wasPending = (a.statut === 'À faire' || a.statut === 'A faire' || a.statut === 'En cours');
          if (data.statut === 'Fait' && wasPending && data.next_step) {
            const fu = await createFollowUp({ ...a, ...data });
            if (fu) UI.toast(`Action suivante créée : ${fu.action}`);
          }
          await Store.syncRelanceDates(data);
        } else {
          data.id = API.generateId('act');
          data.phase = '';
          data.finalite = '';
          data.objectif = '';
          data.moment_suivi = '';
          await Store.add('actions', data);
          UI.toast('Action créée');
          await Store.syncRelanceDates(data);
        }
        location.reload();
      }
    });

    // Searchable selects for candidat, decideur, entreprise
    setTimeout(() => {
      UI.searchableSelect('ac-candidat', {
        items: candidats.map(c => ({
          id: c.id,
          label: `${c.prenom || ''} ${c.nom || ''}`.trim(),
          sub: c.poste_actuel || ''
        })),
        selectedId: a.candidat_id || null,
        placeholder: 'Rechercher un candidat...',
        emptyLabel: '— Aucun —'
      });

      UI.searchableSelect('ac-decideur', {
        items: decideurs.map(d => ({
          id: d.id,
          label: `${d.prenom || ''} ${d.nom || ''}`.trim(),
          sub: d.fonction || ''
        })),
        selectedId: a.decideur_id || null,
        placeholder: 'Rechercher un décideur...',
        emptyLabel: '— Aucun —'
      });

      UI.searchableSelect('ac-entreprise', {
        items: entreprises.map(e => ({
          id: e.id,
          label: e.nom || '',
          sub: [e.secteur, e.localisation].filter(Boolean).join(' \u2022 ')
        })),
        selectedId: a.entreprise_id || null,
        placeholder: 'Rechercher une entreprise...',
        emptyLabel: '— Aucune —'
      });
    }, 50);

    // Template selector: preview + inject into notes
    setTimeout(() => {
      const tplSelect = document.getElementById('a-template');
      const tplPreview = document.getElementById('a-template-preview');
      if (tplSelect && tplPreview) {
        tplSelect.addEventListener('change', () => {
          const key = tplSelect.value;
          if (key && TEMPLATES[key]) {
            tplPreview.style.display = 'block';
            tplPreview.innerHTML = renderTemplate(key) +
              '<button class="btn btn-primary btn-sm" id="tpl-inject" style="margin-top:8px;width:100%;">Insérer dans les notes</button>';
            // Bind inject button
            document.getElementById('tpl-inject').addEventListener('click', (e) => {
              e.preventDefault();
              const notesArea = document.getElementById('a-notes');
              const text = renderTemplateText(key);
              const current = notesArea.value;
              notesArea.value = current + (current ? '\n\n' : '') + text;
              notesArea.style.minHeight = '300px';
              tplPreview.innerHTML = '<div style="color:#16a34a;font-weight:600;text-align:center;padding:8px;">✓ Trame insérée dans les notes</div>';
              setTimeout(() => { tplPreview.style.display = 'none'; tplSelect.value = ''; }, 1500);
            });
          } else {
            tplPreview.style.display = 'none';
          }
        });
      }
    }, 100);

    // --- Timer logic ---
    setTimeout(() => {
      const display = document.getElementById('timer-display');
      const btnStart = document.getElementById('timer-start');
      const btnPause = document.getElementById('timer-pause');
      const btnReset = document.getElementById('timer-reset');
      if (!display || !btnStart) return;

      const actionId = isEdit ? a.id : null;
      let timerInterval = null;

      // Restore timer state from localStorage (only if same action)
      let state = getTimerState();
      if (state && state.actionId !== actionId) state = null;

      // Pre-populate from existing duree_minutes
      if (!state && a.duree_minutes) {
        state = { actionId, startedAt: null, accumulatedSeconds: a.duree_minutes * 60, running: false };
      }

      function getElapsed() {
        if (!state) return 0;
        let total = state.accumulatedSeconds || 0;
        if (state.running && state.startedAt) total += Math.floor((Date.now() - state.startedAt) / 1000);
        return total;
      }

      function updateDisplay() { display.textContent = formatTimer(getElapsed()); }

      function startTimer() {
        if (!state) state = { actionId, startedAt: null, accumulatedSeconds: 0, running: false };
        state.startedAt = Date.now();
        state.running = true;
        setTimerState(state);
        btnStart.style.display = 'none';
        btnPause.style.display = '';
        btnReset.style.display = '';
        timerInterval = setInterval(updateDisplay, 1000);
      }

      function pauseTimer() {
        if (!state || !state.running) return;
        state.accumulatedSeconds += Math.floor((Date.now() - state.startedAt) / 1000);
        state.startedAt = null;
        state.running = false;
        setTimerState(state);
        clearInterval(timerInterval);
        btnStart.style.display = '';
        btnStart.textContent = 'Reprendre';
        btnPause.style.display = 'none';
      }

      function resetTimer() {
        clearInterval(timerInterval);
        state = null;
        setTimerState(null);
        display.textContent = '00:00';
        btnStart.style.display = '';
        btnStart.textContent = 'Démarrer';
        btnPause.style.display = 'none';
        btnReset.style.display = 'none';
      }

      btnStart.addEventListener('click', startTimer);
      btnPause.addEventListener('click', pauseTimer);
      btnReset.addEventListener('click', resetTimer);

      // Restore running timer
      if (state) {
        updateDisplay();
        if (state.running) {
          btnStart.style.display = 'none';
          btnPause.style.display = '';
          btnReset.style.display = '';
          timerInterval = setInterval(updateDisplay, 1000);
        } else if (state.accumulatedSeconds > 0) {
          btnStart.textContent = 'Reprendre';
          btnReset.style.display = '';
        }
      }
    }, 100);
  }

  function editAction(id) {
    const action = Store.findById('actions', id);
    if (action) showActionModal(action);
  }

  // Auto-open edit modal if ?edit=ACTION_ID is in the URL (from dashboard click)
  const editParam = new URLSearchParams(window.location.search).get('edit');
  if (editParam) {
    const action = Store.findById('actions', editParam);
    if (action) showActionModal(action);
    // Clean URL without reloading
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }
})();
