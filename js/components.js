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
    'À contacter': 'badge-a-contacter',
    'En relation': 'badge-en-relation',
    'Champion': 'badge-champion',
    // Décideur roles
    'Décideur': 'badge-decideur',
    'Influenceur': 'badge-influenceur',
    'Prescripteur': 'badge-prescripteur',
    // Relations entre entreprises
    'Société mère': 'badge-societe-mere',
    'Filiale': 'badge-filiale',
    'Même groupe': 'badge-meme-groupe',
    'Partenaire': 'badge-partenaire',
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

  // Sortable, filterable data table with column visibility
  function dataTable(containerId, { columns, data, onRowClick, emptyMessage = 'Aucune donnée', storageKey }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Column visibility (persisted in localStorage)
    let hiddenCols = new Set();
    if (storageKey) {
      try {
        const saved = JSON.parse(localStorage.getItem('ats_cols_' + storageKey) || '[]');
        hiddenCols = new Set(saved);
      } catch { /* ignore */ }
    }

    function saveColVisibility() {
      if (storageKey) localStorage.setItem('ats_cols_' + storageKey, JSON.stringify([...hiddenCols]));
    }

    function visibleColumns() {
      return columns.filter(c => !hiddenCols.has(c.key));
    }

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>${emptyMessage}</p></div>`;
      return;
    }

    let sortCol = null;
    let sortDir = 'asc';
    let currentRows = data;

    function render(rows) {
      currentRows = rows;
      const visCols = visibleColumns();
      const html = `
        ${storageKey ? `<div style="display:flex;justify-content:flex-end;margin-bottom:6px;position:relative;">
          <button class="col-settings-btn" style="border:none;background:#f1f5f9;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.75rem;color:#64748b;display:inline-flex;align-items:center;gap:4px;">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            Colonnes
          </button>
          <div class="col-settings-dropdown" style="display:none;position:absolute;right:0;top:100%;z-index:100;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);padding:8px;min-width:200px;">
            ${columns.map(col => `
              <label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:0.8125rem;cursor:pointer;border-radius:4px;white-space:nowrap;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <input type="checkbox" data-col-key="${col.key}" ${!hiddenCols.has(col.key) ? 'checked' : ''} style="accent-color:#3b82f6;" />
                ${col.label}
              </label>
            `).join('')}
          </div>
        </div>` : ''}
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                ${visCols.map(col => `
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
                  ${visCols.map(col => `<td>${col.render ? col.render(row) : escHtml(row[col.key] || '')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      container.innerHTML = html;

      // Column settings toggle
      const colBtn = container.querySelector('.col-settings-btn');
      const colDrop = container.querySelector('.col-settings-dropdown');
      if (colBtn && colDrop) {
        colBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          colDrop.style.display = colDrop.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', () => { colDrop.style.display = 'none'; }, { once: true });
        colDrop.addEventListener('click', (e) => e.stopPropagation());
        colDrop.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.addEventListener('change', () => {
            const key = cb.dataset.colKey;
            if (cb.checked) hiddenCols.delete(key);
            else hiddenCols.add(key);
            saveColVisibility();
            render(currentRows);
          });
        });
      }

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
            if (e.target.closest('a')) return;
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

  // Rich text rendering — converts plain text with bullet points to formatted HTML
  function renderRichText(text) {
    if (!text) return '';
    const escaped = escHtml(text);
    const lines = escaped.split('\n');
    let html = '';
    let inUl = false;
    let inOl = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);
      const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);

      if (bulletMatch) {
        if (inOl) { html += '</ol>'; inOl = false; }
        if (!inUl) { html += '<ul style="margin:4px 0;padding-left:20px;">'; inUl = true; }
        html += `<li>${bulletMatch[1]}</li>`;
      } else if (numberedMatch) {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (!inOl) { html += '<ol style="margin:4px 0;padding-left:20px;">'; inOl = true; }
        html += `<li>${numberedMatch[2]}</li>`;
      } else {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (inOl) { html += '</ol>'; inOl = false; }
        if (trimmed === '') {
          html += '<div style="height:8px;"></div>';
        } else {
          html += `<div>${line}</div>`;
        }
      }
    }
    if (inUl) html += '</ul>';
    if (inOl) html += '</ol>';
    return html;
  }

  // Utility functions
  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function normalizeUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return 'https://' + url;
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
                niveau_relation: 'À contacter',
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
            ${f.label ? `<div class="inline-field-label">${f.label}</div>` : ''}
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
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { el.classList.remove('editing'); renderFields(); } });
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

  // ============================================================
  // DRAWER — slide-in panel from right (for map/route views)
  // ============================================================
  function drawer(title, contentHtml, { width = 520, onClose } = {}) {
    let overlay = document.getElementById('drawer-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'drawer-overlay';
    overlay.className = 'drawer-overlay';

    const panel = document.createElement('div');
    panel.className = 'drawer-panel';
    panel.style.width = width + 'px';

    panel.innerHTML = `
      <div class="drawer-header">
        <h3>${escHtml(title)}</h3>
        <button class="modal-close drawer-close">&times;</button>
      </div>
      <div class="drawer-body">${contentHtml}</div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      panel.classList.add('visible');
    });

    const close = () => {
      panel.classList.remove('visible');
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
        if (onClose) onClose();
      }, 300);
      document.removeEventListener('keydown', escHandler);
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', escHandler);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    panel.querySelector('.drawer-close').addEventListener('click', close);

    return { close, panel, overlay };
  }

  // LinkedIn enriched badge — displays a mini LinkedIn card with profile info
  function linkedinBadge(url, { compact = false } = {}) {
    if (!url) return '';
    const normalized = normalizeUrl(url);
    // Extract username from LinkedIn URL
    const match = normalized.match(/linkedin\.com\/in\/([^/?#]+)/);
    const slug = match ? decodeURIComponent(match[1]).replace(/-/g, ' ') : null;
    const displayName = slug
      ? slug.replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+\d+$/, '') // capitalize + strip trailing numbers
      : 'Voir le profil';

    if (compact) {
      return `<a href="${escHtml(normalized)}" target="_blank" rel="noopener" class="linkedin-badge-compact" title="${escHtml(normalized)}">
        <svg class="linkedin-icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        ${escHtml(displayName)}
      </a>`;
    }

    return `<a href="${escHtml(normalized)}" target="_blank" rel="noopener" class="linkedin-badge" title="Ouvrir le profil LinkedIn">
      <div class="linkedin-badge-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </div>
      <div class="linkedin-badge-info">
        <span class="linkedin-badge-name">${escHtml(displayName)}</span>
        <span class="linkedin-badge-label">Profil LinkedIn</span>
      </div>
      <svg class="linkedin-badge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
    </a>`;
  }

  // Row count bar — displays filtered/total count between filters and table
  function rowCount(containerId, { filtered, total, label, isFiltered }) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (isFiltered) {
      el.innerHTML = `<span class="row-count-number">${filtered}</span> / ${total} ${escHtml(label)}`;
    } else {
      el.innerHTML = `<span class="row-count-number">${total}</span> ${escHtml(label)}`;
    }
  }

  return {
    badge, autoBadgeStyle, entityLink, resolveLink,
    dataTable, filterBar, modal, toast,
    initTabs, timeline, showConfigModal,
    initGlobalSearch, entrepriseAutocomplete, candidatAutocomplete, localisationAutocomplete,
    candidatDecideurLink,
    inlineEdit, statusBadge, showStatusPicker,
    documentsSection, drawer,
    linkedinBadge, rowCount,
    escHtml, renderRichText, normalizeUrl, formatDate, formatMonthYear, formatCurrency, getParam
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

// ─── Backup Health Monitor ──────────────────────────────
// Checks backup status on every page load and shows a warning banner
// if the last successful backup is older than 48 hours.
// Uses localStorage to avoid excessive API calls (checks bin every 6h max).
(function() {
  const STALE_THRESHOLD = 48 * 60 * 60 * 1000; // 48h
  const CHECK_INTERVAL = 6 * 60 * 60 * 1000;   // 6h between API checks
  const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24h dismiss

  const LS_LAST_SUCCESS = 'ats_backup_last_success';
  const LS_LAST_CHECK   = 'ats_backup_monitor_check';
  const LS_DISMISSED    = 'ats_backup_alert_dismissed';
  const LS_LAST_ERROR   = 'ats_backup_last_error';

  function init() {
    if (typeof API === 'undefined' || !API.isConfigured()) return;
    if (typeof ATS_CONFIG === 'undefined') return;

    const now = Date.now();

    // Check if alert was dismissed recently
    const dismissed = localStorage.getItem(LS_DISMISSED);
    if (dismissed && (now - parseInt(dismissed)) < DISMISS_DURATION) return;

    // Check localStorage for cached status
    const lastSuccess = localStorage.getItem(LS_LAST_SUCCESS);
    const lastCheck = localStorage.getItem(LS_LAST_CHECK);
    const lastError = localStorage.getItem(LS_LAST_ERROR);

    // If we have a recent success timestamp, check if it's stale
    if (lastSuccess) {
      const age = now - new Date(lastSuccess).getTime();
      if (age < STALE_THRESHOLD) return; // All good
    }

    // Show banner based on cached info
    if (lastSuccess || lastError) {
      showBanner(lastSuccess, lastError);
    }

    // Background check the backup bin if we haven't checked recently
    if (!lastCheck || (now - parseInt(lastCheck)) > CHECK_INTERVAL) {
      checkBackupBin();
    }
  }

  async function checkBackupBin() {
    const binId = ATS_CONFIG.bins?.backups;
    if (!binId) return; // Backup bin not yet created

    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { 'X-Master-Key': ATS_CONFIG.apiKey }
      });

      if (!res.ok) return;

      const result = await res.json();
      const container = result.record || {};
      const status = container.status || {};

      localStorage.setItem(LS_LAST_CHECK, Date.now().toString());

      if (status.last_success) {
        localStorage.setItem(LS_LAST_SUCCESS, status.last_success);
      }

      if (status.result === 'error' && status.error) {
        localStorage.setItem(LS_LAST_ERROR, JSON.stringify({
          date: status.last_run,
          message: status.error
        }));
      } else {
        localStorage.removeItem(LS_LAST_ERROR);
      }

      // Re-evaluate after fresh data
      const now = Date.now();
      const dismissed = localStorage.getItem(LS_DISMISSED);
      if (dismissed && (now - parseInt(dismissed)) < DISMISS_DURATION) return;

      if (status.last_success) {
        const age = now - new Date(status.last_success).getTime();
        if (age >= STALE_THRESHOLD) {
          showBanner(status.last_success, status.result === 'error' ? JSON.stringify({ date: status.last_run, message: status.error }) : null);
        } else {
          removeBanner();
        }
      }

      // Send email alert if Gmail is configured and there's a new error
      if (status.result === 'error' && status.error) {
        const notifiedKey = 'ats_backup_alert_notified_' + status.last_run;
        if (!localStorage.getItem(notifiedKey) && typeof Backup !== 'undefined' && typeof Gmail !== 'undefined') {
          trySendEmailAlert(status, notifiedKey);
        }
      }
    } catch (e) {
      // Silent fail — don't block the page
      console.warn('Backup monitor check failed:', e.message);
    }
  }

  async function trySendEmailAlert(status, notifiedKey) {
    try {
      if (!GoogleAuth.isConfigured() || !GoogleAuth.isAuthenticated()) return;

      const senderEmail = GoogleAuth.getSenderEmail();
      if (!senderEmail) return;

      const subject = '⚠️ Amarillo ATS — Échec du backup automatique';
      const body = [
        'Le backup automatique de l\'ATS a échoué.',
        '',
        'Date : ' + new Date(status.last_run).toLocaleString('fr-FR'),
        'Erreur : ' + status.error,
        '',
        'Connectez-vous à l\'ATS pour vérifier : Référentiels > Sauvegardes',
        '',
        '— Amarillo ATS (alerte automatique)'
      ].join('\n');

      const raw = btoa(unescape(encodeURIComponent(
        'From: ' + senderEmail + '\r\n' +
        'To: ' + senderEmail + '\r\n' +
        'Subject: ' + subject + '\r\n' +
        'Content-Type: text/plain; charset=utf-8\r\n\r\n' +
        body
      ))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const token = GoogleAuth.getAccessToken();
      if (!token) return;

      await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
      });

      localStorage.setItem(notifiedKey, '1');
      console.log('Backup alert email sent');
    } catch (e) {
      console.warn('Failed to send backup alert email:', e.message);
    }
  }

  function showBanner(lastSuccess, lastErrorJson) {
    removeBanner(); // Remove existing banner if any

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    let message = '⚠️ Le dernier backup automatique ';
    if (lastSuccess) {
      const d = new Date(lastSuccess);
      message += 'date de ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
      message += 'n\'a jamais été effectué';
    }
    message += '. ';

    if (lastErrorJson) {
      try {
        const err = JSON.parse(lastErrorJson);
        message += 'Dernière erreur : ' + err.message + '. ';
      } catch (_) {}
    }

    message += '<a href="referentiels.html" style="color:inherit;font-weight:700;text-decoration:underline;">Vérifier les sauvegardes →</a>';

    const banner = document.createElement('div');
    banner.id = 'backup-alert-banner';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <span>${message}</span>
        <button id="backup-alert-dismiss" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.1rem;padding:4px 8px;opacity:0.7;flex-shrink:0;" title="Masquer pendant 24h">✕</button>
      </div>
    `;
    banner.style.cssText = 'background:#fef3c7;color:#92400e;padding:10px 20px;font-size:0.8125rem;border-bottom:1px solid #fcd34d;';

    mainContent.insertBefore(banner, mainContent.firstChild);

    document.getElementById('backup-alert-dismiss')?.addEventListener('click', () => {
      localStorage.setItem(LS_DISMISSED, Date.now().toString());
      removeBanner();
    });
  }

  function removeBanner() {
    document.getElementById('backup-alert-banner')?.remove();
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to let other scripts initialize
    setTimeout(init, 500);
  }
})();
