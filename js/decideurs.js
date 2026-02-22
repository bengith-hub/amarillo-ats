// Amarillo ATS — Décideurs logic

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }
  await Store.loadAll();
  UI.initGlobalSearch();

  const allDecideurs = Store.get('decideurs');
  let tableInstance = null;

  // Advanced filters
  const FILTER_DEFINITIONS = [
    { key: 'fonction_macro', label: 'Fonction macro', options: () => Referentiels.get('decideur_fonctions_macro') },
    { key: 'niveau_hierarchique', label: 'Niveau hiérarchique', options: () => Referentiels.get('decideur_niveaux_hierarchiques') },
    { key: 'niveau_relation', label: 'Niveau relation', options: () => Referentiels.get('decideur_niveaux_relation') },
    { key: 'priorite_prospection', label: 'Priorité prospection', options: () => Referentiels.get('decideur_priorites_prospection') },
    { key: 'role_decision', label: 'Rôle décision', options: () => Referentiels.get('decideur_roles_decision') },
    { key: 'entreprise', label: 'Entreprise', options: () => [...new Set(allDecideurs.map(d => {
      if (d.entreprise_id) { const e = Store.resolve('entreprises', d.entreprise_id); return e ? e.displayName : null; }
      return null;
    }).filter(Boolean))].sort() },
    { key: 'perimetre', label: 'Périmètre', options: () => [...new Set(allDecideurs.map(d => d.perimetre).filter(Boolean))].sort() },
    { key: 'localisation', label: 'Localisation', options: () => [...new Set(allDecideurs.map(d => d.localisation).filter(Boolean))].sort() },
  ];

  const activeFilters = []; // { key, mode: 'include'|'exclude', values: [] }
  let searchValue = '';

  function applyFilters() {
    let filtered = allDecideurs;

    if (searchValue) {
      const q = searchValue.toLowerCase();
      filtered = filtered.filter(d => {
        const name = `${d.prenom || ''} ${d.nom || ''}`.toLowerCase();
        return name.includes(q) ||
          (d.fonction || '').toLowerCase().includes(q) ||
          (d.email || '').toLowerCase().includes(q) ||
          (d.telephone || '').toLowerCase().includes(q);
      });
    }

    for (const af of activeFilters) {
      if (af.values.length === 0) continue;
      const match = (d) => {
        let val;
        if (af.key === 'entreprise') {
          if (d.entreprise_id) { const e = Store.resolve('entreprises', d.entreprise_id); val = e ? e.displayName : ''; }
          else val = '';
        } else {
          val = d[af.key] || '';
        }
        return af.values.includes(val);
      };
      if (af.mode === 'include') filtered = filtered.filter(match);
      else filtered = filtered.filter(d => !match(d));
    }

    filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    renderTable(filtered);
  }

  function renderAdvancedFilters() {
    const container = document.getElementById('decideurs-filters');
    if (!container) return;

    const usedKeys = activeFilters.map(f => f.key);
    const availableFilters = FILTER_DEFINITIONS.filter(d => !usedKeys.includes(d.key));

    container.innerHTML = `
      <div class="filters-bar" style="flex-direction:column;align-items:stretch;gap:12px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="text" class="filter-search" placeholder="Rechercher un décideur..." value="${UI.escHtml(searchValue)}" />
          ${availableFilters.length > 0 ? `
            <select class="filter-select" id="add-filter-select" style="color:#64748b;">
              <option value="">+ Ajouter un filtre</option>
              ${availableFilters.map(f => `<option value="${f.key}">${f.label}</option>`).join('')}
            </select>
          ` : ''}
        </div>
        ${activeFilters.length > 0 ? `
          <div id="active-filters-area" style="display:flex;flex-wrap:wrap;gap:8px;">
            ${activeFilters.map((af, idx) => {
              const def = FILTER_DEFINITIONS.find(d => d.key === af.key);
              const opts = def ? def.options() : [];
              return `
                <div class="adv-filter-chip" data-idx="${idx}" style="display:inline-flex;align-items:center;gap:4px;background:${af.mode === 'exclude' ? '#fef2f2' : '#f0f9ff'};border:1px solid ${af.mode === 'exclude' ? '#fca5a5' : '#bae6fd'};border-radius:8px;padding:4px 8px;font-size:0.8125rem;">
                  <button class="filter-mode-toggle" data-idx="${idx}" style="border:none;background:${af.mode === 'exclude' ? '#ef4444' : '#3b82f6'};color:#fff;border-radius:4px;padding:1px 6px;font-size:0.6875rem;cursor:pointer;font-weight:600;" title="Cliquer pour basculer inclure/exclure">
                    ${af.mode === 'include' ? 'INCL' : 'EXCL'}
                  </button>
                  <span style="font-weight:600;color:#334155;">${def ? def.label : af.key}:</span>
                  <select class="filter-value-select" data-idx="${idx}" multiple style="border:1px solid #e2e8f0;border-radius:4px;font-size:0.75rem;padding:2px 4px;min-width:120px;max-height:60px;">
                    ${opts.map(o => `<option value="${o}" ${af.values.includes(o) ? 'selected' : ''}>${o}</option>`).join('')}
                  </select>
                  <button class="filter-remove" data-idx="${idx}" style="border:none;background:none;cursor:pointer;color:#94a3b8;font-size:1rem;padding:0 2px;" title="Supprimer ce filtre">&times;</button>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Search
    container.querySelector('.filter-search').addEventListener('input', (e) => {
      searchValue = e.target.value;
      applyFilters();
    });

    // Add filter
    const addSel = container.querySelector('#add-filter-select');
    if (addSel) {
      addSel.addEventListener('change', (e) => {
        if (!e.target.value) return;
        activeFilters.push({ key: e.target.value, mode: 'include', values: [] });
        renderAdvancedFilters();
      });
    }

    // Toggle include/exclude
    container.querySelectorAll('.filter-mode-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        activeFilters[idx].mode = activeFilters[idx].mode === 'include' ? 'exclude' : 'include';
        renderAdvancedFilters();
        applyFilters();
      });
    });

    // Value selection
    container.querySelectorAll('.filter-value-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.idx);
        activeFilters[idx].values = Array.from(sel.selectedOptions).map(o => o.value);
        applyFilters();
      });
    });

    // Remove filter
    container.querySelectorAll('.filter-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        activeFilters.splice(idx, 1);
        renderAdvancedFilters();
        applyFilters();
      });
    });
  }

  renderAdvancedFilters();

  // Sort by creation date (most recent first)
  allDecideurs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  renderTable(allDecideurs);

  function renderTable(data) {
    UI.dataTable('decideurs-table', {
      columns: [
        { key: 'nom', label: 'Nom', render: r => `<strong>${UI.escHtml((r.prenom||'')+' '+(r.nom||''))}</strong>` },
        { key: 'entreprise', label: 'Entreprise', render: r => r.entreprise_id ? UI.resolveLink('entreprises', r.entreprise_id) : '—' },
        { key: 'fonction', label: 'Fonction' },
        { key: 'niveau_hierarchique', label: 'Niveau' },
        { key: 'role_decision', label: 'Rôle' },
        { key: 'priorite_prospection', label: 'Priorité', render: r => UI.badge(r.priorite_prospection) },
        { key: 'niveau_relation', label: 'Relation', render: r => UI.badge(r.niveau_relation) },
        { key: 'dernier_contact', label: 'Dernier contact', render: r => UI.formatDate(r.dernier_contact) },
      ],
      data: data,
      onRowClick: (id) => window.location.href = `decideur.html?id=${id}`,
      emptyMessage: 'Aucun décideur',
      storageKey: 'decideurs'
    });
  }

  document.getElementById('btn-new-decideur').addEventListener('click', () => showDecideurModal());

  function showDecideurModal(existing = null) {
    const isEdit = !!existing;
    const d = existing || {};
    const entreprises = Store.get('entreprises');

    const bodyHtml = `
      <div class="form-row">
        <div class="form-group"><label>Prénom</label><input type="text" id="d-prenom" value="${UI.escHtml(d.prenom||'')}" /></div>
        <div class="form-group"><label>Nom</label><input type="text" id="d-nom" value="${UI.escHtml(d.nom||'')}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Entreprise</label>
          <select id="d-entreprise"><option value="">—</option>${entreprises.map(e=>`<option value="${e.id}" ${d.entreprise_id===e.id?'selected':''}>${UI.escHtml(e.nom)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Fonction</label><input type="text" id="d-fonction" value="${UI.escHtml(d.fonction||'')}" placeholder="DG, DRH, HR Manager..." /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Fonction macro</label>
          <select id="d-macro"><option value="">—</option>${Referentiels.get('decideur_fonctions_macro').map(s=>`<option value="${s}" ${d.fonction_macro===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Niveau hiérarchique</label>
          <select id="d-niveau"><option value="">—</option>${Referentiels.get('decideur_niveaux_hierarchiques').map(s=>`<option value="${s}" ${d.niveau_hierarchique===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Rôle dans la décision</label>
          <select id="d-role"><option value="">—</option>${Referentiels.get('decideur_roles_decision').map(s=>`<option value="${s}" ${d.role_decision===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Priorité prospection</label>
          <select id="d-prio"><option value="">—</option>${Referentiels.get('decideur_priorites_prospection').map(s=>`<option value="${s}" ${d.priorite_prospection===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Niveau de relation</label>
          <select id="d-relation"><option value="">—</option>${Referentiels.get('decideur_niveaux_relation').map(s=>`<option value="${s}" ${d.niveau_relation===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Périmètre</label>
          <select id="d-perimetre"><option value="">—</option>${['France','Europe','International'].map(s=>`<option value="${s}" ${d.perimetre===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input type="email" id="d-email" value="${UI.escHtml(d.email||'')}" /></div>
        <div class="form-group"><label>Téléphone</label><input type="tel" id="d-tel" value="${UI.escHtml(d.telephone||'')}" /></div>
      </div>
      <div class="form-group"><label>LinkedIn</label><input type="url" id="d-linkedin" value="${UI.escHtml(d.linkedin||'')}" /></div>
      <div class="form-group"><label>Localisation</label><input type="text" id="d-loc" value="${UI.escHtml(d.localisation||'')}" /></div>
      <div class="form-group"><label>Notes relation</label><textarea id="d-notes">${UI.escHtml(d.notes_relation||'')}</textarea></div>
    `;

    UI.modal(isEdit ? 'Modifier le décideur' : 'Nouveau décideur', bodyHtml, {
      width: 600,
      onSave: async (overlay) => {
        const data = {
          prenom: overlay.querySelector('#d-prenom').value.trim(),
          nom: overlay.querySelector('#d-nom').value.trim(),
          entreprise_id: overlay.querySelector('#d-entreprise').value || null,
          fonction: overlay.querySelector('#d-fonction').value.trim(),
          fonction_macro: overlay.querySelector('#d-macro').value,
          niveau_hierarchique: overlay.querySelector('#d-niveau').value,
          role_decision: overlay.querySelector('#d-role').value,
          priorite_prospection: overlay.querySelector('#d-prio').value,
          niveau_relation: overlay.querySelector('#d-relation').value,
          perimetre: overlay.querySelector('#d-perimetre').value,
          email: overlay.querySelector('#d-email').value.trim(),
          telephone: overlay.querySelector('#d-tel').value.trim(),
          linkedin: overlay.querySelector('#d-linkedin').value.trim(),
          localisation: overlay.querySelector('#d-loc').value.trim(),
          notes_relation: overlay.querySelector('#d-notes').value.trim(),
        };
        if (isEdit) {
          await Store.update('decideurs', d.id, data);
          UI.toast('Décideur mis à jour');
        } else {
          data.id = API.generateId('dec');
          data.manager_direct_id = null;
          data.missions_ids = [];
          data.profil_candidat_id = null;
          data.dernier_contact = null;
          data.prochaine_relance = null;
          data.created_at = new Date().toISOString();
          if (!data.niveau_relation) data.niveau_relation = 'À contacter';
          await Store.add('decideurs', data);
          UI.toast('Décideur créé');
        }
        location.reload();
      }
    });
    UI.localisationAutocomplete('d-loc');
  }
})();
