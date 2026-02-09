// Amarillo ATS — Candidat detail page

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }

  const id = UI.getParam('id');
  if (!id) { window.location.href = 'candidats.html'; return; }

  await Store.loadAll();
  UI.initGlobalSearch();
  UI.initTabs('#candidat-tabs');

  const candidat = Store.findById('candidats', id);
  if (!candidat) {
    document.querySelector('.page-content').innerHTML = '<div class="empty-state"><p>Candidat introuvable</p><a href="candidats.html" class="btn btn-secondary">Retour</a></div>';
    return;
  }

  document.title = `${candidat.prenom || ''} ${candidat.nom || ''} — Amarillo ATS`;

  renderHeader();
  renderProfil();
  renderEntretien();
  renderMissions();
  renderActions();
  renderReferences();
  renderSidebar();

  function renderHeader() {
    const entreprise = candidat.entreprise_actuelle_id ? Store.resolve('entreprises', candidat.entreprise_actuelle_id) : null;

    document.getElementById('candidat-header').innerHTML = `
      <div class="detail-header">
        <div>
          <h1>${UI.escHtml((candidat.prenom || '') + ' ' + (candidat.nom || ''))}</h1>
          <div class="subtitle">
            ${UI.escHtml(candidat.poste_actuel || '')}
            ${entreprise ? ` chez ${UI.entityLink('entreprises', entreprise.id, entreprise.displayName)}` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${UI.badge(candidat.statut)}
          ${UI.badge(candidat.niveau)}
          <button class="btn btn-secondary btn-sm" id="btn-edit-candidat">Modifier</button>
        </div>
      </div>
    `;

    document.getElementById('btn-edit-candidat').addEventListener('click', () => {
      showEditModal();
    });
  }

  function renderProfil() {
    const pkg = (candidat.salaire_fixe_actuel || 0) + (candidat.variable_actuel || 0);
    const pkgSouhaite = (candidat.salaire_fixe_souhaite || 0) + (candidat.variable_souhaite || 0);

    const yearsInRole = candidat.debut_poste_actuel ? Math.floor((Date.now() - new Date(candidat.debut_poste_actuel).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
    const totalExp = candidat.debut_carriere ? Math.floor((Date.now() - new Date(candidat.debut_carriere).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

    document.getElementById('tab-profil').innerHTML = `
      <div class="card">
        <div class="card-header"><h2>Informations générales</h2></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            ${field('Localisation', candidat.localisation)}
            ${field('Diplôme', candidat.diplome)}
            ${field('Ingénieur / Master', candidat.ingenieur_master ? 'Oui' : 'Non')}
            ${field('Origine', candidat.origine)}
            ${field('Recommandé par', candidat.recommande_par)}
            ${field('Ambassadeur', candidat.ambassadeur ? 'Oui' : 'Non')}
            ${field('Exposition au pouvoir', candidat.exposition_pouvoir)}
            ${field('Préavis', candidat.preavis)}
            ${field("Ancienneté poste", yearsInRole !== null ? yearsInRole + ' ans' : '—')}
            ${field("Expérience totale", totalExp !== null ? totalExp + ' ans' : '—')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Contact</h2></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            ${field('Email', candidat.email ? `<a href="mailto:${UI.escHtml(candidat.email)}" class="entity-link">${UI.escHtml(candidat.email)}</a>` : '—', true)}
            ${field('Téléphone', candidat.telephone ? `<a href="tel:${UI.escHtml(candidat.telephone)}" class="entity-link">${UI.escHtml(candidat.telephone)}</a>` : '—', true)}
            ${field('LinkedIn', candidat.linkedin ? `<a href="${UI.escHtml(candidat.linkedin)}" target="_blank" class="entity-link">Profil LinkedIn</a>` : '—', true)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Package & Rémunération</h2></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
            <div>
              <h3 style="font-size:0.8125rem;font-weight:600;color:#64748b;margin-bottom:8px;">Actuel</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${field('Fixe', UI.formatCurrency(candidat.salaire_fixe_actuel))}
                ${field('Variable', UI.formatCurrency(candidat.variable_actuel))}
              </div>
              <div style="margin-top:8px;font-size:0.9375rem;font-weight:700;color:#1e293b;">
                Package : ${pkg > 0 ? UI.formatCurrency(pkg) : '—'}
              </div>
            </div>
            <div>
              <h3 style="font-size:0.8125rem;font-weight:600;color:#64748b;margin-bottom:8px;">Souhaité</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${field('Fixe', UI.formatCurrency(candidat.salaire_fixe_souhaite))}
                ${field('Variable', UI.formatCurrency(candidat.variable_souhaite))}
              </div>
              <div style="margin-top:8px;font-size:0.9375rem;font-weight:700;color:#1e293b;">
                Package : ${pkgSouhaite > 0 ? UI.formatCurrency(pkgSouhaite) : '—'}
              </div>
            </div>
          </div>
          <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            ${field('RTT', candidat.rtt ? `Oui (${candidat.nb_rtt || 0} jours)` : 'Non')}
            ${field('Télétravail', candidat.teletravail)}
          </div>
        </div>
      </div>

      ${candidat.notes ? `
      <div class="card">
        <div class="card-header"><h2>Notes</h2></div>
        <div class="card-body">
          <p style="white-space:pre-wrap;font-size:0.875rem;color:#334155;">${UI.escHtml(candidat.notes)}</p>
        </div>
      </div>
      ` : ''}
    `;
  }

  function renderEntretien() {
    document.getElementById('tab-entretien').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Synthèse 30 secondes</h2>
          <button class="btn btn-sm btn-secondary" onclick="editField('synthese_30s', 'Synthèse 30 secondes')">Modifier</button>
        </div>
        <div class="card-body">
          <p style="white-space:pre-wrap;font-size:0.875rem;">${UI.escHtml(candidat.synthese_30s) || '<span style="color:#94a3b8;font-style:italic;">Non renseigné</span>'}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>Parcours cible</h2>
          <button class="btn btn-sm btn-secondary" onclick="editField('parcours_cible', 'Parcours cible')">Modifier</button>
        </div>
        <div class="card-body">
          <p style="white-space:pre-wrap;font-size:0.875rem;">${UI.escHtml(candidat.parcours_cible) || '<span style="color:#94a3b8;font-style:italic;">Non renseigné</span>'}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>Motivation & Drivers</h2>
          <button class="btn btn-sm btn-secondary" onclick="editField('motivation_drivers', 'Motivation & Drivers')">Modifier</button>
        </div>
        <div class="card-body">
          ${field('Motivation changement', candidat.motivation_changement)}
          <p style="white-space:pre-wrap;font-size:0.875rem;margin-top:8px;">${UI.escHtml(candidat.motivation_drivers) || '<span style="color:#94a3b8;font-style:italic;">Non renseigné</span>'}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>Lecture recruteur</h2>
          <button class="btn btn-sm btn-secondary" onclick="editField('lecture_recruteur', 'Lecture recruteur')">Modifier</button>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            ${field('Fit poste', candidat.fit_poste)}
            ${field('Fit culture', candidat.fit_culture)}
            ${field('Risques', candidat.risques)}
          </div>
          <p style="white-space:pre-wrap;font-size:0.875rem;">${UI.escHtml(candidat.lecture_recruteur) || '<span style="color:#94a3b8;font-style:italic;">Non renseigné</span>'}</p>
        </div>
      </div>
    `;
  }

  function renderMissions() {
    const missionIds = candidat.missions_ids || [];
    const missions = missionIds.map(mid => Store.findById('missions', mid)).filter(Boolean);

    let html = '';
    if (missions.length === 0) {
      html = '<div class="empty-state"><p>Aucune mission associée</p></div>';
    } else {
      html = `<div class="card"><div class="card-body">`;
      html += missions.map(m => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <div>
            <a href="mission.html?id=${m.id}" class="entity-link" style="font-weight:600;">${UI.escHtml(m.nom || m.ref || '')}</a>
            <div style="font-size:0.75rem;color:#64748b;margin-top:2px;">${UI.escHtml(m.ref || '')}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${UI.badge(m.statut)}
            ${UI.badge(m.niveau)}
            ${m.fee_estimee ? `<span style="font-size:0.8125rem;font-weight:600;">${UI.formatCurrency(m.fee_estimee)}</span>` : ''}
          </div>
        </div>
      `).join('');
      html += `</div></div>`;
    }
    document.getElementById('tab-missions').innerHTML = html;
  }

  function renderActions() {
    const actions = Store.filter('actions', a => a.candidat_id === id);
    document.getElementById('tab-actions').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Historique des actions</h2>
          <button class="btn btn-sm btn-primary" onclick="newAction()">+ Action</button>
        </div>
        <div class="card-body">
          <div id="candidat-timeline"></div>
        </div>
      </div>
    `;
    UI.timeline('candidat-timeline', actions);
  }

  function renderReferences() {
    const refs = Store.filter('references', r => r.candidat_id === id);

    let html = '';
    if (refs.length === 0) {
      html = '<div class="empty-state"><p>Aucune référence</p></div>';
    } else {
      html = refs.map(r => `
        <div class="card">
          <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              ${field('Référent', r.referent_nom)}
              ${field('Fonction', r.fonction_referent)}
              ${field('Entreprise', r.entreprise)}
              ${field('Lien hiérarchique', r.lien_hierarchique)}
              ${field('Mode', r.mode)}
              ${field('Date', UI.formatDate(r.date_ref_check))}
              ${field('Le reprendrait', r.le_reprendrait)}
              ${field('Niveau recommandation', r.niveau_recommandation)}
              ${field('Autorisation candidat', r.autorisation_candidat ? 'Oui' : 'Non')}
            </div>
          </div>
        </div>
      `).join('');
    }
    document.getElementById('tab-references').innerHTML = html;
  }

  function renderSidebar() {
    const entreprise = candidat.entreprise_actuelle_id ? Store.resolve('entreprises', candidat.entreprise_actuelle_id) : null;
    const decideurs = (candidat.decideur_connu_ids || []).map(did => Store.resolve('decideurs', did)).filter(Boolean);
    const lies = (candidat.candidats_lies_ids || []).map(cid => Store.resolve('candidats', cid)).filter(Boolean);

    document.getElementById('candidat-sidebar').innerHTML = `
      <div class="card-header"><h2>Liens rapides</h2></div>
      <div class="card-body">
        ${entreprise ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Entreprise actuelle</div>
            ${UI.entityLink('entreprises', entreprise.id, entreprise.displayName)}
          </div>
        ` : ''}

        ${decideurs.length > 0 ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Décideurs connus</div>
            ${decideurs.map(d => `<div>${UI.entityLink('decideurs', d.id, d.displayName)}</div>`).join('')}
          </div>
        ` : ''}

        ${lies.length > 0 ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Candidats liés</div>
            ${lies.map(c => `<div>${UI.entityLink('candidats', c.id, c.displayName)}</div>`).join('')}
          </div>
        ` : ''}

        ${candidat.linkedin ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Liens externes</div>
            <a href="${UI.escHtml(candidat.linkedin)}" target="_blank" class="entity-link">LinkedIn</a>
          </div>
        ` : ''}

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
          <div style="font-size:0.75rem;color:#94a3b8;">
            Créé le ${UI.formatDate(candidat.created_at)}<br/>
            Modifié le ${UI.formatDate(candidat.updated_at)}
          </div>
        </div>
      </div>
    `;
  }

  // Helper
  function field(label, value, isHtml = false) {
    return `
      <div style="margin-bottom:8px;">
        <div style="font-size:0.75rem;font-weight:600;color:#64748b;">${label}</div>
        <div style="font-size:0.875rem;color:#1e293b;">${isHtml ? (value || '—') : UI.escHtml(value || '—')}</div>
      </div>
    `;
  }

  // Edit text field inline
  window.editField = function(fieldName, label) {
    const current = candidat[fieldName] || '';
    UI.modal(`Modifier : ${label}`, `
      <div class="form-group">
        <label>${label}</label>
        <textarea id="edit-field-value" style="min-height:150px;">${UI.escHtml(current)}</textarea>
      </div>
    `, {
      onSave: async (overlay) => {
        const value = overlay.querySelector('#edit-field-value').value.trim();
        await Store.update('candidats', id, { [fieldName]: value });
        UI.toast('Mis à jour');
        setTimeout(() => location.reload(), 500);
      }
    });
  };

  // New action for this candidat
  window.newAction = function() {
    const missions = Store.get('missions');
    UI.modal('Nouvelle action', `
      <div class="form-group">
        <label>Action</label>
        <input type="text" id="a-action" placeholder="Ex: Message LinkedIn, Appel..." />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select id="a-type">
            <option value="Prise de contact">Prise de contact</option>
            <option value="Qualification candidat">Qualification candidat</option>
            <option value="Suivi">Suivi</option>
          </select>
        </div>
        <div class="form-group">
          <label>Canal</label>
          <select id="a-canal">
            <option value="LinkedIn">LinkedIn</option>
            <option value="Appel">Appel</option>
            <option value="Email">Email</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="a-date" value="${new Date().toISOString().split('T')[0]}" />
        </div>
        <div class="form-group">
          <label>Mission liée</label>
          <select id="a-mission">
            <option value="">— Aucune —</option>
            ${missions.map(m => `<option value="${m.id}">${UI.escHtml(m.nom || m.ref)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Message / Notes</label>
        <textarea id="a-notes"></textarea>
      </div>
      <div class="form-group">
        <label>Next step</label>
        <input type="text" id="a-next" />
      </div>
    `, {
      onSave: async (overlay) => {
        const action = {
          id: API.generateId('act'),
          action: overlay.querySelector('#a-action').value.trim(),
          type_action: overlay.querySelector('#a-type').value,
          canal: overlay.querySelector('#a-canal').value,
          statut: 'Fait',
          phase: 'Qualification',
          date_action: overlay.querySelector('#a-date').value,
          candidat_id: id,
          mission_id: overlay.querySelector('#a-mission').value || null,
          decideur_id: null,
          entreprise_id: null,
          message_notes: overlay.querySelector('#a-notes').value.trim(),
          next_step: overlay.querySelector('#a-next').value.trim(),
          reponse: false,
          finalite: '',
          objectif: '',
          moment_suivi: '',
          date_relance: '',
        };
        await Store.add('actions', action);
        UI.toast('Action créée');
        setTimeout(() => location.reload(), 500);
      }
    });
  };

  // Edit modal (reuse candidats.js logic)
  function showEditModal() {
    const entreprises = Store.get('entreprises');
    const c = candidat;

    const bodyHtml = `
      <div class="form-row">
        <div class="form-group"><label>Prénom</label><input type="text" id="f-prenom" value="${UI.escHtml(c.prenom || '')}" /></div>
        <div class="form-group"><label>Nom</label><input type="text" id="f-nom" value="${UI.escHtml(c.nom || '')}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Poste actuel</label><input type="text" id="f-poste-actuel" value="${UI.escHtml(c.poste_actuel || '')}" /></div>
        <div class="form-group"><label>Poste cible</label><input type="text" id="f-poste-cible" value="${UI.escHtml(c.poste_cible || '')}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Entreprise actuelle</label>
          <select id="f-entreprise">
            <option value="">— Aucune —</option>
            ${entreprises.map(e => `<option value="${e.id}" ${c.entreprise_actuelle_id === e.id ? 'selected' : ''}>${UI.escHtml(e.nom)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Statut</label>
          <select id="f-statut">
            ${['To call','Approché','En qualification','Shortlisté','Présenté','Placé','Off market','Pas prioritaire'].map(s => `<option value="${s}" ${c.statut===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Niveau</label>
          <select id="f-niveau"><option value="">—</option>${['Junior','Middle','Top'].map(s=>`<option value="${s}" ${c.niveau===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Localisation</label><input type="text" id="f-localisation" value="${UI.escHtml(c.localisation || '')}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input type="email" id="f-email" value="${UI.escHtml(c.email || '')}" /></div>
        <div class="form-group"><label>Téléphone</label><input type="tel" id="f-telephone" value="${UI.escHtml(c.telephone || '')}" /></div>
      </div>
      <div class="form-group"><label>LinkedIn</label><input type="url" id="f-linkedin" value="${UI.escHtml(c.linkedin || '')}" /></div>
      <div class="form-row">
        <div class="form-group"><label>Fixe actuel (€)</label><input type="number" id="f-salaire-fixe" value="${c.salaire_fixe_actuel||''}" /></div>
        <div class="form-group"><label>Variable actuel (€)</label><input type="number" id="f-variable" value="${c.variable_actuel||''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Fixe souhaité (€)</label><input type="number" id="f-salaire-souhaite" value="${c.salaire_fixe_souhaite||''}" /></div>
        <div class="form-group"><label>Variable souhaité (€)</label><input type="number" id="f-variable-souhaite" value="${c.variable_souhaite||''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Préavis</label><input type="text" id="f-preavis" value="${UI.escHtml(c.preavis || '')}" /></div>
        <div class="form-group"><label>Diplôme</label>
          <select id="f-diplome"><option value="">—</option>${['Bac+2 / Bac+3','Bac+4','Bac+5'].map(s=>`<option value="${s}" ${c.diplome===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-group"><label>Motivation changement</label><textarea id="f-motivation">${UI.escHtml(c.motivation_changement||'')}</textarea></div>
      <div class="form-group"><label>Télétravail</label><input type="text" id="f-teletravail" value="${UI.escHtml(c.teletravail||'')}" /></div>
      <div class="form-group"><label>Notes</label><textarea id="f-notes">${UI.escHtml(c.notes||'')}</textarea></div>
    `;

    UI.modal('Modifier le candidat', bodyHtml, {
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
          salaire_fixe_actuel: parseInt(overlay.querySelector('#f-salaire-fixe').value) || 0,
          variable_actuel: parseInt(overlay.querySelector('#f-variable').value) || 0,
          salaire_fixe_souhaite: parseInt(overlay.querySelector('#f-salaire-souhaite').value) || 0,
          variable_souhaite: parseInt(overlay.querySelector('#f-variable-souhaite').value) || 0,
          preavis: overlay.querySelector('#f-preavis').value.trim(),
          diplome: overlay.querySelector('#f-diplome').value,
          motivation_changement: overlay.querySelector('#f-motivation').value.trim(),
          teletravail: overlay.querySelector('#f-teletravail').value.trim(),
          notes: overlay.querySelector('#f-notes').value.trim(),
        };
        await Store.update('candidats', id, data);
        UI.toast('Candidat mis à jour');
        setTimeout(() => location.reload(), 500);
      }
    });
  }
})();
