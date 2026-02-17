// Amarillo ATS — Candidats list logic

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }

  await Store.loadAll();
  UI.initGlobalSearch();

  const allCandidats = Store.get('candidats');
  let tableInstance = null;

  // Filters
  UI.filterBar('candidats-filters', {
    searchPlaceholder: 'Rechercher un candidat...',
    filters: [
      {
        key: 'statut',
        label: 'Tous les statuts',
        options: Referentiels.get('candidat_statuts')
      },
      {
        key: 'niveau',
        label: 'Tous les niveaux',
        options: Referentiels.get('candidat_niveaux')
      },
      {
        key: 'localisation',
        label: 'Toutes localisations',
        options: [...new Set(allCandidats.map(c => c.localisation).filter(Boolean))].sort()
      }
    ],
    onFilter: ({ search, filters }) => {
      let filtered = allCandidats;

      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(c => {
          const name = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase();
          return name.includes(q) ||
            (c.poste_actuel || '').toLowerCase().includes(q) ||
            (c.poste_cible || '').toLowerCase().includes(q) ||
            (c.localisation || '').toLowerCase().includes(q);
        });
      }

      if (filters.statut) filtered = filtered.filter(c => c.statut === filters.statut);
      if (filters.niveau) filtered = filtered.filter(c => c.niveau === filters.niveau);
      if (filters.localisation) filtered = filtered.filter(c => c.localisation === filters.localisation);

      filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      renderTable(filtered);
    }
  });

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
      emptyMessage: 'Aucun candidat trouvé'
    });
  }

  // New candidat button
  document.getElementById('btn-new-candidat').addEventListener('click', () => {
    showCandidatModal();
  });

  function showCandidatModal(existing = null) {
    const isEdit = !!existing;
    const c = existing || {};
    const entreprises = Store.get('entreprises');

    const bodyHtml = `
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
          <label>Exposition au pouvoir</label>
          <input type="text" id="f-exposition-pouvoir" value="${UI.escHtml(c.exposition_pouvoir || '')}" />
        </div>
        <div class="form-group">
          <label>Ambassadeur</label>
          <select id="f-ambassadeur">
            <option value="" ${c.ambassadeur === null || c.ambassadeur === undefined || c.ambassadeur === '' ? 'selected' : ''}>—</option>
            <option value="false" ${c.ambassadeur === false ? 'selected' : ''}>Non</option>
            <option value="true" ${c.ambassadeur === true ? 'selected' : ''}>Oui</option>
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
          exposition_pouvoir: overlay.querySelector('#f-exposition-pouvoir').value.trim(),
          ambassadeur: overlay.querySelector('#f-ambassadeur').value === '' ? null : overlay.querySelector('#f-ambassadeur').value === 'true',
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
          data.created_at = new Date().toISOString();
          await Store.add('candidats', data);
          UI.toast('Candidat créé');
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
  }

  // Expose for edit from detail page
  window.showCandidatModal = showCandidatModal;
})();
