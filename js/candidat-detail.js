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
  renderDSIProfile();

  // Refresh header + sidebar after any inline edit that affects them
  function refreshDependentViews() {
    renderHeader();
    renderSidebar();
  }

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
          <button class="btn btn-secondary btn-sm" id="btn-export-pdf" title="Exporter la fiche en PDF">PDF</button>
          <button class="btn btn-secondary btn-sm" id="btn-teaser-pdf" title="G\u00E9n\u00E9rer le Teaser Talent \u00E0 Impact (anonymis\u00E9)" style="background:#1e293b;color:#FECC02;border-color:#1e293b;">Teaser</button>
          <button class="btn btn-secondary btn-sm" id="btn-dossier-pdf" title="Dossier complet de pr\u00E9sentation" style="background:#2D6A4F;color:#fff;border-color:#2D6A4F;">Dossier</button>
          <button class="btn btn-secondary btn-sm" id="btn-templates">Trames</button>
          <button class="btn btn-danger btn-sm" id="btn-delete-candidat" title="Supprimer ce candidat">Suppr.</button>
          <span class="autosave-indicator saved"><span class="sync-dot"></span> Auto-save</span>
        </div>
      </div>
    `;

    document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
      try {
        UI.toast('Generation du PDF en cours...');
        const dsiResult = candidat.profile_code ? await DSIProfile.fetchProfile(candidat.profile_code) : null;
        const entreprise = candidat.entreprise_actuelle_id ? Store.resolve('entreprises', candidat.entreprise_actuelle_id) : null;
        const doc = PDFEngine.generateCandidatSummary(candidat, { dsiResult, entreprise });
        const filename = `Fiche_${(candidat.prenom||'').replace(/\s/g,'_')}_${(candidat.nom||'').replace(/\s/g,'_')}.pdf`;
        PDFEngine.download(doc, filename);
        UI.toast('PDF telecharge');
      } catch (e) {
        console.error('PDF generation error:', e);
        UI.toast('Erreur lors de la generation du PDF : ' + e.message, 'error');
      }
    });

    document.getElementById('btn-teaser-pdf')?.addEventListener('click', async () => {
      try {
        UI.toast('Pr\u00E9paration du Teaser...');

        // Fetch DSI + company names en parallèle
        const [dsiResult, companyNames] = await Promise.all([
          candidat.profile_code ? DSIProfile.fetchProfile(candidat.profile_code) : null,
          Promise.resolve(Store.get('entreprises').map(e => e.nom).filter(Boolean)),
        ]);

        // Réécriture IA des notes internes (avec fallback silencieux)
        let aiPitch = null;
        const hasNotes = candidat.synthese_30s || candidat.parcours_cible || candidat.motivation_drivers;
        const apiKey = typeof CVParser !== 'undefined' && CVParser.getOpenAIKey ? CVParser.getOpenAIKey() : null;

        if (apiKey && hasNotes && typeof InterviewAnalyzer !== 'undefined') {
          try {
            UI.toast('R\u00E9\u00E9criture IA en cours...');
            const systemPrompt = `Tu es un consultant senior en executive search chez Amarillo Search.
On te donne des notes internes de recruteur sur un candidat.
R\u00E9\u00E9cris-les en 2 sections pour un document client professionnel ("Talent \u00E0 Impact").

R\u00E9ponds UNIQUEMENT avec un JSON :
{
  "synthese": "...",
  "projet": "..."
}

synthese (3-4 phrases max) : Pitch percutant du profil. Mets en avant les forces, l'exp\u00E9rience cl\u00E9, et la valeur ajout\u00E9e. Ton positif et vendeur. Ne mentionne AUCUN nom de personne ni d'entreprise.

projet (3-4 phrases max) : Ce que le candidat recherche et ce qui le motive, formul\u00E9 de mani\u00E8re \u00E0 rassurer un client. Ton professionnel. Ne mentionne AUCUN nom de personne ni d'entreprise.

