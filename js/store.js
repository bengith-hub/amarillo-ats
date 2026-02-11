// Amarillo ATS — Store (cache + state management)

const Store = (() => {
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const STALE_TTL = 30 * 60 * 1000; // 30 min — serve stale but revalidate
  const cache = {};
  const listeners = {};
  const _refreshing = {}; // track in-flight API calls

  function getCacheKey(entity) {
    return `ats_data_${entity}`;
  }

  function getCachedData(entity, allowStale) {
    const key = getCacheKey(entity);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const { data, timestamp } = JSON.parse(raw);
    const age = Date.now() - timestamp;
    if (!allowStale && age > CACHE_TTL) return null;
    if (allowStale && age > STALE_TTL) return null;

    cache[entity] = data;
    return data;
  }

  function setCachedData(entity, data) {
    cache[entity] = data;
    const key = getCacheKey(entity);
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    emit(entity, data);
  }

  // Background revalidate — fetch from API without blocking
  function revalidate(entity) {
    if (_refreshing[entity]) return _refreshing[entity];
    _refreshing[entity] = API.fetchBin(entity).then(data => {
      setCachedData(entity, data);
      return data;
    }).catch(e => {
      console.warn(`Background revalidate ${entity} failed:`, e);
      return cache[entity] || [];
    }).finally(() => {
      delete _refreshing[entity];
    });
    return _refreshing[entity];
  }

  // Load entity: serve from cache instantly, revalidate in background
  async function load(entity) {
    // 1. Fresh cache — return immediately
    const fresh = getCachedData(entity, false);
    if (fresh) return fresh;

    // 2. Stale cache — return immediately + revalidate in background
    const stale = getCachedData(entity, true);
    if (stale) {
      revalidate(entity); // fire & forget
      return stale;
    }

    // 3. No cache at all — must wait for API
    try {
      const data = await API.fetchBin(entity);
      setCachedData(entity, data);
      return data;
    } catch (e) {
      console.error(`Failed to load ${entity}:`, e);
      return [];
    }
  }

  // Load all entities — instant if cached, parallel API calls only if needed
  async function loadAll() {
    const entities = ['candidats', 'entreprises', 'decideurs', 'missions', 'actions', 'facturation', 'references', 'notes'];
    const results = {};
    await Promise.all(entities.map(async (e) => {
      results[e] = await load(e);
    }));
    return results;
  }

  // Get from memory cache (sync)
  function get(entity) {
    return cache[entity] || getCachedData(entity) || [];
  }

  // Find a single record by ID
  function findById(entity, id) {
    const data = get(entity);
    return data.find(r => r.id === id) || null;
  }

  // Find records matching a filter
  function filter(entity, predicate) {
    return get(entity).filter(predicate);
  }

  // Add a record
  async function add(entity, record) {
    const data = get(entity);
    const now = new Date().toISOString().split('T')[0];
    record.created_at = record.created_at || now;
    record.updated_at = now;

    data.push(record);
    setCachedData(entity, data);

    try {
      await API.updateBin(entity, data);
    } catch (e) {
      console.error(`Failed to sync add for ${entity}:`, e);
    }

    return record;
  }

  // Update a record
  async function update(entity, id, updates) {
    const data = get(entity);
    const idx = data.findIndex(r => r.id === id);
    if (idx === -1) return null;

    const now = new Date().toISOString().split('T')[0];
    data[idx] = { ...data[idx], ...updates, updated_at: now };
    setCachedData(entity, data);

    try {
      await API.updateBin(entity, data);
    } catch (e) {
      console.error(`Failed to sync update for ${entity}:`, e);
    }

    return data[idx];
  }

  // Delete a record
  async function remove(entity, id) {
    let data = get(entity);
    data = data.filter(r => r.id !== id);
    setCachedData(entity, data);

    try {
      await API.updateBin(entity, data);
    } catch (e) {
      console.error(`Failed to sync delete for ${entity}:`, e);
    }

    return true;
  }

  // Force refresh from API
  async function refresh(entity) {
    try {
      const data = await API.fetchBin(entity);
      setCachedData(entity, data);
      return data;
    } catch (e) {
      console.error(`Failed to refresh ${entity}:`, e);
      return get(entity);
    }
  }

  // Force refresh all (parallel)
  async function refreshAll() {
    const entities = ['candidats', 'entreprises', 'decideurs', 'missions', 'actions', 'facturation', 'references', 'notes'];
    await Promise.all(entities.map(e => refresh(e)));
  }

  // Event system for reactivity
  function on(entity, callback) {
    if (!listeners[entity]) listeners[entity] = [];
    listeners[entity].push(callback);
  }

  function emit(entity, data) {
    if (listeners[entity]) {
      listeners[entity].forEach(cb => cb(data));
    }
  }

  // Resolve relation: get related entity name
  function resolve(entity, id) {
    const record = findById(entity, id);
    if (!record) return null;

    switch (entity) {
      case 'candidats':
        return { ...record, displayName: `${record.prenom || ''} ${record.nom || ''}`.trim() };
      case 'entreprises':
        return { ...record, displayName: record.nom || '' };
      case 'decideurs':
        return { ...record, displayName: `${record.prenom || ''} ${record.nom || ''}`.trim() };
      case 'missions':
        return { ...record, displayName: record.nom || record.ref || '' };
      default:
        return record;
    }
  }

  // Search across all entities
  function search(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results = [];

    get('candidats').forEach(c => {
      const name = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase();
      if (name.includes(q) || (c.poste_actuel || '').toLowerCase().includes(q)) {
        results.push({ type: 'candidat', id: c.id, label: `${c.prenom || ''} ${c.nom || ''}`, sub: c.poste_actuel || '', url: `candidat.html?id=${c.id}` });
      }
    });

    get('entreprises').forEach(e => {
      if ((e.nom || '').toLowerCase().includes(q)) {
        results.push({ type: 'entreprise', id: e.id, label: e.nom, sub: `${e.secteur || ''} • ${e.localisation || ''}`, url: `entreprise.html?id=${e.id}` });
      }
    });

    get('decideurs').forEach(d => {
      const name = `${d.prenom || ''} ${d.nom || ''}`.toLowerCase();
      if (name.includes(q) || (d.fonction || '').toLowerCase().includes(q)) {
        results.push({ type: 'decideur', id: d.id, label: `${d.prenom || ''} ${d.nom || ''}`, sub: d.fonction || '', url: `decideur.html?id=${d.id}` });
      }
    });

    get('missions').forEach(m => {
      if ((m.nom || '').toLowerCase().includes(q) || (m.ref || '').toLowerCase().includes(q)) {
        results.push({ type: 'mission', id: m.id, label: m.nom || m.ref, sub: m.statut || '', url: `mission.html?id=${m.id}` });
      }
    });

    return results.slice(0, 15);
  }

  return {
    load, loadAll, get, findById, filter,
    add, update, remove,
    refresh, refreshAll,
    on, search, resolve
  };
})();
