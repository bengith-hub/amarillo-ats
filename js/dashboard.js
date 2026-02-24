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

  // Robust status check — handles 'À faire', 'A faire', 'à faire', missing/null/empty
  function isPending(statut) {
    if (!statut) return true; // no status = pending by default
    const s = statut.normalize('NFC').toLowerCase().trim();
    return s === 'à faire' || s === 'a faire';
  }
  function isDone(statut) {
    if (!statut) return false;
    const s = statut.normalize('NFC').toLowerCase().trim();
    return s === 'fait';
  }
  function isCancelled(statut) {
    if (!statut) return false;
    const s = statut.normalize('NFC').toLowerCase().trim();
    return s === 'annulé' || s === 'annule';
  }
  function isActive(statut) {
    return !isDone(statut) && !isCancelled(statut);
  }

  function isProspectionAction(a) {
    return a.decideur_id
        && (a.type_action === 'Prospection'
         || a.type_action === 'Prise de contact'
         || a.type_action === 'Relance décideur');
  }

  renderKPIs();
  renderTeaserAlert();
  renderTeaserKPIs();
  renderProspection();
  renderUrgentBlock();
  renderNextSteps();
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
    const pendingActions = actions.filter(a => isPending(a.statut));
    const overdueActions = pendingActions.filter(a => a.date_action && a.date_action < today);
    const totalFees = activeMissions.reduce((sum, m) => sum + (m.fee_estimee || 0), 0);
    const doneThisWeek = actions.filter(a => isDone(a.statut) && a.date_action >= weekAgo);

    document.getElementById('kpi-missions').textContent = activeMissions.length;
    document.getElementById('kpi-candidats').textContent = activeCandidats.length;
    document.getElementById('kpi-actions').innerHTML = pendingActions.length +
      (overdueActions.length > 0 ? ` <span style="font-size:0.75rem;color:#dc2626;font-weight:600;">(${overdueActions.length} en retard)</span>` : '');
    document.getElementById('kpi-fees').textContent = UI.formatCurrency(totalFees);

    // Sub info
    const kpiSub = document.getElementById('kpi-actions-sub');
    if (kpiSub) kpiSub.textContent = `${doneThisWeek.length} faites cette semaine`;
  }

  // ========== Teaser Alert Banner ==========
  function renderTeaserAlert() {
    // Collect all teaser presentations across all candidats with due relances
    const allTeasers = [];
    candidats.forEach(c => {
      (c.presentations || []).forEach(p => {
        if (p.type === 'teaser') allTeasers.push({ ...p, candidat_id: c.id });
      });
    });

    const dueRelances = allTeasers.filter(t =>
      t.relance_prevue && t.relance_prevue <= today && t.email_status === 'sent' && t.relance_auto
    );

    const alertContainer = document.getElementById('dashboard-teaser-alert');
    if (!alertContainer) {
      // Create alert container above the urgent block
      const urgentEl = document.getElementById('dashboard-urgent');
      if (!urgentEl) return;
      const div = document.createElement('div');
      div.id = 'dashboard-teaser-alert';
      urgentEl.parentNode.insertBefore(div, urgentEl);
    }

    const el = document.getElementById('dashboard-teaser-alert');
    if (!el) return;

    if (dueRelances.length === 0) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <div style="background:#FFFDF0;border:1px solid #FEE566;border-radius:12px;padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.25rem;">✈️</span>
          <div>
            <div style="font-size:0.875rem;font-weight:700;color:#92780c;">${dueRelances.length} relance${dueRelances.length > 1 ? 's' : ''} teaser en attente</div>
            <div style="font-size:0.75rem;color:#b8960a;">Des profils envoyés en teaser n'ont pas reçu de réponse et la date de relance est dépassée.</div>
          </div>
        </div>
        <a href="actions.html" class="btn btn-sm" style="background:#1e293b;color:#FECC02;border:none;font-size:0.75rem;">Voir les relances</a>
      </div>
    `;
  }

  // ========== Teaser KPIs ==========
  function renderTeaserKPIs() {
    const kpiContainer = document.getElementById('dashboard-teaser-kpis');
    if (!kpiContainer) return;

    const allTeasers = [];
    candidats.forEach(c => {
      (c.presentations || []).forEach(p => {
        if (p.type === 'teaser') allTeasers.push(p);
      });
    });

    if (allTeasers.length === 0) {
      kpiContainer.innerHTML = '';
      return;
    }

    const sent = allTeasers.filter(t => t.email_status === 'sent').length;
    const replied = allTeasers.filter(t => t.email_status === 'replied').length;
    const interested = allTeasers.filter(t => t.statut_retour === 'Intéressé' || t.statut_retour === 'Entretien planifié').length;
    const noReply = allTeasers.filter(t => t.email_status === 'no-reply').length;
    const total = allTeasers.length;
    const taux = total > 0 ? Math.round((replied + interested) / total * 100) : 0;

    kpiContainer.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:100px;background:#f8fafc;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:0.6875rem;color:#64748b;text-transform:uppercase;font-weight:600;">Envoyés</div>
          <div style="font-size:1.25rem;font-weight:700;color:#1e293b;">${total}</div>
        </div>
        <div style="flex:1;min-width:100px;background:#eff6ff;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:0.6875rem;color:#3b82f6;text-transform:uppercase;font-weight:600;">En attente</div>
          <div style="font-size:1.25rem;font-weight:700;color:#3b82f6;">${sent}</div>
        </div>
        <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:0.6875rem;color:#16a34a;text-transform:uppercase;font-weight:600;">Répondus</div>
          <div style="font-size:1.25rem;font-weight:700;color:#16a34a;">${replied + interested}</div>
        </div>
        <div style="flex:1;min-width:100px;background:#FFFDF0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:0.6875rem;color:#c9a000;text-transform:uppercase;font-weight:600;">Taux réponse</div>
          <div style="font-size:1.25rem;font-weight:700;color:#c9a000;">${taux}%</div>
        </div>
      </div>
    `;
  }

  // ========== Prospection KPIs ==========
  function renderProspection() {
    const kpiContainer = document.getElementById('dashboard-prospection-kpis');
    if (!kpiContainer) return;

    const prospectionActions = actions.filter(isProspectionAction);

    const todayPending = prospectionActions.filter(a =>
      isPending(a.statut) && a.date_action && a.date_action <= today
    ).length;

    const doneThisWeek = prospectionActions.filter(a =>
      isDone(a.statut) && a.date_action && a.date_action >= weekAgo
    ).length;

    const totalDone = prospectionActions.filter(a => isDone(a.statut)).length;
    const withResponse = prospectionActions.filter(a => isDone(a.statut) && a.reponse).length;
    const tauxReponse = totalDone > 0 ? Math.round(withResponse / totalDone * 100) : 0;

    const totalPending = prospectionActions.filter(a => isPending(a.statut)).length;

    kpiContainer.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:100px;background:#faf5ff;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:0.6875rem;color:#7c3aed;text-transform:uppercase;font-weight:600;">Appels aujourd'hui</div>
          <div style="font-size:1.25rem;font-weight:700;color:#7c3aed;">${todayPending}</div>
        </div>
        <div style="flex:1;min-width:100px;background:#f5f3ff;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:0.6875rem;color:#8b5cf6;text-transform:uppercase;font-weight:600;">Faits cette semaine</div>
          <div style="font-size:1.25rem;font-weight:700;color:#8b5cf6;">${doneThisWeek}</div>
        </div>
        <div style="flex:1;min-width:100px;background:#ede9fe;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:0.6875rem;color:#6d28d9;text-transform:uppercase;font-weight:600;">Taux réponse</div>
          <div style="font-size:1.25rem;font-weight:700;color:#6d28d9;">${tauxReponse}%</div>
        </div>
        <div style="flex:1;min-width:100px;background:#f3e8ff;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:0.6875rem;color:#9333ea;text-transform:uppercase;font-weight:600;">En attente</div>
          <div style="font-size:1.25rem;font-weight:700;color:#9333ea;">${totalPending}</div>
        </div>
      </div>
    `;
  }

  // ========== Bloc Urgent (overdue + relances dépassées) ==========
  function renderUrgentBlock() {
    const container = document.getElementById('dashboard-urgent');
    if (!container) return;

    const overdue = actions.filter(a =>
      isPending(a.statut) && a.date_action && a.date_action < today
    );
    const overdueRelances = actions.filter(a =>
      a.date_relance && a.date_relance <= today && isActive(a.statut)
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

  // ========== Prochaines étapes orphelines ==========
  function renderNextSteps() {
    const card = document.getElementById('card-next-steps');
    const container = document.getElementById('dashboard-next-steps');
    if (!container || !card) return;

    // Find "Fait" actions with a next_step that don't have a follow-up action created
    const doneWithNext = actions.filter(a => isDone(a.statut) && a.next_step);

    // Check if a follow-up already exists (action whose message_notes contains "Suite de")
    // and whose action name matches the next_step
    const pendingActions = actions.filter(a => isActive(a.statut));
    const orphans = doneWithNext.filter(a => {
      const ns = a.next_step.toLowerCase().trim();
      return !pendingActions.some(p =>
        (p.action || '').toLowerCase().trim() === ns
      );
    }).sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''));

    if (orphans.length === 0) {
      card.style.display = 'none';
      return;
    }

    card.style.display = '';
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${orphans.slice(0, 8).map(a => {
          const who = a.candidat_id ? (Store.resolve('candidats', a.candidat_id)?.displayName || '') :
                      a.decideur_id ? (Store.resolve('decideurs', a.decideur_id)?.displayName || '') : '';
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
              <span style="font-size:1rem;">📌</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.8125rem;font-weight:600;color:#92400e;">→ ${UI.escHtml(a.next_step)}</div>
                <div style="font-size:0.75rem;color:#64748b;">Suite de : ${UI.escHtml(a.action || '')}${who ? ' · ' + who : ''} · ${UI.formatDate(a.date_action)}</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;">
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); window.__createFollowUp && window.__createFollowUp('${a.id}')" style="white-space:nowrap;font-size:0.75rem;">
                  Créer l'action
                </button>
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); window.__dismissNextStep && window.__dismissNextStep('${a.id}')" style="white-space:nowrap;font-size:0.75rem;color:#94a3b8;" title="Ignorer cette prochaine étape">
                  Ignorer
                </button>
              </div>
            </div>
          `;
        }).join('')}
        ${orphans.length > 8 ? `<div style="text-align:center;font-size:0.75rem;color:#92400e;">+ ${orphans.length - 8} autres prochaines étapes</div>` : ''}
      </div>
    `;
  }

  // Global handler for creating follow-up from dashboard
  window.__createFollowUp = async (actionId) => {
    const action = Store.findById('actions', actionId);
    if (!action || !action.next_step) return;
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
    };
    await Store.add('actions', followUp);
    UI.toast(`Action créée : ${followUp.action}`);
    location.reload();
  };

  // Global handler for dismissing an orphan next step
  window.__dismissNextStep = async (actionId) => {
    const action = Store.findById('actions', actionId);
    if (!action) return;
    await Store.update('actions', actionId, { next_step: '' });
    UI.toast('Prochaine étape ignorée');
    location.reload();
  };

  // ========== Actions à faire ==========
  function renderTodoActions() {
    const pending = actions
      .filter(a => isPending(a.statut))
      .sort((a, b) => {
        // Today first, then future, then past (most recent past first)
        const aDate = a.date_action || '';
        const bDate = b.date_action || '';
        const aIsToday = aDate === today ? 0 : (aDate >= today ? 1 : 2);
        const bIsToday = bDate === today ? 0 : (bDate >= today ? 1 : 2);
        if (aIsToday !== bIsToday) return aIsToday - bIsToday;
        // Within same group, closest date first
        if (aIsToday <= 1) return (aDate || 'zzz').localeCompare(bDate || 'zzz');
        return bDate.localeCompare(aDate); // past: most recent first
      });

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
      .filter(a => a.date_relance && a.date_relance >= today && a.date_relance <= weekFromNow && isActive(a.statut))
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
      .filter(a => isDone(a.statut))
      .sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''))
      .slice(0, 8);

    UI.timeline('dashboard-recent', recent);
  }
})();
