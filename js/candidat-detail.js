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

  const CANDIDAT_STATUTS = Referentiels.get('candidat_statuts');
  const CANDIDAT_NIVEAUX = Referentiels.get('candidat_niveaux');

  renderHeader();
  renderProfil();
  renderEntretien();
  renderMissions();
  renderActions();
  renderPresentations();
  renderReferences();
  renderDocuments();
  renderSidebar();
  renderEntreprisesCibles();

  function renderHeader() {
    const entreprise = candidat.entreprise_actuelle_id ? Store.resolve('entreprises', candidat.entreprise_actuelle_id) : null;

    document.getElementById('candidat-header').innerHTML = `
      <div class="detail-header">
        <div style="display:flex;align-items:center;">
          <div class="detail-avatar candidat">${(candidat.prenom || '?')[0]}</div>
          <div>
            <h1 id="candidat-name" style="cursor:pointer;" title="Cliquer pour modifier">${UI.escHtml((candidat.prenom || '') + ' ' + (candidat.nom || ''))}</h1>
            <div class="subtitle">
              ${UI.escHtml(candidat.poste_actuel || '')}
              ${entreprise ? ` chez ${UI.entityLink('entreprises', entreprise.id, entreprise.displayName)}` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${UI.statusBadge(candidat.statut || 'To call', CANDIDAT_STATUTS, { entity: 'candidats', recordId: id, fieldName: 'statut', onUpdate: (s) => { candidat.statut = s; } })}
          ${UI.statusBadge(candidat.niveau || 'Middle', CANDIDAT_NIVEAUX, { entity: 'candidats', recordId: id, fieldName: 'niveau', onUpdate: (s) => { candidat.niveau = s; } })}
          <button class="btn btn-secondary btn-sm" id="btn-templates">📋 Trames</button>
          <button class="btn btn-danger btn-sm" id="btn-delete-candidat" title="Supprimer ce candidat">🗑️</button>
          <span class="autosave-indicator saved"><span class="sync-dot"></span> Auto-save</span>
        </div>
      </div>
    `;

    document.getElementById('btn-templates').addEventListener('click', () => {
      showTemplatesModal({ candidatId: id });
    });

    document.getElementById('btn-delete-candidat').addEventListener('click', () => {
      UI.modal('Supprimer le candidat', `
        <p style="color:#dc2626;font-weight:600;">Supprimer <strong>${UI.escHtml((candidat.prenom || '') + ' ' + (candidat.nom || ''))}</strong> ?</p>
        <p style="font-size:0.875rem;color:#64748b;margin-top:8px;">Cette action est irréversible. Toutes les données du candidat seront perdues.</p>
      `, {
        saveLabel: 'Supprimer',
        onSave: async () => {
          await Store.remove('candidats', id);
          UI.toast('Candidat supprimé');
          window.location.href = 'candidats.html';
        }
      });
    });

    // Click on name to edit
    document.getElementById('candidat-name')?.addEventListener('click', () => {
      UI.modal('Modifier le nom', `
        <div class="form-row">
          <div class="form-group"><label>Prénom</label><input type="text" id="cn-prenom" value="${UI.escHtml(candidat.prenom || '')}" /></div>
          <div class="form-group"><label>Nom</label><input type="text" id="cn-nom" value="${UI.escHtml(candidat.nom || '')}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Poste actuel</label><input type="text" id="cn-poste" value="${UI.escHtml(candidat.poste_actuel || '')}" /></div>
          <div class="form-group"><label>Poste cible</label><input type="text" id="cn-poste-cible" value="${UI.escHtml(candidat.poste_cible || '')}" /></div>
        </div>
        <div class="form-group">
          <label>Entreprise actuelle</label>
          <input type="text" id="f-entreprise-search" value="${candidat.entreprise_actuelle_id ? (Store.resolve('entreprises', candidat.entreprise_actuelle_id)?.displayName || '') : ''}" placeholder="Tapez pour rechercher..." />
          <input type="hidden" id="f-entreprise" value="${candidat.entreprise_actuelle_id || ''}" />
        </div>
      `, {
        onSave: async (overlay) => {
          await Store.update('candidats', id, {
            prenom: overlay.querySelector('#cn-prenom').value.trim(),
            nom: overlay.querySelector('#cn-nom').value.trim(),
            poste_actuel: overlay.querySelector('#cn-poste').value.trim(),
            poste_cible: overlay.querySelector('#cn-poste-cible').value.trim(),
            entreprise_actuelle_id: overlay.querySelector('#f-entreprise').value || null,
          });
          UI.toast('Candidat mis à jour');
          location.reload();
        }
      });
      UI.entrepriseAutocomplete('f-entreprise-search', 'f-entreprise');
    });
  }

  function computeDuration(dateStr) {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    const totalMonths = Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000));
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years > 0 && months > 0) return `${years} an${years > 1 ? 's' : ''} ${months} mois`;
    if (years > 0) return `${years} an${years > 1 ? 's' : ''}`;
    if (months > 0) return `${months} mois`;
    return '< 1 mois';
  }

  function renderProfil() {
    const pkg = (candidat.salaire_fixe_actuel || 0) + (candidat.variable_actuel || 0);
    const pkgSouhaiteMin = candidat.package_souhaite_min || 0;
    const pkgSouhaite = candidat.package_souhaite || 0;

    const durePoste = computeDuration(candidat.debut_poste_actuel);
    const totalExp = computeDuration(candidat.debut_carriere);

    document.getElementById('tab-profil').innerHTML = `
      <div class="card" data-accent="green">
        <div class="card-header">
          <h2>Informations générales</h2>
          <span class="edit-hint">cliquer sur un champ pour modifier</span>
        </div>
        <div class="card-body">
          <div class="inline-fields-grid" id="profil-info-fields"></div>
        </div>
      </div>

      <div class="card" data-accent="cyan">
        <div class="card-header">
          <h2>Dates & Expérience</h2>
          <span class="edit-hint">cliquer pour modifier</span>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div id="profil-dates-fields"></div>
            <div>
              <div style="background:#f0f9ff;border-radius:8px;padding:16px;border:1px solid #bae6fd;">
                <div style="font-size:0.75rem;font-weight:600;color:#0284c7;text-transform:uppercase;margin-bottom:8px;">Durées calculées</div>
                <div style="display:flex;flex-direction:column;gap:12px;">
                  <div>
                    <div style="font-size:0.75rem;color:#64748b;">${candidat.open_to_work ? 'En recherche depuis' : 'Ancienneté poste actuel'}</div>
                    <div style="font-size:1.125rem;font-weight:700;color:#0284c7;" id="computed-duree-poste">${durePoste || '—'}</div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem;color:#64748b;">Expérience totale</div>
                    <div style="font-size:1.125rem;font-weight:700;color:#0284c7;" id="computed-exp-totale">${totalExp || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>Contact</h2>
          <span class="edit-hint">cliquer pour modifier</span>
        </div>
        <div class="card-body">
          <div class="inline-fields-grid" id="profil-contact-fields"></div>
          <div id="trajet-button-container" style="margin-top:12px;"></div>
        </div>
      </div>

      <div class="card" data-accent="orange">
        <div class="card-header">
          <h2>Package & Rémunération</h2>
          <span class="edit-hint">cliquer pour modifier</span>
        </div>
        <div class="card-body">
          <div class="inline-fields-grid" id="profil-package-fields"></div>
          <div style="margin-top:12px;display:flex;gap:24px;flex-wrap:wrap;">
            <div style="font-size:0.9375rem;font-weight:700;color:#1e293b;">
              Package actuel : ${pkg > 0 ? `${pkg} K€` : '—'}
            </div>
            <div style="font-size:0.9375rem;font-weight:700;color:#1e293b;">
              Package souhaité : ${pkgSouhaiteMin > 0 && pkgSouhaite > 0 ? `${pkgSouhaiteMin} – ${pkgSouhaite} K€` : pkgSouhaite > 0 ? `${pkgSouhaite} K€` : pkgSouhaiteMin > 0 ? `à partir de ${pkgSouhaiteMin} K€` : '—'}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>Notes</h2>
          <span class="edit-hint">cliquer pour modifier</span>
        </div>
        <div class="card-body" id="profil-notes"></div>
      </div>
    `;

    // Inline editable — Informations générales
    UI.inlineEdit('profil-info-fields', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'entreprise_actuelle_id', label: 'Entreprise actuelle', type: 'entreprise_autocomplete', render: (v) => {
          if (!v) return '';
          const ent = Store.resolve('entreprises', v);
          return ent ? `<a href="entreprise.html?id=${ent.id}" class="entity-link">${UI.escHtml(ent.displayName)}</a>` : '';
        }},
        { key: 'poste_cible', label: 'Poste cible', type: 'text' },
        { key: 'localisation', label: 'Localisation', type: 'autocomplete', options: () => Referentiels.get('localisations'), refKey: 'localisations' },
        { key: 'date_naissance', label: 'Date de naissance', type: 'date', render: (v) => v ? UI.formatDate(v) : '' },
        { key: 'open_to_work', label: 'Open to work', type: 'boolean', render: (v) => v ? '<span style="color:#16a34a;font-weight:600;">✅ Oui</span>' : '❌ Non' },
        { key: 'diplome', label: 'Diplôme', type: 'select', options: Referentiels.get('candidat_diplomes') },
        { key: 'profile_code', label: 'Code Profiling Amarillo™', type: 'text' },
        { key: 'origine', label: 'Origine', type: 'text' },
        { key: 'recommande_par', label: 'Recommandé par', type: 'candidat_autocomplete' },
        { key: 'date_disponibilite', label: 'Date de disponibilité', type: 'date', render: (v) => v ? UI.formatDate(v) : '' },
        { key: 'ambassadeur', label: 'Ambassadeur', type: 'select', options: ['Non', 'Neutre', 'Oui'], render: (v) => {
          if (v === 'Oui' || v === true) return '✅ Oui';
          if (v === 'Neutre') return '🔘 Neutre';
          if (v === 'Non' || v === false) return '❌ Non';
          return '';
        }},
        { key: 'preavis', label: 'Préavis', type: 'text' },
      ],
      onAfterSave: (fieldKey) => {
        // When open_to_work changes, update the date label
        if (fieldKey === 'open_to_work') {
          renderProfil();
        }
      }
    });

    // Inline editable — Contact
    UI.inlineEdit('profil-contact-fields', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'email', label: 'Email', type: 'text', render: (v) => v ? `<a href="mailto:${UI.escHtml(v)}" class="entity-link">${UI.escHtml(v)}</a>` : '' },
        { key: 'telephone', label: 'Téléphone', type: 'text', render: (v) => v ? `<a href="tel:${UI.escHtml(v)}" class="entity-link">${UI.escHtml(v)}</a>` : '' },
        { key: 'linkedin', label: 'LinkedIn', type: 'text', render: (v) => v ? `<a href="${UI.escHtml(v)}" target="_blank" class="entity-link">Profil LinkedIn</a>` : '' },
        { key: 'adresse_ligne1', label: 'Adresse', type: 'text' },
        { key: 'code_postal', label: 'Code postal', type: 'text' },
        { key: 'ville', label: 'Ville', type: 'text' },
      ]
    });

    // --- Driving time button ---
    renderTrajetButton();

    // Inline editable — Package
    UI.inlineEdit('profil-package-fields', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'salaire_fixe_actuel', label: 'Fixe actuel (K€)', type: 'number', render: (v) => v ? `${v} K€` : '—' },
        { key: 'variable_actuel', label: 'Variable actuel (K€)', type: 'number', render: (v) => v ? `${v} K€` : '—' },
        { key: 'package_souhaite_min', label: 'Package souhaité min (K€)', type: 'number', render: (v) => v ? `${v} K€` : '—' },
        { key: 'package_souhaite', label: 'Package souhaité (K€)', type: 'number', render: (v) => v ? `${v} K€` : '—' },
        { key: 'teletravail', label: 'Télétravail', type: 'text' },
        { key: 'rtt', label: 'RTT', type: 'boolean', render: (v) => v ? '✅ Oui' : '❌ Non' },
        { key: 'nb_rtt', label: 'Nb RTT (jours)', type: 'number' },
      ],
      onAfterSave: () => {
        // Re-render to update package totals
        renderProfil();
      }
    });

    UI.inlineEdit('profil-dates-fields', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'debut_poste_actuel', label: candidat.open_to_work ? 'Début de recherche d\'emploi' : 'Prise de poste actuel', type: 'month', render: (v) => {
          if (!v) return '';
          return UI.formatMonthYear(v);
        }},
        { key: 'debut_carriere', label: 'Début de carrière', type: 'month', render: (v) => {
          if (!v) return '';
          return UI.formatMonthYear(v);
        }}
      ],
      onAfterSave: () => {
        const dp = document.getElementById('computed-duree-poste');
        const et = document.getElementById('computed-exp-totale');
        if (dp) dp.textContent = computeDuration(candidat.debut_poste_actuel) || '—';
        if (et) et.textContent = computeDuration(candidat.debut_carriere) || '—';
      }
    });

    UI.inlineEdit('profil-notes', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'notes', label: 'Notes', type: 'textarea', render: (v) => v ? `<span style="white-space:pre-wrap;">${UI.escHtml(v)}</span>` : '' }
      ]
    });
  }

  function renderEntretien() {
    document.getElementById('tab-entretien').innerHTML = `
      <div class="card" data-accent="gold">
        <div class="card-header">
          <h2>Synthèse 30 secondes</h2>
          <span class="edit-hint">cliquer pour modifier</span>
        </div>
        <div class="card-body" id="entretien-synthese"></div>
      </div>

      <div class="card" data-accent="blue">
        <div class="card-header">
          <h2>Parcours cible</h2>
          <span class="edit-hint">cliquer pour modifier</span>
        </div>
        <div class="card-body" id="entretien-parcours"></div>
      </div>

      <div class="card" data-accent="green">
        <div class="card-header">
          <h2>Motivation & Drivers</h2>
          <span class="edit-hint">cliquer pour modifier</span>
        </div>
        <div class="card-body" id="entretien-motivation"></div>
      </div>

      <div class="card" data-accent="purple">
        <div class="card-header">
          <h2>Lecture recruteur</h2>
          <span class="edit-hint">cliquer pour modifier</span>
        </div>
        <div class="card-body" id="entretien-lecture"></div>
      </div>
    `;

    UI.inlineEdit('entretien-synthese', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'synthese_30s', label: 'Synthèse', type: 'textarea', render: (v) => v ? `<span style="white-space:pre-wrap;">${UI.escHtml(v)}</span>` : '' }
      ]
    });

    UI.inlineEdit('entretien-parcours', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'parcours_cible', label: 'Parcours cible', type: 'textarea', render: (v) => v ? `<span style="white-space:pre-wrap;">${UI.escHtml(v)}</span>` : '' }
      ]
    });

    UI.inlineEdit('entretien-motivation', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'motivation_changement', label: 'Motivation changement', type: 'text' },
        { key: 'motivation_drivers', label: 'Drivers', type: 'textarea', render: (v) => v ? `<span style="white-space:pre-wrap;">${UI.escHtml(v)}</span>` : '' }
      ]
    });

    UI.inlineEdit('entretien-lecture', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'fit_poste', label: 'Fit poste', type: 'text' },
        { key: 'fit_culture', label: 'Fit culture', type: 'text' },
        { key: 'risques', label: 'Risques', type: 'text' },
        { key: 'lecture_recruteur', label: 'Lecture recruteur', type: 'textarea', render: (v) => v ? `<span style="white-space:pre-wrap;">${UI.escHtml(v)}</span>` : '' }
      ]
    });
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
    const actions = Store.filter('actions', a => a.candidat_id === id)
      .sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''));
    const todayStr = new Date().toISOString().split('T')[0];

    document.getElementById('tab-actions').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Historique des actions (${actions.length})</h2>
          <button class="btn btn-sm btn-primary" id="btn-new-action">+ Action</button>
        </div>
        <div class="card-body">
          <div id="candidat-actions-table"></div>
        </div>
      </div>
    `;

    UI.dataTable('candidat-actions-table', {
      columns: [
        { key: 'action', label: 'Action', render: r => {
          const overdue = (r.statut === 'À faire' || r.statut === 'A faire') && r.date_action && r.date_action < todayStr;
          return `<strong${overdue ? ' style="color:#dc2626;"' : ''}>${UI.escHtml(r.action || '')}</strong>`;
        }},
        { key: 'type_action', label: 'Type', render: r => `<span style="font-size:0.75rem;color:#64748b;">${UI.escHtml(r.type_action || '')}</span>` },
        { key: 'canal', label: 'Canal', render: r => UI.badge(r.canal) },
        { key: 'date_action', label: 'Date', render: r => UI.formatDate(r.date_action) },
        { key: 'next_step', label: 'Next step', render: r => r.next_step ? `<span style="font-size:0.75rem;color:#c9a000;">→ ${UI.escHtml(r.next_step)}</span>` : '' },
        { key: 'statut', label: 'Statut', render: r => UI.statusBadge(r.statut || 'À faire', ['À faire', 'En cours', 'Fait', 'Annulé'], { entity: 'actions', recordId: r.id, fieldName: 'statut', onUpdate: () => renderActions() }) },
      ],
      data: actions,
      onRowClick: (actionId) => showActionDetail(actionId),
      emptyMessage: 'Aucune action enregistrée'
    });

    document.getElementById('btn-new-action')?.addEventListener('click', (e) => {
      e.stopPropagation();
      newAction();
    });
  }

  // Show action detail modal (consult / edit / delete)
  function showActionDetail(actionId) {
    const action = Store.findById('actions', actionId);
    if (!action) return;
    const missionName = action.mission_id ? (Store.resolve('missions', action.mission_id)?.displayName || '') : '';

    const bodyHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div><div style="font-size:0.75rem;font-weight:600;color:#64748b;">Action</div><div style="font-size:0.875rem;">${UI.escHtml(action.action || '—')}</div></div>
        <div><div style="font-size:0.75rem;font-weight:600;color:#64748b;">Type</div><div style="font-size:0.875rem;">${UI.escHtml(action.type_action || '—')}</div></div>
        <div><div style="font-size:0.75rem;font-weight:600;color:#64748b;">Canal</div><div>${UI.badge(action.canal)}</div></div>
        <div><div style="font-size:0.75rem;font-weight:600;color:#64748b;">Statut</div><div>${UI.badge(action.statut)}</div></div>
        <div><div style="font-size:0.75rem;font-weight:600;color:#64748b;">Date</div><div style="font-size:0.875rem;">${UI.formatDate(action.date_action)}</div></div>
        <div><div style="font-size:0.75rem;font-weight:600;color:#64748b;">Réponse</div><div style="font-size:0.875rem;">${action.reponse ? '<span style="color:#16a34a;font-weight:600;">Oui</span>' : 'Non'}</div></div>
        ${missionName ? `<div><div style="font-size:0.75rem;font-weight:600;color:#64748b;">Mission</div><div style="font-size:0.875rem;">${UI.escHtml(missionName)}</div></div>` : ''}
        ${action.date_relance ? `<div><div style="font-size:0.75rem;font-weight:600;color:#64748b;">Relance</div><div style="font-size:0.875rem;">${UI.formatDate(action.date_relance)}</div></div>` : ''}
      </div>
      ${action.message_notes ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:0.75rem;font-weight:600;color:#64748b;margin-bottom:4px;">Message / Notes</div>
          <div style="background:#f8fafc;border-radius:8px;padding:12px;font-size:0.8125rem;white-space:pre-wrap;max-height:300px;overflow-y:auto;border:1px solid #e2e8f0;">${UI.escHtml(action.message_notes)}</div>
        </div>
      ` : ''}
      ${action.next_step ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:0.75rem;font-weight:600;color:#c9a000;margin-bottom:4px;">→ Next step</div>
          <div style="font-size:0.875rem;">${UI.escHtml(action.next_step)}</div>
        </div>
      ` : ''}
      <div style="display:flex;gap:8px;border-top:1px solid #e2e8f0;padding-top:16px;">
        <button class="btn btn-primary btn-sm" id="action-edit-btn" style="flex:1;">✏️ Modifier</button>
        <button class="btn btn-secondary btn-sm" id="action-toggle-btn" style="flex:1;">${action.statut === 'Fait' ? '↩️ Remettre à faire' : '✅ Marquer fait'}</button>
        <button class="btn btn-danger btn-sm" id="action-delete-btn">🗑️ Supprimer</button>
      </div>
    `;

    const { close } = UI.modal('Détail de l\'action', bodyHtml, { width: 560 });

    setTimeout(() => {
      document.getElementById('action-edit-btn')?.addEventListener('click', () => {
        close();
        showEditActionModal(action);
      });
      document.getElementById('action-toggle-btn')?.addEventListener('click', async () => {
        const newStatut = action.statut === 'Fait' ? 'À faire' : 'Fait';
        await Store.update('actions', actionId, { statut: newStatut });
        UI.toast('Statut mis à jour');
        close();
        location.reload();
      });
      document.getElementById('action-delete-btn')?.addEventListener('click', () => {
        close();
        UI.modal('Confirmer la suppression', `<p style="color:#dc2626;">Supprimer l'action « ${UI.escHtml(action.action)} » ?</p>`, {
          saveLabel: 'Supprimer',
          onSave: async () => {
            await Store.remove('actions', actionId);
            UI.toast('Action supprimée');
            location.reload();
          }
        });
      });
    }, 50);
  }

  // Edit action modal (full form)
  function showEditActionModal(a) {
    const allMissions = Store.get('missions');
    const tplOpts = typeof TEMPLATES !== 'undefined' ? Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${t.icon} ${t.title}</option>`).join('') : '';

    UI.modal('Modifier l\'action', `
      <div class="form-group"><label>Action</label><input type="text" id="ea-action" value="${UI.escHtml(a.action || '')}" /></div>
      <div class="form-row">
        <div class="form-group"><label>Type</label><select id="ea-type">${Referentiels.get('action_types').map(s=>`<option value="${s}" ${a.type_action===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="form-group"><label>Canal</label><select id="ea-canal">${Referentiels.get('action_canaux').map(s=>`<option value="${s}" ${a.canal===s?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Statut</label><select id="ea-statut"><option value="À faire" ${(a.statut==='À faire'||a.statut==='A faire')?'selected':''}>À faire</option><option value="En cours" ${a.statut==='En cours'?'selected':''}>En cours</option><option value="Fait" ${a.statut==='Fait'?'selected':''}>Fait</option><option value="Annulé" ${a.statut==='Annulé'?'selected':''}>Annulé</option></select></div>
        <div class="form-group"><label>Date</label><input type="date" id="ea-date" value="${a.date_action || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Mission</label><select id="ea-mission"><option value="">— Aucune —</option>${allMissions.map(m=>`<option value="${m.id}" ${a.mission_id===m.id?'selected':''}>${UI.escHtml(m.nom||m.ref)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Réponse</label><select id="ea-reponse"><option value="false" ${!a.reponse?'selected':''}>Non</option><option value="true" ${a.reponse?'selected':''}>Oui</option></select></div>
      </div>
      ${tplOpts ? `<div class="form-group" style="background:#FFFDF0;border:1px solid #FEE566;border-radius:8px;padding:12px;"><label style="color:#c9a000;">📋 Trame</label><select id="ea-template"><option value="">—</option>${tplOpts}</select><div id="ea-tpl-preview" style="display:none;max-height:150px;overflow-y:auto;font-size:0.8125rem;background:#fff;border-radius:6px;padding:8px;border:1px solid #e2e8f0;margin-top:8px;"></div></div>` : ''}
      <div class="form-group"><label>Message / Notes</label><textarea id="ea-notes" style="min-height:120px;">${UI.escHtml(a.message_notes || '')}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Next step</label><input type="text" id="ea-next" value="${UI.escHtml(a.next_step || '')}" /></div>
        <div class="form-group"><label>Relance</label><input type="date" id="ea-relance" value="${a.date_relance || ''}" /></div>
      </div>
    `, {
      width: 640,
      draftKey: 'action_edit_' + a.id,
      onSave: async (overlay) => {
        await Store.update('actions', a.id, {
          action: overlay.querySelector('#ea-action').value.trim(),
          type_action: overlay.querySelector('#ea-type').value,
          canal: overlay.querySelector('#ea-canal').value,
          statut: overlay.querySelector('#ea-statut').value,
          date_action: overlay.querySelector('#ea-date').value,
          mission_id: overlay.querySelector('#ea-mission').value || null,
          reponse: overlay.querySelector('#ea-reponse').value === 'true',
          message_notes: overlay.querySelector('#ea-notes').value.trim(),
          next_step: overlay.querySelector('#ea-next').value.trim(),
          date_relance: overlay.querySelector('#ea-relance').value || null,
        });
        UI.toast('Action mise à jour');
        location.reload();
      }
    });
    // Template inject for edit
    setTimeout(() => {
      const sel = document.getElementById('ea-template');
      const prev = document.getElementById('ea-tpl-preview');
      if (sel && prev) sel.addEventListener('change', () => {
        const k = sel.value;
        if (k && TEMPLATES[k]) {
          prev.style.display = 'block';
          prev.innerHTML = renderTemplate(k) + '<button class="btn btn-primary btn-sm" id="ea-tpl-inject" style="margin-top:6px;width:100%;">Insérer</button>';
          document.getElementById('ea-tpl-inject').addEventListener('click', (e) => {
            e.preventDefault();
            const n = document.getElementById('ea-notes');
            n.value = n.value + (n.value ? '\n\n' : '') + renderTemplateText(k);
            prev.innerHTML = '<div style="color:#16a34a;text-align:center;padding:6px;">✓ Insérée</div>';
            setTimeout(() => { prev.style.display = 'none'; sel.value = ''; }, 1200);
          });
        } else prev.style.display = 'none';
      });
    }, 100);
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

  function renderDocuments() {
    document.getElementById('tab-documents').innerHTML = '<div id="candidat-documents"></div>';
    UI.documentsSection('candidat-documents', {
      entity: 'candidats',
      recordId: id,
      docTypesKey: 'document_types_candidat',
    });
  }

  function renderSidebar() {
    const entreprise = candidat.entreprise_actuelle_id ? Store.resolve('entreprises', candidat.entreprise_actuelle_id) : null;
    const decideurs = (candidat.decideur_connu_ids || []).map(did => Store.resolve('decideurs', did)).filter(Boolean);
    const lies = (candidat.candidats_lies_ids || []).map(cid => Store.resolve('candidats', cid)).filter(Boolean);

    document.getElementById('candidat-sidebar').innerHTML = `
      <div class="card-header"><h2>Liens rapides</h2></div>
      <div class="card-body">
        <div id="candidat-decideur-link"></div>

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

        ${candidat.linkedin || candidat.profile_code || candidat.google_drive_url ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Liens externes</div>
            ${candidat.linkedin ? `<a href="${UI.escHtml(candidat.linkedin)}" target="_blank" class="entity-link">LinkedIn</a><br/>` : ''}
            ${candidat.google_drive_url ? `<a href="${UI.escHtml(candidat.google_drive_url)}" target="_blank" class="entity-link" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>Google Drive</a><br/>` : ''}
            ${candidat.profile_code ? `<a href="https://amarillo-dsi-profile.netlify.app/?session=${UI.escHtml(candidat.profile_code)}" target="_blank" class="entity-link" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>Profiling Amarillo™ (${UI.escHtml(candidat.profile_code)})</a>` : ''}
          </div>
        ` : ''}

        <div id="entreprises-cibles" style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;"></div>

        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;">
          <div style="font-size:0.75rem;color:#94a3b8;">
            Créé le ${UI.formatDate(candidat.created_at)}<br/>
            Modifié le ${UI.formatDate(candidat.updated_at)}
          </div>
        </div>
      </div>
    `;

    // Init double casquette candidat/décideur
    UI.candidatDecideurLink('candidat-decideur-link', id);
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
        location.reload();
      }
    });
  };

  // New action for this candidat
  window.newAction = function() {
    const missions = Store.get('missions');
    const templateOptions = typeof TEMPLATES !== 'undefined' ? Object.entries(TEMPLATES).map(([key, tpl]) =>
      `<option value="${key}">${tpl.icon} ${tpl.title}</option>`
    ).join('') : '';

    UI.modal('Nouvelle action', `
      <div class="form-group">
        <label>Action</label>
        <input type="text" id="a-action" placeholder="Ex: Message LinkedIn, Appel..." />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select id="a-type">
            ${Referentiels.get('action_types').map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Canal</label>
          <select id="a-canal">
            ${Referentiels.get('action_canaux').map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="a-statut">
            <option value="À faire">À faire</option>
            <option value="Fait" selected>Fait</option>
          </select>
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="a-date" value="${new Date().toISOString().split('T')[0]}" />
        </div>
      </div>
      <div class="form-group">
        <label>Mission liée</label>
        <select id="a-mission">
          <option value="">— Aucune —</option>
          ${missions.map(m => `<option value="${m.id}">${UI.escHtml(m.nom || m.ref)}</option>`).join('')}
        </select>
      </div>
      ${templateOptions ? `
      <div class="form-group" style="background:#FFFDF0;border:1px solid #FEE566;border-radius:8px;padding:12px;">
        <label style="color:#c9a000;">📋 Utiliser une trame</label>
        <select id="a-template" style="margin-bottom:8px;">
          <option value="">— Choisir un template —</option>
          ${templateOptions}
        </select>
        <div id="a-template-preview" style="display:none;max-height:200px;overflow-y:auto;font-size:0.8125rem;color:#475569;background:#fff;border-radius:6px;padding:10px;border:1px solid #e2e8f0;"></div>
      </div>
      ` : ''}
      <div class="form-group">
        <label>Message / Notes</label>
        <textarea id="a-notes" style="min-height:120px;"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Next step</label>
          <input type="text" id="a-next" />
        </div>
        <div class="form-group">
          <label>Date relance</label>
          <input type="date" id="a-relance" />
        </div>
      </div>
    `, {
      draftKey: 'action_new_cand_' + id,
      onSave: async (overlay) => {
        const action = {
          id: API.generateId('act'),
          action: overlay.querySelector('#a-action').value.trim(),
          type_action: overlay.querySelector('#a-type').value,
          canal: overlay.querySelector('#a-canal').value,
          statut: overlay.querySelector('#a-statut').value,
          phase: 'Qualification',
          date_action: overlay.querySelector('#a-date').value,
          candidat_id: id,
          mission_id: overlay.querySelector('#a-mission').value || null,
          decideur_id: null,
          entreprise_id: null,
          message_notes: overlay.querySelector('#a-notes').value.trim(),
          next_step: overlay.querySelector('#a-next').value.trim(),
          date_relance: overlay.querySelector('#a-relance') ? overlay.querySelector('#a-relance').value || null : null,
          reponse: false,
          priorite: null,
          finalite: '',
          objectif: '',
          moment_suivi: '',
        };
        await Store.add('actions', action);
        UI.toast('Action créée');
        location.reload();
      }
    });

    // Template selector handler
    setTimeout(() => {
      const tplSelect = document.getElementById('a-template');
      const tplPreview = document.getElementById('a-template-preview');
      if (tplSelect && tplPreview) {
        tplSelect.addEventListener('change', () => {
          const key = tplSelect.value;
          if (key && typeof TEMPLATES !== 'undefined' && TEMPLATES[key]) {
            tplPreview.style.display = 'block';
            tplPreview.innerHTML = renderTemplate(key) +
              '<button class="btn btn-primary btn-sm" id="tpl-inject" style="margin-top:8px;width:100%;">Insérer dans les notes</button>';
            document.getElementById('tpl-inject').addEventListener('click', (e) => {
              e.preventDefault();
              const notesArea = document.getElementById('a-notes');
              const text = renderTemplateText(key);
              const current = notesArea.value;
              notesArea.value = current + (current ? '\n\n' : '') + text;
              notesArea.style.minHeight = '300px';
              tplPreview.innerHTML = '<div style="color:#16a34a;font-weight:600;text-align:center;padding:8px;">✓ Trame insérée</div>';
              setTimeout(() => { tplPreview.style.display = 'none'; tplSelect.value = ''; }, 1500);
            });
          } else {
            tplPreview.style.display = 'none';
          }
        });
      }
    }, 100);
  };


  // ============================================================
  // PRÉSENTATIONS — suivi des envois de CV aux entreprises
  // ============================================================
  function renderPresentations() {
    const presentations = candidat.presentations || [];
    const entreprises = Store.get('entreprises');

    document.getElementById('tab-presentations').innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Présentations aux entreprises (${presentations.length})</h2>
          <button class="btn btn-sm btn-primary" id="btn-add-presentation">+ Présentation</button>
        </div>
        <div class="card-body">
          <div id="presentations-list"></div>
        </div>
      </div>
    `;

    const container = document.getElementById('presentations-list');
    if (presentations.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Aucune présentation enregistrée</p></div>';
    } else {
      container.innerHTML = `
        <div class="data-table-wrapper"><table class="data-table"><thead><tr>
          <th>Entreprise</th><th>Date d'envoi</th><th>Anonymisé</th><th>Statut retour</th><th>Notes</th><th></th>
        </tr></thead><tbody>
        ${presentations.map((p, idx) => {
          const ent = p.entreprise_id ? Store.resolve('entreprises', p.entreprise_id) : null;
          return `<tr>
            <td><strong>${ent ? UI.entityLink('entreprises', ent.id, ent.displayName) : UI.escHtml(p.entreprise_nom || '—')}</strong></td>
            <td>${UI.formatDate(p.date_envoi)}</td>
            <td>${p.anonymise ? '<span style="color:#c9a000;font-weight:600;">Oui</span>' : 'Non'}</td>
            <td>${UI.badge(p.statut_retour || 'En attente')}</td>
            <td style="font-size:0.75rem;color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${UI.escHtml(p.notes || '')}</td>
            <td><button class="btn btn-sm btn-danger" data-pres-delete="${idx}">✕</button></td>
          </tr>`;
        }).join('')}
        </tbody></table></div>
      `;

      // Delete handlers
      container.querySelectorAll('[data-pres-delete]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.presDelete);
          const updated = [...presentations];
          updated.splice(idx, 1);
          await Store.update('candidats', id, { presentations: updated });
          UI.toast('Présentation supprimée');
          location.reload();
        });
      });
    }

    // Add presentation button
    document.getElementById('btn-add-presentation').addEventListener('click', () => {
      UI.modal('Nouvelle présentation', `
        <div class="form-group">
          <label>Entreprise</label>
          <input type="text" id="pres-entreprise-search" placeholder="Tapez pour rechercher..." />
          <input type="hidden" id="pres-entreprise-id" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date d'envoi</label>
            <input type="date" id="pres-date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="form-group">
            <label>Anonymisé ?</label>
            <select id="pres-anonymise">
              <option value="true">Oui — profil anonymisé</option>
              <option value="false">Non — nom complet</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Statut retour</label>
          <select id="pres-statut">
            <option value="En attente">En attente</option>
            <option value="Intéressé">Intéressé</option>
            <option value="Entretien planifié">Entretien planifié</option>
            <option value="Refusé">Refusé</option>
            <option value="Offre">Offre</option>
          </select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="pres-notes" placeholder="Contact, contexte..."></textarea>
        </div>
      `, {
        onSave: async (overlay) => {
          const entId = overlay.querySelector('#pres-entreprise-id').value;
          const entSearch = overlay.querySelector('#pres-entreprise-search').value.trim();
          const pres = {
            entreprise_id: entId || null,
            entreprise_nom: entSearch,
            date_envoi: overlay.querySelector('#pres-date').value,
            anonymise: overlay.querySelector('#pres-anonymise').value === 'true',
            statut_retour: overlay.querySelector('#pres-statut').value,
            notes: overlay.querySelector('#pres-notes').value.trim(),
          };
          const updated = [...(candidat.presentations || []), pres];
          await Store.update('candidats', id, { presentations: updated });
          UI.toast('Présentation ajoutée');
          location.reload();
        }
      });
      // Init autocomplete for entreprise
      UI.entrepriseAutocomplete('pres-entreprise-search', 'pres-entreprise-id');
    });
  }

  // ============================================================
  // ENTREPRISES CIBLÉES — souhait candidat + ciblage recruteur
  // ============================================================
  function renderEntreprisesCibles() {
    const container = document.getElementById('entreprises-cibles');
    if (!container) return;

    const cibles = candidat.entreprises_cibles || [];
    const entreprises = Store.get('entreprises');

    let html = `
      <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Entreprises ciblées</div>
      <div id="cibles-list" style="margin-bottom:8px;">
    `;

    if (cibles.length === 0) {
      html += '<div style="font-size:0.75rem;color:#94a3b8;font-style:italic;margin-bottom:8px;">Aucune entreprise ciblée</div>';
    } else {
      cibles.forEach((c, idx) => {
        const ent = c.entreprise_id ? Store.resolve('entreprises', c.entreprise_id) : null;
        const label = ent ? ent.displayName : c.entreprise_nom;
        const icon = c.source === 'candidat' ? '💬' : '🎯';
        const sourceLabel = c.source === 'candidat' ? 'Souhait candidat' : 'Ciblage recruteur';
        html += `
          <div class="cible-item" data-cible-idx="${idx}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:4px;cursor:pointer;transition:all 0.15s;"
            onmouseenter="this.style.borderColor='#dc2626';this.querySelector('.cible-x').style.display='inline'"
            onmouseleave="this.style.borderColor='#e2e8f0';this.querySelector('.cible-x').style.display='none'">
            <span title="${sourceLabel}">${icon}</span>
            <div style="flex:1;min-width:0;">
              ${ent ? `<a href="entreprise.html?id=${ent.id}" class="entity-link" style="font-size:0.8125rem;" onclick="event.stopPropagation()">${UI.escHtml(label)}</a>` : `<span style="font-size:0.8125rem;">${UI.escHtml(label)}</span>`}
              <div style="font-size:0.6875rem;color:#94a3b8;">${sourceLabel}</div>
            </div>
            <span class="cible-x" style="display:none;color:#dc2626;font-weight:700;cursor:pointer;font-size:1rem;" title="Retirer">✕</span>
          </div>
        `;
      });
    }

    html += `</div>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-sm btn-secondary" id="btn-add-cible-candidat" style="flex:1;font-size:0.6875rem;">💬 Souhait</button>
        <button class="btn btn-sm btn-secondary" id="btn-add-cible-recruteur" style="flex:1;font-size:0.6875rem;">🎯 Ciblage</button>
      </div>
    `;

    container.innerHTML = html;

    // Click on item to remove
    container.querySelectorAll('.cible-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.closest('a')) return; // don't intercept link
        const idx = parseInt(item.dataset.cibleIdx);
        const updated = [...cibles];
        updated.splice(idx, 1);
        await Store.update('candidats', id, { entreprises_cibles: updated });
        UI.toast('Entreprise retirée');
        renderEntreprisesCibles(); // re-render in place
      });
    });

    // Add cible buttons
    function showAddCibleModal(source) {
      const sourceLabel = source === 'candidat' ? 'Souhait candidat' : 'Ciblage recruteur';
      UI.modal(`Ajouter une entreprise (${sourceLabel})`, `
        <div class="form-group">
          <label>Entreprise</label>
          <input type="text" id="cible-ent-search" placeholder="Tapez pour rechercher ou créer..." />
          <input type="hidden" id="cible-ent-id" />
        </div>
      `, {
        saveLabel: 'Ajouter',
        onSave: async (overlay) => {
          const entId = overlay.querySelector('#cible-ent-id').value;
          const entNom = overlay.querySelector('#cible-ent-search').value.trim();
          if (!entNom) return;
          // Check not already in list
          const alreadyExists = cibles.some(c =>
            (c.entreprise_id && c.entreprise_id === entId) ||
            (!c.entreprise_id && c.entreprise_nom === entNom)
          );
          if (alreadyExists) {
            UI.toast('Déjà dans la liste', 'error');
            return;
          }
          const newCible = { entreprise_id: entId || null, entreprise_nom: entNom, source };
          const updated = [...cibles, newCible];
          await Store.update('candidats', id, { entreprises_cibles: updated });
          candidat.entreprises_cibles = updated; // update local ref
          UI.toast('Entreprise ajoutée');
          renderEntreprisesCibles();
        }
      });
      UI.entrepriseAutocomplete('cible-ent-search', 'cible-ent-id');
    }

    document.getElementById('btn-add-cible-candidat')?.addEventListener('click', () => showAddCibleModal('candidat'));
    document.getElementById('btn-add-cible-recruteur')?.addEventListener('click', () => showAddCibleModal('recruteur'));
  }

  // ============================================================
  // TEMPS DE TRAJET — drawer with mini-map
  // ============================================================
  function renderTrajetButton() {
    const container = document.getElementById('trajet-button-container');
    if (!container) return;

    const isMobile = Geocoder.isMobile(candidat.localisation);

    if (isMobile) {
      container.innerHTML = `<span class="badge" style="background:#dbeafe;color:#1d4ed8;">Mobile — ${UI.escHtml(candidat.localisation || '')}</span>`;
      return;
    }

    const hasLocation = candidat.localisation || candidat.ville;
    if (!hasLocation) {
      container.innerHTML = '<span style="font-size:0.75rem;color:#94a3b8;font-style:italic;">Ajoutez une adresse pour calculer les temps de trajet</span>';
      return;
    }

    container.innerHTML = `<button class="btn btn-sm btn-secondary" id="btn-trajet" style="gap:6px;">
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
      Temps de trajet
    </button>`;

    document.getElementById('btn-trajet').addEventListener('click', openTrajetDrawer);
  }

  async function openTrajetDrawer() {
    // Init routing
    const config = API.getConfig();
    if (config.orsApiKey || ATS_CONFIG.orsApiKey) {
      Routing.init(config.orsApiKey || ATS_CONFIG.orsApiKey);
    }

    // Geocode candidate
    const candidatCoords = await Geocoder.geocode(candidat);
    if (!candidatCoords) {
      UI.toast('Impossible de localiser ce candidat', 'error');
      return;
    }

    const drawerContent = `
      <div id="trajet-map" style="height:280px;border-radius:8px;margin-bottom:16px;background:#f1f5f9;"></div>
      <div style="margin-bottom:16px;">
        <label style="font-size:0.8125rem;font-weight:600;color:#475569;display:block;margin-bottom:4px;">Ajouter une entreprise</label>
        <div style="position:relative;">
          <input type="text" id="trajet-ent-search" placeholder="Tapez pour rechercher..." style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.875rem;" />
        </div>
      </div>
      <div id="trajet-results" style="display:flex;flex-direction:column;gap:8px;"></div>
    `;

    const { panel, close } = UI.drawer(`Temps de trajet — ${candidat.prenom || ''} ${candidat.nom || ''}`, drawerContent, { width: 480 });

    // Init mini-map after DOM is ready
    setTimeout(() => {
      const miniMap = L.map('trajet-map', { zoomControl: true }).setView([candidatCoords.lat, candidatCoords.lng], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM',
        maxZoom: 18
      }).addTo(miniMap);

      // Candidate marker
      L.circleMarker([candidatCoords.lat, candidatCoords.lng], {
        radius: 8,
        fillColor: '#3b82f6',
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9
      }).addTo(miniMap).bindTooltip(`${UI.escHtml((candidat.prenom || '') + ' ' + (candidat.nom || ''))}`, { permanent: true, direction: 'top', offset: [0, -10], className: 'carte-tooltip' });

      // Track added entreprises
      const addedEntreprises = [];
      const entMarkers = [];

      // Enterprise autocomplete
      const searchInput = panel.querySelector('#trajet-ent-search');
      const resultsContainer = panel.querySelector('#trajet-results');
      let dropdown = null;

      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        if (dropdown) dropdown.remove();
        if (q.length < 1) return;

        const allEnts = Store.get('entreprises');
        const matches = allEnts.filter(e => (e.nom || '').toLowerCase().includes(q)).slice(0, 8);

        dropdown = document.createElement('div');
        dropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:200;max-height:200px;overflow-y:auto;';

        matches.forEach(e => {
          const item = document.createElement('div');
          item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;border-bottom:1px solid #f1f5f9;';
          item.innerHTML = `<strong>${UI.escHtml(e.nom)}</strong> <span style="color:#64748b;font-size:0.75rem;">${UI.escHtml(e.localisation || '')}</span>`;
          item.addEventListener('mousedown', async (ev) => {
            ev.preventDefault();
            searchInput.value = '';
            if (dropdown) dropdown.remove();
            dropdown = null;
            await addEntreprise(e);
          });
          item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
          item.addEventListener('mouseleave', () => item.style.background = '#fff');
          dropdown.appendChild(item);
        });

        searchInput.parentElement.appendChild(dropdown);
      });

      searchInput.addEventListener('blur', () => {
        setTimeout(() => { if (dropdown) { dropdown.remove(); dropdown = null; } }, 200);
      });

      async function addEntreprise(ent) {
        if (addedEntreprises.find(e => e.id === ent.id)) {
          UI.toast('Entreprise déjà ajoutée', 'error');
          return;
        }

        const entCoords = await Geocoder.geocodeLocation(ent.localisation);
        if (!entCoords) {
          UI.toast('Impossible de localiser cette entreprise', 'error');
          return;
        }

        // Add marker
        const marker = L.marker([entCoords.lat, entCoords.lng], {
          icon: L.divIcon({
            className: 'entreprise-marker-icon',
            html: '<div style="width:14px;height:14px;background:#10b981;border:2px solid #fff;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        }).addTo(miniMap);

        // Add dashed line
        const line = L.polyline([[candidatCoords.lat, candidatCoords.lng], [entCoords.lat, entCoords.lng]], {
          color: '#10b981',
          weight: 2,
          dashArray: '6, 8',
          opacity: 0.6
        }).addTo(miniMap);

        entMarkers.push(marker, line);

        // Calculate driving time
        const loadingId = `trajet-loading-${ent.id}`;
        const resultEl = document.createElement('div');
        resultEl.id = `trajet-result-${ent.id}`;
        resultEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <div>
              <div style="font-weight:600;font-size:0.8125rem;">${UI.escHtml(ent.nom)}</div>
              <div style="font-size:0.6875rem;color:#64748b;">${UI.escHtml(ent.localisation || '')}</div>
            </div>
            <div id="${loadingId}" style="font-size:0.8125rem;color:#94a3b8;">Calcul...</div>
          </div>
        `;
        resultsContainer.appendChild(resultEl);
        addedEntreprises.push(ent);

        // Fit bounds to show all markers
        const allPoints = [[candidatCoords.lat, candidatCoords.lng], [entCoords.lat, entCoords.lng]];
        addedEntreprises.forEach((ae, i) => {
          // Already added to markers
        });
        miniMap.fitBounds(L.latLngBounds(
          [candidatCoords, ...entMarkers.filter(m => m instanceof L.Marker).map(m => m.getLatLng())]
        ), { padding: [30, 30] });

        // Get driving time
        const durations = await Routing.matrix(candidatCoords, [entCoords]);
        const loadEl = document.getElementById(loadingId);
        if (loadEl && durations && durations[0] !== null) {
          const dur = durations[0];
          const color = Routing.durationColor(dur);
          loadEl.innerHTML = `<span style="font-weight:700;color:${color};">${Routing.formatDuration(dur)}</span><br/><span style="font-size:0.6875rem;color:#94a3b8;">en voiture</span>`;
          marker.bindTooltip(`${UI.escHtml(ent.nom)}<br/><strong style="color:${color};">${Routing.formatDuration(dur)}</strong>`, { direction: 'top', offset: [0, -8], className: 'carte-tooltip' });
        } else if (loadEl) {
          loadEl.textContent = 'Erreur';
        }
      }

      // Invalidate map size after drawer animation
      setTimeout(() => miniMap.invalidateSize(), 350);
    }, 50);
  }
})();
