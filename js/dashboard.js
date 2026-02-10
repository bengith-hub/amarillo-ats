// Amarillo ATS — Dashboard logic (v2 — actionnable)

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

  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const missions = Store.get('missions');
  const candidats = Store.get('candidats');
  const actions = Store.get('actions');
  const entreprises = Store.get('entreprises');

  renderKPIs();
  renderUrgentBlock();
  renderTodoActions();
  renderRelances();
  renderPipelineCandidats();
  renderPipelineMissions();
  renderRecentActivity();

  // ========== KPIs ==========
  function renderKPIs() {
    const activeMissions = missions.filter(m =>
      m.statut && !['Clôturée', 'Annulée'].includes(m.statut)
    );
    const activeStatuses = ['Approché', 'En qualification', 'Shortlisté', 'Présenté'];
    const activeCandidats = candidats.filter(c => activeStatuses.includes(c.statut));
    const pendingActions = actions.filter(a => a.statut === 'À faire' || a.statut === 'A faire');
    const overdueActions = pendingActions.filter(a => a.date_action && a.date_action < today);
    const totalFees = activeMissions.reduce((sum, m) => sum + (m.fee_estimee || 0), 0);
    const doneThisWeek = actions.filter(a => a.statut === 'Fait' && a.date_action >= weekAgo);

    document.getElementById('kpi-missions').textContent = activeMissions.length;
    document.getElementById('kpi-candidats').textContent = activeCandidats.length;
    document.getElementById('kpi-actions').innerHTML = pendingActions.length +
      (overdueActions.length > 0 ? ` <span style="font-size:0.75rem;color:#dc2626;font-weight:600;">(${overdueActions.length} en retard)</span>` : '');
    document.getElementById('kpi-fees').textContent = UI.formatCurrency(totalFees);

    // Sub info
    const kpiSub = document.getElementById('kpi-actions-sub');
    if (kpiSub) kpiSub.textContent = `${doneThisWeek.length} faites cette semaine`;
  }

  // ========== Bloc Urgent (overdue + relances dépassées) ==========
  function renderUrgentBlock() {
    const container = document.getElementById('dashboard-urgent');
    if (!container) return;

    const overdue = actions.filter(a =>
      (a.statut === 'À faire' || a.statut === 'A faire') && a.date_action && a.date_action < today
    );
    const overdueRelances = actions.filter(a =>
      a.date_relance && a.date_relance <= today && a.statut !== 'Fait' && a.statut !== 'Annulé'
    );
    const urgentItems = [...new Map([...overdue, ...overdueRelances].map(a => [a.id, a])).values()];

    if (urgentItems.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:#16a34a;font-weight:600;">✓ Rien d\'urgent — tout est à jour !</div>';
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${urgentItems.slice(0, 8).map(a => {
          const candidatName = a.candidat_id ? (Store.resolve('candidats', a.candidat_id)?.displayName || '') : '';
          const decideurName = a.decideur_id ? (Store.resolve('decideurs', a.decideur_id)?.displayName || '') : '';
          const who = candidatName || decideurName;
          const isRelance = a.date_relance && a.date_relance <= today;
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;cursor:pointer;"
              onclick="window.location.href='actions.html'">
              <span style="font-size:1.1rem;">${isRelance ? '🔔' : '⚠️'}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.8125rem;font-weight:600;color:#dc2626;">${UI.escHtml(a.action || '')}</div>
                <div style="font-size:0.75rem;color:#64748b;">${who ? who + ' · ' : ''}${UI.badge(a.canal || '')} · ${isRelance ? 'Relance prévue ' : ''}${UI.formatDate(isRelance ? a.date_relance : a.date_action)}</div>
              </div>
              ${a.next_step ? `<div style="font-size:0.75rem;color:#c9a000;max-width:200px;text-align:right;">→ ${UI.escHtml(a.next_step)}</div>` : ''}
            </div>
          `;
        }).join('')}
        ${urgentItems.length > 8 ? `<div style="text-align:center;font-size:0.75rem;color:#dc2626;">+ ${urgentItems.length - 8} autres actions urgentes</div>` : ''}
      </div>
    `;
  }

  // ========== Actions à faire ==========
  function renderTodoActions() {
    const pending = actions
      .filter(a => (a.statut === 'À faire' || a.statut === 'A faire') && (!a.date_action || a.date_action >= today))
      .sort((a, b) => (a.date_action || 'zzz').localeCompare(b.date_action || 'zzz'));

    UI.dataTable('dashboard-actions', {
      columns: [
        { key: 'priorite', label: '', render: r => {
          if (r.priorite === 'Haute') return '🔴';
          if (r.priorite === 'Moyenne') return '🟡';
          return '';
        }},
        { key: 'action', label: 'Action', render: r => `<strong>${UI.escHtml(r.action || '')}</strong>` },
        { key: 'canal', label: 'Canal', render: r => UI.badge(r.canal) },
        { key: 'candidat', label: 'Contact', render: r => {
          if (r.candidat_id) return UI.resolveLink('candidats', r.candidat_id);
          if (r.decideur_id) return UI.resolveLink('decideurs', r.decideur_id);
          return '—';
        }},
        { key: 'date_action', label: 'Date', render: r => UI.formatDate(r.date_action) },
        { key: 'next_step', label: 'Next step', render: r => r.next_step ? `<span style="font-size:0.75rem;color:#c9a000;">→ ${UI.escHtml(r.next_step)}</span>` : '' },
      ],
      data: pending.slice(0, 10),
      onRowClick: () => window.location.href = 'actions.html',
      emptyMessage: 'Aucune action en attente — bravo !'
    });
  }

  // ========== Relances à venir ==========
  function renderRelances() {
    const container = document.getElementById('dashboard-relances');
    if (!container) return;

    const upcoming = actions
      .filter(a => a.date_relance && a.date_relance > today && a.date_relance <= weekFromNow && a.statut !== 'Fait' && a.statut !== 'Annulé')
      .sort((a, b) => (a.date_relance || '').localeCompare(b.date_relance || ''));

    if (upcoming.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Aucune relance prévue cette semaine</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${upcoming.slice(0, 8).map(a => {
          const who = a.candidat_id ? (Store.resolve('candidats', a.candidat_id)?.displayName || '') :
                      a.decideur_id ? (Store.resolve('decideurs', a.decideur_id)?.displayName || '') : '';
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;">
              <span style="font-size:0.75rem;font-weight:600;color:#c9a000;min-width:70px;">${UI.formatDate(a.date_relance)}</span>
              <div style="flex:1;font-size:0.8125rem;">
                <strong>${UI.escHtml(a.action || '')}</strong>
                ${who ? `<span style="color:#64748b;"> · ${who}</span>` : ''}
              </div>
              ${UI.badge(a.canal || '')}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ========== Pipeline candidats par statut ==========
  function renderPipelineCandidats() {
    const container = document.getElementById('dashboard-pipeline-candidats');
    if (!container) return;

    const stages = ['Approché', 'En qualification', 'Shortlisté', 'Présenté'];
    const stageCounts = stages.map(s => ({
      label: s,
      count: candidats.filter(c => c.statut === s).length,
      items: candidats.filter(c => c.statut === s).slice(0, 5)
    }));

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(${stages.length},1fr);gap:12px;">
        ${stageCounts.map(s => `
          <div style="text-align:center;">
            <div style="font-size:1.5rem;font-weight:700;color:#1e293b;">${s.count}</div>
            <div style="font-size:0.75rem;color:#64748b;margin-bottom:8px;">${s.label}</div>
            ${s.items.map(c => `
              <a href="candidat.html?id=${c.id}" style="display:block;font-size:0.75rem;color:#2563eb;text-decoration:none;padding:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${UI.escHtml((c.prenom || '') + ' ' + (c.nom || ''))}
              </a>
            `).join('')}
            ${s.count > 5 ? `<div style="font-size:0.6875rem;color:#94a3b8;">+ ${s.count - 5} autres</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // ========== Pipeline Missions (kanban) ==========
  function renderPipelineMissions() {
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

  // ========== Activité récente ==========
  function renderRecentActivity() {
    const recent = [...actions]
      .filter(a => a.statut === 'Fait')
      .sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''))
      .slice(0, 8);

    UI.timeline('dashboard-recent', recent);
  }
})();
