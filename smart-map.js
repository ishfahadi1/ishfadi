/* ============================================================
   ISHFADI Smart Map — frontend controller
   Uses Leaflet (already loaded by index.html).
   Provider-agnostic surface: window.SmartMap.{show,hide,toggle}.
   Property markers are generated dynamically from window.LISTINGS.
   Nearby services are queried live from OpenStreetMap (Overpass API).
   ============================================================ */
(function () {
  'use strict';

  // ---------- Provider abstraction (swap with Google/Mapbox/Cesium later) ----------
  const MAP_PROVIDERS = {
    street: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      maxZoom: 19
    },
    labels: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png',
      attribution: '© CARTO',
      maxZoom: 19
    }
  };

  // ---------- Service catalog (icon + color + OSM tag) ----------
  const SERVICE_TYPES = {
    hospital:   { label: 'Hospital',     glyph: '✚', osm: 'amenity=hospital' },
    university: { label: 'University',   glyph: '🎓', osm: 'amenity=university' },
    school:     { label: 'School',       glyph: '🏫', osm: 'amenity=school' },
    restaurant: { label: 'Restaurant',   glyph: '🍽', osm: 'amenity=restaurant' },
    market:     { label: 'Market',       glyph: '🛒', osm: 'shop=supermarket' },
    bank:       { label: 'Bank',         glyph: '$',  osm: 'amenity=bank' },
    hotel:      { label: 'Hotel',        glyph: '🛏', osm: 'tourism=hotel' },
    busstop:    { label: 'Bus Stop',     glyph: '🚌', osm: 'highway=bus_stop' },
    fuel:       { label: 'Fuel Station', glyph: '⛽', osm: 'amenity=fuel' },
    atm:        { label: 'ATM',          glyph: '💳', osm: 'amenity=atm' },
    pharmacy:   { label: 'Pharmacy',     glyph: '℞',  osm: 'amenity=pharmacy' },
    airport:    { label: 'Airport',      glyph: '✈',  osm: 'aeroway=aerodrome' },
    park:       { label: 'Park',         glyph: '🌳', osm: 'leisure=park' },
    police:     { label: 'Police',       glyph: '👮', osm: 'amenity=police' }
  };

  // ---------- State ----------
  let overlay = null;
  let map = null;
  let baseLayer = null;
  let labelLayer = null;
  let currentView = 'street';            // 'street' | 'satellite'
  let userMarker = null;
  let userAccCircle = null;
  let propertyMarkers = [];              // L.Marker[]
  let serviceMarkers = [];               // L.Marker[]
  let serviceCache = new Map();          // key = `${type}|${bboxRounded}` -> features[]
  let activeFilter = 'all';
  let activeProperty = null;
  let toastTimer = null;

  // ---------- Utilities ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'dataset') Object.assign(n.dataset, attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  }
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function formatDistance(m) {
    if (m < 1000) return Math.round(m) + ' m';
    return (m / 1000).toFixed(1) + ' km';
  }
  function showToast(msg) {
    const t = $('#smToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ---------- Marker factory ----------
  function makeMarkerIcon(kind, glyph) {
    return L.divIcon({
      className: 'sm-marker ' + kind,
      iconSize: [38, 46],
      iconAnchor: [19, 44],
      popupAnchor: [0, -38],
      html: `<div class="pin"><span class="glyph">${glyph}</span></div>`
    });
  }
  function makeUserIcon() {
    return L.divIcon({
      className: 'sm-userloc',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      html: ''
    });
  }

  // ---------- Overlay markup ----------
  function buildOverlay() {
    if (overlay) return overlay;

    overlay = el('div', { class: 'smart-map-overlay', id: 'smartMapOverlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ISHFADI Smart Map' });

    // Top bar
    const topbar = el('div', { class: 'sm-topbar' });
    topbar.innerHTML = `
      <button type="button" class="sm-hide-btn" id="smHideBtn" aria-label="Hide map and return to homepage">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
        </svg>
        <span>Hide Map</span>
      </button>
      <div class="sm-brand"><span class="crown">♛</span> ISHFADI</div>
      <div class="sm-search-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        <input id="smSearchInput" type="text" placeholder="Search any place, property or service..." aria-label="Search the map" />
      </div>
      <button type="button" class="sm-nearby-btn" id="smOpenNearby" aria-label="Search nearby services">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h6v6H4V6zm10 0h6v6h-6V6zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
        <span>Search Nearby Services</span>
      </button>
    `;
    overlay.appendChild(topbar);

    // Map container
    const mapEl = el('div', { class: 'sm-map', id: 'smartMap' });
    overlay.appendChild(mapEl);

    // Left side tools
    const sideLeft = el('div', { class: 'sm-side-left', role: 'toolbar', 'aria-label': 'Map tools' });
    sideLeft.innerHTML = `
      <button type="button" class="sm-tool active" data-action="map-view" aria-pressed="true" aria-label="Standard map view">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
        <span>Map View</span>
      </button>
      <button type="button" class="sm-tool" data-action="sat-view" aria-pressed="false" aria-label="Satellite view">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>
        <span>Satellite View</span>
      </button>
      <button type="button" class="sm-tool" data-action="my-location" aria-label="My location">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span>My Location</span>
      </button>
      <button type="button" class="sm-tool" data-action="nearby" aria-label="Search nearby services">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="11" r="3" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a9 9 0 00-9 9c0 6 9 11 9 11s9-5 9-11a9 9 0 00-9-9z"/></svg>
        <span>Nearby</span>
      </button>
      <button type="button" class="sm-tool" data-action="directions" aria-label="Directions">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        <span>Directions</span>
      </button>
    `;
    overlay.appendChild(sideLeft);

    // Right side controls
    const sideRight = el('div', { class: 'sm-side-right' });
    sideRight.innerHTML = `
      <div class="sm-compass" aria-hidden="true"><div class="needle"></div>N</div>
      <button type="button" class="sm-icon-btn" data-action="zoom-in" aria-label="Zoom in">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 5v14M5 12h14"/></svg>
      </button>
      <button type="button" class="sm-icon-btn" data-action="zoom-out" aria-label="Zoom out">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 12h14"/></svg>
      </button>
      <button type="button" class="sm-icon-btn" data-action="fullscreen" aria-label="Toggle fullscreen">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/></svg>
      </button>
      <button type="button" class="sm-icon-btn sm-locate-btn" data-action="my-location" aria-label="Find my location">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
      </button>
    `;
    overlay.appendChild(sideRight);

    // Filter bar (bottom center)
    const filterBar = el('div', { class: 'sm-filter-bar', role: 'tablist', 'aria-label': 'Map filter' });
    const filters = [
      { id: 'all',        label: 'All' },
      { id: 'properties', label: 'Properties' },
      { id: 'hospital',   label: 'Hospitals' },
      { id: 'university', label: 'Universities' },
      { id: 'school',     label: 'Schools' },
      { id: 'restaurant', label: 'Restaurants' },
      { id: 'hotel',      label: 'Hotels' },
      { id: 'bank',       label: 'Banks' },
      { id: 'busstop',    label: 'Transit' }
    ];
    filters.forEach((f, i) => {
      const c = el('button', {
        class: 'sm-chip' + (i === 0 ? ' active' : ''),
        type: 'button',
        role: 'tab',
        dataset: { filter: f.id }
      });
      c.textContent = f.label;
      filterBar.appendChild(c);
    });
    overlay.appendChild(filterBar);

    // Legend
    const legend = el('details', { class: 'sm-legend', id: 'smLegend', open: '' });
    legend.innerHTML = `
      <summary>
        <span>Map Legend</span>
        <svg class="chev" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <div class="legend-grid">
        ${legendRow('ishfadi',   'ISHFADI Property', '♛', '#1e3a5f')}
        ${legendRow('bank',      'Bank',             '$', '#eab308')}
        ${legendRow('hospital',  'Hospital',         '✚', '#ef4444')}
        ${legendRow('hotel',     'Hotel',            '🛏', '#06b6d4')}
        ${legendRow('university','University',       '🎓', '#8b5cf6')}
        ${legendRow('busstop',   'Bus Stop',         '🚌', '#3b82f6')}
        ${legendRow('school',    'School',           '🏫', '#f59e0b')}
        ${legendRow('market',    'Market',           '🛒', '#10b981')}
        ${legendRow('restaurant','Restaurant',       '🍽', '#f97316')}
        ${legendRow('userloc',   'Your Location',    '●', '#3b82f6')}
      </div>
    `;
    overlay.appendChild(legend);

    // Nearby panel
    const nearby = el('details', { class: 'sm-nearby-panel', id: 'smNearbyPanel' });
    nearby.innerHTML = `
      <summary>
        <span>Nearby Services</span>
        <svg class="chev" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <div class="sm-nearby-list" id="smNearbyList">
        <p class="empty">Select a property to see real nearby services.</p>
      </div>
    `;
    overlay.appendChild(nearby);

    // Property card
    const card = el('div', { class: 'sm-property-card', id: 'smPropertyCard', 'aria-live': 'polite' });
    overlay.appendChild(card);

    // Bottom brand bar
    const bottom = el('div', { class: 'sm-bottom-bar' });
    bottom.innerHTML = `<span class="crown">♛</span> Discover. Explore. Live <span class="brand">ISHFADI</span>`;
    overlay.appendChild(bottom);

    // Toast
    overlay.appendChild(el('div', { class: 'sm-toast', id: 'smToast', role: 'status' }));

    document.body.appendChild(overlay);
    wireOverlay();
    return overlay;
  }

  function legendRow(kind, label, glyph, color) {
    return `<div class="row"><span class="badge" style="background:${color}">${glyph}</span><span>${label}</span></div>`;
  }

  // ---------- Wiring ----------
  function wireOverlay() {
    $('#smHideBtn').addEventListener('click', hide);
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

    overlay.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, btn));
    });

    overlay.querySelectorAll('.sm-chip').forEach(chip => {
      chip.addEventListener('click', () => setFilter(chip.dataset.filter));
    });

    $('#smOpenNearby').addEventListener('click', () => {
      $('#smNearbyPanel').open = true;
      loadNearbyAroundView();
    });

    $('#smSearchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performGeoSearch(e.target.value);
    });
  }

  function handleAction(action, btn) {
    switch (action) {
      case 'map-view':    return setView('street', btn);
      case 'sat-view':    return setView('satellite', btn);
      case 'my-location': return locateUser();
      case 'nearby':      $('#smNearbyPanel').open = true; return loadNearbyAroundView();
      case 'directions':  return directionsHint();
      case 'zoom-in':     return map && map.zoomIn();
      case 'zoom-out':    return map && map.zoomOut();
      case 'fullscreen':  return toggleFullscreen();
    }
  }

  // ---------- Lifecycle ----------
  function show() {
    buildOverlay();
    overlay.classList.add('active');
    document.body.classList.add('smart-map-open');
    requestAnimationFrame(() => {
      initMap();
      setTimeout(() => map && map.invalidateSize(), 250);
    });
  }
  function hide() {
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.classList.remove('smart-map-open');
    closePropertyCard();
  }
  function toggle() { if (overlay && overlay.classList.contains('active')) hide(); else show(); }

  function toggleFullscreen() {
    const target = overlay;
    if (!document.fullscreenElement) {
      (target.requestFullscreen || target.webkitRequestFullscreen || (() => {})).call(target);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    }
  }

  // ---------- Map init ----------
  function initMap() {
    if (map) return;
    const mapEl = $('#smartMap');
    map = L.map(mapEl, {
      zoomControl: false,
      worldCopyJump: true,
      attributionControl: true,
      minZoom: 2,
      maxZoom: 19
    }).setView([15, 25], 3); // Africa/MENA framing matches brand reference

    applyBaseLayer('street');
    addPropertyMarkers();
  }

  function applyBaseLayer(kind) {
    if (baseLayer) map.removeLayer(baseLayer);
    if (labelLayer) { map.removeLayer(labelLayer); labelLayer = null; }
    const p = MAP_PROVIDERS[kind];
    baseLayer = L.tileLayer(p.url, { attribution: p.attribution, maxZoom: p.maxZoom }).addTo(map);
    if (kind === 'satellite') {
      const lp = MAP_PROVIDERS.labels;
      labelLayer = L.tileLayer(lp.url, { attribution: lp.attribution, maxZoom: lp.maxZoom, pane: 'overlayPane' }).addTo(map);
    }
    currentView = kind;
  }

  function setView(kind, btn) {
    if (!map) return;
    applyBaseLayer(kind);
    overlay.querySelectorAll('[data-action="map-view"],[data-action="sat-view"]').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
    showToast(kind === 'satellite' ? 'Satellite view' : 'Map view');
  }

  // ---------- Property markers ----------
  function addPropertyMarkers() {
    const data = Array.isArray(window.LISTINGS) ? window.LISTINGS : [];
    propertyMarkers.forEach(m => map.removeLayer(m));
    propertyMarkers = [];
    data.forEach(listing => {
      if (typeof listing.lat !== 'number' || typeof listing.lng !== 'number') return;
      const marker = L.marker([listing.lat, listing.lng], {
        icon: makeMarkerIcon('ishfadi', '♛'),
        title: listing.title,
        alt: listing.title,
        keyboard: true
      });
      marker.on('click', () => openPropertyCard(listing));
      marker.addTo(map);
      propertyMarkers.push(marker);
    });
  }

  // ---------- Property card ----------
  function openPropertyCard(listing) {
    activeProperty = listing;
    const card = $('#smPropertyCard');
    const img = listingImage(listing);
    const beds = listing.beds || 2, baths = listing.baths || 2, area = listing.area || 120;
    const initials = (listing.host || 'IH').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
    card.innerHTML = `
      <div class="pc-media">
        ${listing.verified ? '<span class="pc-verified">✓ Verified</span>' : ''}
        <button class="pc-close" id="smCardClose" aria-label="Close property card">✕</button>
        <img src="${img}" alt="${escapeHtml(listing.title)}" loading="lazy" onerror="this.style.display='none'"/>
      </div>
      <div class="pc-body">
        <h3 class="pc-title">${escapeHtml(listing.title)}</h3>
        <div class="pc-row">
          <span class="pc-loc">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" stroke-width="2"/></svg>
            ${escapeHtml(listing.city)}, ${escapeHtml(listing.country)}
          </span>
          <span class="pc-price">$${listing.price.toLocaleString()}<small>/month</small></span>
        </div>
        <div class="pc-meta">
          <span>🛏 ${beds} Beds</span>
          <span>🛁 ${baths} Baths</span>
          <span>📐 ${area} m²</span>
        </div>
        <div class="pc-host">
          <div class="avatar">${initials}</div>
          <div class="info">
            <div class="label">Hosted by</div>
            <div class="name">${escapeHtml(listing.host || 'ISHFADI Host')} ${listing.verified ? '<span class="verified-dot">✓</span>' : ''}</div>
          </div>
          <div class="rating">★ 4.8</div>
        </div>
        <div class="pc-actions">
          <button type="button" data-pc="quick">Quick View</button>
          <button type="button" data-pc="contact">Contact Host</button>
          <button type="button" class="pc-dir" data-pc="directions">Directions</button>
        </div>
      </div>
    `;
    card.classList.add('show');
    map.flyTo([listing.lat, listing.lng], Math.max(map.getZoom(), 12), { duration: 0.8 });

    $('#smCardClose').addEventListener('click', closePropertyCard);
    card.querySelectorAll('[data-pc]').forEach(b => {
      b.addEventListener('click', () => onCardAction(b.dataset.pc, listing));
    });

    // Auto-load nearby services around this property
    loadNearbyAround(listing.lat, listing.lng);
    $('#smNearbyPanel').open = true;
  }
  function closePropertyCard() {
    const card = $('#smPropertyCard');
    if (card) card.classList.remove('show');
    activeProperty = null;
  }
  function onCardAction(action, listing) {
    if (action === 'quick' && typeof window.openListingModal === 'function') {
      window.openListingModal(listing.id);
    } else if (action === 'contact' && typeof window.openInquiry === 'function') {
      window.openInquiry(listing.id);
    } else if (action === 'directions') {
      directionsHint(listing);
    } else {
      showToast('Action prepared for backend integration');
    }
  }

  function directionsHint(listing) {
    const target = listing || activeProperty;
    if (!target) { showToast('Select a property first'); return; }
    showToast('Preparing directions to ' + target.city + '…');
    // Frontend-ready hand-off (provider-agnostic). Opens OSM directions in new tab.
    const url = `https://www.openstreetmap.org/directions?to=${target.lat}%2C${target.lng}`;
    setTimeout(() => window.open(url, '_blank', 'noopener'), 600);
  }

  function listingImage(listing) {
    // Try several conventional fields, otherwise fall back to a city-themed Unsplash thumb.
    return listing.image || listing.cover || listing.thumb ||
      `https://source.unsplash.com/600x400/?${encodeURIComponent((listing.type || 'apartment') + ',' + listing.city)}`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---------- Geolocation ----------
  function locateUser() {
    if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
    showToast('Locating…');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (userMarker) map.removeLayer(userMarker);
        if (userAccCircle) map.removeLayer(userAccCircle);
        userMarker = L.marker([latitude, longitude], { icon: makeUserIcon(), zIndexOffset: 1000 }).addTo(map);
        userAccCircle = L.circle([latitude, longitude], {
          radius: Math.min(accuracy || 80, 500),
          color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.08
        }).addTo(map);
        map.flyTo([latitude, longitude], 14, { duration: 0.8 });
        showToast('You are here');
      },
      err => {
        const msgs = { 1: 'Location permission denied', 2: 'Location unavailable', 3: 'Location request timed out' };
        showToast(msgs[err.code] || 'Could not locate you');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  // ---------- Filters ----------
  function setFilter(id) {
    activeFilter = id;
    overlay.querySelectorAll('.sm-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === id));
    propertyMarkers.forEach(m => {
      const visible = (id === 'all' || id === 'properties');
      if (visible) m.addTo(map); else map.removeLayer(m);
    });
    if (id === 'all' || id === 'properties') {
      // keep current services
    } else {
      const c = map.getCenter();
      loadServicesByType(id, c.lat, c.lng);
    }
  }

  // ---------- Search (nominatim geocoder, no key) ----------
  function performGeoSearch(q) {
    q = (q || '').trim();
    if (!q) return;
    showToast('Searching…');
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { 'Accept': 'application/json' }
    }).then(r => r.json()).then(arr => {
      if (!arr || !arr.length) { showToast('No results'); return; }
      const r = arr[0];
      map.flyTo([+r.lat, +r.lon], 13, { duration: 0.8 });
      showToast(r.display_name.split(',')[0]);
    }).catch(() => showToast('Search failed'));
  }

  // ---------- Nearby services via Overpass (real OSM data) ----------
  function loadNearbyAroundView() {
    const c = map.getCenter();
    loadNearbyAround(c.lat, c.lng);
  }
  function loadNearbyAround(lat, lng) {
    const radius = 1500; // meters
    const list = $('#smNearbyList');
    list.innerHTML = '<p class="empty">Loading nearby places…</p>';

    const queries = ['hospital', 'university', 'market', 'bank', 'busstop', 'restaurant', 'hotel', 'school'];
    Promise.all(queries.map(t => fetchOverpass(t, lat, lng, radius)))
      .then(results => {
        // Clear previous service markers
        serviceMarkers.forEach(m => map.removeLayer(m));
        serviceMarkers = [];
        const all = [];
        queries.forEach((t, i) => {
          (results[i] || []).slice(0, 8).forEach(f => {
            all.push({ ...f, type: t });
            const cfg = SERVICE_TYPES[t];
            const mk = L.marker([f.lat, f.lng], { icon: makeMarkerIcon(t, cfg.glyph), title: f.name })
              .bindPopup(`<strong>${escapeHtml(f.name)}</strong><br>${cfg.label}`);
            mk.addTo(map);
            serviceMarkers.push(mk);
          });
        });
        renderNearbyList(all, lat, lng);
      })
      .catch(() => { list.innerHTML = '<p class="empty">Could not load nearby services.</p>'; });
  }
  function loadServicesByType(type, lat, lng) {
    const cfg = SERVICE_TYPES[type];
    if (!cfg) return;
    const list = $('#smNearbyList');
    list.innerHTML = '<p class="empty">Loading…</p>';
    fetchOverpass(type, lat, lng, 2500).then(features => {
      serviceMarkers.forEach(m => map.removeLayer(m));
      serviceMarkers = [];
      features.forEach(f => {
        const mk = L.marker([f.lat, f.lng], { icon: makeMarkerIcon(type, cfg.glyph), title: f.name })
          .bindPopup(`<strong>${escapeHtml(f.name)}</strong><br>${cfg.label}`);
        mk.addTo(map);
        serviceMarkers.push(mk);
      });
      renderNearbyList(features.map(f => ({ ...f, type })), lat, lng);
      $('#smNearbyPanel').open = true;
    }).catch(() => { list.innerHTML = '<p class="empty">No data available.</p>'; });
  }

  function fetchOverpass(type, lat, lng, radius) {
    const cfg = SERVICE_TYPES[type];
    if (!cfg) return Promise.resolve([]);
    const key = `${type}|${lat.toFixed(2)}|${lng.toFixed(2)}|${radius}`;
    if (serviceCache.has(key)) return Promise.resolve(serviceCache.get(key));
    const [k, v] = cfg.osm.split('=');
    const q = `[out:json][timeout:15];(node["${k}"="${v}"](around:${radius},${lat},${lng});way["${k}"="${v}"](around:${radius},${lat},${lng}););out center 25;`;
    return fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q)
    }).then(r => r.json()).then(data => {
      const features = (data.elements || []).map(e => {
        const elat = e.lat ?? (e.center && e.center.lat);
        const elng = e.lon ?? (e.center && e.center.lon);
        if (elat == null || elng == null) return null;
        return { name: (e.tags && (e.tags.name || e.tags['name:en'])) || cfg.label, lat: elat, lng: elng };
      }).filter(Boolean);
      serviceCache.set(key, features);
      return features;
    }).catch(() => []);
  }

  function renderNearbyList(features, lat, lng) {
    const list = $('#smNearbyList');
    if (!features.length) { list.innerHTML = '<p class="empty">No nearby services found in this area.</p>'; return; }
    const colors = { hospital:'#ef4444', university:'#8b5cf6', school:'#f59e0b', restaurant:'#f97316', market:'#10b981', bank:'#eab308', hotel:'#06b6d4', busstop:'#3b82f6', fuel:'#d97706', pharmacy:'#ec4899' };
    const items = features
      .map(f => ({ ...f, dist: haversine(lat, lng, f.lat, f.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6);
    list.innerHTML = items.map(f => `
      <div class="item" data-lat="${f.lat}" data-lng="${f.lng}">
        <div class="ico" style="background:${colors[f.type] || '#64748b'}">${SERVICE_TYPES[f.type] ? SERVICE_TYPES[f.type].glyph : '•'}</div>
        <div class="nm">${escapeHtml(f.name)}</div>
        <div class="dist">${formatDistance(f.dist)}</div>
      </div>
    `).join('') + '<button class="more" type="button" id="smMoreNearby">View more</button>';

    list.querySelectorAll('.item').forEach(it => {
      it.addEventListener('click', () => {
        map.flyTo([+it.dataset.lat, +it.dataset.lng], 16, { duration: 0.6 });
      });
    });
    const more = $('#smMoreNearby');
    if (more) more.addEventListener('click', () => loadNearbyAroundView());
  }

  // ---------- Public API ----------
  window.SmartMap = { show, hide, toggle };

  // Auto-wire any element with [data-smart-map="show"|"toggle"|"hide"]
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-smart-map]');
    if (!t) return;
    e.preventDefault();
    const cmd = t.getAttribute('data-smart-map');
    if (cmd === 'show') show();
    else if (cmd === 'hide') hide();
    else toggle();
  });
})();
