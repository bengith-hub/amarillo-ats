// Amarillo ATS — Command Palette (Skills IA)
// Palette de commandes / pour lancer des skills depuis n'importe quelle page.
// Depend de : store.js, components.js, skills-engine.js

const CommandPalette = (() => {

  let _overlay = null;
  let _open = false;
  let _selectedIndex = 0;
  let _filteredSkills = [];
  let _mode = 'skills'; // 'skills' | 'entity-search'
  let _pendingSkill = null;

  // ============================================================
  // CONTEXTE
  // ============================================================

  function _getCurrentContext() {
    const topbar = document.querySelector('.topbar');
    const entityType = topbar ? topbar.getAttribute('data-entity') : null;
    const id = new URLSearchParams(window.location.search).get('id');

    // Only valid entity types with detail pages
    const validTypes = ['candidats', 'entreprises', 'decideurs'];
    if (!validTypes.includes(entityType) || !id) {
      return { entityType: null, entityId: null };
    }

    return { entityType, entityId: id };
  }

  // ============================================================
  // PALETTE UI
  // ============================================================

  function open() {
    if (_open) return;
    _open = true;
    _mode = 'skills';
    _pendingSkill = null;
    _selectedIndex = 0;

    // Create overlay
    _overlay = document.createElement('div');
    _overlay.className = 'cmd-palette-overlay';
    _overlay.innerHTML = `
      <div class="cmd-palette">
        <div class="cmd-palette-input-wrap">
          <span class="cmd-palette-slash">/</span>
          <input type="text" class="cmd-palette-input" placeholder="Rechercher un skill..." autofocus />
        </div>
        <div class="cmd-palette-list"></div>
        <div class="cmd-palette-footer">
          <a href="skills.html" class="cmd-palette-manage">Gerer les skills &rarr;</a>
        </div>
      </div>
    `;

    document.body.appendChild(_overlay);

    // Events
    const input = _overlay.querySelector('.cmd-palette-input');
    input.addEventListener('input', () => _onFilterChange(input.value));
    input.addEventListener('keydown', _onKeyDown);
    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) close();
    });

    // Initial render
    _renderSkillsList('');
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (!_open) return;
    _open = false;
    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
    }
    _overlay = null;
  }

  // ============================================================
  // SKILLS LIST MODE
  // ============================================================

  function _renderSkillsList(query) {
    if (!_overlay) return;
    const list = _overlay.querySelector('.cmd-palette-list');
    const { entityType } = _getCurrentContext();

    // Get all active skills
    let skills = SkillsEngine.getSkills().filter(s => s.statut === 'actif');

    // Filter by entity type if on a detail page
    if (entityType) {
      skills = skills.filter(s => s.entity_types && s.entity_types.includes(entityType));
    }

    // Filter by query
    if (query) {
      const q = query.toLowerCase();
      skills = skills.filter(s =>
        (s.nom && s.nom.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }

    _filteredSkills = skills;
    _selectedIndex = Math.min(_selectedIndex, Math.max(0, skills.length - 1));

    if (skills.length === 0) {
      list.innerHTML = `
        <div class="cmd-palette-empty">
          ${query ? 'Aucun skill correspondant' : 'Aucun skill actif'}
          ${!query ? '<br><a href="skills.html" style="color:#3b82f6;font-size:0.8rem;">Creer un skill</a>' : ''}
        </div>
      `;
      return;
    }

    list.innerHTML = skills.map((skill, i) => `
      <div class="cmd-palette-item ${i === _selectedIndex ? 'cmd-palette-item-selected' : ''}" data-index="${i}">
        <span class="cmd-palette-dot" style="background:${skill.color || '#f59e0b'}"></span>
        <div class="cmd-palette-item-info">
          <span class="cmd-palette-item-name">${_escHtml(skill.nom)}</span>
          ${skill.description ? `<span class="cmd-palette-item-desc">${_escHtml(skill.description)}</span>` : ''}
        </div>
        <div class="cmd-palette-item-meta">
          ${skill.entity_types ? skill.entity_types.map(t => `<span class="cmd-palette-badge">${SkillsEngine.ENTITY_LABELS[t] || t}</span>`).join('') : ''}
          ${skill.steps && skill.steps.length > 1 ? `<span class="cmd-palette-steps">${skill.steps.length} etapes</span>` : ''}
        </div>
      </div>
    `).join('');

    // Click events
    list.querySelectorAll('.cmd-palette-item').forEach(item => {
      item.addEventListener('click', () => {
        _selectedIndex = parseInt(item.dataset.index);
        _selectCurrent();
      });
    });
  }

  // ============================================================
  // ENTITY SEARCH MODE (hors fiche detail)
  // ============================================================

  function _showEntitySearch(skill) {
    if (!_overlay) return;
    _mode = 'entity-search';
    _pendingSkill = skill;
    _selectedIndex = 0;

    const input = _overlay.querySelector('.cmd-palette-input');
    const slash = _overlay.querySelector('.cmd-palette-slash');
    input.value = '';
    input.placeholder = 'Chercher un(e) ' + (skill.entity_types || []).map(t => SkillsEngine.ENTITY_LABELS[t] || t).join(' / ') + '...';
    if (slash) slash.textContent = '>';

    _renderEntityList('');
    input.focus();
  }

  function _renderEntityList(query) {
    if (!_overlay || !_pendingSkill) return;
    const list = _overlay.querySelector('.cmd-palette-list');
    const footer = _overlay.querySelector('.cmd-palette-footer');
    if (footer) footer.innerHTML = '<a href="#" class="cmd-palette-manage cmd-palette-back">&larr; Retour aux skills</a>';

    // Wire back button
    const backBtn = _overlay.querySelector('.cmd-palette-back');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        _mode = 'skills';
        _pendingSkill = null;
        const input = _overlay.querySelector('.cmd-palette-input');
        const slash = _overlay.querySelector('.cmd-palette-slash');
        input.value = '';
        input.placeholder = 'Rechercher un skill...';
        if (slash) slash.textContent = '/';
        if (footer) footer.innerHTML = '<a href="skills.html" class="cmd-palette-manage">Gerer les skills &rarr;</a>';
        _renderSkillsList('');
        input.focus();
      });
    }

    // Search entities matching the skill's entity_types
    let entities = [];
    const types = _pendingSkill.entity_types || [];
    const q = (query || '').toLowerCase();

    for (const type of types) {
      const all = Store.get(type) || [];
      for (const ent of all) {
        let label = '';
        let sub = '';
        if (type === 'candidats') {
          label = (ent.prenom || '') + ' ' + (ent.nom || '');
          sub = ent.poste_actuel || ent.poste_cible || '';
        } else if (type === 'entreprises') {
          label = ent.nom || '';
          sub = ent.secteur || '';
        } else if (type === 'decideurs') {
          label = (ent.prenom || '') + ' ' + (ent.nom || '');
          sub = ent.fonction || '';
        }
        label = label.trim();
        if (!label) continue;
        if (q && !label.toLowerCase().includes(q) && !sub.toLowerCase().includes(q)) continue;
        entities.push({ id: ent.id, type, label, sub });
      }
    }

    // Sort by relevance / name
    entities.sort((a, b) => a.label.localeCompare(b.label));
    entities = entities.slice(0, 20);

    _filteredSkills = entities; // reuse for keyboard nav
    _selectedIndex = Math.min(_selectedIndex, Math.max(0, entities.length - 1));

    if (entities.length === 0) {
      list.innerHTML = '<div class="cmd-palette-empty">' + (q ? 'Aucun resultat' : 'Tapez pour rechercher...') + '</div>';
      return;
    }

    list.innerHTML = entities.map((ent, i) => `
      <div class="cmd-palette-item ${i === _selectedIndex ? 'cmd-palette-item-selected' : ''}" data-index="${i}">
        <span class="cmd-palette-dot" style="background:#94a3b8"></span>
        <div class="cmd-palette-item-info">
          <span class="cmd-palette-item-name">${_escHtml(ent.label)}</span>
          ${ent.sub ? `<span class="cmd-palette-item-desc">${_escHtml(ent.sub)}</span>` : ''}
        </div>
        <span class="cmd-palette-badge">${SkillsEngine.ENTITY_LABELS[ent.type] || ent.type}</span>
      </div>
    `).join('');

    list.querySelectorAll('.cmd-palette-item').forEach(item => {
      item.addEventListener('click', () => {
        _selectedIndex = parseInt(item.dataset.index);
        _selectEntity();
      });
    });
  }

  function _selectEntity() {
    if (!_pendingSkill || !_filteredSkills[_selectedIndex]) return;
    const ent = _filteredSkills[_selectedIndex];
    close();
    SkillsEngine.showRunner(_pendingSkill, ent.type, ent.id);
  }

  // ============================================================
  // SELECTION & NAVIGATION
  // ============================================================

  function _selectCurrent() {
    if (_mode === 'entity-search') {
      _selectEntity();
      return;
    }

    const skill = _filteredSkills[_selectedIndex];
    if (!skill) return;

    const { entityType, entityId } = _getCurrentContext();

    if (entityType && entityId) {
      // On a detail page — launch immediately
      close();
      SkillsEngine.showRunner(skill, entityType, entityId);
    } else {
      // No context — switch to entity search
      _showEntitySearch(skill);
    }
  }

  function _onFilterChange(query) {
    _selectedIndex = 0;
    if (_mode === 'entity-search') {
      _renderEntityList(query);
    } else {
      _renderSkillsList(query);
    }
  }

  function _onKeyDown(e) {
    const maxIdx = _filteredSkills.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _selectedIndex = Math.min(_selectedIndex + 1, maxIdx);
      _updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _selectedIndex = Math.max(_selectedIndex - 1, 0);
      _updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      _selectCurrent();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function _updateSelection() {
    if (!_overlay) return;
    const items = _overlay.querySelectorAll('.cmd-palette-item');
    items.forEach((item, i) => {
      item.classList.toggle('cmd-palette-item-selected', i === _selectedIndex);
    });
    // Scroll into view
    const selected = _overlay.querySelector('.cmd-palette-item-selected');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  // ============================================================
  // GLOBAL LISTENER
  // ============================================================

  function _initGlobalListener() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || _open) return;

      const el = document.activeElement;
      const tag = el?.tagName;

      // In a text field: trigger only if cursor is at start of empty field or start of line
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        const val = el.value;
        const pos = el.selectionStart || 0;
        const atLineStart = pos === 0 || val[pos - 1] === '\n';
        if (!atLineStart) return; // let '/' type normally
        e.preventDefault();
        open();
        return;
      }

      // Skip selects and contentEditable
      if (tag === 'SELECT') return;
      if (el?.isContentEditable) return;

      e.preventDefault();
      open();
    });
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initGlobalListener);
  } else {
    _initGlobalListener();
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================================
  // PUBLIC
  // ============================================================

  return { open, close };
})();
