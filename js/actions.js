// Amarillo ATS — Actions / CRM logic

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
    overdue: { label: 'En retard', icon: '🔴', filter: () => allActions.filter(a => (a.statut === 'À faire' || a.statut === 'A faire') && a.date_action && a.date_action < today) },
    relances: { label: 'Relances à faire', icon: '🔔', filter: () => allActions.filter(a => a.date_relance && a.date_relance <= today && a.statut !== 'Fait' && a.statut !== 'Annulé') },
    today: { label: 'Aujourd\'hui', icon: '📅', filter: () => allActions.filter(a => a.date_action === today) },
    week: { label: 'Cette semaine', icon: '📆', filter: () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      return allActions.filter(a => a.date_action >= weekAgo);
    }},
    prospection: { label: 'Prospection', icon: '🎯', filter: () => allActions.filter(a => a.type_action === 'Prospection' || a.type_action === 'Prise de contact' || a.type_action === 'Relance décideur') },
    done: { label: 'Fait', icon: '✅', filter: () => allActions.filter(a => a.statut === 'Fait') },
  };

  let currentView = 'todo'; // Default to "À faire" view
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
        ${['Prise de contact','Qualification candidat','Présentation candidat','Suivi candidat','Prise de référence','Suivi intégration','Prospection','Relance décideur','Cadrage mission','Négociation','Organisation d\'échange','Facturation','Autre'].map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select class="filter-select" data-filter="canal">
        <option value="">Tous les canaux</option>
        ${['LinkedIn','Appel','Email','Visio','Physique','SMS','Autre'].map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <select class="filter-select" data-filter="priorite">
        <option value="">Toutes priorités</option>
        <option value="Haute">🔴 Haute</option>
        <option value="Moyenne">🟡 Moyenne</option>
        <option value="Basse">🟢 Basse</option>
      </select>
    </div>
  `;

  // Bind view tabs
  filtersContainer.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      filtersContainer.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
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
        { key: 'candidat', label: 'Candidat', render: r => r.candidat_id ? UI.resolveLink('candidats', r.candidat_id) : (r.decideur_id ? UI.resolveLink('decideurs', r.decideur_id) : '—') },
        { key: 'mission', label: 'Mission', render: r => r.mission_id ? UI.resolveLink('missions', r.mission_id) : '—' },
        { key: 'date_action', label: 'Date', render: r => {
          const overdue = (r.statut === 'À faire' || r.statut === 'A faire') && r.date_action && r.date_action < todayStr;
          return `<span${overdue ? ' style="color:#dc2626;font-weight:600;"' : ''}>${UI.formatDate(r.date_action)}</span>`;
        }},
        { key: 'next_step', label: 'Next step', render: r => r.next_step ? `<span style="font-size:0.75rem;color:#c9a000;">→ ${UI.escHtml(r.next_step)}</span>` : '' },
        { key: 'relance', label: 'Relance', render: r => r.date_relance ? `<span style="font-size:0.75rem;${r.date_relance <= todayStr ? 'color:#dc2626;font-weight:600;' : 'color:#64748b;'}">${UI.formatDate(r.date_relance)}</span>` : '' },
        { key: 'statut', label: 'Statut', render: r => UI.statusBadge(r.statut || 'À faire', ['À faire', 'En cours', 'Fait', 'Annulé'], { entity: 'actions', recordId: r.id, fieldName: 'statut', onUpdate: () => { setTimeout(() => location.reload(), 400); } }) },
      ],
      data: sorted,
      onRowClick: (id) => editAction(id),
      emptyMessage: 'Aucune action dans cette vue'
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
            ${['Prise de contact','Qualification candidat','Présentation candidat','Suivi candidat','Prise de référence','Suivi intégration','Prospection','Relance décideur','Cadrage mission','Négociation','Organisation d\'échange','Facturation','Autre'].map(s => `<option value="${s}" ${a.type_action===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Canal</label>
          <select id="a-canal">
            ${['LinkedIn','Appel','Email','Visio','Physique','SMS','Autre'].map(s => `<option value="${s}" ${a.canal===s?'selected':''}>${s}</option>`).join('')}
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
      <div class="form-row">
        <div class="form-group">
          <label>Candidat</label>
          <select id="a-candidat">
            <option value="">— Aucun —</option>
            ${candidats.map(c => `<option value="${c.id}" ${a.candidat_id===c.id?'selected':''}>${UI.escHtml((c.prenom||'')+' '+(c.nom||''))}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Décideur</label>
          <select id="a-decideur">
            <option value="">— Aucun —</option>
            ${decideurs.map(d => `<option value="${d.id}" ${a.decideur_id===d.id?'selected':''}>${UI.escHtml((d.prenom||'')+' '+(d.nom||''))}</option>`).join('')}
          </select>
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
          <select id="a-entreprise">
            <option value="">— Aucune —</option>
            ${entreprises.map(e => `<option value="${e.id}" ${a.entreprise_id===e.id?'selected':''}>${UI.escHtml(e.nom)}</option>`).join('')}
          </select>
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
      onSave: async (overlay) => {
        const data = {
          action: overlay.querySelector('#a-action').value.trim(),
          type_action: overlay.querySelector('#a-type').value,
          canal: overlay.querySelector('#a-canal').value,
          statut: overlay.querySelector('#a-statut').value,
          priorite: overlay.querySelector('#a-priorite').value || null,
          date_action: overlay.querySelector('#a-date').value,
          candidat_id: overlay.querySelector('#a-candidat').value || null,
          decideur_id: overlay.querySelector('#a-decideur').value || null,
          mission_id: overlay.querySelector('#a-mission').value || null,
          entreprise_id: overlay.querySelector('#a-entreprise').value || null,
          reponse: overlay.querySelector('#a-reponse').value === 'true',
          message_notes: overlay.querySelector('#a-notes').value.trim(),
          next_step: overlay.querySelector('#a-next').value.trim(),
          date_relance: overlay.querySelector('#a-relance').value || null,
        };

        if (isEdit) {
          await Store.update('actions', a.id, data);
          UI.toast('Action mise à jour');
        } else {
          data.id = API.generateId('act');
          data.phase = '';
          data.finalite = '';
          data.objectif = '';
          data.moment_suivi = '';
          await Store.add('actions', data);
          UI.toast('Action créée');
        }
        setTimeout(() => location.reload(), 500);
      }
    });

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
  }

  function editAction(id) {
    const action = Store.findById('actions', id);
    if (action) showActionModal(action);
  }
})();
