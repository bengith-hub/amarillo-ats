// Amarillo ATS — Carte interactive des candidats

(async function() {
  if (!API.isConfigured()) { UI.showConfigModal(); return; }

  await Store.loadAll();
  UI.initGlobalSearch();

  // Init routing with ORS API key
  const config = API.getConfig();
  if (config.orsApiKey || ATS_CONFIG.orsApiKey) {
    Routing.init(config.orsApiKey || ATS_CONFIG.orsApiKey);
  }

  const candidats = Store.get('candidats');
  const entreprises = Store.get('entreprises');

  // --- Populate filter dropdowns ---
  const STATUTS = Referentiels.get('candidat_statuts');
  const NIVEAUX = Referentiels.get('candidat_niveaux');
  const filterStatut = document.getElementById('filter-statut');
  const filterNiveau = document.getElementById('filter-niveau');

  STATUTS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    filterStatut.appendChild(opt);
  });
  NIVEAUX.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    filterNiveau.appendChild(opt);
  });

  // --- Init Leaflet map ---
  const map = L.map('map', {
    center: [46.6, 2.3],
    zoom: 6,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map);

  // --- Geocode candidates ---
  const loadingEl = document.getElementById('carte-loading');
  loadingEl.style.display = 'inline-flex';

  const candidatCoords = await Geocoder.geocodeAll(candidats, (done, total) => {
    loadingEl.innerHTML = `<span class="sync-dot syncing" style="display:inline-block;margin-right:4px;"></span> Geocodage ${done}/${total}`;
  });

  loadingEl.style.display = 'none';

  // --- Create candidate markers ---
  const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  });

  const candidatMarkers = new Map(); // id -> { marker, candidat, coords }

  candidats.forEach(c => {
    const coords = candidatCoords.get(c.id);
    if (!coords) return;

    const isMobile = Geocoder.isMobile(c.localisation);
    const color = isMobile ? '#94a3b8' : '#3b82f6';

    const marker = L.circleMarker([coords.lat, coords.lng], {
      radius: 7,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85
    });

    const entreprise = c.entreprise_actuelle_id ? Store.resolve('entreprises', c.entreprise_actuelle_id) : null;
    const tooltipContent = `<strong>${UI.escHtml((c.prenom || '') + ' ' + (c.nom || ''))}</strong><br/>` +
      `${UI.escHtml(c.poste_actuel || '')}${entreprise ? ' chez ' + UI.escHtml(entreprise.displayName) : ''}<br/>` +
      `<span style="font-size:0.75rem;color:#64748b;">${UI.escHtml(c.statut || '')} ${c.niveau ? '• ' + UI.escHtml(c.niveau) : ''}</span>`;

    marker.bindTooltip(tooltipContent, {
      direction: 'top',
      offset: [0, -8],
      className: 'carte-tooltip'
    });

    marker.on('click', () => {
      window.location.href = `candidat.html?id=${c.id}`;
    });

    marker._candidatId = c.id;
    candidatMarkers.set(c.id, { marker, candidat: c, coords });
    clusterGroup.addLayer(marker);
  });

  map.addLayer(clusterGroup);

  // --- Enterprise markers (hidden by default) ---
  const entrepriseLayer = L.layerGroup();
  const entrepriseMarkerMap = new Map();

  entreprises.forEach(async e => {
    const coords = await Geocoder.geocodeLocation(e.localisation);
    if (!coords) return;

    const marker = L.marker([coords.lat, coords.lng], {
      icon: L.divIcon({
        className: 'entreprise-marker-icon',
        html: '<div style="width:12px;height:12px;background:#10b981;border:2px solid #fff;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    });

    marker.bindTooltip(`<strong>${UI.escHtml(e.nom || '')}</strong><br/><span style="font-size:0.75rem;color:#64748b;">${UI.escHtml(e.localisation || '')} • ${UI.escHtml(e.secteur || '')}</span>`, {
      direction: 'top',
      offset: [0, -8],
      className: 'carte-tooltip'
    });

    marker.on('click', () => {
      window.location.href = `entreprise.html?id=${e.id}`;
    });

    entrepriseMarkerMap.set(e.id, { marker, entreprise: e, coords });
    entrepriseLayer.addLayer(marker);
  });

  // --- Filter logic ---
  let currentFilters = { statut: '', niveau: '' };

  function applyFilters() {
    clusterGroup.clearLayers();
    candidatMarkers.forEach(({ marker, candidat }) => {
      let show = true;
      if (currentFilters.statut && candidat.statut !== currentFilters.statut) show = false;
      if (currentFilters.niveau && candidat.niveau !== currentFilters.niveau) show = false;
      if (show) clusterGroup.addLayer(marker);
    });
  }

  filterStatut.addEventListener('change', () => {
    currentFilters.statut = filterStatut.value;
    applyFilters();
  });

  filterNiveau.addEventListener('change', () => {
    currentFilters.niveau = filterNiveau.value;
    applyFilters();
  });

  // --- Show/hide entreprises ---
  document.getElementById('filter-show-entreprises').addEventListener('change', (e) => {
    if (e.target.checked) {
      map.addLayer(entrepriseLayer);
    } else {
      map.removeLayer(entrepriseLayer);
    }
  });

  // --- Enterprise distance mode ---
  let distanceLayers = []; // isochrone polygons
  let selectedEntrepriseId = null;
  let selectedEntrepriseCoords = null;

  // Enterprise autocomplete
  const entSearchInput = document.getElementById('filter-entreprise-search');
  const entHiddenInput = document.getElementById('filter-entreprise-id');
  const btnClear = document.getElementById('btn-clear-distance');
  const distancePanel = document.getElementById('distance-panel');
  let entDropdown = null;

  entSearchInput.addEventListener('input', () => {
    const q = entSearchInput.value.toLowerCase().trim();
    if (entDropdown) entDropdown.remove();
    if (q.length < 1) return;

    const matches = entreprises.filter(e => (e.nom || '').toLowerCase().includes(q)).slice(0, 8);
    entDropdown = document.createElement('div');
    entDropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:200;max-height:200px;overflow-y:auto;';

    matches.forEach(e => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:0.8125rem;border-bottom:1px solid #f1f5f9;';
      item.innerHTML = `<strong>${UI.escHtml(e.nom)}</strong> <span style="color:#64748b;font-size:0.75rem;">${UI.escHtml(e.localisation || '')}</span>`;
      item.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        entSearchInput.value = e.nom;
        entHiddenInput.value = e.id;
        if (entDropdown) entDropdown.remove();
        entDropdown = null;
        activateDistanceMode(e);
      });
      item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
      item.addEventListener('mouseleave', () => item.style.background = '#fff');
      entDropdown.appendChild(item);
    });

    entSearchInput.parentElement.appendChild(entDropdown);
  });

  entSearchInput.addEventListener('blur', () => {
    setTimeout(() => { if (entDropdown) { entDropdown.remove(); entDropdown = null; } }, 200);
  });

  async function activateDistanceMode(entreprise) {
    clearDistanceMode();

    const coords = await Geocoder.geocodeLocation(entreprise.localisation);
    if (!coords) {
      UI.toast('Impossible de localiser cette entreprise', 'error');
      return;
    }

    selectedEntrepriseId = entreprise.id;
    selectedEntrepriseCoords = coords;
    btnClear.style.display = 'inline-flex';

    // Show enterprise marker prominently
    const entMarker = L.marker([coords.lat, coords.lng], {
      icon: L.divIcon({
        className: 'entreprise-selected-icon',
        html: `<div style="width:20px;height:20px;background:#10b981;border:3px solid #fff;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      }),
      zIndexOffset: 1000
    });
    entMarker.bindTooltip(`<strong>${UI.escHtml(entreprise.nom)}</strong>`, { permanent: true, direction: 'top', offset: [0, -12], className: 'carte-tooltip entreprise-label' });
    entMarker.addTo(map);
    distanceLayers.push(entMarker);

    // Fetch isochrones
    loadingEl.style.display = 'inline-flex';
    loadingEl.innerHTML = '<span class="sync-dot syncing" style="display:inline-block;margin-right:4px;"></span> Calcul isochrones...';

    const isoData = await Routing.isochrones(coords, [1800, 3600, 5400, 7200]);
    if (isoData && isoData.features) {
      const colors = ['#16a34a', '#eab308', '#f97316', '#dc2626'];
      // Features come in reverse order (largest first)
      isoData.features.reverse().forEach((feature, idx) => {
        const layer = L.geoJSON(feature, {
          style: {
            fillColor: colors[idx] || '#94a3b8',
            fillOpacity: 0.12,
            color: colors[idx] || '#94a3b8',
            weight: 2,
            opacity: 0.5
          }
        });
        layer.addTo(map);
        distanceLayers.push(layer);
      });
    }

    // Calculate driving times to all visible candidates
    const visibleCandidats = [];
    const destCoords = [];

    candidatMarkers.forEach(({ candidat, coords: cCoords }) => {
      if (Geocoder.isMobile(candidat.localisation)) return;
      let show = true;
      if (currentFilters.statut && candidat.statut !== currentFilters.statut) show = false;
      if (currentFilters.niveau && candidat.niveau !== currentFilters.niveau) show = false;
      if (show) {
        visibleCandidats.push({ candidat, coords: cCoords });
        destCoords.push(cCoords);
      }
    });

    loadingEl.innerHTML = '<span class="sync-dot syncing" style="display:inline-block;margin-right:4px;"></span> Calcul temps de trajet...';

    const durations = await Routing.matrix(coords, destCoords);

    loadingEl.style.display = 'none';

    // Update marker colors and tooltips with driving time
    const results = [];
    if (durations) {
      visibleCandidats.forEach((item, i) => {
        const dur = durations[i];
        const entry = candidatMarkers.get(item.candidat.id);
        if (entry) {
          const color = Routing.durationColor(dur);
          entry.marker.setStyle({ fillColor: color });

          const entrepriseActuelle = item.candidat.entreprise_actuelle_id ? Store.resolve('entreprises', item.candidat.entreprise_actuelle_id) : null;
          const newTooltip = `<strong>${UI.escHtml((item.candidat.prenom || '') + ' ' + (item.candidat.nom || ''))}</strong><br/>` +
            `${UI.escHtml(item.candidat.poste_actuel || '')}${entrepriseActuelle ? ' chez ' + UI.escHtml(entrepriseActuelle.displayName) : ''}<br/>` +
            `<span style="font-weight:600;color:${color};">${Routing.formatDuration(dur)} en voiture</span>`;
          entry.marker.unbindTooltip();
          entry.marker.bindTooltip(newTooltip, { direction: 'top', offset: [0, -8], className: 'carte-tooltip' });
        }
        results.push({ candidat: item.candidat, duration: dur });
      });
    }

    // Sort results by duration and show distance panel
    results.sort((a, b) => (a.duration || Infinity) - (b.duration || Infinity));
    showDistancePanel(entreprise.nom, results);

    // Zoom to show isochrones
    if (isoData && isoData.features && isoData.features.length > 0) {
      const bounds = L.geoJSON(isoData).getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  function clearDistanceMode() {
    distanceLayers.forEach(l => map.removeLayer(l));
    distanceLayers = [];
    selectedEntrepriseId = null;
    selectedEntrepriseCoords = null;
    btnClear.style.display = 'none';
    distancePanel.style.display = 'none';
    entSearchInput.value = '';
    entHiddenInput.value = '';

    // Reset marker colors
    candidatMarkers.forEach(({ marker, candidat }) => {
      const color = Geocoder.isMobile(candidat.localisation) ? '#94a3b8' : '#3b82f6';
      marker.setStyle({ fillColor: color });

      // Reset tooltip
      const entreprise = candidat.entreprise_actuelle_id ? Store.resolve('entreprises', candidat.entreprise_actuelle_id) : null;
      const tooltipContent = `<strong>${UI.escHtml((candidat.prenom || '') + ' ' + (candidat.nom || ''))}</strong><br/>` +
        `${UI.escHtml(candidat.poste_actuel || '')}${entreprise ? ' chez ' + UI.escHtml(entreprise.displayName) : ''}<br/>` +
        `<span style="font-size:0.75rem;color:#64748b;">${UI.escHtml(candidat.statut || '')} ${candidat.niveau ? '• ' + UI.escHtml(candidat.niveau) : ''}</span>`;
      marker.unbindTooltip();
      marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -8], className: 'carte-tooltip' });
    });

    applyFilters();
  }

  btnClear.addEventListener('click', clearDistanceMode);

  function showDistancePanel(entrepriseNom, results) {
    distancePanel.style.display = 'block';
    document.getElementById('distance-panel-title').textContent = `Temps de trajet depuis ${entrepriseNom}`;

    const listEl = document.getElementById('distance-panel-list');
    if (results.length === 0) {
      listEl.innerHTML = '<div style="padding:12px;color:#94a3b8;font-size:0.8125rem;">Aucun candidat localisable</div>';
      return;
    }

    listEl.innerHTML = results.map(r => {
      const c = r.candidat;
      const dur = r.duration;
      const color = Routing.durationColor(dur);
      return `
        <a href="candidat.html?id=${c.id}" class="distance-result-item">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
            <div style="min-width:0;">
              <div style="font-weight:600;font-size:0.8125rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${UI.escHtml((c.prenom || '') + ' ' + (c.nom || ''))}</div>
              <div style="font-size:0.6875rem;color:#64748b;">${UI.escHtml(c.localisation || c.ville || '')}</div>
            </div>
          </div>
          <div style="font-weight:600;font-size:0.8125rem;color:${color};white-space:nowrap;">${Routing.formatDuration(dur)}</div>
        </a>
      `;
    }).join('');
  }

  document.getElementById('distance-panel-close').addEventListener('click', () => {
    distancePanel.style.display = 'none';
  });

  // --- Count displayed ---
  const totalMapped = candidatCoords.size;
  const totalCandidats = candidats.length;
  loadingEl.style.display = 'inline-flex';
  loadingEl.innerHTML = `<span class="sync-dot" style="display:inline-block;margin-right:4px;"></span> ${totalMapped}/${totalCandidats} candidats sur la carte`;

})();
