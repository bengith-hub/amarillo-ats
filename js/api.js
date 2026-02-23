// Amarillo ATS — JSONBin API Layer

const API = (() => {
  // Load config from config.js (hardcoded) or fallback to localStorage
  let config = {
    apiKey: '',
    bins: {
      candidats: '',
      entreprises: '',
      decideurs: '',
      missions: '',
      actions: '',
      facturation: '',
      references: '',
      notes: ''
    }
  };

  const BASE_URL = 'https://api.jsonbin.io/v3/b';

  function loadConfig() {
    // Priority 1: hardcoded config from config.js
    if (typeof ATS_CONFIG !== 'undefined' && ATS_CONFIG.apiKey) {
      config = { ...config, ...ATS_CONFIG };
      return true;
    }
    // Priority 2: localStorage (legacy fallback)
    const saved = localStorage.getItem('ats_config');
    if (saved) {
      config = JSON.parse(saved);
      return true;
    }
    return false;
  }

  function saveConfig(newConfig) {
    config = { ...config, ...newConfig };
    localStorage.setItem('ats_config', JSON.stringify(config));
  }

  function isConfigured() {
    return config.apiKey && Object.values(config.bins).some(b => b);
  }

  // Retry-aware fetch: handles 429 rate limits with exponential backoff
  async function fetchWithRetry(url, options, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.status === 429 && attempt < retries) {
          const delay = (attempt + 1) * 1500; // 1.5s, 3s, 4.5s
          console.warn(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return res;
      } catch (e) {
        // Network/CORS error — often caused by 429 without CORS headers
        if (attempt < retries) {
          const delay = (attempt + 1) * 2000;
          console.warn(`Fetch failed (${e.message}), retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw e;
      }
    }
  }

  async function fetchBin(entity) {
    const binId = config.bins[entity];
    if (!binId) throw new Error(`No bin configured for ${entity}`);

    const res = await fetchWithRetry(`${BASE_URL}/${binId}/latest`, {
      headers: { 'X-Master-Key': config.apiKey }
    });

    if (!res.ok) throw new Error(`Failed to fetch ${entity}: ${res.status}`);
    const data = await res.json();
    return data.record || [];
  }

  async function updateBin(entity, records) {
    const binId = config.bins[entity];
    if (!binId) throw new Error(`No bin configured for ${entity}`);

    const body = JSON.stringify(records);
    const sizeKB = Math.round(body.length / 1024);

    const res = await fetchWithRetry(`${BASE_URL}/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': config.apiKey
      },
      body
    });

    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (_) {}
      throw new Error(`Sync ${entity} failed: HTTP ${res.status} (payload ${sizeKB}KB)${detail ? ' — ' + detail.substring(0, 200) : ''}`);
    }
    return true;
  }

  async function createBin(entity, initialData = []) {
    const res = await fetch('https://api.jsonbin.io/v3/b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': config.apiKey,
        'X-Bin-Name': `ats-${entity}`
      },
      body: JSON.stringify(initialData)
    });

    if (!res.ok) throw new Error(`Failed to create bin for ${entity}: ${res.status}`);
    const data = await res.json();
    return data.metadata.id;
  }

  // Initialize all bins if not yet created
  async function initAllBins() {
    const entities = Object.keys(config.bins);
    for (const entity of entities) {
      if (!config.bins[entity]) {
        const binId = await createBin(entity);
        config.bins[entity] = binId;
      }
    }
    saveConfig(config);
    return config.bins;
  }

  // Generate unique ID
  function generateId(prefix) {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substr(2, 5);
    return `${prefix}_${ts}${rand}`;
  }

  loadConfig();

  return {
    loadConfig,
    saveConfig,
    isConfigured,
    fetchBin,
    updateBin,
    createBin,
    initAllBins,
    generateId,
    getConfig: () => config
  };
})();
