/* =====================================================================
 * ISHFADI SMART EXPLORER
 * Provider-abstract map + intelligent discovery UI.
 * Default provider: Leaflet + OpenStreetMap. Swap MapProvider to use
 * Mapbox or Google Maps without touching the UI layer.
 * ===================================================================*/
(function () {
  'use strict';

  /* ---------------- Sample property dataset ---------------- */
  const PROPERTIES = [
    { id:'p1', title:'Modern Apartment in Downtown', category:'apartment', price:850, currency:'USD', period:'month', bedrooms:2, bathrooms:1, furnished:true, verified:true, hostType:'host', city:'Riyadh', country:'Saudi Arabia', district:'Olaya', lat:24.6877, lng:46.6857, img:'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop' },
    { id:'p2', title:'Luxury Villa with Pool', category:'house', price:3200, currency:'USD', period:'month', bedrooms:5, bathrooms:4, furnished:true, verified:true, hostType:'agent', city:'Dubai', country:'UAE', district:'Palm Jumeirah', lat:25.1124, lng:55.1390, img:'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400&h=300&fit=crop' },
    { id:'p3', title:'Cozy Student Studio Near Campus', category:'student', price:380, currency:'USD', period:'month', bedrooms:1, bathrooms:1, furnished:true, verified:true, hostType:'host', city:'Cairo', country:'Egypt', district:'Maadi', lat:29.9602, lng:31.2569, img:'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop' },
    { id:'p4', title:'Boutique Hotel Suite', category:'hotel', price:180, currency:'USD', period:'night', bedrooms:1, bathrooms:1, furnished:true, verified:true, hostType:'agent', city:'Istanbul', country:'Turkey', district:'Sultanahmet', lat:41.0086, lng:28.9802, img:'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop' },
    { id:'p5', title:'Family Guest House', category:'guesthouse', price:120, currency:'USD', period:'night', bedrooms:3, bathrooms:2, furnished:true, verified:false, hostType:'host', city:'Marrakech', country:'Morocco', district:'Medina', lat:31.6295, lng:-7.9811, img:'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=300&fit=crop' },
    { id:'p6', title:'Premium Office Space', category:'office', price:2400, currency:'USD', period:'month', bedrooms:0, bathrooms:2, furnished:true, verified:true, hostType:'agent', city:'Doha', country:'Qatar', district:'West Bay', lat:25.3286, lng:51.5310, img:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop' },
    { id:'p7', title:'Beachfront Vacation Home', category:'vacation', price:240, currency:'USD', period:'night', bedrooms:4, bathrooms:3, furnished:true, verified:true, hostType:'host', city:'Alexandria', country:'Egypt', district:'Corniche', lat:31.2001, lng:29.9187, img:'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=400&h=300&fit=crop' },
    { id:'p8', title:'Investment Land Plot', category:'land', price:75000, currency:'USD', period:'total', bedrooms:0, bathrooms:0, furnished:false, verified:false, hostType:'agent', city:'Amman', country:'Jordan', district:'Abdoun', lat:31.9454, lng:35.9284, img:'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop' },
    { id:'p9', title:'Retail Commercial Unit', category:'commercial', price:1800, currency:'USD', period:'month', bedrooms:0, bathrooms:1, furnished:false, verified:true, hostType:'agent', city:'Riyadh', country:'Saudi Arabia', district:'King Fahd Rd', lat:24.7136, lng:46.6753, img:'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=400&h=300&fit=crop' },
    { id:'p10', title:'Penthouse with City View', category:'apartment', price:2100, currency:'USD', period:'month', bedrooms:3, bathrooms:2, furnished:true, verified:true, hostType:'agent', city:'Dubai', country:'UAE', district:'Downtown', lat:25.1972, lng:55.2744, img:'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop' },
    { id:'p11', title:'Charming Heritage House', category:'house', price:950, currency:'USD', period:'month', bedrooms:3, bathrooms:2, furnished:false, verified:true, hostType:'host', city:'Istanbul', country:'Turkey', district:'Beyoglu', lat:41.0369, lng:28.9850, img:'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop' },
    { id:'p12', title:'Shared Student Residence', category:'student', price:290, currency:'USD', period:'month', bedrooms:1, bathrooms:1, furnished:true, verified:true, hostType:'host', city:'Amman', country:'Jordan', district:'University District', lat:32.0145, lng:35.8740, img:'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400&h=300&fit=crop' }
  ];

  const CATEGORIES = [
    { id:'all', label:'All', icon:'M4 6h16M4 12h16M4 18h16' },
    { id:'apartment', label:'Apartment', icon:'M3 21h18M6 18V9.5a1 1 0 011-1h2a1 1 0 011 1V18m4 0V5.5a1 1 0 011-1h2a1 1 0 011 1V18' },
    { id:'house', label:'House', icon:'M3 12l9-9 9 9M5 10v10h14V10' },
    { id:'hotel', label:'Hotel', icon:'M3 21V8l9-5 9 5v13M9 21v-6h6v6' },
    { id:'guesthouse', label:'Guest House', icon:'M12 6.253v13M9 13.5a3 3 0 11-6 0 3 3 0 016 0zm12 0a3 3 0 11-6 0 3 3 0 016 0z' },
    { id:'student', label:'Student', icon:'M12 14l9-5-9-5-9 5 9 5zm0 0v6m-6-3v-4l6-3 6 3v4' },
    { id:'office', label:'Office', icon:'M21 13.255V21h-4v-6h-6v6H3v-7.745M21 13.255V8a2 2 0 00-2-2H5a2 2 0 00-2 2v5.255' },
    { id:'commercial', label:'Commercial', icon:'M5 7h14l-1 12H6L5 7zm3 0V5a4 4 0 118 0v2' },
    { id:'vacation', label:'Vacation', icon:'M12 3l1.5 4.5L18 9l-3.5 3 1 5L12 14.5 8.5 17l1-5L6 9l4.5-1.5L12 3z' },
    { id:'land', label:'Land', icon:'M3 17l6-6 4 4 8-8M14 7h7v7' }
  ];

  /* ---------------- Map Provider Abstraction ---------------- */
  // Provider must implement: init, addMarker, clearMarkers, setView, fitBounds,
  // setLayer, getZoom, addUserMarker, removeUserMarker, on, destroy
  const LeafletProvider = {
    name: 'leaflet',
    map: null, layerStreets: null, layerSatellite: null, markers: [], userMarker: null, container: null,
    init(containerId, opts) {
      if (typeof L === 'undefined') { console.warn('[Explorer] Leaflet not loaded'); return; }
      this.container = document.getElementById(containerId);
      this.map = L.map(containerId, { zoomControl: false, attributionControl: true })
        .setView(opts.center || [25.0, 45.0], opts.zoom || 4);
      this.layerStreets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap', maxZoom: 19
      });
      this.layerSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri', maxZoom: 19
      });
      this.layerStreets.addTo(this.map);
      return this.map;
    },
    setLayer(name) {
      if (!this.map) return;
      this.map.removeLayer(this.layerStreets); this.map.removeLayer(this.layerSatellite);
      (name === 'satellite' ? this.layerSatellite : this.layerStreets).addTo(this.map);
    },
    addMarker(prop, onClick) {
      if (!this.map) return null;
      const html = `<div class="ex-marker ${prop.verified ? 'verified' : ''}" data-id="${prop.id}"><div class="ex-marker-pin"><span>${categoryGlyph(prop.category)}</span></div></div>`;
      const icon = L.divIcon({ html, className:'', iconSize:[36,46], iconAnchor:[18,46], popupAnchor:[0,-44] });
      const m = L.marker([prop.lat, prop.lng], { icon, title: prop.title }).addTo(this.map);
      m.on('click', () => onClick && onClick(prop));
      m._propId = prop.id;
      this.markers.push(m);
      return m;
    },
    highlightMarker(id) {
      this.markers.forEach(m => {
        const el = m.getElement && m.getElement();
        if (!el) return;
        const inner = el.querySelector('.ex-marker');
        if (inner) inner.classList.toggle('active', m._propId === id);
      });
    },
    clearMarkers() { this.markers.forEach(m => this.map && this.map.removeLayer(m)); this.markers = []; },
    setView(lat, lng, zoom) { this.map && this.map.setView([lat, lng], zoom || this.map.getZoom()); },
    flyTo(lat, lng, zoom) { this.map && this.map.flyTo([lat, lng], zoom || 13, { duration: 1.2 }); },
    fitBounds(coords) {
      if (!this.map || !coords.length) return;
      const b = L.latLngBounds(coords.map(c => [c.lat, c.lng]));
      this.map.fitBounds(b, { padding: [50, 50], maxZoom: 12 });
    },
    addUserMarker(lat, lng) {
      this.removeUserMarker();
      const icon = L.divIcon({ html:'<div class="ex-user-marker"></div>', className:'', iconSize:[18,18], iconAnchor:[9,9] });
      this.userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(this.map);
    },
    removeUserMarker() { if (this.userMarker && this.map) { this.map.removeLayer(this.userMarker); this.userMarker = null; } },
    invalidate() { this.map && setTimeout(() => this.map.invalidateSize(), 100); }
  };

  let MapProvider = LeafletProvider;

  /* ---------------- Helpers ---------------- */
  function categoryGlyph(cat) {
    const m = { apartment:'A', house:'H', hotel:'★', guesthouse:'G', student:'S', office:'O', commercial:'C', vacation:'V', land:'L' };
    return m[cat] || '•';
  }
  function distanceKm(a, b) {
    if (!a || !b) return null;
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }
  function fmtPrice(p) {
    if (p.price >= 1000) return '$' + Math.round(p.price).toLocaleString();
    return '$' + p.price;
  }
  function fmtDistance(km) {
    if (km == null) return '';
    if (km < 1) return Math.round(km * 1000) + ' m';
    if (km < 100) return km.toFixed(1) + ' km';
    return Math.round(km) + ' km';
  }
  function uniq(arr) { return Array.from(new Set(arr)); }

  /* ---------------- State ---------------- */
  const state = {
    mode: 'discovery',         // 'discovery' | 'nearby'
    category: 'all',
    country: '', city: '', search: '',
    verifiedOnly: false,
    userLocation: null,
    selectedId: null,
    layer: 'streets'
  };

  let allProps = PROPERTIES.slice();

  /* ---------------- Filtering ---------------- */
  function filtered() {
    return allProps.filter(p => {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (state.country && p.country !== state.country) return false;
      if (state.city && p.city !== state.city) return false;
      if (state.verifiedOnly && !p.verified) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        if (!(p.title.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.district.toLowerCase().includes(q) || p.country.toLowerCase().includes(q))) return false;
      }
      return true;
    }).map(p => ({ ...p, distance: state.userLocation ? distanceKm(state.userLocation, p) : null }))
      .sort((a, b) => {
        if (state.mode === 'nearby' && state.userLocation) return (a.distance || 9e9) - (b.distance || 9e9);
        return (b.verified === a.verified) ? 0 : b.verified ? 1 : -1;
      });
  }

  /* ---------------- Render ---------------- */
  const $ = sel => document.querySelector(sel);
  const els = {};

  function render() {
    const list = filtered();
    els.count.innerHTML = `<span>${list.length}</span> ${list.length === 1 ? 'property' : 'properties'}`;
    if (!list.length) {
      els.list.innerHTML = `<div class="ex-empty"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><p>No properties match your filters.</p></div>`;
    } else {
      els.list.innerHTML = list.map(p => `
        <div class="ex-card ${state.selectedId === p.id ? 'active' : ''}" data-id="${p.id}" role="button" tabindex="0" aria-label="${p.title}">
          <img class="ex-card-img" src="${p.img}" alt="${p.title}" loading="lazy" />
          <div class="ex-card-body">
            <div class="ex-card-top">
              <span class="ex-card-cat">${p.category}</span>
              ${p.verified ? '<span class="ex-card-verified"><svg fill="currentColor" viewBox="0 0 20 20"><path d="M2.93 8.94a1.5 1.5 0 010-2.12L6.82 2.93a1.5 1.5 0 012.12 0L10 4l1.06-1.07a1.5 1.5 0 012.12 0l3.89 3.89a1.5 1.5 0 010 2.12L16 10l1.07 1.06a1.5 1.5 0 010 2.12l-3.89 3.89a1.5 1.5 0 01-2.12 0L10 16l-1.06 1.07a1.5 1.5 0 01-2.12 0l-3.89-3.89a1.5 1.5 0 010-2.12L4 10 2.93 8.94zM8.7 11.3l4.6-4.6-1.4-1.4-3.2 3.2-1.3-1.3-1.4 1.4 2.7 2.7z"/></svg>Verified</span>' : ''}
            </div>
            <div class="ex-card-title">${p.title}</div>
            <div class="ex-card-meta">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" stroke-width="2"/></svg>
              ${p.district}, ${p.city}${p.distance != null ? ' · ' + fmtDistance(p.distance) : ''}
            </div>
            <div class="ex-card-price">${fmtPrice(p)}<small> / ${p.period}</small></div>
          </div>
        </div>
      `).join('');
    }
    // Markers
    MapProvider.clearMarkers();
    list.forEach(p => MapProvider.addMarker(p, openPreview));
    if (list.length && state.mode === 'discovery') MapProvider.fitBounds(list);
  }

  function renderCities() {
    const grid = {};
    PROPERTIES.forEach(p => { const k = `${p.city}|${p.country}`; grid[k] = (grid[k]||0)+1; });
    els.cities.innerHTML = Object.entries(grid).map(([k, n]) => {
      const [city, country] = k.split('|');
      return `<div class="ex-city-card" data-city="${city}" role="button" tabindex="0">
        <div class="ex-city-name">${city}</div>
        <div class="ex-city-country">${country}</div>
        <div class="ex-city-count">${n} ${n === 1 ? 'listing' : 'listings'}</div>
      </div>`;
    }).join('');
  }

  function renderFilters() {
    const countries = uniq(PROPERTIES.map(p => p.country)).sort();
    els.country.innerHTML = '<option value="">All Countries</option>' + countries.map(c => `<option value="${c}">${c}</option>`).join('');
    const cities = uniq(PROPERTIES.filter(p => !state.country || p.country === state.country).map(p => p.city)).sort();
    els.city.innerHTML = '<option value="">All Cities</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');
    els.chips.innerHTML = CATEGORIES.map(c => `
      <button class="ex-chip ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}" type="button" aria-pressed="${state.category === c.id}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${c.icon}"/></svg>
        ${c.label}
      </button>
    `).join('') + `<button class="ex-chip ${state.verifiedOnly ? 'active' : ''}" id="exVerifiedChip" type="button" aria-pressed="${state.verifiedOnly}">
      <svg fill="currentColor" viewBox="0 0 20 20"><path d="M2.93 8.94a1.5 1.5 0 010-2.12L6.82 2.93a1.5 1.5 0 012.12 0L10 4l1.06-1.07a1.5 1.5 0 012.12 0l3.89 3.89a1.5 1.5 0 010 2.12L16 10l1.07 1.06a1.5 1.5 0 010 2.12l-3.89 3.89a1.5 1.5 0 01-2.12 0L10 16l-1.06 1.07a1.5 1.5 0 01-2.12 0l-3.89-3.89a1.5 1.5 0 010-2.12L4 10 2.93 8.94zM8.7 11.3l4.6-4.6-1.4-1.4-3.2 3.2-1.3-1.3-1.4 1.4 2.7 2.7z"/></svg>
      Verified Only
    </button>`;
  }

  /* ---------------- Preview Panel ---------------- */
  function openPreview(prop) {
    state.selectedId = prop.id;
    MapProvider.highlightMarker(prop.id);
    MapProvider.flyTo(prop.lat, prop.lng, Math.max(13, MapProvider.map ? MapProvider.map.getZoom() : 13));
    els.preview.innerHTML = `
      <div class="ex-preview-img">
        <img src="${prop.img}" alt="${prop.title}" />
        <span class="ex-preview-cat">${prop.category}</span>
        <button class="ex-preview-close" aria-label="Close preview" id="exPreviewClose">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="ex-preview-body">
        <div class="ex-preview-title">${prop.title}</div>
        <div class="ex-preview-loc">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3" stroke-width="2"/></svg>
          ${prop.district}, ${prop.city}, ${prop.country}${prop.distance != null ? ' · ' + fmtDistance(prop.distance) + ' away' : ''}
        </div>
        <div class="ex-preview-row">
          <div class="ex-preview-price">${fmtPrice(prop)}<small> / ${prop.period}</small></div>
          ${prop.verified ? `<span class="ex-preview-verified"><svg fill="currentColor" viewBox="0 0 20 20"><path d="M2.93 8.94a1.5 1.5 0 010-2.12L6.82 2.93a1.5 1.5 0 012.12 0L10 4l1.06-1.07a1.5 1.5 0 012.12 0l3.89 3.89a1.5 1.5 0 010 2.12L16 10l1.07 1.06a1.5 1.5 0 010 2.12l-3.89 3.89a1.5 1.5 0 01-2.12 0L10 16l-1.06 1.07a1.5 1.5 0 01-2.12 0l-3.89-3.89a1.5 1.5 0 010-2.12L4 10 2.93 8.94zM8.7 11.3l4.6-4.6-1.4-1.4-3.2 3.2-1.3-1.3-1.4 1.4 2.7 2.7z"/></svg>Verified ${prop.hostType}</span>` : `<span style="font-size:.78rem;color:#64748b;font-weight:600">By ${prop.hostType}</span>`}
        </div>
        <div class="ex-preview-actions">
          <button type="button" data-act="save" aria-label="Save"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>Save</button>
          <button type="button" data-act="share" aria-label="Share"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-2.684-4.026M15 5a3 3 0 11-6 0 3 3 0 016 0z"/></svg>Share</button>
          <button type="button" class="primary" data-act="details">View Details<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg></button>
        </div>
      </div>
    `;
    els.preview.classList.add('show');
    // Update card highlight
    document.querySelectorAll('.ex-card').forEach(c => c.classList.toggle('active', c.dataset.id === prop.id));
  }
  function closePreview() {
    els.preview.classList.remove('show');
    state.selectedId = null;
    MapProvider.highlightMarker(null);
    document.querySelectorAll('.ex-card').forEach(c => c.classList.remove('active'));
  }

  /* ---------------- Geolocation ---------------- */
  function locateUser() {
    if (!navigator.geolocation) { toast('Geolocation is not supported on this device.'); return; }
    els.locateBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        MapProvider.addUserMarker(state.userLocation.lat, state.userLocation.lng);
        MapProvider.flyTo(state.userLocation.lat, state.userLocation.lng, 12);
        state.mode = 'nearby';
        syncModeUI();
        render();
        els.locateBtn.disabled = false;
        toast('Showing nearby listings.');
      },
      err => {
        els.locateBtn.disabled = false;
        toast(err.code === 1 ? 'Location permission denied.' : 'Could not detect location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  function toast(msg) {
    let t = document.getElementById('exToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'exToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:12px 20px;border-radius:999px;font-size:.85rem;font-weight:600;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transition:opacity .25s';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = '0', 2500);
  }

  /* ---------------- Mode toggle ---------------- */
  function syncModeUI() {
    document.querySelectorAll('.ex-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  }

  /* ---------------- Wire UI ---------------- */
  function wire() {
    els.search = $('#exSearch');
    els.country = $('#exCountry');
    els.city = $('#exCity');
    els.chips = $('#exChips');
    els.list = $('#exList');
    els.count = $('#exCount');
    els.preview = $('#exPreview');
    els.cities = $('#exCitiesGrid');
    els.locateBtn = $('#exLocate');
    els.fsBtn = $('#exFullscreen');
    els.mapWrap = $('#exMapWrap');
    els.sidebar = $('#exSidebar');

    els.search.addEventListener('input', e => { state.search = e.target.value.trim(); render(); });
    els.country.addEventListener('change', e => { state.country = e.target.value; state.city = ''; renderFilters(); render(); });
    els.city.addEventListener('change', e => { state.city = e.target.value; render(); });

    els.chips.addEventListener('click', e => {
      const chip = e.target.closest('.ex-chip');
      if (!chip) return;
      if (chip.id === 'exVerifiedChip') { state.verifiedOnly = !state.verifiedOnly; }
      else if (chip.dataset.cat) { state.category = chip.dataset.cat; }
      renderFilters(); render();
    });

    els.list.addEventListener('click', e => {
      const card = e.target.closest('.ex-card');
      if (!card) return;
      const p = allProps.find(x => x.id === card.dataset.id);
      if (p) openPreview(p);
    });
    els.list.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.ex-card');
      if (!card) return;
      e.preventDefault();
      const p = allProps.find(x => x.id === card.dataset.id);
      if (p) openPreview(p);
    });

    els.cities.addEventListener('click', e => {
      const card = e.target.closest('.ex-city-card');
      if (!card) return;
      state.city = card.dataset.city; state.country = '';
      const c = PROPERTIES.find(p => p.city === card.dataset.city);
      if (c) MapProvider.flyTo(c.lat, c.lng, 11);
      renderFilters(); render();
    });

    document.addEventListener('click', e => {
      if (e.target.closest('#exPreviewClose')) closePreview();
      const mode = e.target.closest('.ex-mode-btn');
      if (mode) {
        state.mode = mode.dataset.mode;
        syncModeUI();
        if (state.mode === 'nearby' && !state.userLocation) locateUser();
        else render();
      }
      const layerBtn = e.target.closest('.ex-layers button');
      if (layerBtn) {
        state.layer = layerBtn.dataset.layer;
        document.querySelectorAll('.ex-layers button').forEach(b => b.classList.toggle('active', b === layerBtn));
        MapProvider.setLayer(state.layer);
      }
    });

    els.locateBtn.addEventListener('click', locateUser);
    $('#exZoomIn').addEventListener('click', () => MapProvider.map && MapProvider.map.zoomIn());
    $('#exZoomOut').addEventListener('click', () => MapProvider.map && MapProvider.map.zoomOut());
    els.fsBtn.addEventListener('click', () => {
      els.mapWrap.classList.toggle('fullscreen');
      MapProvider.invalidate();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (els.mapWrap.classList.contains('fullscreen')) { els.mapWrap.classList.remove('fullscreen'); MapProvider.invalidate(); }
        else if (els.preview.classList.contains('show')) closePreview();
      }
    });

    // Mobile bottom-sheet toggle
    const handle = $('#exSheetHandle');
    if (handle) handle.addEventListener('click', () => els.sidebar.classList.toggle('expanded'));
  }

  /* ---------------- Init ---------------- */
  function init() {
    if (!document.getElementById('smartExplorer')) return;
    MapProvider.init('explorerMap', { center: [25.0, 45.0], zoom: 4 });
    wire();
    renderFilters();
    renderCities();
    render();
    // Expose for debugging / future provider swap
    window.IshfadiExplorer = { state, setProvider(p) { MapProvider = p; }, refresh: render };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