R\u00E8gles :
- Texte brut, pas de markdown, pas de tirets, pas de listes
- Fran\u00E7ais professionnel
- JAMAIS de nom de candidat, d'entreprise ou de coordonn\u00E9es
- Si les notes sont vides ou insuffisantes, retourne des cha\u00EEnes vides`;

            const notesConcat = [
              candidat.synthese_30s || '',
              candidat.parcours_cible || '',
              candidat.motivation_drivers || ''
            ].filter(Boolean).join('\n\n');

            const userPrompt = `Notes d'entretien :\n${notesConcat.substring(0, 6000)}\n\nPoste actuel : ${candidat.poste_actuel || 'Non renseign\u00E9'}`;

            aiPitch = await InterviewAnalyzer._callOpenAI(systemPrompt, userPrompt);
          } catch (aiErr) {
            console.warn('AI rewriting failed, using raw notes:', aiErr.message);
            aiPitch = null;
          }
        }

        // Préparer les textes pour le modal d'édition
        const allCompanyNames = [...companyNames];
        if (candidat.entreprise_nom) allCompanyNames.push(candidat.entreprise_nom);
        if (candidat.entreprise_actuel) allCompanyNames.push(candidat.entreprise_actuel);

        const _anon = (t) => {
          if (!t) return '';
          let r = t;
          const sorted = [...allCompanyNames].filter(n => n && n.length >= 2).sort((a, b) => b.length - a.length);
          for (const name of sorted) {
            const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            r = r.replace(new RegExp(esc, 'gi'), '[entreprise confidentielle]');
          }
          return r;
        };

        const defaultSynthese = aiPitch?.synthese
          || _anon(candidat.synthese_30s || '');
        const defaultProjet = aiPitch?.projet
          || [_anon(candidat.parcours_cible || ''), _anon(candidat.motivation_drivers || '')].filter(Boolean).join('\n\n');

        // Afficher le modal d'édition avant génération
        const bodyHtml = `
          <p style="font-size:0.8125rem;color:#64748b;margin-bottom:16px;">
            Relisez et corrigez le contenu avant de g\u00E9n\u00E9rer le PDF. ${aiPitch ? '<span style="color:#16a36a;font-weight:600;">Texte retravaillé par IA.</span>' : '<span style="color:#e8a838;font-weight:600;">Texte brut (pas de cl\u00E9 IA configur\u00E9e).</span>'}
          </p>
          <div class="form-group">
            <label style="font-weight:600;">Synth\u00E8se <span style="font-weight:400;color:#94a3b8;font-size:0.75rem;">(pitch vendeur du profil)</span></label>
            <textarea id="teaser-synthese" rows="5" style="width:100%;resize:vertical;font-size:0.875rem;line-height:1.5;padding:10px;border:1px solid #e2e8f0;border-radius:8px;">${UI.escHtml(defaultSynthese)}</textarea>
          </div>
          <div class="form-group" style="margin-top:12px;">
            <label style="font-weight:600;">Projet professionnel <span style="font-weight:400;color:#94a3b8;font-size:0.75rem;">(motivations et recherche)</span></label>
            <textarea id="teaser-projet" rows="5" style="width:100%;resize:vertical;font-size:0.875rem;line-height:1.5;padding:10px;border:1px solid #e2e8f0;border-radius:8px;">${UI.escHtml(defaultProjet)}</textarea>
          </div>
        `;

        UI.modal('Teaser \u2014 Talent \u00E0 Impact', bodyHtml, {
          saveLabel: 'G\u00E9n\u00E9rer le PDF',
          width: 680,
          onSave: (overlay) => {
            const synthese = overlay.querySelector('#teaser-synthese').value.trim();
            const projet = overlay.querySelector('#teaser-projet').value.trim();

            const finalPitch = { synthese, projet };
            const doc = PDFEngine.generateTalentAImpact(candidat, { dsiResult, companyNames, aiPitch: finalPitch });
            const filename = `Talent_a_Impact_${(candidat.poste_actuel || 'Candidat').replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
            PDFEngine.download(doc, filename);
            UI.toast('Teaser PDF t\u00E9l\u00E9charg\u00E9');
          }
        });

      } catch (e) {
        console.error('Teaser PDF generation error:', e);
        UI.toast('Erreur lors de la g\u00E9n\u00E9ration du teaser : ' + e.message, 'error');
      }
    });

    document.getElementById('btn-dossier-pdf')?.addEventListener('click', async () => {
      try {
        UI.toast('G\u00E9n\u00E9ration du dossier complet...');
        const dsiResult = candidat.profile_code ? await DSIProfile.fetchProfile(candidat.profile_code) : null;
        const entreprise = candidat.entreprise_actuelle_id ? Store.resolve('entreprises', candidat.entreprise_actuelle_id) : null;
        const missionIds = candidat.missions_ids || [];
        const missions = missionIds.map(mid => Store.findById('missions', mid)).filter(Boolean);
        const actions = Store.filter('actions', a => a.candidat_id === id)
          .sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''));
        const doc = PDFEngine.generateCandidatPresentation(candidat, { dsiResult, entreprise, missions, actions });
        const filename = `Dossier_${(candidat.prenom || '').replace(/\s/g, '_')}_${(candidat.nom || '').replace(/\s/g, '_')}.pdf`;
        PDFEngine.download(doc, filename);
        UI.toast('Dossier PDF t\u00E9l\u00E9charg\u00E9');
      } catch (e) {
        console.error('Dossier PDF generation error:', e);
        UI.toast('Erreur lors de la g\u00E9n\u00E9ration du dossier : ' + e.message, 'error');
      }
    });

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

    // Check if CV completion feature is available
    const cvDoc = (candidat.documents || []).find(d => d.type === 'CV' && d.url);
    const hasDriveCv = cvDoc && typeof GoogleDrive !== 'undefined' && GoogleDrive.isConfigured();
    const hasOpenAI = typeof CVParser !== 'undefined' && CVParser.getOpenAIKey && CVParser.getOpenAIKey();
    const showCvCompletion = hasDriveCv || hasOpenAI;

    document.getElementById('tab-profil').innerHTML = `
      ${showCvCompletion ? `
      <div class="card" data-accent="blue" id="cv-completion-section" style="margin-bottom:16px;">
        <div class="card-header">
          <h2>Compléter le profil depuis le CV</h2>
          <span style="font-size:0.7rem;color:#94a3b8;">gpt-4o-mini</span>
        </div>
        <div class="card-body" style="padding:16px;">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            ${hasDriveCv ? `
            <button class="btn btn-primary" id="btn-cv-complete-drive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Compléter depuis le CV (Drive)
            </button>` : ''}
            <div id="cv-complete-drop-zone" style="border:2px dashed #e2e8f0;border-radius:8px;padding:10px 16px;text-align:center;cursor:pointer;transition:all 0.15s;display:inline-block;">
              <span style="font-size:0.8125rem;color:#64748b;">Ou glissez un CV ici</span>
              <input type="file" id="cv-complete-file" accept=".pdf,.txt,.text,.md" style="display:none;" />
            </div>
            ${!hasOpenAI ? `
            <button class="btn btn-sm btn-secondary" id="btn-cv-complete-config" style="font-size:0.6875rem;">Configurer clé OpenAI</button>` : ''}
          </div>
          <div id="cv-complete-status" style="margin-top:8px;font-size:0.8125rem;"></div>
        </div>
      </div>` : ''}
      <div class="card" data-accent="green">
        <div class="card-header">
          <h2>Informations générales</h2>
          <span class="edit-hint">cliquer sur un champ pour modifier</span>
        </div>
        <div class="card-body">
          <div class="inline-fields-grid" id="profil-info-fields"></div>
          <div id="dsi-profile-display"></div>
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
        refreshDependentViews();
        // When open_to_work changes, re-render full profile (date labels change)
        if (fieldKey === 'open_to_work') {
          renderProfil();
        }
        if (fieldKey === 'profile_code') {
          DSIProfile.clearCache(candidat.profile_code);
          renderDSIProfile();
        }
      }
    });

    // Inline editable — Contact
    UI.inlineEdit('profil-contact-fields', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'email', label: 'Email', type: 'text', render: (v) => v ? `<a href="mailto:${UI.escHtml(v)}" class="entity-link">${UI.escHtml(v)}</a>` : '' },
        { key: 'telephone', label: 'Téléphone', type: 'text', render: (v) => v ? `<a href="tel:${UI.escHtml(v)}" class="entity-link">${UI.escHtml(v)}</a>` : '' },
        { key: 'linkedin', label: 'LinkedIn', type: 'text', render: (v) => v ? `<a href="${UI.escHtml(UI.normalizeUrl(v))}" target="_blank" class="entity-link">Profil LinkedIn</a>` : '' },
        { key: 'google_drive_url', label: 'Google Drive', type: 'text', render: (v) => v ? `<a href="${UI.escHtml(UI.normalizeUrl(v))}" target="_blank" class="entity-link">Dossier Drive</a>` : '' },
        { key: 'adresse_ligne1', label: 'Adresse', type: 'text' },
        { key: 'code_postal', label: 'Code postal', type: 'text' },
        { key: 'ville', label: 'Ville', type: 'text' },
      ],
      onAfterSave: () => {
        refreshDependentViews();
      }
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
        // Re-render to update package totals + sidebar
        renderProfil();
        refreshDependentViews();
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

    // =============================================
    // CV Profile Completion — event handlers
    // =============================================

    if (showCvCompletion) {
      const cvCompleteStatus = document.getElementById('cv-complete-status');
      const cvCompleteDropZone = document.getElementById('cv-complete-drop-zone');
      const cvCompleteFileInput = document.getElementById('cv-complete-file');

      // Process a CV file: extract text, call OpenAI, show review modal
      async function processCvForCompletion(file) {
        const driveBtn = document.getElementById('btn-cv-complete-drive');
        if (driveBtn) driveBtn.disabled = true;
        cvCompleteDropZone.style.pointerEvents = 'none';
        cvCompleteStatus.innerHTML = '<span style="color:#64748b;"><span class="ia-spinner"></span> Analyse du CV en cours...</span>';

        try {
          if (!CVParser.getOpenAIKey()) {
            CVParser.showKeyConfigModal(() => {
              // Retry after key is set
              processCvForCompletion(file);
            });
            cvCompleteStatus.innerHTML = '';
            if (driveBtn) driveBtn.disabled = false;
            cvCompleteDropZone.style.pointerEvents = '';
            return;
          }

          const text = await CVParser.parseFile(file);
          if (!text || text.trim().length < 20) throw new Error('Fichier vide ou illisible');

          const extracted = await CVParser.extractWithOpenAI(text);
          showProfileReviewModal(extracted);

          cvCompleteStatus.innerHTML = '';
        } catch (err) {
          cvCompleteStatus.innerHTML = `<span style="color:#dc2626;">Erreur : ${UI.escHtml(err.message)}</span>`;
        } finally {
          const driveBtn2 = document.getElementById('btn-cv-complete-drive');
          if (driveBtn2) driveBtn2.disabled = false;
          if (cvCompleteDropZone) cvCompleteDropZone.style.pointerEvents = '';
        }
      }

      // Drive button
      document.getElementById('btn-cv-complete-drive')?.addEventListener('click', async () => {
        const match = cvDoc.url.match(/\/d\/([^/]+)/);
        if (!match) { UI.toast('URL Drive invalide', 'error'); return; }

        const driveBtn = document.getElementById('btn-cv-complete-drive');
        driveBtn.disabled = true;
        cvCompleteStatus.innerHTML = '<span style="color:#64748b;"><span class="ia-spinner"></span> Téléchargement depuis Drive...</span>';

        try {
          await GoogleDrive.authenticate();
          const downloaded = await GoogleDrive.downloadFile(match[1]);
          const file = new File([downloaded.blob], downloaded.name, { type: downloaded.mimeType });
          await processCvForCompletion(file);
        } catch (err) {
          cvCompleteStatus.innerHTML = `<span style="color:#dc2626;">Erreur Drive : ${UI.escHtml(err.message)}</span>`;
          driveBtn.disabled = false;
        }
      });

      // Drop zone
      cvCompleteDropZone.addEventListener('click', () => cvCompleteFileInput.click());
      cvCompleteDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        cvCompleteDropZone.style.borderColor = '#3b82f6';
        cvCompleteDropZone.style.background = '#eff6ff';
      });
      cvCompleteDropZone.addEventListener('dragleave', () => {
        cvCompleteDropZone.style.borderColor = '#e2e8f0';
        cvCompleteDropZone.style.background = '';
      });
      cvCompleteDropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        cvCompleteDropZone.style.borderColor = '#e2e8f0';
        cvCompleteDropZone.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file) await processCvForCompletion(file);
      });
      cvCompleteFileInput.addEventListener('change', async () => {
        if (cvCompleteFileInput.files[0]) await processCvForCompletion(cvCompleteFileInput.files[0]);
        cvCompleteFileInput.value = '';
      });

      // OpenAI key config button
      document.getElementById('btn-cv-complete-config')?.addEventListener('click', () => {
        CVParser.showKeyConfigModal();
      });
    }

    // Profile review modal — shows extracted CV data vs current values
    function showProfileReviewModal(extracted) {
      const PROFILE_FIELDS = [
        { key: 'prenom', label: 'Prénom' },
        { key: 'nom', label: 'Nom' },
        { key: 'email', label: 'Email' },
        { key: 'telephone', label: 'Téléphone' },
        { key: 'linkedin', label: 'LinkedIn' },
        { key: 'adresse_ligne1', label: 'Adresse' },
        { key: 'code_postal', label: 'Code postal' },
        { key: 'ville', label: 'Ville' },
        { key: 'localisation', label: 'Localisation' },
        { key: 'poste_actuel', label: 'Poste actuel' },
        { key: 'poste_cible', label: 'Poste cible' },
        { key: 'entreprise_nom', label: 'Entreprise actuelle', candidatKey: 'entreprise_actuelle_id', isEntreprise: true },
        { key: 'diplome', label: 'Diplôme' },
        { key: 'date_naissance', label: 'Date de naissance' },
        { key: 'debut_carriere', label: 'Début de carrière' },
        { key: 'debut_poste_actuel', label: 'Prise de poste actuel' },
        { key: 'salaire_fixe_actuel', label: 'Salaire fixe actuel (K€)', isNumeric: true },
        { key: 'variable_actuel', label: 'Variable actuel (K€)', isNumeric: true },
        { key: 'preavis', label: 'Préavis' },
        { key: 'synthese_30s', label: 'Synthèse 30 secondes' },
        { key: 'notes', label: 'Notes (profil CV)' },
      ];

      // Resolve current entreprise name for display
      const currentEntreprise = candidat.entreprise_actuelle_id
        ? Store.resolve('entreprises', candidat.entreprise_actuelle_id)
        : null;
      const currentEntrepriseNom = currentEntreprise ? (currentEntreprise.nom || currentEntreprise.displayName || '') : '';

      // Build list of all extracted fields
      const changes = [];
      for (const f of PROFILE_FIELDS) {
        const extractedVal = (extracted[f.key] || '').toString().trim();
        if (!extractedVal) continue; // Skip if CV didn't extract anything

        let currentVal;
        if (f.isEntreprise) {
          currentVal = currentEntrepriseNom;
        } else {
          const raw = candidat[f.candidatKey || f.key];
          // Treat 0 as empty for numeric fields
          currentVal = (f.isNumeric && raw === 0) ? '' : (raw || '').toString().trim();
        }

        const isSame = extractedVal === currentVal;

        changes.push({
          ...f,
          currentVal,
          extractedVal,
          isEmpty: !currentVal,
          isSame,
        });
      }

      if (changes.length === 0) {
        UI.toast('Aucun champ extrait du CV', 'info');
        return;
      }

      const bodyHtml = `
        <div style="margin-bottom:12px;font-size:0.8125rem;color:#475569;">
          Cochez les champs à mettre à jour. Les valeurs proposées sont éditables.
        </div>
        ${changes.map((c, i) => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;${c.isSame ? 'opacity:0.55;' : ''}">
            <input type="checkbox" id="cv-field-check-${i}" ${c.isEmpty ? 'checked' : ''} ${c.isSame ? 'disabled' : ''} style="margin-top:4px;accent-color:#3b82f6;" />
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <label for="cv-field-check-${i}" style="font-size:0.8125rem;font-weight:600;color:#1e293b;cursor:pointer;">${c.label}</label>
                ${c.isSame
                  ? '<span style="font-size:0.6875rem;color:#6b7280;background:#f3f4f6;padding:1px 6px;border-radius:4px;">identique</span>'
                  : c.isEmpty
                    ? '<span style="font-size:0.6875rem;color:#059669;background:#ecfdf5;padding:1px 6px;border-radius:4px;">nouveau</span>'
                    : '<span style="font-size:0.6875rem;color:#d97706;background:#fffbeb;padding:1px 6px;border-radius:4px;">modification</span>'}
              </div>
              ${c.currentVal && !c.isSame ? `<div style="font-size:0.75rem;color:#94a3b8;text-decoration:line-through;margin-bottom:4px;">${UI.escHtml(c.currentVal)}</div>` : ''}
              <input type="text" id="cv-field-val-${i}" value="${UI.escHtml(c.extractedVal)}" ${c.isSame ? 'disabled' : ''} style="width:100%;font-size:0.8125rem;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;${c.isSame ? 'background:#f9fafb;color:#9ca3af;' : ''}" />
            </div>
          </div>
        `).join('')}
      `;

      UI.modal('Compléter le profil depuis le CV', bodyHtml, {
        width: 600,
        saveLabel: 'Appliquer les modifications',
        onSave: async (overlay) => {
          const updates = {};
          let entrepriseNom = null;

          for (let i = 0; i < changes.length; i++) {
            const checkbox = overlay.querySelector(`#cv-field-check-${i}`);
            if (!checkbox || !checkbox.checked) continue;

            const val = overlay.querySelector(`#cv-field-val-${i}`).value.trim();
            if (!val) continue;

            const field = changes[i];

            if (field.isEntreprise) {
              entrepriseNom = val;
            } else if (field.key === 'diplome') {
              // Validate diploma against allowed values
              const allowedDiplomes = Referentiels.get('candidat_diplomes');
              if (allowedDiplomes.includes(val)) {
                updates[field.candidatKey || field.key] = val;
              }
            } else if (field.isNumeric) {
              const num = parseInt(val);
              if (!isNaN(num)) updates[field.candidatKey || field.key] = num;
            } else {
              updates[field.candidatKey || field.key] = val;
            }
          }

          // Resolve entreprise
          if (entrepriseNom) {
            const entreprises = Store.get('entreprises');
            const nomLower = entrepriseNom.toLowerCase().trim();
            const match = entreprises.find(e => (e.nom || '').toLowerCase().trim() === nomLower);

            if (match) {
              updates.entreprise_actuelle_id = match.id;
            } else {
              const newEnt = {
                id: API.generateId('ent'),
                nom: entrepriseNom,
                secteur: '', taille: '', ca: '', localisation: updates.localisation || candidat.localisation || '',
                priorite: '', statut: 'À cibler',
                site_web: '', telephone: '', angle_approche: '', source: '', notes: '',
                dernier_contact: null, prochaine_relance: null,
                created_at: new Date().toISOString(),
              };
              await Store.add('entreprises', newEnt);
              updates.entreprise_actuelle_id = newEnt.id;
              UI.toast('Entreprise créée : ' + newEnt.nom, 'info');
            }
          }

          if (Object.keys(updates).length === 0) {
            UI.toast('Aucune modification sélectionnée', 'info');
            return;
          }

          await Store.update('candidats', id, updates);
          Object.assign(candidat, updates);
          UI.toast(`${Object.keys(updates).length} champ(s) mis à jour depuis le CV`);
          renderProfil();
          refreshDependentViews();
        }
      });
    }
  }

  function renderEntretien() {
    // Fetch candidate actions that have notes
    const candidatActions = Store.filter('actions', a => a.candidat_id === id)
      .sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''));
    const actionsWithNotes = candidatActions.filter(a => a.message_notes && a.message_notes.trim());
    const notesCount = actionsWithNotes.length;

    // Build dynamic type filter options from this candidate's actions
    const actionTypes = [...new Set(actionsWithNotes.map(a => a.type_action).filter(Boolean))];
    const typeOptions = actionTypes.map(t => `<option value="${UI.escHtml(t)}">${UI.escHtml(t)}</option>`).join('');

    // Check if candidate has a CV in documents (for Drive fetch)
    const cvDoc = (candidat.documents || []).find(d => d.type === 'CV' && d.url);
    const hasDriveCv = cvDoc && typeof GoogleDrive !== 'undefined' && GoogleDrive.isConfigured();
    const hasExistingContent = [candidat.synthese_30s, candidat.parcours_cible, candidat.motivation_drivers, candidat.lecture_recruteur].some(f => f && f.trim());

    document.getElementById('tab-entretien').innerHTML = `
      <div class="entretien-toolbar">
        <button class="btn btn-sm btn-secondary" id="btn-toggle-notes-panel" title="Afficher les notes d'actions à côté">
          Notes d'actions (${notesCount})
        </button>
      </div>

      <div class="card" data-accent="orange" id="ia-analysis-section" style="margin-bottom:16px;">
        <div class="card-header" style="cursor:pointer;" id="ia-toggle-header">
          <h2>Analyse IA</h2>
          <span style="font-size:0.7rem;color:#94a3b8;display:flex;align-items:center;gap:8px;">
            gpt-4o-mini
            <svg id="ia-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.2s;"><path d="M6 9l6 6 6-6"/></svg>
          </span>
        </div>
        <div class="card-body" id="ia-body" style="padding:16px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <label style="font-size:0.8125rem;font-weight:600;color:#475569;display:block;margin-bottom:6px;">Notes d'entretien</label>
              ${notesCount > 0
                ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:0.8125rem;color:#166534;">
                    ${notesCount} note${notesCount > 1 ? 's' : ''} d'actions collect\u00e9e${notesCount > 1 ? 's' : ''} automatiquement
                    <button class="btn btn-sm btn-secondary" id="ia-show-notes" style="margin-left:8px;font-size:0.6875rem;">Voir</button>
                  </div>`
                : `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:0.8125rem;color:#991b1b;">
                    Aucune note d'action trouv\u00e9e. Cr\u00e9ez des actions avec des notes avant d'analyser.
                  </div>`
              }
            </div>
            <div>
              <label style="font-size:0.8125rem;font-weight:600;color:#475569;display:block;margin-bottom:6px;">CV (optionnel)</label>
              <div id="ia-cv-drop-zone" style="border:2px dashed #e2e8f0;border-radius:8px;padding:16px;text-align:center;cursor:pointer;transition:all 0.15s;">
                <div style="font-size:0.8125rem;color:#64748b;">Glissez un CV ici ou cliquez</div>
                <div style="font-size:0.75rem;color:#94a3b8;">PDF, TXT</div>
                <input type="file" id="ia-cv-file" accept=".pdf,.txt,.text,.md" style="display:none;" />
              </div>
              ${hasDriveCv ? `
              <button class="btn btn-sm btn-secondary" id="ia-fetch-cv-drive" style="width:100%;margin-top:6px;font-size:0.75rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                R\u00e9cup\u00e9rer le CV depuis Google Drive
              </button>` : ''}
              <div id="ia-cv-status" style="margin-top:6px;font-size:0.75rem;"></div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9;">
            <button class="btn btn-primary" id="ia-analyze-btn" ${notesCount === 0 ? 'disabled' : ''} title="${notesCount === 0 ? 'Ajoutez des notes d\'actions d\'abord' : ''}">
              G\u00e9n\u00e9rer
            </button>
            <button class="btn btn-secondary" id="ia-enrich-btn" style="display:none;">
              Enrichir avec le CV
            </button>
            <div id="ia-loading" style="display:none;font-size:0.8125rem;color:#64748b;">
              <span class="ia-spinner"></span>
              Analyse en cours...
            </div>
            <div id="ia-error" style="display:none;font-size:0.8125rem;color:#dc2626;max-width:400px;"></div>
            <div style="margin-left:auto;">
              <button class="btn btn-sm btn-secondary" id="ia-config-key" style="font-size:0.6875rem;">Cl\u00e9 OpenAI</button>
            </div>
          </div>
        </div>
      </div>

      <div class="entretien-layout" id="entretien-layout">
        <div class="entretien-notes-panel" id="entretien-notes-panel">
          <div class="card" data-accent="cyan" style="position:sticky;top:80px;">
            <div class="card-header">
              <h2>Notes d'actions</h2>
              <button class="btn btn-sm btn-secondary" id="btn-close-notes-panel" title="Fermer">&times;</button>
            </div>
            <div class="card-body" style="padding:12px;">
              ${actionTypes.length > 1 ? `
              <div style="margin-bottom:12px;">
                <select id="notes-filter-type" style="font-size:0.75rem;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;">
                  <option value="">Tous les types</option>
                  ${typeOptions}
                </select>
              </div>` : ''}
              <div id="entretien-notes-list" style="max-height:calc(100vh - 340px);overflow-y:auto;"></div>
            </div>
          </div>
        </div>

        <div class="entretien-fields">
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
        </div>
      </div>
    `;

    // Render notes list
    renderEntretienNotes(actionsWithNotes);

    // Toggle panel
    document.getElementById('btn-toggle-notes-panel').addEventListener('click', () => {
      const layout = document.getElementById('entretien-layout');
      const isOpen = layout.classList.toggle('notes-open');
      localStorage.setItem('ats_entretien_notes_open', isOpen ? '1' : '');
    });

    document.getElementById('btn-close-notes-panel').addEventListener('click', () => {
      document.getElementById('entretien-layout').classList.remove('notes-open');
      localStorage.setItem('ats_entretien_notes_open', '');
    });

    // Restore saved preference
    if (localStorage.getItem('ats_entretien_notes_open') === '1' && notesCount > 0) {
      document.getElementById('entretien-layout').classList.add('notes-open');
    }

    // Type filter
    document.getElementById('notes-filter-type')?.addEventListener('change', (e) => {
      const filterVal = e.target.value;
      const filtered = filterVal ? actionsWithNotes.filter(a => a.type_action === filterVal) : actionsWithNotes;
      renderEntretienNotes(filtered);
    });

    // Consolidate old separate fields into single textarea fields (one-time migration)
    const motivationParts = [candidat.motivation_changement, candidat.motivation_drivers].filter(Boolean);
    if (candidat.motivation_changement && motivationParts.length > 0) {
      const combined = motivationParts.join('\n\n');
      candidat.motivation_drivers = combined;
      candidat.motivation_changement = '';
      Store.update('candidats', id, { motivation_drivers: combined, motivation_changement: '' });
    }

    const lectureParts = [
      candidat.fit_poste ? `Fit poste : ${candidat.fit_poste}` : '',
      candidat.fit_culture ? `Fit culture : ${candidat.fit_culture}` : '',
      candidat.risques ? `Risques : ${candidat.risques}` : '',
      candidat.lecture_recruteur || ''
    ].filter(Boolean);
    if (candidat.fit_poste || candidat.fit_culture || candidat.risques) {
      const combined = lectureParts.join('\n');
      candidat.lecture_recruteur = combined;
      candidat.fit_poste = '';
      candidat.fit_culture = '';
      candidat.risques = '';
      Store.update('candidats', id, { lecture_recruteur: combined, fit_poste: '', fit_culture: '', risques: '' });
    }

    const richRender = (v) => v ? UI.renderRichText(v) : '';

    UI.inlineEdit('entretien-synthese', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'synthese_30s', label: '', type: 'textarea', render: richRender }
      ]
    });

    UI.inlineEdit('entretien-parcours', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'parcours_cible', label: '', type: 'textarea', render: richRender }
      ]
    });

    UI.inlineEdit('entretien-motivation', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'motivation_drivers', label: '', type: 'textarea', render: richRender }
      ]
    });

    UI.inlineEdit('entretien-lecture', {
      entity: 'candidats', recordId: id,
      fields: [
        { key: 'lecture_recruteur', label: '', type: 'textarea', render: richRender }
      ]
    });

    // =============================================
    // Analyse IA — event handlers
    // =============================================

    let _iaCvText = null;

    // Collapse/expand toggle
    const iaBody = document.getElementById('ia-body');
    const iaChevron = document.getElementById('ia-chevron');
    const iaSavedOpen = localStorage.getItem('ats_ia_section_open');
    if (iaSavedOpen === '0') {
      iaBody.style.display = 'none';
      iaChevron.style.transform = 'rotate(-90deg)';
    }
    document.getElementById('ia-toggle-header').addEventListener('click', () => {
      const isHidden = iaBody.style.display === 'none';
      iaBody.style.display = isHidden ? '' : 'none';
      iaChevron.style.transform = isHidden ? '' : 'rotate(-90deg)';
      localStorage.setItem('ats_ia_section_open', isHidden ? '1' : '0');
    });

    // "Voir" notes button → open the notes panel
    document.getElementById('ia-show-notes')?.addEventListener('click', () => {
      document.getElementById('entretien-layout').classList.add('notes-open');
      localStorage.setItem('ats_entretien_notes_open', '1');
    });

    // Build concatenated notes text
    function buildNotesText() {
      return actionsWithNotes.map(a => {
        const header = `[${a.type_action || 'Action'}${a.canal ? ' - ' + a.canal : ''} - ${UI.formatDate(a.date_action)}]`;
        return `${header}\n${a.message_notes}`;
      }).join('\n\n---\n\n');
    }

    // Update enrich button visibility
    function updateEnrichBtn() {
      const enrichBtn = document.getElementById('ia-enrich-btn');
      if (enrichBtn) {
        enrichBtn.style.display = (hasExistingContent && _iaCvText) ? '' : 'none';
      }
    }

    // CV drop zone
    const cvDropZone = document.getElementById('ia-cv-drop-zone');
    const cvFileInput = document.getElementById('ia-cv-file');
    const cvStatus = document.getElementById('ia-cv-status');

    cvDropZone.addEventListener('click', () => cvFileInput.click());
    cvDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      cvDropZone.style.borderColor = '#3b82f6';
      cvDropZone.style.background = '#eff6ff';
    });
    cvDropZone.addEventListener('dragleave', () => {
      cvDropZone.style.borderColor = '#e2e8f0';
      cvDropZone.style.background = '';
    });
    cvDropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      cvDropZone.style.borderColor = '#e2e8f0';
      cvDropZone.style.background = '';
      const file = e.dataTransfer.files[0];
      if (file) await loadCVFile(file);
    });
    cvFileInput.addEventListener('change', async () => {
      if (cvFileInput.files[0]) await loadCVFile(cvFileInput.files[0]);
      cvFileInput.value = '';
    });

    async function loadCVFile(file) {
      cvStatus.innerHTML = '<span style="color:#64748b;">Extraction du texte...</span>';
      cvDropZone.style.display = 'none';
      try {
        const text = await CVParser.parseFile(file);
        if (!text || text.trim().length < 20) throw new Error('Fichier vide ou illisible');
        _iaCvText = text;
        cvStatus.innerHTML = `<span style="color:#059669;">CV charg\u00e9 : ${UI.escHtml(file.name)} (${text.length} car.)</span>
          <button class="btn btn-sm btn-secondary" id="ia-cv-clear" style="margin-left:6px;font-size:0.625rem;">Retirer</button>`;
        document.getElementById('ia-cv-clear')?.addEventListener('click', () => {
          _iaCvText = null;
          cvDropZone.style.display = '';
          cvStatus.innerHTML = '';
          updateEnrichBtn();
        });
        updateEnrichBtn();
      } catch (err) {
        cvDropZone.style.display = '';
        cvStatus.innerHTML = `<span style="color:#dc2626;">Erreur : ${UI.escHtml(err.message)}</span>`;
        _iaCvText = null;
      }
    }

    // Google Drive CV fetch
    document.getElementById('ia-fetch-cv-drive')?.addEventListener('click', async () => {
      const match = cvDoc.url.match(/\/d\/([^/]+)/);
      if (!match) { UI.toast('URL Drive invalide', 'error'); return; }
      cvStatus.innerHTML = '<span style="color:#64748b;">T\u00e9l\u00e9chargement depuis Drive...</span>';
      try {
        await GoogleDrive.authenticate();
        const downloaded = await GoogleDrive.downloadFile(match[1]);
        const file = new File([downloaded.blob], downloaded.name, { type: downloaded.mimeType });
        await loadCVFile(file);
      } catch (err) {
        cvStatus.innerHTML = `<span style="color:#dc2626;">Erreur Drive : ${UI.escHtml(err.message)}</span>`;
      }
    });

    // OpenAI key config
    document.getElementById('ia-config-key').addEventListener('click', () => {
      CVParser.showKeyConfigModal();
    });

    // Review modal
    function showReviewModal(result) {
      const fields = [
        { key: 'synthese_30s', label: 'Synth\u00e8se 30 secondes', accent: '#f59e0b' },
        { key: 'parcours_cible', label: 'Parcours cible', accent: '#3b82f6' },
        { key: 'motivation_drivers', label: 'Motivation & Drivers', accent: '#10b981' },
        { key: 'lecture_recruteur', label: 'Lecture recruteur', accent: '#8b5cf6' },
      ];

      const bodyHtml = `
        ${hasExistingContent ? '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:0.8125rem;color:#92400e;">Des contenus existent d\u00e9j\u00e0 dans certains champs. L\'analyse les remplacera.</div>' : ''}
        ${fields.map(f => `
          <div style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <div style="width:4px;height:16px;border-radius:2px;background:${f.accent};"></div>
              <label style="font-size:0.8125rem;font-weight:600;color:#1e293b;">${f.label}</label>
              ${candidat[f.key]?.trim() ? '<span style="font-size:0.6875rem;color:#f59e0b;">remplace le contenu existant</span>' : ''}
            </div>
            <textarea id="review-${f.key}" style="width:100%;min-height:100px;font-size:0.8125rem;border:1px solid #e2e8f0;border-radius:8px;padding:10px;resize:vertical;font-family:inherit;">${UI.escHtml(result[f.key] || '')}</textarea>
          </div>
        `).join('')}
      `;

      UI.modal('R\u00e9sultat de l\'analyse IA', bodyHtml, {
        width: 700,
        saveLabel: 'Appliquer les 4 champs',
        onSave: async (overlay) => {
          const updates = {};
          fields.forEach(f => {
            updates[f.key] = overlay.querySelector(`#review-${f.key}`).value.trim();
          });
          await Store.update('candidats', id, updates);
          Object.assign(candidat, updates);
          UI.toast('Analyse appliqu\u00e9e aux 4 champs');
          renderEntretien();
        }
      });
    }

    // Generate button
    document.getElementById('ia-analyze-btn').addEventListener('click', async () => {
      if (!CVParser.getOpenAIKey()) { CVParser.showKeyConfigModal(); return; }
      if (notesCount === 0) { UI.toast('Aucune note d\'action \u00e0 analyser', 'error'); return; }

      const analyzeBtn = document.getElementById('ia-analyze-btn');
      const enrichBtn = document.getElementById('ia-enrich-btn');
      const loading = document.getElementById('ia-loading');
      const errorDiv = document.getElementById('ia-error');

      analyzeBtn.disabled = true;
      if (enrichBtn) enrichBtn.disabled = true;
      loading.style.display = 'inline-flex';
      errorDiv.style.display = 'none';

      try {
        const result = await InterviewAnalyzer.analyze(buildNotesText(), _iaCvText);
        loading.style.display = 'none';
        analyzeBtn.disabled = false;
        if (enrichBtn) enrichBtn.disabled = false;
        showReviewModal(result);
      } catch (err) {
        loading.style.display = 'none';
        analyzeBtn.disabled = false;
        if (enrichBtn) enrichBtn.disabled = false;
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
      }
    });

    // Enrich button
    document.getElementById('ia-enrich-btn').addEventListener('click', async () => {
      if (!CVParser.getOpenAIKey()) { CVParser.showKeyConfigModal(); return; }
      if (!_iaCvText) { UI.toast('Chargez un CV d\'abord', 'error'); return; }

      const analyzeBtn = document.getElementById('ia-analyze-btn');
      const enrichBtn = document.getElementById('ia-enrich-btn');
      const loading = document.getElementById('ia-loading');
      const errorDiv = document.getElementById('ia-error');

      analyzeBtn.disabled = true;
      enrichBtn.disabled = true;
      loading.style.display = 'inline-flex';
      errorDiv.style.display = 'none';

      try {
        const existingFields = {
          synthese_30s: candidat.synthese_30s || '',
          parcours_cible: candidat.parcours_cible || '',
          motivation_drivers: candidat.motivation_drivers || '',
          lecture_recruteur: candidat.lecture_recruteur || '',
        };
        const result = await InterviewAnalyzer.enrich(existingFields, _iaCvText, buildNotesText());
        loading.style.display = 'none';
        analyzeBtn.disabled = false;
        enrichBtn.disabled = false;
        showReviewModal(result);
      } catch (err) {
        loading.style.display = 'none';
        analyzeBtn.disabled = false;
        enrichBtn.disabled = false;
        errorDiv.textContent = err.message;
        errorDiv.style.display = 'block';
      }
    });

    updateEnrichBtn();
  }

  function renderEntretienNotes(actions) {
    const container = document.getElementById('entretien-notes-list');
    if (!container) return;

    if (actions.length === 0) {
      container.innerHTML = '<div style="font-size:0.8125rem;color:#94a3b8;font-style:italic;padding:8px;">Aucune note d\'action.</div>';
      return;
    }

    const canalIcons = { 'Appel': '\u{1F4DE}', 'LinkedIn': '\u{1F4AC}', 'Email': '\u{1F4E7}', 'Visio': '\u{1F4F9}', 'Physique': '\u{1F91D}', 'SMS': '\u{1F4F1}' };

    container.innerHTML = actions.map(a => {
      const icon = canalIcons[a.canal] || '\u{1F4CC}';
      return `
        <div class="entretien-note-item">
          <div class="entretien-note-header">
            <span>${icon}</span>
            <strong style="font-size:0.8125rem;">${UI.escHtml(a.action || '')}</strong>
            <span style="font-size:0.6875rem;color:#94a3b8;margin-left:auto;white-space:nowrap;">${UI.formatDate(a.date_action)}</span>
          </div>
          <div class="entretien-note-meta">
            ${a.type_action ? UI.badge(a.type_action) : ''}
            ${a.canal ? UI.badge(a.canal) : ''}
          </div>
          <div class="entretien-note-body">${UI.escHtml(a.message_notes)}</div>
        </div>`;
    }).join('');

    // Collapse long notes
    container.querySelectorAll('.entretien-note-body').forEach(body => {
      if (body.scrollHeight > 120) {
        body.classList.add('collapsed');
        body.addEventListener('click', () => body.classList.toggle('collapsed'));
      }
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
            ${candidat.linkedin ? `<a href="${UI.escHtml(UI.normalizeUrl(candidat.linkedin))}" target="_blank" class="entity-link">LinkedIn</a><br/>` : ''}
            ${candidat.google_drive_url ? `<a href="${UI.escHtml(UI.normalizeUrl(candidat.google_drive_url))}" target="_blank" class="entity-link" style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>Google Drive</a><br/>` : ''}
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

  // ============================================================
  // DSI PROFILE DISPLAY
  // ============================================================
  async function renderDSIProfile() {
    const container = document.getElementById('dsi-profile-display');
    if (!container) return;

    const code = candidat.profile_code;
    if (!code || !code.startsWith('AMA')) {
      container.innerHTML = '';
      return;
    }

    // Loading state
    container.innerHTML = `
      <div style="margin-top:12px;background:#FFFDF0;border:1px solid #FEE566;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px;">
        <div style="width:16px;height:16px;border:2px solid #FECC02;border-top-color:transparent;border-radius:50%;animation:dsi-spin 0.8s linear infinite;"></div>
        <span style="font-size:0.8125rem;color:#92700c;">Chargement du profil DSI...</span>
      </div>
      <style>@keyframes dsi-spin { to { transform: rotate(360deg); } }</style>
    `;

    const result = await DSIProfile.fetchProfile(code);

    if (!result || result.status === 'error') {
      container.innerHTML = `
        <div style="margin-top:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:0.8125rem;color:#991b1b;">
          Impossible de charger le profil DSI. <a href="#" id="dsi-retry" style="color:#dc2626;text-decoration:underline;">Réessayer</a>
        </div>
      `;
      document.getElementById('dsi-retry')?.addEventListener('click', (e) => {
        e.preventDefault();
        DSIProfile.clearCache(code);
        renderDSIProfile();
      });
      return;
    }

    if (result.status === 'not_found') {
      container.innerHTML = `
        <div style="margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;font-size:0.8125rem;color:#64748b;">
          Code <strong>${UI.escHtml(code)}</strong> — Session non trouvée. Le candidat n'a pas encore passé le profiling.
        </div>
      `;
      return;
    }

    if (result.status === 'in_progress') {
      container.innerHTML = `
        <div style="margin-top:12px;background:#FFFDF0;border:1px solid #FEE566;border-radius:8px;padding:10px 14px;font-size:0.8125rem;color:#92700c;">
          <strong>${UI.escHtml(code)}</strong> — Profiling en cours (non terminé)
        </div>
      `;
      return;
    }

    // Completed — render profile card
    const pillarNames = ['Leadership', 'Opérationnel', 'Innovation'];
    const pillarColors = ['#FECC02', '#2D6A4F', '#3A5BA0'];
    const scoreColor = result.avgNorm >= 70 ? '#16a34a' : result.avgNorm >= 50 ? '#FECC02' : result.avgNorm >= 30 ? '#E8A838' : '#dc2626';

    container.innerHTML = `
      <div style="margin-top:12px;background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);border-radius:10px;padding:16px 20px;color:#f8fafc;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,rgba(254,204,2,0.08) 0%,transparent 70%);"></div>

        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;margin-bottom:4px;">Profil DSI Amarillo\u2122</div>
            <div style="font-size:1.125rem;font-weight:700;color:#FECC02;">${UI.escHtml(result.profile)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;margin-bottom:2px;">Indice global</div>
            <div style="font-size:1.75rem;font-weight:800;color:${scoreColor};font-variant-numeric:tabular-nums;">${result.avgNorm}<span style="font-size:0.75rem;color:#94a3b8;font-weight:500;">/100</span></div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:14px;">
          ${result.pillarScoresNorm.map((score, i) => `
            <div style="flex:1;background:rgba(255,255,255,0.05);border-radius:6px;padding:8px 10px;text-align:center;">
              <div style="font-size:0.625rem;color:#94a3b8;margin-bottom:2px;">${pillarNames[i]}</div>
              <div style="font-size:1rem;font-weight:700;color:${pillarColors[i]};">${score}</div>
              <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:4px;">
                <div style="height:100%;width:${score}%;background:${pillarColors[i]};border-radius:2px;transition:width 0.6s ease;"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;">
          <a href="https://amarillo-dsi-profile.netlify.app/?session=${UI.escHtml(code)}" target="_blank"
             style="font-size:0.75rem;color:#94a3b8;text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:color 0.15s;"
             onmouseenter="this.style.color='#FECC02'" onmouseleave="this.style.color='#94a3b8'">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Voir le rapport complet
          </a>
          <span style="font-size:0.625rem;color:#475569;">${UI.escHtml(code)}</span>
        </div>
      </div>
    `;
  }
})();
