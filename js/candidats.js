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
        options: ['To call', 'Approché', 'En qualification', 'Shortlisté', 'Présenté', 'Placé', 'Off market', 'Pas prioritaire']
      },
      {
        key: 'niveau',
        label: 'Tous les niveaux',
        options: ['Junior', 'Middle', 'Top']
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

      renderTable(filtered);
    }
  });

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
            if (!r.entreprise_actuelle_id) return r.entreprise_nom || '—';
            return UI.resolveLink('entreprises', r.entreprise_actuelle_id);
          }
        },
        { key: 'statut', label: 'Statut', render: r => UI.badge(r.statut) },
        { key: 'niveau', label: 'Niveau', render: r => UI.badge(r.niveau) },
        { key: 'localisation', label: 'Localisation' },
        {
          key: 'package',
          label: 'Package actuel',
          render: r => {
            const pkg = (r.salaire_fixe_actuel || 0) + (r.variable_actuel || 0);
            return pkg > 0 ? UI.formatCurrency(pkg) : '—';
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
            <option value="Junior" ${c.niveau === 'Junior' ? 'selected' : ''}>Junior</option>
            <option value="Middle" ${c.niveau === 'Middle' ? 'selected' : ''}>Middle</option>
            <option value="Top" ${c.niveau === 'Top' ? 'selected' : ''}>Top</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="f-statut">
            <option value="To call" ${c.statut === 'To call' ? 'selected' : ''}>To call</option>
            <option value="Approché" ${c.statut === 'Approché' ? 'selected' : ''}>Approché</option>
            <option value="En qualification" ${c.statut === 'En qualification' ? 'selected' : ''}>En qualification</option>
            <option value="Shortlisté" ${c.statut === 'Shortlisté' ? 'selected' : ''}>Shortlisté</option>
            <option value="Présenté" ${c.statut === 'Présenté' ? 'selected' : ''}>Présenté</option>
            <option value="Placé" ${c.statut === 'Placé' ? 'selected' : ''}>Placé</option>
            <option value="Off market" ${c.statut === 'Off market' ? 'selected' : ''}>Off market</option>
            <option value="Pas prioritaire" ${c.statut === 'Pas prioritaire' ? 'selected' : ''}>Pas prioritaire</option>
          </select>
        </div>
        <div class="form-group">
          <label>Localisation</label>
          <input type="text" id="f-localisation" value="${UI.escHtml(c.localisation || '')}" />
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
          <label>Salaire fixe actuel (€)</label>
          <input type="number" id="f-salaire-fixe" value="${c.salaire_fixe_actuel || ''}" />
        </div>
        <div class="form-group">
          <label>Variable actuel (€)</label>
          <input type="number" id="f-variable" value="${c.variable_actuel || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Salaire fixe souhaité (€)</label>
          <input type="number" id="f-salaire-souhaite" value="${c.salaire_fixe_souhaite || ''}" />
        </div>
        <div class="form-group">
          <label>Variable souhaité (€)</label>
          <input type="number" id="f-variable-souhaite" value="${c.variable_souhaite || ''}" />
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
            <option value="Bac+2 / Bac+3" ${c.diplome === 'Bac+2 / Bac+3' ? 'selected' : ''}>Bac+2 / Bac+3</option>
            <option value="Bac+4" ${c.diplome === 'Bac+4' ? 'selected' : ''}>Bac+4</option>
            <option value="Bac+5" ${c.diplome === 'Bac+5' ? 'selected' : ''}>Bac+5</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Origine</label>
        <select id="f-origine">
          <option value="">—</option>
          <option value="Approche directe" ${c.origine === 'Approche directe' ? 'selected' : ''}>Approche directe</option>
          <option value="Recommandation" ${c.origine === 'Recommandation' ? 'selected' : ''}>Recommandation</option>
          <option value="Candidature" ${c.origine === 'Candidature' ? 'selected' : ''}>Candidature</option>
        </select>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="f-notes">${UI.escHtml(c.notes || '')}</textarea>
      </div>
    `;

    UI.modal(isEdit ? 'Modifier le candidat' : 'Nouveau candidat', bodyHtml, {
      width: 600,
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
          email: overlay.querySelector('#f-email').value.trim(),
          telephone: overlay.querySelector('#f-telephone').value.trim(),
          linkedin: overlay.querySelector('#f-linkedin').value.trim(),
          profile_code: overlay.querySelector('#f-profile-code').value.trim(),
          salaire_fixe_actuel: parseInt(overlay.querySelector('#f-salaire-fixe').value) || 0,
          variable_actuel: parseInt(overlay.querySelector('#f-variable').value) || 0,
          salaire_fixe_souhaite: parseInt(overlay.querySelector('#f-salaire-souhaite').value) || 0,
          variable_souhaite: parseInt(overlay.querySelector('#f-variable-souhaite').value) || 0,
          preavis: overlay.querySelector('#f-preavis').value.trim(),
          diplome: overlay.querySelector('#f-diplome').value,
          origine: overlay.querySelector('#f-origine').value,
          notes: overlay.querySelector('#f-notes').value.trim(),
        };

        if (!data.nom) {
          UI.toast('Le nom est obligatoire', 'error');
          return;
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
          data.ambassadeur = false;
          data.ingenieur_master = false;
          data.exposition_pouvoir = '';
          data.motivation_changement = '';
          data.fit_poste = '';
          data.fit_culture = '';
          data.risques = '';
          data.recommande_par = '';
          data.synthese_30s = '';
          data.parcours_cible = '';
          data.package_attentes = '';
          data.motivation_drivers = '';
          data.lecture_recruteur = '';
          data.teletravail = '';
          data.rtt = false;
          data.nb_rtt = 0;
          data.debut_poste_actuel = '';
          data.debut_carriere = '';
          await Store.add('candidats', data);
          UI.toast('Candidat créé');
        }

        setTimeout(() => location.reload(), 500);
      }
    });

    // Init autocomplete after modal renders
    UI.entrepriseAutocomplete('f-entreprise-search', 'f-entreprise');
  }

  // Expose for edit from detail page
  window.showCandidatModal = showCandidatModal;
})();
