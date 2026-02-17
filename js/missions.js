// Amarillo ATS — Missions logic

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }

  await Store.loadAll();
  UI.initGlobalSearch();

  const allMissions = Store.get('missions');
  let viewMode = 'table';

  const STAGES = [
    'Ciblage décideurs', 'Cadrage', 'Proposition',
    'Mission lancée', 'Shortlist', 'Entretiens client',
    'Offre', 'Placé', 'Suivi intégration', 'Clôturée'
  ];

  // View toggle
  document.getElementById('btn-view-table').addEventListener('click', () => {
    viewMode = 'table';
    document.getElementById('missions-kanban').style.display = 'none';
    document.getElementById('missions-table-card').style.display = 'block';
    renderTable(allMissions);
  });

  document.getElementById('btn-view-kanban').addEventListener('click', () => {
    viewMode = 'kanban';
    document.getElementById('missions-table-card').style.display = 'none';
    document.getElementById('missions-kanban').style.display = 'block';
    renderKanban(allMissions);
  });

  // Filters
  UI.filterBar('missions-filters', {
    searchPlaceholder: 'Rechercher une mission...',
    filters: [
      { key: 'statut', label: 'Tous les statuts', options: STAGES },
      { key: 'niveau', label: 'Tous les niveaux', options: ['Middle', 'Top'] }
    ],
    onFilter: ({ search, filters }) => {
      let filtered = allMissions;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(m => (m.nom || '').toLowerCase().includes(q) || (m.ref || '').toLowerCase().includes(q));
      }
      if (filters.statut) filtered = filtered.filter(m => m.statut === filters.statut);
      if (filters.niveau) filtered = filtered.filter(m => m.niveau === filters.niveau);
      if (viewMode === 'table') renderTable(filtered);
      else renderKanban(filtered);
    }
  });

  renderTable(allMissions);

  function renderTable(data) {
    UI.dataTable('missions-table', {
      columns: [
        { key: 'ref', label: 'Réf' },
        { key: 'nom', label: 'Mission', render: r => `<strong>${UI.escHtml(r.nom || '')}</strong>` },
        { key: 'statut', label: 'Statut', render: r => UI.badge(r.statut) },
        { key: 'niveau', label: 'Niveau', render: r => UI.badge(r.niveau) },
        { key: 'candidats', label: 'Candidats', render: r => (r.candidats_ids || []).length },
        { key: 'fee_estimee', label: 'Fee estimée', render: r => UI.formatCurrency(r.fee_estimee) },
        { key: 'probabilite', label: 'Proba', render: r => r.probabilite ? r.probabilite + '%' : '—' },
        { key: 'exclusivite', label: 'Exclusivité', render: r => {
          if (!r.date_demarrage || !r.duree_exclusivite_sem) return '—';
          const start = new Date(r.date_demarrage);
          const end = new Date(start.getTime() + r.duree_exclusivite_sem * 7 * 24*60*60*1000);
          const now = new Date();
          if (now < start) return '<span style="color:#94a3b8;">Non démarrée</span>';
          if (now > end) return '<span style="color:#dc2626;">Expirée</span>';
          return '<span style="color:#16a34a;">Active</span>';
        }},
        { key: 'date_demarrage', label: 'Démarrage', render: r => UI.formatDate(r.date_demarrage) }
      ],
      data: data,
      onRowClick: (id) => window.location.href = `mission.html?id=${id}`,
      emptyMessage: 'Aucune mission'
    });
  }

  function renderKanban(data) {
    const container = document.getElementById('missions-kanban');
    container.innerHTML = `
      <div class="kanban">
        ${STAGES.map(stage => {
          const items = data.filter(m => m.statut === stage);
          return `
            <div class="kanban-column">
              <div class="kanban-column-header">
                ${stage}
                <span class="kanban-column-count">${items.length}</span>
              </div>
              ${items.map(m => `
                <a href="mission.html?id=${m.id}" class="kanban-card" style="display:block;text-decoration:none;color:inherit;">
                  <div class="kanban-card-title">${UI.escHtml(m.nom || m.ref || '')}</div>
                  <div class="kanban-card-sub" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
                    ${UI.badge(m.niveau)}
                    <span style="font-size:0.75rem;">${(m.candidats_ids||[]).length} candidat(s)</span>
                  </div>
                  ${m.fee_estimee ? `<div style="font-size:0.8125rem;font-weight:600;margin-top:4px;">${UI.formatCurrency(m.fee_estimee)}</div>` : ''}
                </a>
              `).join('') || '<div style="font-size:0.75rem;color:#94a3b8;padding:8px;">Aucune mission</div>'}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // New mission
  document.getElementById('btn-new-mission').addEventListener('click', () => showMissionModal());

  function showMissionModal(existing = null) {
    const isEdit = !!existing;
    const m = existing || {};
    const decideurs = Store.get('decideurs');

    const bodyHtml = `
      <div class="form-row">
        <div class="form-group"><label>Nom de la mission</label><input type="text" id="m-nom" value="${UI.escHtml(m.nom||'')}" /></div>
        <div class="form-group"><label>Référence</label><input type="text" id="m-ref" value="${UI.escHtml(m.ref||'')}" placeholder="AS001" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Statut</label>
          <select id="m-statut">${STAGES.map(s=>`<option value="${s}" ${m.statut===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Niveau</label>
          <select id="m-niveau"><option value="Middle" ${m.niveau==='Middle'?'selected':''}>Middle</option><option value="Top" ${m.niveau==='Top'?'selected':''}>Top</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Taux honoraires (%)</label><input type="number" id="m-taux" value="${m.taux_honoraires||18}" /></div>
        <div class="form-group"><label>Fee estimée (€)</label><input type="number" id="m-fee" value="${m.fee_estimee||''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date démarrage</label><input type="date" id="m-date" value="${m.date_demarrage||''}" /></div>
        <div class="form-group"><label>Durée exclusivité (sem)</label><input type="number" id="m-exclu" value="${m.duree_exclusivite_sem||6}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Exclusivité</label>
          <select id="m-exclu-type"><option value="Formelle" ${m.exclusivite==='Formelle'?'selected':''}>Formelle</option><option value="De fait" ${m.exclusivite==='De fait'?'selected':''}>De fait</option></select>
        </div>
        <div class="form-group"><label>Garantie</label>
          <select id="m-garantie"><option value="3 mois" ${m.garantie==='3 mois'?'selected':''}>3 mois</option><option value="6 mois" ${m.garantie==='6 mois'?'selected':''}>6 mois</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Probabilité (%)</label><input type="number" id="m-proba" value="${m.probabilite||''}" min="0" max="100" /></div>
        <div class="form-group"><label>Priorité</label>
          <select id="m-priorite"><option value="Haute" ${m.priorite==='Haute'?'selected':''}>Haute</option><option value="Moyenne" ${m.priorite==='Moyenne'?'selected':''}>Moyenne</option><option value="Basse" ${m.priorite==='Basse'?'selected':''}>Basse</option></select>
        </div>
      </div>
      <div class="form-group"><label>Notes</label><textarea id="m-notes">${UI.escHtml(m.notes||'')}</textarea></div>
    `;

    UI.modal(isEdit ? 'Modifier la mission' : 'Nouvelle mission', bodyHtml, {
      width: 600,
      onSave: async (overlay) => {
        const data = {
          nom: overlay.querySelector('#m-nom').value.trim(),
          ref: overlay.querySelector('#m-ref').value.trim(),
          statut: overlay.querySelector('#m-statut').value,
          niveau: overlay.querySelector('#m-niveau').value,
          taux_honoraires: parseFloat(overlay.querySelector('#m-taux').value) || 18,
          fee_estimee: parseFloat(overlay.querySelector('#m-fee').value) || 0,
          date_demarrage: overlay.querySelector('#m-date').value || null,
          duree_exclusivite_sem: parseInt(overlay.querySelector('#m-exclu').value) || 6,
          exclusivite: overlay.querySelector('#m-exclu-type').value,
          garantie: overlay.querySelector('#m-garantie').value,
          probabilite: parseInt(overlay.querySelector('#m-proba').value) || 0,
          priorite: overlay.querySelector('#m-priorite').value,
          notes: overlay.querySelector('#m-notes').value.trim(),
        };

        if (isEdit) {
          await Store.update('missions', m.id, data);
          UI.toast('Mission mise à jour');
        } else {
          data.id = API.generateId('mis');
          data.candidats_ids = [];
          data.decideurs_ids = [];
          data.candidat_place_id = null;
          data.factures_ids = [];
          data.prochaine_relance = null;
          await Store.add('missions', data);
          UI.toast('Mission créée');
        }
        location.reload();
      }
    });
  }
})();
