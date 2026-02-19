// Amarillo ATS — Candidats list logic

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }

  await Store.loadAll();
  UI.initGlobalSearch();

  const allCandidats = Store.get('candidats');
  let tableInstance = null;

  // Advanced filters
  const FILTER_DEFINITIONS = [
    { key: 'statut', label: 'Statut', options: () => Referentiels.get('candidat_statuts') },
    { key: 'niveau', label: 'Niveau', options: () => Referentiels.get('candidat_niveaux') },
    { key: 'localisation', label: 'Localisation', options: () => [...new Set(allCandidats.map(c => c.localisation).filter(Boolean))].sort() },
    { key: 'diplome', label: 'Diplôme', options: () => Referentiels.get('candidat_diplomes') },
    { key: 'origine', label: 'Origine', options: () => Referentiels.get('candidat_sources') },
    { key: 'open_to_work', label: 'Open to work', options: () => ['Oui', 'Non'] },
    { key: 'ambassadeur', label: 'Ambassadeur', options: () => ['Oui', 'Neutre', 'Non'] },
    { key: 'entreprise', label: 'Entreprise', options: () => [...new Set(allCandidats.map(c => {
      if (c.entreprise_actuelle_id) { const e = Store.resolve('entreprises', c.entreprise_actuelle_id); return e ? e.displayName : null; }
      return c.entreprise_nom || c.entreprise_actuelle || null;
    }).filter(Boolean))].sort() },
    { key: 'poste_actuel', label: 'Poste actuel', options: () => [...new Set(allCandidats.map(c => c.poste_actuel).filter(Boolean))].sort() },
    { key: 'poste_cible', label: 'Poste cible', options: () => [...new Set(allCandidats.map(c => c.poste_cible).filter(Boolean))].sort() },
  ];

  const activeFilters = []; // { key, mode: 'include'|'exclude', values: [] }
  let searchValue = '';

  function applyFilters() {
    let filtered = allCandidats;

    if (searchValue) {
      const q = searchValue.toLowerCase();
      filtered = filtered.filter(c => {
        const name = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase();
        return name.includes(q) ||
          (c.poste_actuel || '').toLowerCase().includes(q) ||
          (c.poste_cible || '').toLowerCase().includes(q) ||
          (c.localisation || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.telephone || '').toLowerCase().includes(q);
      });
    }

    for (const af of activeFilters) {
      if (af.values.length === 0) continue;
      const match = (c) => {
        let val;
        if (af.key === 'open_to_work') {
          val = c.open_to_work === true ? 'Oui' : 'Non';
        } else if (af.key === 'ambassadeur') {
          val = c.ambassadeur === true || c.ambassadeur === 'Oui' ? 'Oui' : c.ambassadeur === 'Neutre' ? 'Neutre' : 'Non';
        } else if (af.key === 'entreprise') {
          if (c.entreprise_actuelle_id) { const e = Store.resolve('entreprises', c.entreprise_actuelle_id); val = e ? e.displayName : ''; }
          else val = c.entreprise_nom || c.entreprise_actuelle || '';
        } else {
          val = c[af.key] || '';
        }
        return af.values.includes(val);
      };
      if (af.mode === 'include') filtered = filtered.filter(match);
      else filtered = filtered.filter(c => !match(c));
    }

    filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    renderTable(filtered);
  }

  function renderAdvancedFilters() {
    const container = document.getElementById('candidats-filters');
    if (!container) return;

    const usedKeys = activeFilters.map(f => f.key);
    const availableFilters = FILTER_DEFINITIONS.filter(d => !usedKeys.includes(d.key));

    container.innerHTML = `
      <div class="filters-bar" style="flex-direction:column;align-items:stretch;gap:12px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="text" class="filter-search" placeholder="Rechercher un candidat..." value="${UI.escHtml(searchValue)}" />
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
  allCandidats.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  renderTable(allCandidats);

  function renderTable(data) {
    UI.dataTable('candidats-table', {
      columns: [
        {
          key: 'nom',
          label: 'Nom',
          render: r => `<strong>${UI.escHtml((r.prenom || '') + ' ' + (r.nom || ''))}</strong>`
        },
        { key: 'poste_actuel', label: 'Poste actuel' },
        {
          key: 'entreprise',
          label: 'Entreprise',
          render: r => {
            if (!r.entreprise_actuelle_id) return r.entreprise_nom || r.entreprise_actuelle || '—';
            return UI.resolveLink('entreprises', r.entreprise_actuelle_id);
          }
        },
        { key: 'statut', label: 'Statut', render: r => UI.badge(r.statut) },
        { key: 'niveau', label: 'Niveau', render: r => UI.badge(r.niveau) },
        { key: 'localisation', label: 'Localisation' },
        {
          key: 'package',
          label: 'Package actuel (K€)',
          render: r => {
            const pkg = (r.salaire_fixe_actuel || 0) + (r.variable_actuel || 0);
            return pkg > 0 ? `${pkg} K€` : '—';
          }
        },
        {
          key: 'derniere_action',
          label: 'Dernière action',
          render: r => {
            const actions = Store.filter('actions', a => a.candidat_id === r.id);
            if (actions.length === 0) return '—';
            const sorted = actions.sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''));
            return UI.formatDate(sorted[0].date_action);
          }
        }
      ],
      data: data,
      onRowClick: (id) => {
        window.location.href = `candidat.html?id=${id}`;
      },
      emptyMessage: 'Aucun candidat trouvé',
      storageKey: 'candidats'
    });
  }

  // New candidat button
  document.getElementById('btn-new-candidat').addEventListener('click', () => {
    showCandidatModal();
  });

  // Fichier CV stocké temporairement pendant la création
  let _pendingCVFile = null;

  function showCandidatModal(existing = null) {
    const isEdit = !!existing;
    const c = existing || {};
    const entreprises = Store.get('entreprises');
    _pendingCVFile = null;

    const bodyHtml = `
      ${!isEdit ? `
      <div id="cv-import-section" style="margin-bottom:20px;padding:16px;background:#f0f9ff;border:2px dashed #3b82f6;border-radius:10px;text-align:center;">
        <input type="file" id="cv-file-input" accept=".pdf,.txt,.text,.md" style="display:none;" />
        <div id="cv-import-idle">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
            <svg style="width:22px;height:22px;color:#3b82f6;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            <button type="button" class="btn btn-primary" id="btn-import-cv" style="font-size:0.875rem;">Importer un CV</button>
            <button type="button" class="btn btn-secondary" id="btn-config-openai" style="font-size:0.75rem;" title="Configurer la clé API OpenAI">Clé OpenAI</button>
            <button type="button" class="btn btn-secondary" id="btn-config-gdrive" style="font-size:0.75rem;" title="Configurer Google Drive">Drive</button>
          </div>
          <p style="margin:8px 0 0;font-size:0.75rem;color:#64748b;">PDF ou fichier texte — glissez-déposez ou cliquez pour importer</p>
        </div>
        <div id="cv-import-loading" style="display:none;">
          <div style="display:inline-flex;align-items:center;gap:10px;color:#3b82f6;font-weight:500;">
            <span style="width:20px;height:20px;border:3px solid #bfdbfe;border-top-color:#3b82f6;border-radius:50%;animation:cv-spin 0.8s linear infinite;display:inline-block;"></span>
            Analyse du CV en cours...
          </div>
        </div>
        <div id="cv-import-result" style="display:none;font-weight:500;"></div>
      </div>
      <style>@keyframes cv-spin{to{transform:rotate(360deg)}}</style>
      ` : ''}
      <div class="form-row">
        <div class="form-group">
          <label>Prénom</label>
          <input type="text" id="f-prenom" value="${UI.escHtml(c.prenom || '')}" />
        </div>
        <div class="form-group">
          <label>Nom</label>
          <input type="text" id="f-nom" value="${UI.escHtml(c.nom || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Poste actuel</label>
          <input type="text" id="f-poste-actuel" value="${UI.escHtml(c.poste_actuel || '')}" />
        </div>
        <div class="form-group">
          <label>Poste cible</label>
          <input type="text" id="f-poste-cible" value="${UI.escHtml(c.poste_cible || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Entreprise actuelle</label>
          <input type="text" id="f-entreprise-search" value="${c.entreprise_actuelle_id ? (Store.resolve('entreprises', c.entreprise_actuelle_id)?.displayName || '') : ''}" placeholder="Tapez pour rechercher..." />
          <input type="hidden" id="f-entreprise" value="${c.entreprise_actuelle_id || ''}" />
        </div>
        <div class="form-group">
          <label>Niveau</label>
          <select id="f-niveau">
            <option value="">—</option>
            ${Referentiels.get('candidat_niveaux').map(s=>`<option value="${s}" ${c.niveau===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="f-statut">
            ${Referentiels.get('candidat_statuts').map(s=>`<option value="${s}" ${c.statut===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Localisation</label>
          <input type="text" id="f-localisation" value="${UI.escHtml(c.localisation || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de naissance</label>
          <input type="date" id="f-date-naissance" value="${c.date_naissance || ''}" />
        </div>
        <div class="form-group">
          <label>Open to work</label>
          <select id="f-open-to-work">
            <option value="" ${c.open_to_work === null || c.open_to_work === undefined || c.open_to_work === '' ? 'selected' : ''}>—</option>
            <option value="false" ${c.open_to_work === false ? 'selected' : ''}>Non</option>
            <option value="true" ${c.open_to_work === true ? 'selected' : ''}>Oui</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="f-email" value="${UI.escHtml(c.email || '')}" />
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" id="f-telephone" value="${UI.escHtml(c.telephone || '')}" />
        </div>
      </div>
      <div class="form-group">
        <label>Adresse postale</label>
        <input type="text" id="f-adresse-ligne1" value="${UI.escHtml(c.adresse_ligne1 || '')}" placeholder="Numéro et nom de rue" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Code postal</label>
          <input type="text" id="f-code-postal" value="${UI.escHtml(c.code_postal || '')}" />
        </div>
        <div class="form-group">
          <label>Ville</label>
          <input type="text" id="f-ville" value="${UI.escHtml(c.ville || '')}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>LinkedIn</label>
          <input type="url" id="f-linkedin" value="${UI.escHtml(c.linkedin || '')}" />
        </div>
        <div class="form-group">
          <label>Code Profiling Amarillo™</label>
          <input type="text" id="f-profile-code" value="${UI.escHtml(c.profile_code || '')}" placeholder="AMA-XXXX" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Salaire fixe actuel (K€)</label>
          <input type="number" id="f-salaire-fixe" value="${c.salaire_fixe_actuel || ''}" />
        </div>
        <div class="form-group">
          <label>Variable actuel (K€)</label>
          <input type="number" id="f-variable" value="${c.variable_actuel || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Package souhaité min (K€)</label>
          <input type="number" id="f-package-souhaite-min" value="${c.package_souhaite_min || ''}" placeholder="Fourchette basse" />
        </div>
        <div class="form-group">
          <label>Package souhaité (K€)</label>
          <input type="number" id="f-package-souhaite" value="${c.package_souhaite || ''}" placeholder="Souhaité" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Préavis</label>
          <input type="text" id="f-preavis" value="${UI.escHtml(c.preavis || '')}" />
        </div>
        <div class="form-group">
          <label>Diplôme</label>
          <select id="f-diplome">
            <option value="">—</option>
            ${Referentiels.get('candidat_diplomes').map(s=>`<option value="${s}" ${c.diplome===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label id="label-debut-poste">${c.open_to_work ? 'Début de recherche d\'emploi' : 'Prise de poste actuel'}</label>
          <input type="month" id="f-debut-poste" value="${(c.debut_poste_actuel || '').substring(0, 7)}" />
        </div>
        <div class="form-group">
          <label>Début de carrière</label>
          <input type="month" id="f-debut-carriere" value="${(c.debut_carriere || '').substring(0, 7)}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Origine</label>
          <select id="f-origine">
            <option value="">—</option>
            ${Referentiels.get('candidat_sources').map(s=>`<option value="${s}" ${c.origine===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Recommandé par</label>
          <input type="text" id="f-recommande-par" value="${UI.escHtml(c.recommande_par || '')}" placeholder="Tapez pour rechercher un candidat..." />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de disponibilité</label>
          <input type="date" id="f-date-disponibilite" value="${c.date_disponibilite || ''}" />
        </div>
        <div class="form-group">
          <label>Ambassadeur</label>
          <select id="f-ambassadeur">
            <option value="" ${!c.ambassadeur ? 'selected' : ''}>—</option>
            <option value="Non" ${c.ambassadeur === 'Non' || c.ambassadeur === false ? 'selected' : ''}>Non</option>
            <option value="Neutre" ${c.ambassadeur === 'Neutre' ? 'selected' : ''}>Neutre</option>
            <option value="Oui" ${c.ambassadeur === 'Oui' || c.ambassadeur === true ? 'selected' : ''}>Oui</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Télétravail</label>
          <input type="text" id="f-teletravail" value="${UI.escHtml(c.teletravail || '')}" placeholder="Ex: 2j/semaine" />
        </div>
        <div class="form-group">
          <label>RTT</label>
          <select id="f-rtt">
            <option value="" ${c.rtt === null || c.rtt === undefined || c.rtt === '' ? 'selected' : ''}>—</option>
            <option value="false" ${c.rtt === false ? 'selected' : ''}>Non</option>
            <option value="true" ${c.rtt === true ? 'selected' : ''}>Oui</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="f-notes">${UI.escHtml(c.notes || '')}</textarea>
      </div>
    `;

    UI.modal(isEdit ? 'Modifier le candidat' : 'Nouveau candidat', bodyHtml, {
      width: 600,
      draftKey: isEdit ? 'candidat_edit_' + c.id : 'candidat_new',
      onSave: async (overlay) => {
        const data = {
          prenom: overlay.querySelector('#f-prenom').value.trim(),
          nom: overlay.querySelector('#f-nom').value.trim(),
          poste_actuel: overlay.querySelector('#f-poste-actuel').value.trim(),
          poste_cible: overlay.querySelector('#f-poste-cible').value.trim(),
          entreprise_actuelle_id: overlay.querySelector('#f-entreprise').value || null,
          niveau: overlay.querySelector('#f-niveau').value,
          statut: overlay.querySelector('#f-statut').value,
          localisation: overlay.querySelector('#f-localisation').value.trim(),
          date_naissance: overlay.querySelector('#f-date-naissance').value || '',
          open_to_work: overlay.querySelector('#f-open-to-work').value === '' ? null : overlay.querySelector('#f-open-to-work').value === 'true',
          email: overlay.querySelector('#f-email').value.trim(),
          telephone: overlay.querySelector('#f-telephone').value.trim(),
          adresse_ligne1: overlay.querySelector('#f-adresse-ligne1').value.trim(),
          code_postal: overlay.querySelector('#f-code-postal').value.trim(),
          ville: overlay.querySelector('#f-ville').value.trim(),
          linkedin: overlay.querySelector('#f-linkedin').value.trim(),
          profile_code: overlay.querySelector('#f-profile-code').value.trim(),
          salaire_fixe_actuel: parseInt(overlay.querySelector('#f-salaire-fixe').value) || 0,
          variable_actuel: parseInt(overlay.querySelector('#f-variable').value) || 0,
          package_souhaite_min: parseInt(overlay.querySelector('#f-package-souhaite-min').value) || 0,
          package_souhaite: parseInt(overlay.querySelector('#f-package-souhaite').value) || 0,
          preavis: overlay.querySelector('#f-preavis').value.trim(),
          diplome: overlay.querySelector('#f-diplome').value,
          origine: overlay.querySelector('#f-origine').value,
          recommande_par: overlay.querySelector('#f-recommande-par').value.trim(),
          date_disponibilite: overlay.querySelector('#f-date-disponibilite').value || '',
          ambassadeur: overlay.querySelector('#f-ambassadeur').value || null,
          teletravail: overlay.querySelector('#f-teletravail').value.trim(),
          rtt: overlay.querySelector('#f-rtt').value === '' ? null : overlay.querySelector('#f-rtt').value === 'true',
          notes: overlay.querySelector('#f-notes').value.trim(),
          debut_poste_actuel: overlay.querySelector('#f-debut-poste').value || '',
          debut_carriere: overlay.querySelector('#f-debut-carriere').value || '',
        };

        if (!data.nom) {
          UI.toast('Le nom est obligatoire', 'error');
          throw new Error('validation');
        }

        if (isEdit) {
          await Store.update('candidats', c.id, data);
          UI.toast('Candidat mis à jour');
        } else {
          data.id = API.generateId('cand');
          data.profile_code = data.profile_code || '';
          data.missions_ids = [];
          data.decideur_connu_ids = [];
          data.candidats_lies_ids = [];
          data.manager_id = null;
          data.n2_id = null;
          data.motivation_changement = '';
          data.fit_poste = '';
          data.fit_culture = '';
          data.risques = '';
          data.synthese_30s = '';
          data.parcours_cible = '';
          data.package_attentes = '';
          data.motivation_drivers = '';
          data.lecture_recruteur = '';
          data.nb_rtt = 0;
          data.documents = [];
          data.google_drive_url = '';
          data.created_at = new Date().toISOString();
          await Store.add('candidats', data);
          UI.toast('Candidat créé');

          // --- Google Drive : créer dossier + uploader CV ---
          if (_pendingCVFile && GoogleDrive.isConfigured()) {
            try {
              UI.toast('Upload du CV sur Google Drive...', 'info');
              const candidatName = `${data.prenom} ${data.nom}`.trim();
              const driveResult = await GoogleDrive.createCandidatFolderAndUploadCV(candidatName, _pendingCVFile);

              await Store.update('candidats', data.id, {
                google_drive_url: driveResult.folderUrl,
                documents: [driveResult.document]
              });

              UI.toast('Dossier Drive créé et CV uploadé');
            } catch (driveErr) {
              console.error('Erreur Google Drive:', driveErr);
              UI.toast('Candidat créé, mais erreur Drive : ' + driveErr.message, 'error');
            }
            _pendingCVFile = null;
          }
        }

        location.reload();
      }
    });

    // Init autocomplete after modal renders
    UI.entrepriseAutocomplete('f-entreprise-search', 'f-entreprise');
    UI.localisationAutocomplete('f-localisation');
    UI.candidatAutocomplete('f-recommande-par');

    // Toggle date label based on "open to work"
    const otwSelect = document.getElementById('f-open-to-work');
    if (otwSelect) {
      otwSelect.addEventListener('change', () => {
        const label = document.getElementById('label-debut-poste');
        if (label) label.textContent = otwSelect.value === 'true' ? 'Début de recherche d\'emploi' : 'Prise de poste actuel';
      });
    }

    // --- CV Import logic ---
    if (!isEdit) {
      const btnImport = document.getElementById('btn-import-cv');
      const btnConfig = document.getElementById('btn-config-openai');
      const fileInput = document.getElementById('cv-file-input');
      const idleDiv = document.getElementById('cv-import-idle');
      const loadingDiv = document.getElementById('cv-import-loading');
      const resultDiv = document.getElementById('cv-import-result');

      const dropZone = document.getElementById('cv-import-section');

      if (btnImport && fileInput) {
        btnImport.addEventListener('click', () => {
          if (!CVParser.getOpenAIKey()) {
            CVParser.showKeyConfigModal(() => {
              UI.toast('Clé enregistrée. Vous pouvez maintenant importer un CV.');
            });
            return;
          }
          fileInput.click();
        });

        // --- Drag & Drop sur la zone CV ---
        if (dropZone) {
          dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.background = '#dbeafe';
            dropZone.style.borderColor = '#2563eb';
          });

          dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.background = '#dbeafe';
            dropZone.style.borderColor = '#2563eb';
          });

          dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.background = '#f0f9ff';
            dropZone.style.borderColor = '#3b82f6';
          });

          dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.background = '#f0f9ff';
            dropZone.style.borderColor = '#3b82f6';

            const file = e.dataTransfer.files[0];
            if (!file) return;

            const ext = file.name.split('.').pop().toLowerCase();
            if (!['pdf', 'txt', 'text', 'md'].includes(ext)) {
              UI.toast('Format non supporté. Utilisez un fichier PDF, TXT ou MD.', 'error');
              return;
            }

            if (!CVParser.getOpenAIKey()) {
              CVParser.showKeyConfigModal(() => {
                UI.toast('Clé enregistrée. Glissez à nouveau votre CV.');
              });
              return;
            }

            // Simuler la sélection de fichier via le file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
          });
        }

        btnConfig.addEventListener('click', () => {
          CVParser.showKeyConfigModal();
        });

        const btnDrive = document.getElementById('btn-config-gdrive');
        if (btnDrive) {
          btnDrive.addEventListener('click', () => {
            GoogleDrive.showConfigModal();
          });
        }

        fileInput.addEventListener('change', async () => {
          const file = fileInput.files[0];
          if (!file) return;

          // Stocker le fichier pour l'upload Drive après création
          _pendingCVFile = file;

          idleDiv.style.display = 'none';
          loadingDiv.style.display = 'block';
          resultDiv.style.display = 'none';

          try {
            const extracted = await CVParser.parseCV(file);
            fillFormFromCV(extracted);

            const filledCount = Object.values(extracted).filter(v => v && v !== '').length;
            const driveReady = GoogleDrive.isConfigured();
            resultDiv.style.color = '#059669';
            resultDiv.innerHTML = `
              <svg style="width:18px;height:18px;vertical-align:middle;margin-right:6px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              ${filledCount} champs pré-remplis depuis <strong>${UI.escHtml(file.name)}</strong>
              ${driveReady ? '<br><small style="color:#3b82f6;">Le CV sera uploadé sur Google Drive à l\'enregistrement</small>' : '<br><small style="color:#94a3b8;">Configurez Google Drive pour uploader le CV automatiquement</small>'}
            `;
            resultDiv.style.display = 'block';
            loadingDiv.style.display = 'none';

            UI.toast(`CV importé : ${filledCount} champs remplis`, 'success');
          } catch (err) {
            resultDiv.style.color = '#dc2626';
            resultDiv.textContent = err.message;
            resultDiv.style.display = 'block';
            loadingDiv.style.display = 'none';
            idleDiv.style.display = 'block';
            UI.toast(err.message, 'error');
            _pendingCVFile = null;
          }

          // Reset file input pour permettre de re-sélectionner le même fichier
          fileInput.value = '';
        });
      }
    }

    function fillFormFromCV(data) {
      const overlay = document.getElementById('modal-overlay');
      if (!overlay) return;

      const fieldMap = {
        prenom: 'f-prenom',
        nom: 'f-nom',
        email: 'f-email',
        telephone: 'f-telephone',
        linkedin: 'f-linkedin',
        adresse_ligne1: 'f-adresse-ligne1',
        code_postal: 'f-code-postal',
        ville: 'f-ville',
        localisation: 'f-localisation',
        poste_actuel: 'f-poste-actuel',
        date_naissance: 'f-date-naissance',
        debut_carriere: 'f-debut-carriere',
        debut_poste_actuel: 'f-debut-poste',
        notes: 'f-notes'
      };

      for (const [key, inputId] of Object.entries(fieldMap)) {
        if (data[key]) {
          const el = overlay.querySelector('#' + inputId);
          if (el) el.value = data[key];
        }
      }

      // Entreprise : remplir le champ texte de recherche (pas l'ID)
      if (data.entreprise_nom) {
        const searchEl = overlay.querySelector('#f-entreprise-search');
        if (searchEl) searchEl.value = data.entreprise_nom;
      }

      // Diplôme : sélectionner l'option correspondante
      if (data.diplome) {
        const diplomeSelect = overlay.querySelector('#f-diplome');
        if (diplomeSelect) {
          const option = Array.from(diplomeSelect.options).find(o => o.value === data.diplome);
          if (option) diplomeSelect.value = data.diplome;
        }
      }

      // Synthèse 30s et notes : concaténer si notes contient déjà quelque chose
      if (data.synthese_30s) {
        const notesEl = overlay.querySelector('#f-notes');
        if (notesEl) {
          const existingNotes = notesEl.value.trim();
          const prefix = data.synthese_30s;
          const skills = data.notes || '';
          const parts = [prefix, skills, existingNotes].filter(Boolean);
          notesEl.value = parts.join('\n\n');
        }
      }
    }
  }

  // Expose for edit from detail page
  window.showCandidatModal = showCandidatModal;
})();
