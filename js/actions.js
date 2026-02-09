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

  // Filters
  UI.filterBar('actions-filters', {
    searchPlaceholder: 'Rechercher une action...',
    filters: [
      { key: 'statut', label: 'Tous les statuts', options: ['À faire', 'Fait'] },
      { key: 'canal', label: 'Tous les canaux', options: ['LinkedIn', 'Appel', 'Email'] },
      { key: 'type_action', label: 'Tous les types', options: ['Prise de contact', 'Qualification candidat', 'Suivi'] }
    ],
    onFilter: ({ search, filters }) => {
      let filtered = allActions;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(a => (a.action || '').toLowerCase().includes(q) || (a.message_notes || '').toLowerCase().includes(q));
      }
      if (filters.statut) filtered = filtered.filter(a => a.statut === filters.statut);
      if (filters.canal) filtered = filtered.filter(a => a.canal === filters.canal);
      if (filters.type_action) filtered = filtered.filter(a => a.type_action === filters.type_action);
      renderTable(filtered);
    }
  });

  renderTable(allActions);

  function renderTable(data) {
    const sorted = [...data].sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''));

    UI.dataTable('actions-table', {
      columns: [
        { key: 'action', label: 'Action', render: r => `<strong>${UI.escHtml(r.action || '')}</strong>` },
        { key: 'canal', label: 'Canal', render: r => UI.badge(r.canal) },
        { key: 'type_action', label: 'Type' },
        { key: 'candidat', label: 'Candidat', render: r => r.candidat_id ? UI.resolveLink('candidats', r.candidat_id) : '—' },
        { key: 'decideur', label: 'Décideur', render: r => r.decideur_id ? UI.resolveLink('decideurs', r.decideur_id) : '—' },
        { key: 'mission', label: 'Mission', render: r => r.mission_id ? UI.resolveLink('missions', r.mission_id) : '—' },
        { key: 'date_action', label: 'Date', render: r => UI.formatDate(r.date_action) },
        { key: 'reponse', label: 'Réponse', render: r => r.reponse ? '<span style="color:#16a34a;font-weight:600;">Oui</span>' : '<span style="color:#94a3b8;">Non</span>' },
        { key: 'statut', label: 'Statut', render: r => UI.badge(r.statut) },
      ],
      data: sorted,
      onRowClick: (id) => editAction(id),
      emptyMessage: 'Aucune action'
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

    const bodyHtml = `
      <div class="form-group">
        <label>Action</label>
        <input type="text" id="a-action" value="${UI.escHtml(a.action || '')}" placeholder="Ex: Message LinkedIn, Appel..." />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type d'action</label>
          <select id="a-type">
            ${['Prise de contact','Qualification candidat','Suivi','Organisation d\'echange'].map(s => `<option value="${s}" ${a.type_action===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Canal</label>
          <select id="a-canal">
            ${['LinkedIn','Appel','Email'].map(s => `<option value="${s}" ${a.canal===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="a-statut">
            <option value="À faire" ${(a.statut==='À faire'||a.statut==='A faire')?'selected':''}>À faire</option>
            <option value="Fait" ${a.statut==='Fait'?'selected':''}>Fait</option>
          </select>
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="a-date" value="${a.date_action || new Date().toISOString().split('T')[0]}" />
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
      <div class="form-group">
        <label>Message / Notes</label>
        <textarea id="a-notes">${UI.escHtml(a.message_notes || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Next step</label>
          <input type="text" id="a-next" value="${UI.escHtml(a.next_step || '')}" />
        </div>
        <div class="form-group">
          <label>Date relance</label>
          <input type="date" id="a-relance" value="${a.date_relance || ''}" />
        </div>
      </div>
    `;

    UI.modal(isEdit ? 'Modifier l\'action' : 'Nouvelle action', bodyHtml, {
      width: 600,
      onSave: async (overlay) => {
        const data = {
          action: overlay.querySelector('#a-action').value.trim(),
          type_action: overlay.querySelector('#a-type').value,
          canal: overlay.querySelector('#a-canal').value,
          statut: overlay.querySelector('#a-statut').value,
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
  }

  function editAction(id) {
    const action = Store.findById('actions', id);
    if (action) showActionModal(action);
  }
})();
