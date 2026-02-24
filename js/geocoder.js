// Amarillo ATS — Geocoder module
// Converts addresses and city names to lat/lng coordinates
// Uses: 1) Static lookup table  2) localStorage cache  3) BAN API (api-adresse.data.gouv.fr)

const Geocoder = (() => {

  const CACHE_KEY = 'ats_geocache';
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Tier 1: Static coordinates for referentiel localisations + major cities
  const CITY_COORDS = {
    'Paris':            { lat: 48.8566, lng: 2.3522 },
    'Île-de-France':    { lat: 48.8499, lng: 2.6370 },
    'Ile-de-France':    { lat: 48.8499, lng: 2.6370 },
    'Lyon':             { lat: 45.7640, lng: 4.8357 },
    'Marseille':        { lat: 43.2965, lng: 5.3698 },
    'Toulouse':         { lat: 43.6047, lng: 1.4442 },
    'Bordeaux':         { lat: 44.8378, lng: -0.5792 },
    'Nantes':           { lat: 47.2184, lng: -1.5536 },
    'Lille':            { lat: 50.6292, lng: 3.0573 },
    'Strasbourg':       { lat: 48.5734, lng: 7.7521 },
    'Rennes':           { lat: 48.1173, lng: -1.6778 },
    'Montpellier':      { lat: 43.6108, lng: 3.8767 },
    'Nice':             { lat: 43.7102, lng: 7.2620 },
    'Grenoble':         { lat: 45.1885, lng: 5.7245 },
    'Versailles':       { lat: 48.8014, lng: 2.1301 },
    'Aix-en-Provence':  { lat: 43.5297, lng: 5.4474 },
    'Rouen':            { lat: 49.4432, lng: 1.0999 },
    'Tours':            { lat: 47.3941, lng: 0.6848 },
    'Dijon':            { lat: 47.3220, lng: 5.0415 },
    'Clermont-Ferrand': { lat: 45.7772, lng: 3.0870 },
    'Angers':           { lat: 47.4784, lng: -0.5632 },
    'Metz':             { lat: 49.1193, lng: 6.1757 },
    'Nancy':            { lat: 48.6921, lng: 6.1844 },
    'Orléans':          { lat: 47.9029, lng: 1.9093 },
    'Reims':            { lat: 49.2583, lng: 4.0317 },
    'Le Mans':          { lat: 48.0061, lng: 0.1996 },
    'Brest':            { lat: 48.3904, lng: -4.4861 },
    'Caen':             { lat: 49.1829, lng: -0.3707 },
    'La Rochelle':      { lat: 46.1603, lng: -1.1511 },
    'Pau':              { lat: 43.2951, lng: -0.3708 },
    'Perpignan':        { lat: 42.6887, lng: 2.8948 },
    'Toulon':           { lat: 43.1242, lng: 5.9280 },
    'Saint-Étienne':    { lat: 45.4397, lng: 4.3872 },
    'Limoges':          { lat: 45.8336, lng: 1.2611 },
    'Amiens':           { lat: 49.8941, lng: 2.2958 },
    'Poitiers':         { lat: 46.5802, lng: 0.3404 },
    'Besançon':         { lat: 47.2378, lng: 6.0241 },
    'Annecy':           { lat: 45.8992, lng: 6.1294 },
    'Valence':          { lat: 44.9334, lng: 4.8924 },
    'Avignon':          { lat: 43.9493, lng: 4.8055 },
  };

  // Localisations that should not be mapped (mobile/remote candidates)
  const MOBILE_LOCALISATIONS = ['France entière', 'Remote France', 'International', 'Autre'];

  function isMobile(localisation) {
    return MOBILE_LOCALISATIONS.includes(localisation);
  }

  // --- Cache management ---
  function _getCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch { return {}; }
  }

  function _setCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  function getCached(key) {
    const cache = _getCache();
    const entry = cache[key];
    if (entry && (Date.now() - entry.ts) < CACHE_TTL) {
      return { lat: entry.lat, lng: entry.lng };
    }
    return null;
  }

  function setCached(key, lat, lng) {
    const cache = _getCache();
    cache[key] = { lat, lng, ts: Date.now() };
    _setCache(cache);
  }

  // --- BAN API ---
  async function _queryBAN(query) {
    try {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        return { lat, lng };
      }
    } catch {}
    return null;
  }

  // --- BAN Municipality Search (for address autocomplete) ---
  const _municipalityCache = new Map();
  const _MC_TTL = 5 * 60 * 1000; // 5 min

  async function searchMunicipalities(query, { limit = 8 } = {}) {
    const key = (query || '').trim().toLowerCase();
    if (key.length < 2) return [];

    const cached = _municipalityCache.get(key);
    if (cached && (Date.now() - cached.ts) < _MC_TTL) return cached.results;

    try {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&type=municipality&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const results = (data.features || []).map(f => ({
        city: f.properties.city,
        postcode: f.properties.postcode,
        context: f.properties.context,
        label: `${f.properties.city} (${f.properties.postcode})`,
      }));
      _municipalityCache.set(key, { results, ts: Date.now() });
      return results;
    } catch {
      return [];
    }
  }

  function _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // --- Geocode a single location string ---
  async function geocodeLocation(locationStr) {
    if (!locationStr || isMobile(locationStr)) return null;

    // 1. Static lookup
    if (CITY_COORDS[locationStr]) return CITY_COORDS[locationStr];

    // 2. Cache
    const cached = getCached(locationStr);
    if (cached) return cached;

    // 3. BAN API
    const result = await _queryBAN(locationStr);
    if (result) {
      setCached(locationStr, result.lat, result.lng);
      return result;
    }
    return null;
  }

  // --- Geocode a candidate (uses full address if available, then localisation) ---
  async function geocode(candidat) {
    if (!candidat) return null;
    const loc = candidat.localisation;
    if (isMobile(loc)) return null;

    // Build a cache key from the best available address info
    const hasAddress = candidat.adresse_ligne1 && candidat.ville;
    const cacheKey = hasAddress
      ? `${candidat.adresse_ligne1} ${candidat.code_postal || ''} ${candidat.ville}`.trim()
      : (loc || '');

    if (!cacheKey) return null;

    // 1. Static lookup on localisation
    if (!hasAddress && CITY_COORDS[loc]) return CITY_COORDS[loc];

    // 2. Cache
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // 3. BAN API with full address
    if (hasAddress) {
      const fullQuery = `${candidat.adresse_ligne1} ${candidat.code_postal || ''} ${candidat.ville}`;
      const result = await _queryBAN(fullQuery);
      if (result) {
        setCached(cacheKey, result.lat, result.lng);
        return result;
      }
    }

    // 4. Fallback to localisation
    if (loc && CITY_COORDS[loc]) return CITY_COORDS[loc];
    if (loc) {
      const result = await _queryBAN(loc);
      if (result) {
        setCached(loc, result.lat, result.lng);
        return result;
      }
    }

    return null;
  }

  // --- Batch geocode all candidates ---
  // Returns Map<candidatId, {lat, lng}>
  async function geocodeAll(candidats, onProgress) {
    const results = new Map();
    let apiCallCount = 0;

    for (let i = 0; i < candidats.length; i++) {
      const c = candidats[i];
      if (isMobile(c.localisation)) continue;

      const coords = await geocode(c);
      if (coords) {
        results.set(c.id, coords);
      }

      // Only add delay if we actually called the API (cache misses)
      // We detect this by checking if the geocode was already cached
      if (onProgress) onProgress(i + 1, candidats.length);
    }

    return results;
  }

  return {
    geocode,
    geocodeLocation,
    geocodeAll,
    searchMunicipalities,
    isMobile,
    MOBILE_LOCALISATIONS,
    CITY_COORDS
  };

})();
