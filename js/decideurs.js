// Amarillo ATS — Décideurs logic

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }
  await Store.loadAll();
  UI.initGlobalSearch();

  const allDecideurs = Store.get('decideurs');

  UI.filterBar('decideurs-filters', {
    searchPlaceholder: 'Rechercher un décideur...',
    filters: [
      { key: 'fonction_macro', label: 'Toutes fonctions', options: Referentiels.get('decideur_fonctions_macro') },
      { key: 'niveau_hierarchique', label: 'Tous niveaux', options: Referentiels.get('decideur_niveaux_hierarchiques') },
      { key: 'niveau_relation', label: 'Tous niveaux relation', options: Referentiels.get('decideur_niveaux_relation') },
      { key: 'priorite_prospection', label: 'Toutes priorités', options: Referentiels.get('decideur_priorites_prospection') }
    ],
    onFilter: ({ search, filters }) => {
      let filtered = allDecideurs;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(d => {
          const name = `${d.prenom||''} ${d.nom||''}`.toLowerCase();
          return name.includes(q) || (d.fonction || '').toLowerCase().includes(q);
        });
      }
      if (filters.fonction_macro) filtered = filtered.filter(d => d.fonction_macro === filters.fonction_macro);
      if (filters.niveau_hierarchique) filtered = filtered.filter(d => d.niveau_hierarchique === filters.niveau_hierarchique);
      if (filters.niveau_relation) filtered = filtered.filter(d => d.niveau_relation === filters.niveau_relation);
      if (filters.priorite_prospection) filtered = filtered.filter(d => d.priorite_prospection === filters.priorite_prospection);
      filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      renderTable(filtered);
    }
  });

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
        { key: 'niveau_relation', label: 'Relation' },
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
          await Store.add('decideurs', data);
          UI.toast('Décideur créé');
        }
        location.reload();
      }
    });
    UI.localisationAutocomplete('d-loc');
  }
})();
