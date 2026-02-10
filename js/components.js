// Amarillo ATS — Reusable UI Components

const UI = (() => {

  // Status badge mapping
  const BADGE_MAP = {
    // Candidats
    'To call': 'badge-to-call',
    'Approché': 'badge-approche',
    'En qualification': 'badge-en-qualification',
    'Shortlisté': 'badge-shortliste',
    'Présenté': 'badge-presente',
    'Placé': 'badge-place',
    'Off market': 'badge-off-market',
    'Pas prioritaire': 'badge-pas-prioritaire',
    // Actions
    'À faire': 'badge-a-faire',
    'A faire': 'badge-a-faire',
    'En cours': 'badge-en-cours',
    'Fait': 'badge-fait',
    'Annulé': 'badge-annule',
    // Priorité
    'Haute': 'badge-haute',
    'Moyenne': 'badge-moyenne',
    'Basse': 'badge-basse',
    // Canaux
    'LinkedIn': 'badge-linkedin',
    'Appel': 'badge-appel',
    'Email': 'badge-email',
    'Visio': 'badge-visio',
    // Présentations
    'En attente': 'badge-a-faire',
    'Intéressé': 'badge-en-cours',
    'Entretien planifié': 'badge-shortliste',
    'Refusé': 'badge-annule',
    'Offre': 'badge-place',
    // Niveau
    'Middle': 'badge-middle',
    'Top': 'badge-top',
    // Entreprise statuts
    'À cibler': 'badge-a-cibler',
    'Ciblé': 'badge-cible',
    'Contactée': 'badge-contacte',
    'Contacté': 'badge-contacte',
    'En discussion': 'badge-en-discussion',
    'Cliente': 'badge-cliente',
    'Prospection en cours': 'badge-prospect',
    'Client': 'badge-cliente',
    'Ancien client': 'badge-inactive',
    'Écarté': 'badge-annule',
    'Inactive': 'badge-inactive',
    // Décideur relation
    'En relation': 'badge-en-relation',
    'Champion': 'badge-champion',
    // Décideur roles
    'Décideur': 'badge-decideur',
    'Influenceur': 'badge-influenceur',
    'Prescripteur': 'badge-prescripteur',
  };

  function badge(text) {
    if (!text) return '';
    const cls = BADGE_MAP[text] || '';
    return `<span class="badge ${cls}">${escHtml(text)}</span>`;
  }

  function entityLink(entity, id, label) {
    if (!id || !label) return label || '—';
    const pages = {
      candidats: 'candidat.html',
      entreprises: 'entreprise.html',
      decideurs: 'decideur.html',
      missions: 'mission.html'
    };
    const page = pages[entity] || '#';
    return `<a href="${page}?id=${id}" class="entity-link">${escHtml(label)}</a>`;
  }

  function resolveLink(entity, id) {
    const record = Store.resolve(entity, id);
    if (!record) return '—';
    return entityLink(entity, id, record.displayName);
  }

  // Sortable, filterable data table
  function dataTable(containerId, { columns, data, onRowClick, emptyMessage = 'Aucune donnée' }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>${emptyMessage}</p></div>`;
      return;
    }

    let sortCol = null;
    let sortDir = 'asc';

    function render(rows) {
      const html = `
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                ${columns.map(col => `
                  <th data-key="${col.key}" class="${sortCol === col.key ? 'sorted' : ''}">
                    ${col.label}
                    <span class="sort-icon">${sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr data-id="${row.id || ''}">
                  ${columns.map(col => `<td>${col.render ? col.render(row) : escHtml(row[col.key] || '')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      container.innerHTML = html;

      // Sort handlers
      container.querySelectorAll('th').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.key;
          if (sortCol === key) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            sortCol = key;
            sortDir = 'asc';
          }
          const sorted = [...rows].sort((a, b) => {
            const va = (a[key] || '').toString().toLowerCase();
            const vb = (b[key] || '').toString().toLowerCase();
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          });
          render(sorted);
        });
      });

      // Row click
      if (onRowClick) {
        container.querySelectorAll('tbody tr').forEach(tr => {
          tr.addEventListener('click', (e) => {
            if (e.target.closest('a')) return; // don't intercept link clicks
            onRowClick(tr.dataset.id);
          });
        });
      }
    }

    render(data);

    return {
      update: (newData) => render(newData)
    };
  }

  // Filter bar
  function filterBar(containerId, { filters, searchPlaceholder, onFilter }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let searchValue = '';
    const filterValues = {};

    const html = `
      <div class="filters-bar">
        <input type="text" class="filter-search" placeholder="${searchPlaceholder || 'Rechercher...'}" />
        ${filters.map(f => `
          <select class="filter-select" data-filter="${f.key}">
            <option value="">${f.label}</option>
            ${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
        `).join('')}
      </div>
    `;
    container.innerHTML = html;

    const searchInput = container.querySelector('.filter-search');
    searchInput.addEventListener('input', (e) => {
      searchValue = e.target.value;
      onFilter({ search: searchValue, filters: filterValues });
    });

    container.querySelectorAll('.filter-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        filterValues[sel.dataset.filter] = e.target.value;
        onFilter({ search: searchValue, filters: filterValues });
      });
    });
  }

  // Modal
  function modal(title, bodyHtml, { onSave, saveLabel = 'Enregistrer', width } = {}) {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal" ${width ? `style="max-width:${width}px"` : ''}>
        <div class="modal-header">
          <h3>${escHtml(title)}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${onSave ? `
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel">Annuler</button>
          <button class="btn btn-primary modal-save">${saveLabel}</button>
        </div>
        ` : ''}
      </div>
    `;

    overlay.classList.add('visible');

    const close = () => overlay.classList.remove('visible');

    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    if (onSave) {
      overlay.querySelector('.modal-cancel').addEventListener('click', close);
      overlay.querySelector('.modal-save').addEventListener('click', () => {
        onSave(overlay);
        close();
      });
    }

    return { close, overlay };
  }

  // Toast notification
  function toast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // Tabs
  function initTabs(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        // Search tab-content in document, not just in container
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }

  // Timeline for actions
  function timeline(containerId, actions) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!actions || actions.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Aucune action enregistrée</p></div>';
      return;
    }

    const sorted = [...actions].sort((a, b) => (b.date_action || '').localeCompare(a.date_action || ''));

    container.innerHTML = `
      <div class="timeline">
        ${sorted.map(a => `
          <div class="timeline-item">
            <div class="timeline-dot ${(a.canal || '').toLowerCase().includes('linkedin') ? 'linkedin' : 'appel'}">
              ${(a.canal || '').toLowerCase().includes('linkedin') ? 'in' : '☎'}
            </div>
            <div class="timeline-body">
              <div class="timeline-date">${formatDate(a.date_action)}</div>
              <div class="timeline-title">${escHtml(a.action || '')}</div>
              ${a.message_notes ? `<div class="timeline-text">${escHtml(a.message_notes).substring(0, 150)}</div>` : ''}
              ${a.next_step ? `<div class="timeline-text" style="color:#c9a000;">→ ${escHtml(a.next_step)}</div>` : ''}
            </div>
            <div>${badge(a.statut)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Config modal (for setting up JSONBin keys)
  function showConfigModal() {
    const config = API.getConfig();
    const bodyHtml = `
      <div class="form-group">
        <label>Clé API JSONBin (X-Master-Key)</label>
        <input type="text" id="cfg-apikey" value="${config.apiKey || ''}" placeholder="$2a$10$..." />
      </div>
      <hr style="margin: 16px 0; border-color: #e2e8f0;" />
      <p style="font-size: 0.8125rem; color: #64748b; margin-bottom: 12px;">
        IDs des bins (laissez vide pour créer automatiquement) :
      </p>
      ${Object.keys(config.bins).map(entity => `
        <div class="form-group">
          <label>${entity}</label>
          <input type="text" id="cfg-bin-${entity}" value="${config.bins[entity] || ''}" placeholder="ID du bin" />
        </div>
      `).join('')}
    `;

    modal('Configuration JSONBin', bodyHtml, {
      saveLabel: 'Sauvegarder',
      width: 500,
      onSave: async (overlay) => {
        const apiKey = overlay.querySelector('#cfg-apikey').value.trim();
        const bins = {};
        Object.keys(config.bins).forEach(entity => {
          bins[entity] = overlay.querySelector(`#cfg-bin-${entity}`).value.trim();
        });
        API.saveConfig({ apiKey, bins });

        // Create missing bins
        const emptyBins = Object.entries(bins).filter(([, v]) => !v);
        if (emptyBins.length > 0 && apiKey) {
          toast('Création des bins manquants...', 'success');
          try {
            await API.initAllBins();
            toast('Bins créés avec succès !', 'success');
            setTimeout(() => location.reload(), 1000);
          } catch (e) {
            toast('Erreur lors de la création des bins', 'error');
          }
        } else {
          toast('Configuration sauvegardée', 'success');
          setTimeout(() => location.reload(), 1000);
        }
      }
    });
  }

  // Global search setup
  function initGlobalSearch() {
    const input = document.querySelector('.search-global input');
    const dropdown = document.querySelector('.search-results-dropdown');
    if (!input || !dropdown) return;

    let debounce;

    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const results = Store.search(input.value);
        if (results.length > 0) {
          dropdown.innerHTML = results.map(r => `
            <a href="${r.url}" class="search-result-item" style="text-decoration:none;color:inherit;">
              <span class="search-result-type ${r.type}">${r.type}</span>
              <div>
                <div style="font-weight:600;font-size:0.8125rem;">${escHtml(r.label)}</div>
                <div style="font-size:0.75rem;color:#64748b;">${escHtml(r.sub)}</div>
              </div>
            </a>
          `).join('');
          dropdown.classList.add('visible');
        } else {
          dropdown.classList.remove('visible');
        }
      }, 200);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('visible'), 200);
    });

    input.addEventListener('focus', () => {
      if (input.value.length >= 2) input.dispatchEvent(new Event('input'));
    });
  }

  // Utility functions
  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function formatCurrency(amount) {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // Autocomplete entreprise input
  function entrepriseAutocomplete(inputId, hiddenId) {
    setTimeout(() => {
      const input = document.getElementById(inputId);
      const hidden = document.getElementById(hiddenId);
      if (!input) return;

      const entreprises = Store.get('entreprises');
      let dropdown = null;

      input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        if (dropdown) dropdown.remove();

        if (q.length < 1) { hidden.value = ''; return; }

        const matches = entreprises.filter(e => (e.nom || '').toLowerCase().includes(q)).slice(0, 8);
        if (matches.length === 0) return;

        dropdown = document.createElement('div');
        dropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:200;max-height:200px;overflow-y:auto;';

        matches.forEach(e => {
          const item = document.createElement('div');
          item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;border-bottom:1px solid #f1f5f9;';
          item.innerHTML = `<strong>${escHtml(e.nom)}</strong> <span style="color:#64748b;font-size:0.75rem;">${escHtml(e.secteur||'')} • ${escHtml(e.localisation||'')}</span>`;
          item.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            input.value = e.nom;
            hidden.value = e.id;
            if (dropdown) dropdown.remove();
            dropdown = null;
            // Auto-fill related fields if they exist
            const locInput = document.getElementById('f-localisation');
            if (locInput && !locInput.value && e.localisation) locInput.value = e.localisation;
          });
          item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
          item.addEventListener('mouseleave', () => item.style.background = '#fff');
          dropdown.appendChild(item);
        });

        // Add "Créer cette entreprise" option
        const createItem = document.createElement('div');
        createItem.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;color:#c9a000;font-weight:600;';
        createItem.textContent = `+ Créer "${input.value}"`;
        createItem.addEventListener('mousedown', async (ev) => {
          ev.preventDefault();
          const newEnt = {
            id: API.generateId('ent'),
            nom: input.value.trim(),
            secteur: '', taille: '', ca: '', localisation: '',
            priorite: '', statut: 'À cibler', icp_fit: false,
            site_web: '', telephone: '', angle_approche: '', source: '', notes: '',
            dernier_contact: null, prochaine_relance: null,
          };
          await Store.add('entreprises', newEnt);
          input.value = newEnt.nom;
          hidden.value = newEnt.id;
          if (dropdown) dropdown.remove();
          dropdown = null;
          toast('Entreprise créée : ' + newEnt.nom);
        });
        dropdown.appendChild(createItem);

        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(dropdown);
      });

      input.addEventListener('blur', () => {
        setTimeout(() => { if (dropdown) { dropdown.remove(); dropdown = null; } }, 200);
      });
    }, 50);
  }

  // Candidat/Décideur link management
  function candidatDecideurLink(containerId, candidatId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const candidat = Store.findById('candidats', candidatId);
    if (!candidat) return;

    const linkedDecideur = candidat.profil_decideur_id ? Store.findById('decideurs', candidat.profil_decideur_id) : null;

    if (linkedDecideur) {
      container.innerHTML = `
        <div style="margin-bottom:16px;">
          <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Aussi décideur</div>
          ${entityLink('decideurs', linkedDecideur.id, (linkedDecideur.prenom||'')+' '+(linkedDecideur.nom||''))}
          <div style="font-size:0.75rem;color:#64748b;">${escHtml(linkedDecideur.fonction||'')} — ${escHtml(linkedDecideur.role_decision||'')}</div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button class="btn btn-sm btn-secondary" id="btn-link-decideur" style="margin-bottom:16px;">
          Lier à un profil décideur
        </button>
      `;
      document.getElementById('btn-link-decideur').addEventListener('click', () => {
        const decideurs = Store.get('decideurs');
        modal('Lier à un décideur', `
          <p style="font-size:0.8125rem;color:#64748b;margin-bottom:12px;">
            Sélectionnez un décideur existant ou créez un profil décideur pour ce candidat.
          </p>
          <div class="form-group">
            <label>Décideur existant</label>
            <select id="link-dec-id" style="margin-bottom:12px;">
              <option value="">— Sélectionner —</option>
              ${decideurs.map(d => '<option value="'+d.id+'">'+escHtml((d.prenom||'')+' '+(d.nom||''))+' — '+escHtml(d.fonction||'')+'</option>').join('')}
            </select>
          </div>
          <div style="text-align:center;padding:8px;color:#94a3b8;font-size:0.8125rem;">— ou —</div>
          <button class="btn btn-secondary" id="btn-create-decideur-from-candidat" style="width:100%;">
            Créer un profil décideur à partir de ce candidat
          </button>
        `, {
          saveLabel: 'Lier',
          onSave: async (overlay) => {
            const decId = overlay.querySelector('#link-dec-id').value;
            if (decId) {
              await Store.update('candidats', candidatId, { profil_decideur_id: decId });
              await Store.update('decideurs', decId, { profil_candidat_id: candidatId });
              toast('Lié au décideur');
              setTimeout(() => location.reload(), 500);
            }
          }
        });

        // Create decideur from candidat
        setTimeout(() => {
          const btn = document.getElementById('btn-create-decideur-from-candidat');
          if (btn) {
            btn.addEventListener('click', async () => {
              const ent = candidat.entreprise_actuelle_id;
              const newDec = {
                id: API.generateId('dec'),
                prenom: candidat.prenom || '',
                nom: candidat.nom || '',
                entreprise_id: ent,
                fonction: candidat.poste_actuel || '',
                fonction_macro: '',
                niveau_hierarchique: '',
                role_decision: 'Décideur',
                perimetre: 'France',
                priorite_prospection: 'Haute',
                niveau_relation: 'Contacté',
                email: candidat.email || '',
                telephone: candidat.telephone || '',
                linkedin: candidat.linkedin || '',
                localisation: candidat.localisation || '',
                notes_relation: '',
                manager_direct_id: null,
                missions_ids: [],
                profil_candidat_id: candidatId,
                dernier_contact: null,
                prochaine_relance: null,
              };
              await Store.add('decideurs', newDec);
              await Store.update('candidats', candidatId, { profil_decideur_id: newDec.id });
              toast('Profil décideur créé');
              setTimeout(() => location.reload(), 500);
            });
          }
        }, 100);
      });
    }
  }

  // ============================================================
  // INLINE EDIT — click-to-edit fields with auto-save (Notion-like)
  // ============================================================
  function inlineEdit(containerId, { entity, recordId, fields }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const record = Store.findById(entity, recordId);
    if (!record) return;

    function renderFields() {
      container.innerHTML = fields.map(f => {
        const value = record[f.key];
        const display = f.render ? f.render(value, record) : escHtml(value || '');
        return `
          <div class="inline-field" data-field="${f.key}" data-type="${f.type || 'text'}">
            <div class="inline-field-label">${f.label}</div>
            <div class="inline-field-value" data-field-key="${f.key}" title="Cliquer pour modifier">${display || '<span class="inline-field-empty">—</span>'}</div>
          </div>
        `;
      }).join('');

      // Bind click handlers
      container.querySelectorAll('.inline-field-value').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('a')) return;
          const fieldKey = el.dataset.fieldKey;
          const fieldDef = fields.find(f => f.key === fieldKey);
          if (!fieldDef) return;
          startEditing(el, fieldDef);
        });
      });
    }

    async function saveField(fieldKey, value) {
      record[fieldKey] = value;
      await Store.update(entity, recordId, { [fieldKey]: value });
      toast('Sauvegardé');
    }

    function startEditing(el, fieldDef) {
      if (el.classList.contains('editing')) return;
      el.classList.add('editing');
      const currentValue = record[fieldDef.key] || '';

      if (fieldDef.type === 'select' && fieldDef.options) {
        const select = document.createElement('select');
        select.className = 'inline-edit-input';
        if (!fieldDef.required) {
          const emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.textContent = '—';
          select.appendChild(emptyOpt);
        }
        fieldDef.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          if (opt === currentValue) option.selected = true;
          select.appendChild(option);
        });
        el.innerHTML = '';
        el.appendChild(select);
        select.focus();

        select.addEventListener('change', async () => {
          await saveField(fieldDef.key, select.value);
          el.classList.remove('editing');
          renderFields();
        });
        select.addEventListener('blur', () => {
          el.classList.remove('editing');
          renderFields();
        });
      } else if (fieldDef.type === 'textarea') {
        const textarea = document.createElement('textarea');
        textarea.className = 'inline-edit-input';
        textarea.value = currentValue;
        textarea.style.minHeight = '80px';
        el.innerHTML = '';
        el.appendChild(textarea);
        textarea.focus();

        textarea.addEventListener('blur', async () => {
          const val = textarea.value.trim();
          if (val !== currentValue) {
            await saveField(fieldDef.key, val);
          }
          el.classList.remove('editing');
          renderFields();
        });
      } else if (fieldDef.type === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'inline-edit-input';
        input.value = currentValue;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();
        input.select();

        const finish = async () => {
          const val = parseInt(input.value) || 0;
          if (val !== currentValue) {
            await saveField(fieldDef.key, val);
          }
          el.classList.remove('editing');
          renderFields();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { el.classList.remove('editing'); renderFields(); } });
      } else if (fieldDef.type === 'date') {
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'inline-edit-input';
        input.value = currentValue;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();

        const finish = async () => {
          const val = input.value || null;
          if (val !== currentValue) {
            await saveField(fieldDef.key, val);
          }
          el.classList.remove('editing');
          renderFields();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('change', finish);
      } else if (fieldDef.type === 'boolean') {
        // Toggle immediately
        const newVal = !record[fieldDef.key];
        saveField(fieldDef.key, newVal).then(() => {
          el.classList.remove('editing');
          renderFields();
        });
      } else {
        // Default: text input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-edit-input';
        input.value = currentValue;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();
        input.select();

        const finish = async () => {
          const val = input.value.trim();
          if (val !== currentValue) {
            await saveField(fieldDef.key, val);
          }
          el.classList.remove('editing');
          renderFields();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { el.classList.remove('editing'); renderFields(); } });
      }
    }

    renderFields();
    return { refresh: renderFields };
  }

  // ============================================================
  // STATUS DROPDOWN — clickable badge that opens status picker
  // ============================================================
  function statusBadge(currentStatus, options, { entity, recordId, fieldName = 'statut', onUpdate } = {}) {
    const id = 'sb-' + Math.random().toString(36).substr(2, 6);
    // Return HTML string; bind events after DOM insert
    const html = `<span class="badge ${BADGE_MAP[currentStatus] || ''} status-clickable" id="${id}" data-status="${escHtml(currentStatus || '')}" title="Cliquer pour changer le statut">${escHtml(currentStatus || '—')}</span>`;

    // Deferred binding
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        showStatusPicker(el, currentStatus, options, async (newStatus) => {
          if (newStatus !== currentStatus) {
            await Store.update(entity, recordId, { [fieldName]: newStatus });
            el.className = `badge ${BADGE_MAP[newStatus] || ''} status-clickable`;
            el.textContent = newStatus;
            el.dataset.status = newStatus;
            toast('Statut mis à jour');
            if (onUpdate) onUpdate(newStatus);
          }
        });
      });
    }, 50);

    return html;
  }

  function showStatusPicker(anchor, currentStatus, options, onSelect) {
    // Remove existing picker
    document.querySelectorAll('.status-picker').forEach(p => p.remove());

    const picker = document.createElement('div');
    picker.className = 'status-picker';

    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'status-picker-item' + (opt === currentStatus ? ' active' : '');
      item.innerHTML = `<span class="badge ${BADGE_MAP[opt] || ''}">${escHtml(opt)}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(opt);
        picker.remove();
      });
      picker.appendChild(item);
    });

    // Position relative to anchor
    const rect = anchor.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = (rect.bottom + 4) + 'px';
    picker.style.left = rect.left + 'px';
    picker.style.zIndex = '300';
    document.body.appendChild(picker);

    // Close on click outside
    const closePicker = (e) => {
      if (!picker.contains(e.target) && e.target !== anchor) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    };
    setTimeout(() => document.addEventListener('click', closePicker), 10);
  }

  return {
    badge, entityLink, resolveLink,
    dataTable, filterBar, modal, toast,
    initTabs, timeline, showConfigModal,
    initGlobalSearch, entrepriseAutocomplete,
    candidatDecideurLink,
    inlineEdit, statusBadge, showStatusPicker,
    escHtml, formatDate, formatCurrency, getParam
  };
})();
