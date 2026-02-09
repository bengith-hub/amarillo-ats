// Amarillo ATS — Entreprises logic

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }
  await Store.loadAll();
  UI.initGlobalSearch();

  const allEntreprises = Store.get('entreprises');

  UI.filterBar('entreprises-filters', {
    searchPlaceholder: 'Rechercher une entreprise...',
    filters: [
      { key: 'secteur', label: 'Tous secteurs', options: ['BTP', 'Retail', 'Industrie', 'Transports', 'Finance', 'SaaS / Tech'] },
      { key: 'taille', label: 'Toutes tailles', options: ['51-200', '201-1000', '1000+'] },
      { key: 'priorite', label: 'Toutes priorités', options: ['5 - Coeur de cible', '3 - Pertinent'] },
      { key: 'statut', label: 'Tous statuts', options: ['À cibler', 'Contactée', 'En discussion', 'Cliente', 'Inactive'] }
    ],
    onFilter: ({ search, filters }) => {
      let filtered = allEntreprises;
      if (search) { const q = search.toLowerCase(); filtered = filtered.filter(e => (e.nom || '').toLowerCase().includes(q) || (e.localisation || '').toLowerCase().includes(q)); }
      if (filters.secteur) filtered = filtered.filter(e => e.secteur === filters.secteur);
      if (filters.taille) filtered = filtered.filter(e => e.taille === filters.taille);
      if (filters.priorite) filtered = filtered.filter(e => e.priorite === filters.priorite);
      if (filters.statut) filtered = filtered.filter(e => e.statut === filters.statut);
      renderTable(filtered);
    }
  });

  renderTable(allEntreprises);

  function renderTable(data) {
    UI.dataTable('entreprises-table', {
      columns: [
        { key: 'nom', label: 'Entreprise', render: r => `<strong>${UI.escHtml(r.nom || '')}</strong>` },
        { key: 'secteur', label: 'Secteur' },
        { key: 'taille', label: 'Taille' },
        { key: 'ca', label: 'CA' },
        { key: 'localisation', label: 'Localisation' },
        { key: 'priorite', label: 'Priorité', render: r => UI.badge(r.priorite === '5 - Coeur de cible' ? 'Haute' : 'Moyenne') },
        { key: 'icp_fit', label: 'ICP', render: r => r.icp_fit ? '<span style="color:#16a34a;font-weight:600;">✓</span>' : '—' },
        { key: 'statut', label: 'Statut' },
        { key: 'decideurs', label: 'Décideurs', render: r => {
          const decs = Store.filter('decideurs', d => d.entreprise_id === r.id);
          return decs.length;
        }},
        { key: 'dernier_contact', label: 'Dernier contact', render: r => UI.formatDate(r.dernier_contact) }
      ],
      data: data,
      onRowClick: (id) => window.location.href = `entreprise.html?id=${id}`,
      emptyMessage: 'Aucune entreprise'
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
          <select id="e-secteur"><option value="">—</option>${['BTP','Retail','Industrie','Transports','Finance','SaaS / Tech'].map(s=>`<option value="${s}" ${e.secteur===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Taille</label>
          <select id="e-taille"><option value="">—</option>${['51-200','201-1000','1000+'].map(s=>`<option value="${s}" ${e.taille===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>CA</label>
          <select id="e-ca"><option value="">—</option>${['20-50 M€','50-100 M€','250 M€+'].map(s=>`<option value="${s}" ${e.ca===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Localisation</label><input type="text" id="e-loc" value="${UI.escHtml(e.localisation||'')}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Priorité</label>
          <select id="e-prio"><option value="5 - Coeur de cible" ${e.priorite==='5 - Coeur de cible'?'selected':''}>5 - Coeur de cible</option><option value="3 - Pertinent" ${e.priorite==='3 - Pertinent'?'selected':''}>3 - Pertinent</option></select>
        </div>
        <div class="form-group"><label>Statut</label>
          <select id="e-statut">${['À cibler','Contactée','En discussion','Cliente','Inactive'].map(s=>`<option value="${s}" ${e.statut===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-group"><label>Site web</label><input type="url" id="e-site" value="${UI.escHtml(e.site_web||'')}" /></div>
      <div class="form-group"><label>Téléphone</label><input type="tel" id="e-tel" value="${UI.escHtml(e.telephone||'')}" /></div>
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
          angle_approche: overlay.querySelector('#e-angle').value.trim(),
          notes: overlay.querySelector('#e-notes').value.trim(),
          icp_fit: overlay.querySelector('#e-prio').value === '5 - Coeur de cible',
        };
        if (isEdit) {
          await Store.update('entreprises', e.id, data);
          UI.toast('Entreprise mise à jour');
        } else {
          data.id = API.generateId('ent');
          data.source = '';
          data.dernier_contact = null;
          data.prochaine_relance = null;
          await Store.add('entreprises', data);
          UI.toast('Entreprise créée');
        }
        setTimeout(() => location.reload(), 500);
      }
    });
  }
})();
