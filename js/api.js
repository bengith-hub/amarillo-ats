// Amarillo ATS — API Layer (Netlify Blobs via Netlify Functions)
// Migrated from JSONBin to Netlify Blobs for unlimited storage.

const API = (() => {
  const STORE_URL = '/.netlify/functions/store';

  // Legacy config (kept for backward compat with config.js references)
  let config = {
    apiKey: '',
    bins: {}
  };

  function loadConfig() {
    if (typeof ATS_CONFIG !== 'undefined') {
      config = { ...config, ...ATS_CONFIG };
    }
    return true;
  }

  function saveConfig(newConfig) {
    config = { ...config, ...newConfig };
    localStorage.setItem('ats_config', JSON.stringify(config));
  }

  function isConfigured() {
    // Always configured — Netlify Blobs doesn't need API keys
    return true;
  }

  // Retry-aware fetch with exponential backoff
  async function fetchWithRetry(url, options, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.status === 429 && attempt < retries) {
          const delay = (attempt + 1) * 1500;
          console.warn(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return res;
      } catch (e) {
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
    const res = await fetchWithRetry(`${STORE_URL}?entity=${entity}`);
    if (!res.ok) throw new Error(`Failed to fetch ${entity}: ${res.status}`);
    return await res.json();
  }

  async function updateBin(entity, records) {
    const body = JSON.stringify(records);
    const sizeKB = Math.round(body.length / 1024);

    const res = await fetchWithRetry(`${STORE_URL}?entity=${entity}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (_) {}
      throw new Error(`Sync ${entity} failed: HTTP ${res.status} (payload ${sizeKB}KB)${detail ? ' — ' + detail.substring(0, 200) : ''}`);
    }
    return true;
  }

  // Legacy — no longer needed with Netlify Blobs, kept for compat
  async function createBin() { return 'netlify-blob'; }
  async function initAllBins() { return config.bins; }

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
