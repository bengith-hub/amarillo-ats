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

  // Generate a consistent color for values not in BADGE_MAP
  function autoBadgeStyle(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
    const hue = ((hash % 360) + 360) % 360;
    return `background:hsl(${hue},55%,92%);color:hsl(${hue},60%,35%)`;
  }

  function badge(text) {
    if (!text) return '';
    const cls = BADGE_MAP[text] || '';
    if (cls) return `<span class="badge ${cls}">${escHtml(text)}</span>`;
    return `<span class="badge" style="${autoBadgeStyle(text)}">${escHtml(text)}</span>`;
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
  function modal(title, bodyHtml, { onSave, saveLabel = 'Enregistrer', width, draftKey } = {}) {
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

    // --- Dirty state tracking ---
    let _dirty = false;
    let _saved = false;

    // --- Draft auto-save ---
    const _draftLSKey = draftKey ? `ats_draft_${draftKey}` : null;
    let _draftTimer = null;

    function _collectFormData() {
      const data = {};
      overlay.querySelectorAll('input, textarea, select').forEach(el => {
        if (!el.id || el.type === 'hidden') return;
        data[el.id] = el.value;
      });
      return data;
    }

    function _restoreFormData(data) {
      Object.entries(data).forEach(([id, value]) => {
        const el = overlay.querySelector('#' + CSS.escape(id));
        if (el && el.type !== 'hidden') el.value = value;
      });
    }

    function _saveDraft() {
      if (!_draftLSKey) return;
      try {
        localStorage.setItem(_draftLSKey, JSON.stringify({
          data: _collectFormData(),
          timestamp: Date.now()
        }));
      } catch (e) { /* localStorage full */ }
    }

    function _clearDraft() {
      if (_draftLSKey) localStorage.removeItem(_draftLSKey);
      if (_draftTimer) clearInterval(_draftTimer);
    }

    // --- Close functions ---
    const close = () => {
      overlay.classList.remove('visible');
      document.removeEventListener('keydown', _escHandler);
      if (_draftTimer) clearInterval(_draftTimer);
    };

    const guardedClose = () => {
      if (_dirty && !_saved) {
        if (!confirm('Vous avez des modifications non sauvegardées. Quitter sans enregistrer ?')) {
          return;
        }
      }
      close();
    };

    // --- Escape key ---
    const _escHandler = (e) => {
      if (e.key === 'Escape') guardedClose();
    };
    document.addEventListener('keydown', _escHandler);

    // --- Event binding ---
    overlay.querySelector('.modal-close').addEventListener('click', guardedClose);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) guardedClose();
    });

    if (onSave) {
      overlay.querySelector('.modal-cancel').addEventListener('click', guardedClose);
      overlay.querySelector('.modal-save').addEventListener('click', async () => {
        _saved = true;
        _clearDraft();
        const saveBtn = overlay.querySelector('.modal-save');
        const cancelBtn = overlay.querySelector('.modal-cancel');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';
        if (cancelBtn) cancelBtn.disabled = true;
        try {
          await onSave(overlay);
        } catch (e) {
          if (e && e.message !== 'validation') {
            console.error('Save failed:', e);
          }
          _saved = false;
          saveBtn.disabled = false;
          saveBtn.textContent = saveLabel;
          if (cancelBtn) cancelBtn.disabled = false;
          return;
        }
        close();
      });
    }

    // --- Attach dirty tracking + draft restore/auto-save (after DOM is parsed) ---
    setTimeout(() => {
      // Dirty tracking on all form inputs
      overlay.querySelectorAll('input, textarea, select').forEach(el => {
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, () => { _dirty = true; });
      });

      // Draft restore + auto-save
      if (_draftLSKey) {
        try {
          const raw = localStorage.getItem(_draftLSKey);
          if (raw) {
            const { data, timestamp } = JSON.parse(raw);
            if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
              const age = Math.round((Date.now() - timestamp) / 60000);
              const ageLabel = age < 60
                ? `${age} min`
                : `${Math.round(age / 60)}h`;

              const banner = document.createElement('div');
              banner.style.cssText = 'background:#FFFDF0;border:1px solid #FEE566;border-radius:8px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;font-size:0.8125rem;';
              banner.innerHTML = `
                <span>Brouillon trouvé (il y a ${ageLabel})</span>
                <span>
                  <button class="btn btn-sm btn-primary" id="draft-restore">Restaurer</button>
                  <button class="btn btn-sm btn-secondary" id="draft-discard" style="margin-left:4px;">Ignorer</button>
                </span>
              `;
              const modalBody = overlay.querySelector('.modal-body');
              modalBody.insertBefore(banner, modalBody.firstChild);

              banner.querySelector('#draft-restore').addEventListener('click', () => {
                _restoreFormData(data);
                _dirty = true;
                banner.remove();
              });
              banner.querySelector('#draft-discard').addEventListener('click', () => {
                _clearDraft();
                banner.remove();
              });
            } else {
              localStorage.removeItem(_draftLSKey);
            }
          }
        } catch (e) { /* corrupted draft */ }

        // Auto-save every 5s if dirty
        _draftTimer = setInterval(() => {
          if (_dirty) _saveDraft();
        }, 5000);

        // Also save on input (debounced 1s)
        let _draftDebounce;
        overlay.querySelectorAll('input, textarea, select').forEach(el => {
          const evt = el.tagName === 'SELECT' ? 'change' : 'input';
          el.addEventListener(evt, () => {
            clearTimeout(_draftDebounce);
            _draftDebounce = setTimeout(_saveDraft, 1000);
          });
        });
      }
    }, 0);

    return { close, guardedClose, overlay };
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
            location.reload();
          } catch (e) {
            toast('Erreur lors de la création des bins', 'error');
          }
        } else {
          toast('Configuration sauvegardée', 'success');
          location.reload();
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

  function formatMonthYear(dateStr) {
    if (!dateStr) return '—';
    try {
      // Handle both "YYYY-MM" and "YYYY-MM-DD" formats
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1);
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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
            priorite: '', statut: 'À cibler',
            site_web: '', telephone: '', angle_approche: '', source: '', notes: '',
            dernier_contact: null, prochaine_relance: null,
            created_at: new Date().toISOString(),
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

  // Autocomplete candidat input (for "recommandé par", etc.)
  function candidatAutocomplete(inputId) {
    setTimeout(() => {
      const input = document.getElementById(inputId);
      if (!input) return;

      const candidats = Store.get('candidats');
      let dropdown = null;

      input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        if (dropdown) dropdown.remove();

        if (q.length < 1) return;

        const matches = candidats.filter(c => {
          const name = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase();
          return name.includes(q);
        }).slice(0, 8);

        if (matches.length === 0) return;

        dropdown = document.createElement('div');
        dropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:200;max-height:200px;overflow-y:auto;';

        matches.forEach(c => {
          const fullName = `${c.prenom || ''} ${c.nom || ''}`.trim();
          const item = document.createElement('div');
          item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;border-bottom:1px solid #f1f5f9;';
          item.innerHTML = `<strong>${escHtml(fullName)}</strong> <span style="color:#64748b;font-size:0.75rem;">${escHtml(c.poste_actuel || '')}${c.entreprise_actuelle_id ? ' • ' + escHtml(Store.resolve('entreprises', c.entreprise_actuelle_id)?.displayName || '') : ''}</span>`;
          item.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            input.value = fullName;
            if (dropdown) dropdown.remove();
            dropdown = null;
          });
          item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
          item.addEventListener('mouseleave', () => item.style.background = '#fff');
          dropdown.appendChild(item);
        });

        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(dropdown);
      });

      input.addEventListener('blur', () => {
        setTimeout(() => { if (dropdown) { dropdown.remove(); dropdown = null; } }, 200);
      });
    }, 50);
  }

  // Autocomplete localisation input (from Referentiels)
  function localisationAutocomplete(inputId) {
    setTimeout(() => {
      const input = document.getElementById(inputId);
      if (!input) return;

      let dropdown = null;

      input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        if (dropdown) dropdown.remove();
        if (q.length < 1) return;

        const locs = Referentiels.get('localisations');
        const matches = locs.filter(l => l.toLowerCase().includes(q)).slice(0, 10);

        dropdown = document.createElement('div');
        dropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:200;max-height:200px;overflow-y:auto;';

        matches.forEach(loc => {
          const item = document.createElement('div');
          item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;border-bottom:1px solid #f1f5f9;';
          item.textContent = loc;
          item.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            input.value = loc;
            if (dropdown) dropdown.remove();
            dropdown = null;
          });
          item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
          item.addEventListener('mouseleave', () => item.style.background = '#fff');
          dropdown.appendChild(item);
        });

        // Option to add to referentiels if no exact match
        const exact = locs.some(l => l.toLowerCase() === q);
        if (!exact && input.value.trim()) {
          const addItem = document.createElement('div');
          addItem.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;color:#c9a000;font-weight:600;';
          addItem.textContent = `+ Ajouter "${input.value.trim()}"`;
          addItem.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            const val = input.value.trim();
            Referentiels.addValue('localisations', val);
            input.value = val;
            if (dropdown) dropdown.remove();
            dropdown = null;
            toast('Localisation ajoutée aux référentiels');
          });
          dropdown.appendChild(addItem);
        }

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
              location.reload();
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
              location.reload();
            });
          }
        }, 100);
      });
    }
  }

  // ============================================================
  // INLINE EDIT — click-to-edit fields with auto-save (Notion-like)
  // ============================================================
  function inlineEdit(containerId, { entity, recordId, fields, onAfterSave }) {
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
      if (onAfterSave) onAfterSave(fieldKey, value);
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
      } else if (fieldDef.type === 'date' || fieldDef.type === 'month') {
        const input = document.createElement('input');
        input.type = fieldDef.type === 'month' ? 'month' : 'date';
        input.className = 'inline-edit-input';
        // For month inputs, only use YYYY-MM portion
        input.value = fieldDef.type === 'month' ? (currentValue || '').substring(0, 7) : currentValue;
        el.innerHTML = '';
        el.appendChild(input);
        input.focus();

        const finish = async () => {
          const val = input.value || null;
          if (val !== currentValue && val !== (currentValue || '').substring(0, 7)) {
            await saveField(fieldDef.key, val);
          }
          el.classList.remove('editing');
          renderFields();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('change', finish);
      } else if (fieldDef.type === 'autocomplete' && fieldDef.options) {
        // Autocomplete with referentiel suggestions
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-edit-input';
        input.value = currentValue;
        wrapper.appendChild(input);
        el.innerHTML = '';
        el.appendChild(wrapper);
        input.focus();
        input.select();

        let acDropdown = null;
        const buildDropdown = () => {
          if (acDropdown) acDropdown.remove();
          const q = input.value.toLowerCase().trim();
          if (q.length < 1) return;
          const opts = (typeof fieldDef.options === 'function' ? fieldDef.options() : fieldDef.options);
          const matches = opts.filter(o => o.toLowerCase().includes(q)).slice(0, 8);
          acDropdown = document.createElement('div');
          acDropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:200;max-height:180px;overflow-y:auto;';
          matches.forEach(opt => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:0.8125rem;border-bottom:1px solid #f1f5f9;';
            item.textContent = opt;
            item.addEventListener('mousedown', (ev) => { ev.preventDefault(); input.value = opt; input.blur(); });
            item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
            item.addEventListener('mouseleave', () => item.style.background = '#fff');
            acDropdown.appendChild(item);
          });
          if (!opts.some(o => o.toLowerCase() === q) && fieldDef.refKey) {
            const addItem = document.createElement('div');
            addItem.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:0.8125rem;color:#c9a000;font-weight:600;';
            addItem.textContent = `+ Ajouter "${input.value.trim()}"`;
            addItem.addEventListener('mousedown', (ev) => { ev.preventDefault(); Referentiels.addValue(fieldDef.refKey, input.value.trim()); toast('Ajouté aux référentiels'); input.blur(); });
            acDropdown.appendChild(addItem);
          }
          wrapper.appendChild(acDropdown);
        };
        input.addEventListener('input', buildDropdown);
        buildDropdown();

        const finish = async () => {
          if (acDropdown) acDropdown.remove();
          const val = input.value.trim();
          if (val !== currentValue) {
            await saveField(fieldDef.key, val);
          }
          el.classList.remove('editing');
          renderFields();
        };
        input.addEventListener('blur', () => setTimeout(finish, 150));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { el.classList.remove('editing'); renderFields(); } });
      } else if (fieldDef.type === 'entreprise_autocomplete') {
        // Special: entreprise autocomplete with ID storage
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-edit-input';
        input.placeholder = 'Tapez pour rechercher...';
        // Display current entreprise name
        const currentEntId = record[fieldDef.key];
        const currentEnt = currentEntId ? Store.resolve('entreprises', currentEntId) : null;
        input.value = currentEnt ? currentEnt.displayName : '';
        wrapper.appendChild(input);
        el.innerHTML = '';
        el.appendChild(wrapper);
        input.focus();
        input.select();

        let acDropdown = null;
        let selectedId = currentEntId || null;

        const buildDropdown = () => {
          if (acDropdown) acDropdown.remove();
          const q = input.value.toLowerCase().trim();
          if (q.length < 1) { selectedId = null; return; }
          const entreprises = Store.get('entreprises');
          const matches = entreprises.filter(e => (e.nom || '').toLowerCase().includes(q)).slice(0, 8);
          acDropdown = document.createElement('div');
          acDropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:200;max-height:200px;overflow-y:auto;';
          matches.forEach(e => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;border-bottom:1px solid #f1f5f9;';
            item.innerHTML = `<strong>${escHtml(e.nom)}</strong> <span style="color:#64748b;font-size:0.75rem;">${escHtml(e.secteur||'')} • ${escHtml(e.localisation||'')}</span>`;
            item.addEventListener('mousedown', (ev) => {
              ev.preventDefault();
              input.value = e.nom;
              selectedId = e.id;
              if (acDropdown) acDropdown.remove();
              acDropdown = null;
              input.blur();
            });
            item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
            item.addEventListener('mouseleave', () => item.style.background = '#fff');
            acDropdown.appendChild(item);
          });
          // "Créer cette entreprise" option
          if (!entreprises.some(e => (e.nom || '').toLowerCase() === q)) {
            const createItem = document.createElement('div');
            createItem.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;color:#c9a000;font-weight:600;border-top:1px solid #e2e8f0;';
            createItem.textContent = `+ Créer "${input.value.trim()}"`;
            createItem.addEventListener('mousedown', async (ev) => {
              ev.preventDefault();
              const newEnt = {
                id: API.generateId('ent'),
                nom: input.value.trim(),
                secteur: '', taille: '', ca: '', localisation: '',
                priorite: '', statut: 'À cibler',
                site_web: '', telephone: '', angle_approche: '', source: '', notes: '',
                dernier_contact: null, prochaine_relance: null,
                created_at: new Date().toISOString(),
              };
              await Store.add('entreprises', newEnt);
              input.value = newEnt.nom;
              selectedId = newEnt.id;
              if (acDropdown) acDropdown.remove();
              acDropdown = null;
              toast('Entreprise créée : ' + newEnt.nom);
              input.blur();
            });
            createItem.addEventListener('mouseenter', () => createItem.style.background = '#FFFDF0');
            createItem.addEventListener('mouseleave', () => createItem.style.background = '#fff');
            acDropdown.appendChild(createItem);
          }
          wrapper.appendChild(acDropdown);
        };
        input.addEventListener('input', () => { selectedId = null; buildDropdown(); });

        const finish = async () => {
          if (acDropdown) acDropdown.remove();
          const val = input.value.trim();
          if (!val) selectedId = null;
          if (selectedId !== currentEntId) {
            await saveField(fieldDef.key, selectedId);
          }
          el.classList.remove('editing');
          renderFields();
        };
        input.addEventListener('blur', () => setTimeout(finish, 150));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { el.classList.remove('editing'); renderFields(); } });
      } else if (fieldDef.type === 'candidat_autocomplete') {
        // Special: candidat autocomplete (stores text name)
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-edit-input';
        input.placeholder = 'Tapez pour rechercher...';
        input.value = currentValue;
        wrapper.appendChild(input);
        el.innerHTML = '';
        el.appendChild(wrapper);
        input.focus();
        input.select();

        let acDropdown = null;
        const buildDropdown = () => {
          if (acDropdown) acDropdown.remove();
          const q = input.value.toLowerCase().trim();
          if (q.length < 1) return;
          const candidats = Store.get('candidats');
          const matches = candidats.filter(c => {
            const name = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase();
            return name.includes(q);
          }).slice(0, 8);
          if (matches.length === 0) return;
          acDropdown = document.createElement('div');
          acDropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:200;max-height:200px;overflow-y:auto;';
          matches.forEach(c => {
            const fullName = `${c.prenom || ''} ${c.nom || ''}`.trim();
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;border-bottom:1px solid #f1f5f9;';
            item.innerHTML = `<strong>${escHtml(fullName)}</strong> <span style="color:#64748b;font-size:0.75rem;">${escHtml(c.poste_actuel || '')}</span>`;
            item.addEventListener('mousedown', (ev) => {
              ev.preventDefault();
              input.value = fullName;
              if (acDropdown) acDropdown.remove();
              acDropdown = null;
              input.blur();
            });
            item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
            item.addEventListener('mouseleave', () => item.style.background = '#fff');
            acDropdown.appendChild(item);
          });
          wrapper.appendChild(acDropdown);
        };
        input.addEventListener('input', buildDropdown);

        const finish = async () => {
          if (acDropdown) acDropdown.remove();
          const val = input.value.trim();
          if (val !== currentValue) {
            await saveField(fieldDef.key, val);
          }
          el.classList.remove('editing');
          renderFields();
        };
        input.addEventListener('blur', () => setTimeout(finish, 150));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { el.classList.remove('editing'); renderFields(); } });
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
    const statusCls = BADGE_MAP[currentStatus] || '';
    const statusStyle = statusCls ? '' : ` style="${autoBadgeStyle(currentStatus || '')}"`;
    const html = `<span class="badge ${statusCls} status-clickable" id="${id}" data-status="${escHtml(currentStatus || '')}"${statusStyle} title="Cliquer pour changer le statut">${escHtml(currentStatus || '—')}</span>`;

    // Deferred binding
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        showStatusPicker(el, currentStatus, options, async (newStatus) => {
          if (newStatus !== currentStatus) {
            await Store.update(entity, recordId, { [fieldName]: newStatus });
            const newCls = BADGE_MAP[newStatus] || '';
            el.className = `badge ${newCls} status-clickable`;
            el.style.cssText = newCls ? '' : autoBadgeStyle(newStatus);
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
      const optCls = BADGE_MAP[opt] || '';
      item.innerHTML = optCls
        ? `<span class="badge ${optCls}">${escHtml(opt)}</span>`
        : `<span class="badge" style="${autoBadgeStyle(opt)}">${escHtml(opt)}</span>`;
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

  // ============================================================
  // DOCUMENTS & GOOGLE DRIVE — gestion des documents liés
  // ============================================================

  /**
   * Renders a full documents management section for an entity.
   * @param {string} containerId - DOM container id
   * @param {object} opts
   * @param {string} opts.entity - 'candidats' | 'entreprises' | 'decideurs'
   * @param {string} opts.recordId - the record id
   * @param {string} opts.docTypesKey - referentiels key for document types
   * @param {function} [opts.onUpdate] - callback after any change
   */
  function documentsSection(containerId, { entity, recordId, docTypesKey, onUpdate }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    function render() {
      const record = Store.findById(entity, recordId);
      if (!record) return;

      const docs = record.documents || [];
      const driveUrl = record.google_drive_url || '';
      const docTypes = Referentiels.get(docTypesKey);

      container.innerHTML = `
        <div class="card" data-accent="orange" style="margin-bottom:16px;">
          <div class="card-header">
            <h2>Dossier Google Drive</h2>
          </div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="flex:1;">
                ${driveUrl
                  ? `<a href="${escHtml(driveUrl)}" target="_blank" class="entity-link" style="display:inline-flex;align-items:center;gap:6px;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      Ouvrir le dossier Drive
                    </a>`
                  : `<span style="font-size:0.8125rem;color:#94a3b8;font-style:italic;">Aucun dossier Drive lié</span>`
                }
              </div>
              <button class="btn btn-sm btn-secondary" id="doc-edit-drive-${containerId}">
                ${driveUrl ? 'Modifier le lien' : 'Ajouter un lien Drive'}
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>Documents (${docs.length})</h2>
            <button class="btn btn-sm btn-primary" id="doc-add-${containerId}">+ Document</button>
          </div>
          <div class="card-body">
            <div id="doc-list-${containerId}"></div>
          </div>
        </div>
      `;

      // Render document list
      const listEl = document.getElementById(`doc-list-${containerId}`);
      if (docs.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>Aucun document</p></div>';
      } else {
        listEl.innerHTML = `
          <div class="data-table-wrapper"><table class="data-table"><thead><tr>
            <th>Nom</th><th>Type</th><th>Date</th><th>Lien</th><th></th>
          </tr></thead><tbody>
          ${docs.map((doc, idx) => `<tr>
            <td><strong>${escHtml(doc.nom || '—')}</strong></td>
            <td>${badge(doc.type || '')}</td>
            <td style="font-size:0.8125rem;">${formatDate(doc.date_ajout)}</td>
            <td>
              <a href="${escHtml(doc.url || '#')}" target="_blank" class="entity-link" style="font-size:0.8125rem;display:inline-flex;align-items:center;gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Ouvrir
              </a>
            </td>
            <td style="white-space:nowrap;">
              <button class="btn btn-sm btn-secondary" data-doc-edit="${idx}" style="padding:2px 8px;font-size:0.75rem;">Modifier</button>
              <button class="btn btn-sm btn-danger" data-doc-delete="${idx}" style="padding:2px 8px;font-size:0.75rem;">Supprimer</button>
            </td>
          </tr>`).join('')}
          </tbody></table></div>
        `;

        // Delete handlers
        listEl.querySelectorAll('[data-doc-delete]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.docDelete);
            const docName = docs[idx]?.nom || 'ce document';
            modal('Supprimer le document', `<p style="color:#dc2626;">Supprimer <strong>${escHtml(docName)}</strong> ?</p>`, {
              saveLabel: 'Supprimer',
              onSave: async () => {
                const updated = [...docs];
                updated.splice(idx, 1);
                await Store.update(entity, recordId, { documents: updated });
                toast('Document supprimé');
                render();
                if (onUpdate) onUpdate();
              }
            });
          });
        });

        // Edit handlers
        listEl.querySelectorAll('[data-doc-edit]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.docEdit);
            showDocModal(docs[idx], idx);
          });
        });
      }

      // Drive link button
      document.getElementById(`doc-edit-drive-${containerId}`)?.addEventListener('click', () => {
        modal('Lien Google Drive', `
          <div class="form-group">
            <label>URL du dossier Google Drive</label>
            <input type="url" id="doc-drive-url" value="${escHtml(driveUrl)}" placeholder="https://drive.google.com/drive/folders/..." />
          </div>
          <p style="font-size:0.75rem;color:#64748b;margin-top:8px;">
            Collez ici le lien de partage du dossier Google Drive associé.
            Pour créer un dossier, ouvrez Google Drive et copiez le lien ici.
          </p>
        `, {
          onSave: async (overlay) => {
            const url = overlay.querySelector('#doc-drive-url').value.trim();
            await Store.update(entity, recordId, { google_drive_url: url });
            toast(url ? 'Lien Drive enregistré' : 'Lien Drive supprimé');
            render();
            if (onUpdate) onUpdate();
          }
        });
      });

      // Add document button
      document.getElementById(`doc-add-${containerId}`)?.addEventListener('click', () => {
        showDocModal(null, null);
      });

      function showDocModal(existing, editIdx) {
        const isEdit = existing !== null && editIdx !== null;
        const d = existing || {};

        modal(isEdit ? 'Modifier le document' : 'Ajouter un document', `
          <div class="form-group">
            <label>Nom du document</label>
            <input type="text" id="doc-nom" value="${escHtml(d.nom || '')}" placeholder="Ex: CV Jean Dupont, Contrat cadre..." />
          </div>
          <div class="form-group">
            <label>URL (lien Google Drive ou autre)</label>
            <input type="url" id="doc-url" value="${escHtml(d.url || '')}" placeholder="https://drive.google.com/..." />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Type de document</label>
              <select id="doc-type">
                <option value="">—</option>
                ${docTypes.map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Date</label>
              <input type="date" id="doc-date" value="${d.date_ajout || new Date().toISOString().split('T')[0]}" />
            </div>
          </div>
        `, {
          onSave: async (overlay) => {
            const nom = overlay.querySelector('#doc-nom').value.trim();
            const url = overlay.querySelector('#doc-url').value.trim();
            if (!nom || !url) {
              toast('Le nom et l\'URL sont requis', 'error');
              throw new Error('validation');
            }
            const docData = {
              id: isEdit ? (d.id || 'doc_' + Date.now()) : 'doc_' + Date.now(),
              nom,
              url,
              type: overlay.querySelector('#doc-type').value,
              date_ajout: overlay.querySelector('#doc-date').value,
            };
            const updated = [...docs];
            if (isEdit) {
              updated[editIdx] = docData;
            } else {
              updated.push(docData);
            }
            await Store.update(entity, recordId, { documents: updated });
            toast(isEdit ? 'Document modifié' : 'Document ajouté');
            render();
            if (onUpdate) onUpdate();
          }
        });
      }
    }

    render();
    return { refresh: render };
  }

  return {
    badge, autoBadgeStyle, entityLink, resolveLink,
    dataTable, filterBar, modal, toast,
    initTabs, timeline, showConfigModal,
    initGlobalSearch, entrepriseAutocomplete, candidatAutocomplete, localisationAutocomplete,
    candidatDecideurLink,
    inlineEdit, statusBadge, showStatusPicker,
    documentsSection,
    escHtml, formatDate, formatMonthYear, formatCurrency, getParam
  };
})();

// Sync error feedback — show toast when API sync fails
if (typeof Store !== 'undefined' && Store.onSyncError) {
  Store.onSyncError(({ entity }) => {
    UI.toast(`Erreur de synchronisation (${entity}). Modifications sauvegardées localement.`, 'error');
  });
}

// Sidebar responsive toggle (hamburger menu)
(function() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  // Create hamburger button
  const btn = document.createElement('button');
  btn.className = 'sidebar-toggle';
  btn.setAttribute('aria-label', 'Menu');
  btn.innerHTML = '&#9776;';
  document.body.appendChild(btn);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  function toggle() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  }
  function close() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }

  btn.addEventListener('click', toggle);
  overlay.addEventListener('click', close);
})();
