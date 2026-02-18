// Amarillo ATS — Routing module
// Calculates driving times using OpenRouteService API (matrix + isochrones)
// Fallback to Haversine distance when API is unavailable

const Routing = (() => {

  const CACHE_KEY = 'ats_routecache';
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  const ORS_BASE = 'https://api.openrouteservice.org/v2';

  let _apiKey = null;

  function init(apiKey) {
    _apiKey = apiKey;
  }

  function isConfigured() {
    return !!_apiKey;
  }

  // --- Cache ---
  function _getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
  }

  function _setCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  function _cacheKey(origin, dest) {
    return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}-${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}`;
  }

  function getCachedDuration(origin, dest) {
    const cache = _getCache();
    const key = _cacheKey(origin, dest);
    const entry = cache[key];
    if (entry && (Date.now() - entry.ts) < CACHE_TTL) {
      return entry.duration;
    }
    return null;
  }

  function setCachedDuration(origin, dest, duration) {
    const cache = _getCache();
    cache[_cacheKey(origin, dest)] = { duration, ts: Date.now() };
    _setCache(cache);
  }

  // --- ORS Matrix API ---
  // origin: {lat, lng}, destinations: [{lat, lng}, ...]
  // Returns array of durations in seconds (null if error)
  async function matrix(origin, destinations) {
    if (!_apiKey || destinations.length === 0) return null;

    // Check cache for all destinations
    const results = new Array(destinations.length);
    const uncachedIndices = [];

    for (let i = 0; i < destinations.length; i++) {
      const cached = getCachedDuration(origin, destinations[i]);
      if (cached !== null) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
      }
    }

    // If all cached, return immediately
    if (uncachedIndices.length === 0) return results;

    // Build locations array: origin first, then uncached destinations
    const locations = [[origin.lng, origin.lat]];
    uncachedIndices.forEach(i => {
      locations.push([destinations[i].lng, destinations[i].lat]);
    });

    // Destination indices in the locations array (1, 2, 3, ...)
    const destIndices = uncachedIndices.map((_, i) => i + 1);

    try {
      const res = await fetch(`${ORS_BASE}/matrix/driving-car`, {
        method: 'POST',
        headers: {
          'Authorization': _apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locations: locations,
          sources: [0],
          destinations: destIndices,
          metrics: ['duration']
        })
      });

      if (!res.ok) {
        console.warn('ORS Matrix API error:', res.status);
        return _fallbackMatrix(origin, destinations);
      }

      const data = await res.json();
      const durations = data.durations[0]; // single source row

      // Map results back and cache them
      uncachedIndices.forEach((origIdx, i) => {
        const dur = durations[i];
        if (dur !== null && dur !== undefined) {
          results[origIdx] = dur;
          setCachedDuration(origin, destinations[origIdx], dur);
        }
      });

      return results;
    } catch (err) {
      console.warn('ORS Matrix API failed:', err);
      return _fallbackMatrix(origin, destinations);
    }
  }

  // --- ORS Isochrones API ---
  // center: {lat, lng}, ranges: [seconds] e.g. [1800, 3600, 5400, 7200]
  // Returns GeoJSON FeatureCollection of isochrone polygons
  async function isochrones(center, ranges) {
    if (!_apiKey) return null;

    try {
      const res = await fetch(`${ORS_BASE}/isochrones/driving-car`, {
        method: 'POST',
        headers: {
          'Authorization': _apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locations: [[center.lng, center.lat]],
          range: ranges,
          range_type: 'time'
        })
      });

      if (!res.ok) {
        console.warn('ORS Isochrones API error:', res.status);
        return null;
      }

      return await res.json();
    } catch (err) {
      console.warn('ORS Isochrones API failed:', err);
      return null;
    }
  }

  // --- Fallback: Haversine distance → estimated driving time ---
  function _haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function _fallbackMatrix(origin, destinations) {
    // Estimate: average speed ~70 km/h on French roads
    return destinations.map(dest => {
      const km = _haversineKm(origin, dest);
      return Math.round((km / 70) * 3600); // seconds
    });
  }

  // --- Format duration ---
  function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins < 10 ? '0' : ''}${mins}`;
  }

  // Duration color class (for markers and list)
  function durationColor(seconds) {
    if (seconds === null || seconds === undefined) return '#94a3b8'; // gray
    if (seconds <= 2700) return '#16a34a';  // green: ≤ 45 min
    if (seconds <= 4500) return '#eab308';  // yellow: 45 min – 1h15
    if (seconds <= 7200) return '#f97316';  // orange: 1h15 – 2h
    return '#dc2626';                        // red: > 2h
  }

  return {
    init,
    isConfigured,
    matrix,
    isochrones,
    formatDuration,
    durationColor
  };

})();
