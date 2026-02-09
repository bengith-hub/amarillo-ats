// Amarillo ATS — Dashboard logic

(async function() {
  if (!API.isConfigured()) {
    UI.showConfigModal();
    return;
  }

  document.getElementById('sync-status').textContent = 'Chargement...';
  document.querySelector('.sync-dot').classList.add('syncing');

  try {
    await Store.loadAll();
  } catch (e) {
    console.error('Failed to load data:', e);
  }

  document.getElementById('sync-status').textContent = 'Synchronisé';
  document.querySelector('.sync-dot').classList.remove('syncing');

  UI.initGlobalSearch();
  renderKPIs();
  renderActions();
  renderPipeline();
  renderRecent();

  function renderKPIs() {
    const missions = Store.get('missions');
    const candidats = Store.get('candidats');
    const actions = Store.get('actions');

    const activeMissions = missions.filter(m =>
      m.statut && !['Clôturée', 'Annulée'].includes(m.statut)
    );

    const activeStatuses = ['Approché', 'En qualification', 'Shortlisté', 'Présenté'];
    const activeCandidats = candidats.filter(c => activeStatuses.includes(c.statut));

    const pendingActions = actions.filter(a =>
      a.statut === 'À faire' || a.statut === 'A faire'
    );

    const totalFees = activeMissions.reduce((sum, m) => sum + (m.fee_estimee || 0), 0);

    document.getElementById('kpi-missions').textContent = activeMissions.length;
    document.getElementById('kpi-candidats').textContent = activeCandidats.length;
    document.getElementById('kpi-actions').textContent = pendingActions.length;
    document.getElementById('kpi-fees').textContent = UI.formatCurrency(totalFees);
  }

  function renderActions() {
    const actions = Store.get('actions');
    const today = new Date().toISOString().split('T')[0];

    const pending = actions
      .filter(a => a.statut === 'À faire' || a.statut === 'A faire')
      .sort((a, b) => (a.date_action || '').localeCompare(b.date_action || ''));

    UI.dataTable('dashboard-actions', {
      columns: [
        { key: 'action', label: 'Action', render: r => UI.escHtml(r.action || '') },
        { key: 'canal', label: 'Canal', render: r => UI.badge(r.canal) },
        { key: 'candidat', label: 'Candidat', render: r => r.candidat_id ? UI.resolveLink('candidats', r.candidat_id) : '—' },
        { key: 'mission', label: 'Mission', render: r => r.mission_id ? UI.resolveLink('missions', r.mission_id) : '—' },
        { key: 'date_action', label: 'Date', render: r => UI.formatDate(r.date_action) },
        { key: 'statut', label: 'Statut', render: r => UI.badge(r.statut) },
      ],
      data: pending.slice(0, 10),
      onRowClick: (id) => {
        // Open action detail or edit modal
      },
      emptyMessage: 'Aucune action en attente'
    });
  }

  function renderPipeline() {
    const missions = Store.get('missions');
    const stages = [
      'Ciblage décideurs', 'Cadrage', 'Proposition',
      'Mission lancée', 'Shortlist', 'Entretiens client',
      'Offre', 'Placé', 'Suivi intégration'
    ];

    const container = document.getElementById('dashboard-pipeline');
    if (!container) return;

    if (missions.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Aucune mission</p></div>';
      return;
    }

    const html = `
      <div class="kanban">
        ${stages.map(stage => {
          const items = missions.filter(m => m.statut === stage);
          return `
            <div class="kanban-column">
              <div class="kanban-column-header">
                ${stage}
                <span class="kanban-column-count">${items.length}</span>
              </div>
              ${items.map(m => `
                <a href="mission.html?id=${m.id}" class="kanban-card" style="display:block;text-decoration:none;color:inherit;">
                  <div class="kanban-card-title">${UI.escHtml(m.nom || m.ref || '')}</div>
                  <div class="kanban-card-sub">
                    ${UI.badge(m.niveau)}
                    ${m.fee_estimee ? UI.formatCurrency(m.fee_estimee) : ''}
                  </div>
                </a>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;
    container.innerHTML = html;
  }

  function renderRecent() {
    const actions = Store.get('actions');
    const recent = [...actions]
      .filter(a => a.statut === 'Fait')
      .sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''))
      .slice(0, 8);

    UI.timeline('dashboard-recent', recent);
  }
})();
