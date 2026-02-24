// Amarillo ATS — Company Map Widget
// Mini-map in the company detail sidebar showing location + nearby cities with estimated travel times

const CompanyMapWidget = (() => {

  let _map = null;

  // --- Haversine distance in km ---
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

  // --- Format duration ---
  function _formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins < 10 ? '0' : ''}${mins}`;
  }

  // --- Duration color ---
  function _durationColor(seconds) {
    if (seconds === null || seconds === undefined) return '#94a3b8';
    if (seconds <= 2700) return '#16a34a';   // green: ≤ 45 min
    if (seconds <= 4500) return '#eab308';   // yellow: 45 min – 1h15
    if (seconds <= 7200) return '#f97316';   // orange: 1h15 – 2h
    return '#dc2626';                         // red: > 2h
  }

  // --- Find nearby cities from Geocoder.CITY_COORDS ---
  function _findNearbyCities(coords, count) {
    const cities = [];
    for (const [name, cityCoords] of Object.entries(Geocoder.CITY_COORDS)) {
      const km = _haversineKm(coords, cityCoords);
      const durationSec = Math.round((km / 70) * 3600);
      cities.push({ name, coords: cityCoords, km, durationSec });
    }
    cities.sort((a, b) => a.km - b.km);
    // Exclude the city itself (distance < 5 km)
    return cities.filter(c => c.km >= 5).slice(0, count);
  }

  // --- Init widget ---
  async function init(containerId, companyData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Destroy previous map if re-rendering
    if (_map) {
      _map.remove();
      _map = null;
    }

    // Determine best location string to geocode
    const locationStr = companyData.siege_ville || companyData.localisation;
    if (!locationStr) {
      container.innerHTML = `
        <div class="card" data-accent="blue">
          <div class="card-header"><h2>Localisation</h2></div>
          <div class="card-body">
            <div style="color:#94a3b8;font-size:0.8125rem;text-align:center;padding:16px 0;">Localisation non renseignée</div>
          </div>
        </div>
      `;
      return;
    }

    // Geocode: prefer full address, fall back to city name
    let coords = null;
    if (companyData.siege_ville && companyData.siege_code_postal) {
      const fullAddr = `${companyData.siege_adresse || ''} ${companyData.siege_code_postal} ${companyData.siege_ville}`.trim();
      coords = await Geocoder.geocodeLocation(fullAddr);
    }
    if (!coords) {
      coords = await Geocoder.geocodeLocation(locationStr);
    }

    if (!coords) {
      container.innerHTML = `
        <div class="card" data-accent="blue">
          <div class="card-header"><h2>Localisation</h2></div>
          <div class="card-body">
            <div style="color:#94a3b8;font-size:0.8125rem;text-align:center;padding:16px 0;">Localisation introuvable sur la carte</div>
          </div>
        </div>
      `;
      return;
    }

    // Find 6 nearest major cities
    const nearbyCities = _findNearbyCities(coords, 6);

    // Render widget HTML
    container.innerHTML = `
      <div class="card" data-accent="blue">
        <div class="card-header">
          <h2>Localisation</h2>
          <span style="font-size:0.7rem;color:#94a3b8;">distances estimées</span>
        </div>
        <div class="card-body" style="padding:0;">
          <div id="ent-mini-map" style="height:200px;"></div>
          <div style="padding:12px;" id="ent-nearby-cities"></div>
        </div>
      </div>
    `;

    // Init Leaflet map
    _map = L.map('ent-mini-map', {
      center: [coords.lat, coords.lng],
      zoom: 8,
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 14
    }).addTo(_map);

    // Company marker (green, prominent)
    const companyMarker = L.marker([coords.lat, coords.lng], {
      icon: L.divIcon({
        className: 'ent-map-company-marker',
        html: '<div style="width:16px;height:16px;background:#10b981;border:3px solid #fff;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      }),
      zIndexOffset: 1000
    });
    companyMarker.bindTooltip(`<strong>${UI.escHtml(companyData.nom)}</strong>`, {
      permanent: true,
      direction: 'top',
      offset: [0, -10],
      className: 'carte-tooltip'
    });
    companyMarker.addTo(_map);

    // Nearby city markers
    const bounds = L.latLngBounds([[coords.lat, coords.lng]]);

    nearbyCities.forEach(city => {
      const color = _durationColor(city.durationSec);
      const marker = L.circleMarker([city.coords.lat, city.coords.lng], {
        radius: 5,
        fillColor: color,
        color: '#fff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.85
      });
      marker.bindTooltip(`<strong>${city.name}</strong><br/><span style="color:${color};font-weight:600;">~${_formatDuration(city.durationSec)}</span>`, {
        direction: 'top',
        offset: [0, -6],
        className: 'carte-tooltip'
      });
      marker.addTo(_map);
      bounds.extend([city.coords.lat, city.coords.lng]);
    });

    // Autres sites markers (blue, small)
    if (companyData.autres_sites && companyData.autres_sites.length > 0) {
      for (const site of companyData.autres_sites) {
        const siteCoords = await Geocoder.geocodeLocation(site);
        if (siteCoords) {
          const siteMarker = L.circleMarker([siteCoords.lat, siteCoords.lng], {
            radius: 5,
            fillColor: '#3b82f6',
            color: '#fff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.85
          });
          siteMarker.bindTooltip(`<strong>${UI.escHtml(site)}</strong><br/><span style="font-size:0.75rem;color:#64748b;">Autre site</span>`, {
            direction: 'top',
            offset: [0, -6],
            className: 'carte-tooltip'
          });
          siteMarker.addTo(_map);
          bounds.extend([siteCoords.lat, siteCoords.lng]);
        }
      }
    }

    // Fit map to show all markers
    if (nearbyCities.length > 0) {
      _map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
    }

    // Render nearby cities list
    const listEl = document.getElementById('ent-nearby-cities');
    listEl.innerHTML = nearbyCities.map(city => {
      const color = _durationColor(city.durationSec);
      return `
        <div class="nearby-city-item">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
            <span>${city.name}</span>
          </div>
          <span style="font-weight:600;color:${color};white-space:nowrap;">~${_formatDuration(city.durationSec)}</span>
        </div>
      `;
    }).join('');

    // Fix Leaflet rendering in hidden/resized containers
    setTimeout(() => { if (_map) _map.invalidateSize(); }, 200);
  }

  return { init };
})();
