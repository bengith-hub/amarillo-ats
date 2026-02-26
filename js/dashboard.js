// Amarillo ATS — Dashboard logic (v3 — sections collapsibles)

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

  function isTeaserAction(a) {
    return a.type_action === 'Envoi teaser'
        || a.type_action === 'Retour teaser'
        || a.type_action === 'Relance teaser';
  }

  // ========== Collapsible sections management ==========
  const SECTION_STORAGE_KEY = 'ats_dashboard_sections';

  function getSectionStates() {
    try {
      return JSON.parse(localStorage.getItem(SECTION_STORAGE_KEY) || '{}');
    } catch (e) { return {}; }
  }

  function saveSectionState(sectionId, expanded) {
    const states = getSectionStates();
    states[sectionId] = expanded;
    localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(states));
  }

  window.toggleSection = function(sectionId) {
    const card = document.getElementById('section-' + sectionId);
    if (!card) return;
    const isExpanded = card.classList.toggle('expanded');
    saveSectionState(sectionId, isExpanded);
  };

  function restoreSectionStates() {
    const states = getSectionStates();
    Object.entries(states).forEach(([sectionId, expanded]) => {
      const card = document.getElementById('section-' + sectionId);
      if (card && expanded) card.classList.add('expanded');
    });
  }

  // Helper: resolve contact name
  function resolveWho(a) {
    if (a.candidat_id) return Store.resolve('candidats', a.candidat_id)?.displayName || '';
    if (a.decideur_id) return Store.resolve('decideurs', a.decideur_id)?.displayName || '';
    return '';
  }

  // Helper: get link URL for an action's related entity
  function actionHref(a) {
    if (a.candidat_id) return `candidat.html?id=${a.candidat_id}`;
    if (a.decideur_id) return `decideur.html?id=${a.decideur_id}`;
    if (a.mission_id) return `mission.html?id=${a.mission_id}`;
    return 'actions.html';
  }

  // Helper: render an action row for collapsible lists
  function renderActionRow(a, options = {}) {
    const who = resolveWho(a);
    const isOverdue = a.date_action && a.date_action < today;
    const isRelance = a.date_relance && a.date_relance <= today;
    const bgColor = options.bgColor || (isOverdue ? '#fff5f5' : '#f8fafc');
    const borderColor = options.borderColor || (isOverdue ? '#fecaca' : '#e2e8f0');
    const titleColor = isOverdue ? '#dc2626' : '#1e293b';

    const href = actionHref(a);

    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${bgColor};border:1px solid ${borderColor};border-radius:8px;cursor:pointer;"
        onclick="window.location.href='${href}'">
        <div style="flex-shrink:0;width:20px;text-align:center;">
          ${a.priorite === 'Haute' ? '🔴' : a.priorite === 'Moyenne' ? '🟡' : ''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.8125rem;font-weight:600;color:${titleColor};">${UI.escHtml(a.action || '')}</div>
          <div style="font-size:0.75rem;color:#64748b;">
            ${who ? who + ' · ' : ''}${UI.badge(a.canal || '')} · ${UI.formatDate(a.date_action)}
            ${isRelance ? ' · <span style="color:#dc2626;">Relance ' + UI.formatDate(a.date_relance) + '</span>' : ''}
          </div>
        </div>
        ${a.next_step ? `<div style="font-size:0.75rem;color:#c9a000;max-width:180px;text-align:right;flex-shrink:0;">→ ${UI.escHtml(a.next_step)}</div>` : ''}
        <button class="btn btn-sm" onclick="event.stopPropagation(); window.__markDone('${a.id}')"
          style="white-space:nowrap;font-size:0.6875rem;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;flex-shrink:0;">
          ✓ Fait
        </button>
      </div>
    `;
  }

  // ========== Render all sections ==========
  renderKPIs();
  renderUrgentBlock();
  renderProspectionSection();
  renderCandidatsSection();
  renderNextSteps();
  restoreSectionStates();

  // Signal Engine widget
  if (typeof SignalEngine !== 'undefined') {
    SignalEngine.renderDashboardWidget('dashboard-signaux');
  }

  // ========== KPIs ==========
  function renderKPIs() {
    const activeMissions = missions.filter(m =>
      m.statut && !['Clôturée', 'Annulée'].includes(m.statut)
    );
    const activeStatuses = ['Approché', 'En qualification', 'Shortlisté', 'Présenté'];
    const activeCandidats = candidats.filter(c => activeStatuses.includes(c.statut));
    const pendingActions = actions.filter(a => isPending(a.statut));
    const overdueActions = actions.filter(a => isActive(a.statut) && a.date_action && a.date_action < today);
    const totalFees = activeMissions.reduce((sum, m) => sum + (m.fee_estimee || 0), 0);
    const doneThisWeek = actions.filter(a => isDone(a.statut) && a.date_action >= weekAgo);

    document.getElementById('kpi-missions').textContent = activeMissions.length;
    document.getElementById('kpi-candidats').textContent = activeCandidats.length;
    document.getElementById('kpi-actions').innerHTML = pendingActions.length +
      (overdueActions.length > 0 ? ` <span style="font-size:0.75rem;color:#dc2626;font-weight:600;">(${overdueActions.length} en retard)</span>` : '');
    document.getElementById('kpi-fees').textContent = UI.formatCurrency(totalFees);

    const kpiSub = document.getElementById('kpi-actions-sub');
    if (kpiSub) kpiSub.textContent = `${doneThisWeek.length} faites cette semaine`;
  }

  // ========== Aujourd'hui & En retard ==========
  function renderUrgentBlock() {
    const container = document.getElementById('dashboard-urgent');
    if (!container) return;

    // All active actions due today or overdue
    const todayActions = actions.filter(a =>
      isActive(a.statut) && a.date_action && a.date_action === today
    );
    const overdue = actions.filter(a =>
      isActive(a.statut) && a.date_action && a.date_action < today
    );
    const overdueRelances = actions.filter(a =>
      a.date_relance && a.date_relance <= today && isActive(a.statut)
    );

    // Deduplicate
    const allUrgent = [...new Map(
      [...overdue, ...todayActions, ...overdueRelances].map(a => [a.id, a])
    ).values()];

    // Sort: overdue first (oldest first), then today
    allUrgent.sort((a, b) => {
      const aDate = a.date_action || '';
      const bDate = b.date_action || '';
      return aDate.localeCompare(bDate);
    });

    // Update count badge
    const countEl = document.getElementById('urgent-count');
    if (countEl) {
      countEl.textContent = allUrgent.length > 0
        ? `${allUrgent.length} action${allUrgent.length > 1 ? 's' : ''}`
        : '';
    }

    if (allUrgent.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:#16a34a;font-weight:600;">✓ Rien d\'urgent — tout est à jour !</div>';
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;max-height:600px;overflow-y:auto;">
        ${allUrgent.map(a => {
          const who = resolveWho(a);
          const isRelance = a.date_relance && a.date_relance <= today;
          const isOverdue = a.date_action && a.date_action < today;
          const bgColor = isOverdue ? '#fff5f5' : '#fffbeb';
          const borderColor = isOverdue ? '#fecaca' : '#fde68a';
          const href = actionHref(a);
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${bgColor};border:1px solid ${borderColor};border-radius:8px;cursor:pointer;"
              onclick="window.location.href='${href}'">
              <span style="font-size:1.1rem;">${isOverdue ? '⚠️' : isRelance ? '🔔' : '📅'}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.8125rem;font-weight:600;color:${isOverdue ? '#dc2626' : '#92400e'};">${UI.escHtml(a.action || '')}</div>
                <div style="font-size:0.75rem;color:#64748b;">
                  ${who ? who + ' · ' : ''}${UI.badge(a.canal || '')}
                  · ${UI.badge(a.statut || 'À faire')}
                  · ${isRelance ? 'Relance ' : ''}${UI.formatDate(isRelance ? a.date_relance : a.date_action)}
                </div>
              </div>
              ${a.next_step ? `<div style="font-size:0.75rem;color:#c9a000;max-width:200px;text-align:right;flex-shrink:0;">→ ${UI.escHtml(a.next_step)}</div>` : ''}
              <button class="btn btn-sm" onclick="event.stopPropagation(); window.__markDone('${a.id}')"
                style="white-space:nowrap;font-size:0.6875rem;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;flex-shrink:0;">
                ✓ Fait
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ========== Section collapsible : Prospection ==========
  function renderProspectionSection() {
    const summaryEl = document.getElementById('summary-prospection');
    const contentEl = document.getElementById('content-prospection');
    if (!contentEl) return;

    // Prospection actions (decideur-linked prospection types)
    const prospectionActions = actions.filter(isProspectionAction);
    const prospectionPending = prospectionActions.filter(a => isActive(a.statut));
    const prospectionOverdue = prospectionActions.filter(a => isActive(a.statut) && a.date_action && a.date_action < today);

    // Teaser data
    const allTeasers = [];
    candidats.forEach(c => {
      (c.presentations || []).forEach(p => {
        if (p.type === 'teaser') allTeasers.push({ ...p, candidat_id: c.id });
      });
    });
    const dueRelances = allTeasers.filter(t =>
      t.relance_prevue && t.relance_prevue <= today && t.email_status === 'sent' && t.relance_auto
    );

    // Teaser actions
    const teaserActions = actions.filter(a => isTeaserAction(a) && isActive(a.statut));

    const totalPending = prospectionPending.length + teaserActions.length;
    const totalOverdue = prospectionOverdue.length;

    // Summary badges
    if (summaryEl) {
      summaryEl.innerHTML = `
        ${totalPending > 0 ? `<span class="count-badge">${totalPending} à faire</span>` : ''}
        ${totalOverdue > 0 ? `<span class="count-badge overdue">${totalOverdue} en retard</span>` : ''}
        ${dueRelances.length > 0 ? `<span class="count-badge overdue">${dueRelances.length} relance${dueRelances.length > 1 ? 's' : ''} teaser</span>` : ''}
      `;
    }

    // Content
    let html = '';

    // Teaser alert banner (if relances due)
    if (dueRelances.length > 0) {
      html += `
        <div style="background:#FFFDF0;border:1px solid #FEE566;border-radius:12px;padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.25rem;">✈️</span>
            <div>
              <div style="font-size:0.875rem;font-weight:700;color:#92780c;">${dueRelances.length} relance${dueRelances.length > 1 ? 's' : ''} teaser en attente</div>
              <div style="font-size:0.75rem;color:#b8960a;">Des profils envoyés en teaser n'ont pas reçu de réponse et la date de relance est dépassée.</div>
            </div>
          </div>
          <a href="actions.html#teasers" class="btn btn-sm" style="background:#1e293b;color:#FECC02;border:none;font-size:0.75rem;">Voir les relances</a>
        </div>
      `;
    }

    // Prospection KPIs
    const todayPending = prospectionActions.filter(a =>
      isPending(a.statut) && a.date_action && a.date_action <= today
    ).length;
    const doneThisWeek = prospectionActions.filter(a =>
      isDone(a.statut) && a.date_action && a.date_action >= weekAgo
    ).length;
    const totalDone = prospectionActions.filter(a => isDone(a.statut)).length;
    const withResponse = prospectionActions.filter(a => isDone(a.statut) && a.reponse).length;
    const tauxReponse = totalDone > 0 ? Math.round(withResponse / totalDone * 100) : 0;

    html += `
      <div style="margin-bottom:16px;">
        <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:8px;">📞 Prospection</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:80px;background:#faf5ff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.625rem;color:#7c3aed;text-transform:uppercase;font-weight:600;">Aujourd'hui</div>
            <div style="font-size:1.125rem;font-weight:700;color:#7c3aed;">${todayPending}</div>
          </div>
          <div style="flex:1;min-width:80px;background:#f5f3ff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.625rem;color:#8b5cf6;text-transform:uppercase;font-weight:600;">Faits/sem.</div>
            <div style="font-size:1.125rem;font-weight:700;color:#8b5cf6;">${doneThisWeek}</div>
          </div>
          <div style="flex:1;min-width:80px;background:#ede9fe;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:0.625rem;color:#6d28d9;text-transform:uppercase;font-weight:600;">Taux rép.</div>
            <div style="font-size:1.125rem;font-weight:700;color:#6d28d9;">${tauxReponse}%</div>
          </div>
        </div>
      </div>
    `;

    // Teaser KPIs (if teasers exist)
    if (allTeasers.length > 0) {
      const sent = allTeasers.filter(t => t.email_status === 'sent').length;
      const replied = allTeasers.filter(t => t.email_status === 'replied').length;
      const interested = allTeasers.filter(t => t.statut_retour === 'Intéressé' || t.statut_retour === 'Entretien planifié').length;
      const total = allTeasers.length;
      const taux = total > 0 ? Math.round((replied + interested) / total * 100) : 0;

      html += `
        <div style="margin-bottom:16px;">
          <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:8px;">✈️ Teasers</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:80px;background:#f8fafc;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:0.625rem;color:#64748b;text-transform:uppercase;font-weight:600;">Envoyés</div>
              <div style="font-size:1.125rem;font-weight:700;color:#1e293b;">${total}</div>
            </div>
            <div style="flex:1;min-width:80px;background:#eff6ff;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:0.625rem;color:#3b82f6;text-transform:uppercase;font-weight:600;">En attente</div>
              <div style="font-size:1.125rem;font-weight:700;color:#3b82f6;">${sent}</div>
            </div>
            <div style="flex:1;min-width:80px;background:#f0fdf4;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:0.625rem;color:#16a34a;text-transform:uppercase;font-weight:600;">Répondus</div>
              <div style="font-size:1.125rem;font-weight:700;color:#16a34a;">${replied + interested}</div>
            </div>
            <div style="flex:1;min-width:80px;background:#FFFDF0;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:0.625rem;color:#c9a000;text-transform:uppercase;font-weight:600;">Taux rép.</div>
              <div style="font-size:1.125rem;font-weight:700;color:#c9a000;">${taux}%</div>
            </div>
          </div>
        </div>
      `;
    }

    // Action list: prospection + teaser actions that are active
    const allProspActions = [...new Map(
      [...prospectionPending, ...teaserActions].map(a => [a.id, a])
    ).values()]
      .sort((a, b) => {
        // Overdue first, then by date
        const aGroup = (a.date_action && a.date_action < today) ? 0 : 1;
        const bGroup = (b.date_action && b.date_action < today) ? 0 : 1;
        if (aGroup !== bGroup) return aGroup - bGroup;
        return (a.date_action || 'zzz').localeCompare(b.date_action || 'zzz');
      });

    if (allProspActions.length > 0) {
      html += `
        <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Actions à traiter</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${allProspActions.map(a => renderActionRow(a)).join('')}
        </div>
      `;
    } else {
      html += '<div style="text-align:center;padding:12px;color:#16a34a;font-size:0.8125rem;">✓ Aucune action de prospection en attente</div>';
    }

    contentEl.innerHTML = html;
  }

  // ========== Section collapsible : Candidats ==========
  function renderCandidatsSection() {
    const summaryEl = document.getElementById('summary-candidats');
    const contentEl = document.getElementById('content-candidats');
    if (!contentEl) return;

    // Candidate-related actions: have candidat_id and are active
    const candidatActions = actions.filter(a => a.candidat_id && isActive(a.statut))
      .sort((a, b) => {
        const aGroup = (a.date_action && a.date_action < today) ? 0 : 1;
        const bGroup = (b.date_action && b.date_action < today) ? 0 : 1;
        if (aGroup !== bGroup) return aGroup - bGroup;
        return (a.date_action || 'zzz').localeCompare(b.date_action || 'zzz');
      });
    const candidatOverdue = candidatActions.filter(a => a.date_action && a.date_action < today);

    // Summary badges
    if (summaryEl) {
      summaryEl.innerHTML = `
        ${candidatActions.length > 0 ? `<span class="count-badge">${candidatActions.length} action${candidatActions.length > 1 ? 's' : ''}</span>` : ''}
        ${candidatOverdue.length > 0 ? `<span class="count-badge overdue">${candidatOverdue.length} en retard</span>` : ''}
      `;
    }

    let html = '';

    // Action list
    if (candidatActions.length > 0) {
      html += `
        <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Actions candidats</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;">
          ${candidatActions.map(a => renderActionRow(a)).join('')}
        </div>
      `;
    } else {
      html += '<div style="text-align:center;padding:12px;color:#16a34a;font-size:0.8125rem;margin-bottom:16px;">✓ Aucune action candidat en attente</div>';
    }

    // Mini pipeline candidats
    const stages = ['Approché', 'En qualification', 'Shortlisté', 'Présenté'];
    const stageCounts = stages.map(s => ({
      label: s,
      count: candidats.filter(c => c.statut === s).length,
      items: candidats.filter(c => c.statut === s).slice(0, 3)
    }));

    const totalInPipeline = stageCounts.reduce((sum, s) => sum + s.count, 0);
    if (totalInPipeline > 0) {
      html += `
        <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Pipeline</div>
        <div style="display:grid;grid-template-columns:repeat(${stages.length},1fr);gap:12px;">
          ${stageCounts.map(s => `
            <div style="text-align:center;">
              <div style="font-size:1.25rem;font-weight:700;color:#1e293b;">${s.count}</div>
              <div style="font-size:0.6875rem;color:#64748b;margin-bottom:6px;">${s.label}</div>
              ${s.items.map(c => `
                <a href="candidat.html?id=${c.id}" style="display:block;font-size:0.6875rem;color:#2563eb;text-decoration:none;padding:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${UI.escHtml((c.prenom || '') + ' ' + (c.nom || ''))}
                </a>
              `).join('')}
              ${s.count > 3 ? `<div style="font-size:0.625rem;color:#94a3b8;">+ ${s.count - 3} autres</div>` : ''}
            </div>
          `).join('')}
        </div>
        <div style="text-align:right;margin-top:8px;">
          <a href="candidats.html" style="font-size:0.75rem;color:#2563eb;text-decoration:none;">Voir tous les candidats →</a>
        </div>
      `;
    }

    contentEl.innerHTML = html;
  }

  // ========== Section collapsible : Prochaines étapes ==========
  function renderNextSteps() {
    const summaryEl = document.getElementById('summary-next-steps');
    const container = document.getElementById('dashboard-next-steps');
    if (!container) return;

    // Find "Fait" actions with a next_step that don't have a follow-up action created
    const doneWithNext = actions.filter(a => isDone(a.statut) && a.next_step);
    const activeActions = actions.filter(a => isActive(a.statut));
    const orphans = doneWithNext.filter(a => {
      const ns = a.next_step.toLowerCase().trim();
      return !activeActions.some(p =>
        (p.action || '').toLowerCase().trim() === ns
      );
    }).sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''));

    // Summary badge
    if (summaryEl) {
      summaryEl.innerHTML = orphans.length > 0
        ? `<span class="count-badge">${orphans.length} à traiter</span>`
        : '';
    }

    if (orphans.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:12px;color:#16a34a;font-size:0.8125rem;">✓ Toutes les prochaines étapes sont traitées</div>';
      return;
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${orphans.map(a => {
          const who = resolveWho(a);
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
      </div>
    `;
  }

  // ========== Global handlers ==========

  // Mark action as done from dashboard
  window.__markDone = async (actionId) => {
    const action = Store.findById('actions', actionId);
    if (!action) return;
    await Store.update('actions', actionId, { statut: 'Fait' });
    if (action.next_step) {
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
      UI.toast(`Fait ! Action suivante créée : ${followUp.action}`);
    } else {
      UI.toast('Action marquée comme faite');
    }
    location.reload();
  };

  // Create follow-up from orphan next step
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

  // Dismiss orphan next step
  window.__dismissNextStep = async (actionId) => {
    const action = Store.findById('actions', actionId);
    if (!action) return;
    await Store.update('actions', actionId, { next_step: '' });
    UI.toast('Prochaine étape ignorée');
    location.reload();
  };
})();
