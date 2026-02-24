// Amarillo ATS — Entreprises logic

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }
  await Store.loadAll();
  UI.initGlobalSearch();

  const allEntreprises = Store.get('entreprises');
  let tableInstance = null;

  // Advanced filters
  const FILTER_DEFINITIONS = [
    { key: 'secteur', label: 'Secteur', options: () => Referentiels.get('entreprise_secteurs') },
    { key: 'taille', label: 'Taille', options: () => Referentiels.get('entreprise_tailles') },
    { key: 'priorite', label: 'Priorité', options: () => Referentiels.get('entreprise_priorites') },
    { key: 'statut', label: 'Statut', options: () => Referentiels.get('entreprise_statuts') },
    { key: 'localisation', label: 'Localisation', options: () => [...new Set(allEntreprises.map(e => e.localisation).filter(Boolean))].sort() },
    { key: 'ca', label: 'CA', options: () => [...new Set(allEntreprises.map(e => e.ca).filter(Boolean))].sort() },
  ];

  const activeFilters = []; // { key, mode: 'include'|'exclude', values: [] }
  let searchValue = '';

  function applyFilters() {
    let filtered = allEntreprises;

    if (searchValue) {
      const q = searchValue.toLowerCase();
      filtered = filtered.filter(e => {
        return (e.nom || '').toLowerCase().includes(q) ||
          (e.localisation || '').toLowerCase().includes(q) ||
          (e.secteur || '').toLowerCase().includes(q) ||
          (e.site_web || '').toLowerCase().includes(q) ||
          (e.telephone || '').toLowerCase().includes(q);
      });
    }

    for (const af of activeFilters) {
      if (af.values.length === 0) continue;
      const match = (e) => {
        const val = e[af.key] || '';
        return af.values.includes(val);
      };
      if (af.mode === 'include') filtered = filtered.filter(match);
      else filtered = filtered.filter(e => !match(e));
    }

    filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    renderTable(filtered);
    const isFiltered = searchValue || activeFilters.some(f => f.values.length > 0);
    UI.rowCount('entreprises-count', { filtered: filtered.length, total: allEntreprises.length, label: 'entreprises', isFiltered });
  }

  function renderAdvancedFilters() {
    const container = document.getElementById('entreprises-filters');
    if (!container) return;

    const usedKeys = activeFilters.map(f => f.key);
    const availableFilters = FILTER_DEFINITIONS.filter(d => !usedKeys.includes(d.key));

    container.innerHTML = `
      <div class="filters-bar" style="flex-direction:column;align-items:stretch;gap:12px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="text" class="filter-search" placeholder="Rechercher une entreprise..." value="${UI.escHtml(searchValue)}" />
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

  // Row count container
  const countEl = document.createElement('div');
  countEl.id = 'entreprises-count';
  countEl.className = 'row-count-bar';
  document.getElementById('entreprises-filters').after(countEl);

  // Sort by creation date (most recent first)
  allEntreprises.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  renderTable(allEntreprises);
  UI.rowCount('entreprises-count', { filtered: allEntreprises.length, total: allEntreprises.length, label: 'entreprises', isFiltered: false });

  function renderTable(data) {
    UI.dataTable('entreprises-table', {
      columns: [
        { key: 'nom', label: 'Entreprise', render: r => `<strong>${UI.escHtml(r.nom || '')}</strong>` },
        { key: 'secteur', label: 'Secteur' },
        { key: 'taille', label: 'Taille' },
        { key: 'ca', label: 'CA' },
        { key: 'localisation', label: 'Localisation' },
        { key: 'groupe', label: 'Groupe', render: r => {
          const parent = (r.entreprises_liees || []).find(l => l.type_relation === 'Société mère');
          if (parent) { const p = Store.findById('entreprises', parent.entreprise_id); return p ? UI.escHtml(p.nom) : ''; }
          return '';
        }},
        { key: 'priorite', label: 'Priorité', render: r => UI.badge(r.priorite === '5 - Coeur de cible' ? 'Haute' : 'Moyenne') },
        { key: 'statut', label: 'Statut' },
        { key: 'decideurs', label: 'Décideurs', render: r => {
          const decs = Store.filter('decideurs', d => d.entreprise_id === r.id);
          return decs.length;
        }},
        { key: 'dernier_contact', label: 'Dernier contact', render: r => UI.formatDate(r.dernier_contact) }
      ],
      data: data,
      onRowClick: (id) => window.location.href = `entreprise.html?id=${id}`,
      emptyMessage: 'Aucune entreprise',
      storageKey: 'entreprises'
    });
  }

  document.getElementById('btn-new-entreprise').addEventListener('click', () => showEntrepriseModal());

  function showEntrepriseModal(existing = null) {
    const isEdit = !!existing;
    const e = existing || {};

    const bodyHtml = `
      <div class="form-group"><label>Nom</label><input type="text" id="e-nom" value="${UI.escHtml(e.nom||'')}" /></div>
      <div class="form-row">
        <div class="form-group"><label>Secteur</label>
          <select id="e-secteur"><option value="">—</option>${Referentiels.get('entreprise_secteurs').map(s=>`<option value="${s}" ${e.secteur===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Taille</label>
          <select id="e-taille"><option value="">—</option>${Referentiels.get('entreprise_tailles').map(s=>`<option value="${s}" ${e.taille===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>CA</label>
          <select id="e-ca"><option value="">—</option>${['< 5 M€','5-20 M€','20-50 M€','50-100 M€','100-250 M€','250 M€+'].map(s=>`<option value="${s}" ${e.ca===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Localisation</label><input type="text" id="e-loc" value="${UI.escHtml(e.localisation||'')}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Priorité</label>
          <select id="e-prio"><option value="">—</option>${Referentiels.get('entreprise_priorites').map(s=>`<option value="${s}" ${e.priorite===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Statut</label>
          <select id="e-statut">${Referentiels.get('entreprise_statuts').map(s=>`<option value="${s}" ${e.statut===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-group"><label>Site web</label><input type="url" id="e-site" value="${UI.escHtml(e.site_web||'')}" /></div>
      <div class="form-group"><label>Téléphone</label><input type="tel" id="e-tel" value="${UI.escHtml(e.telephone||'')}" /></div>
      <div class="form-group"><label>Adresse siège social</label><textarea id="e-siege-adresse" placeholder="Rue, bâtiment...">${UI.escHtml(e.siege_adresse||'')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Code postal</label><input type="text" id="e-siege-cp" value="${UI.escHtml(e.siege_code_postal||'')}" /></div>
        <div class="form-group"><label>Ville</label><input type="text" id="e-siege-ville" value="${UI.escHtml(e.siege_ville||'')}" /></div>
      </div>
      <div class="form-group"><label>Angle d'approche</label><textarea id="e-angle">${UI.escHtml(e.angle_approche||'')}</textarea></div>
      <div class="form-group"><label>Notes</label><textarea id="e-notes">${UI.escHtml(e.notes||'')}</textarea></div>
    `;

    UI.modal(isEdit ? 'Modifier l\'entreprise' : 'Nouvelle entreprise', bodyHtml, {
      width: 560,
      onSave: async (overlay) => {
        const data = {
          nom: overlay.querySelector('#e-nom').value.trim(),
          secteur: overlay.querySelector('#e-secteur').value,
          taille: overlay.querySelector('#e-taille').value,
          ca: overlay.querySelector('#e-ca').value,
          localisation: overlay.querySelector('#e-loc').value.trim(),
          priorite: overlay.querySelector('#e-prio').value,
          statut: overlay.querySelector('#e-statut').value,
          site_web: overlay.querySelector('#e-site').value.trim(),
          telephone: overlay.querySelector('#e-tel').value.trim(),
          siege_adresse: overlay.querySelector('#e-siege-adresse').value.trim(),
          siege_code_postal: overlay.querySelector('#e-siege-cp').value.trim(),
          siege_ville: overlay.querySelector('#e-siege-ville').value.trim(),
          angle_approche: overlay.querySelector('#e-angle').value.trim(),
          notes: overlay.querySelector('#e-notes').value.trim(),
        };
        if (isEdit) {
          await Store.update('entreprises', e.id, data);
          UI.toast('Entreprise mise à jour');
        } else {
          data.id = API.generateId('ent');
          data.source = '';
          data.autres_sites = [];
          data.dernier_contact = null;
          data.prochaine_relance = null;
          data.created_at = new Date().toISOString();
          await Store.add('entreprises', data);
          UI.toast('Entreprise créée');
        }
        location.reload();
      }
    });
    UI.localisationAutocomplete('e-loc');
    UI.addressAutocomplete('e-siege-ville', 'e-siege-cp');
  }
})();
