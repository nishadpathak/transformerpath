/* map.js — TransformerPath industry map (Leaflet). */
(function () {
  'use strict';

  var LAYERS = [
    { t: 'm', id: 'layerM', count: 'countM', color: 'm', label: 'Manufacturer' },
    { t: 'u', id: 'layerU', count: 'countU', color: 'u', label: 'Utility / grid operator' },
    { t: 'b', id: 'layerB', count: 'countB', color: 'b', label: 'Buyer / procurement' },
    { t: 'a', id: 'layerA', count: 'countA', color: 'a', label: 'Component & material supplier' },
    { t: 'y', id: 'layerY', count: 'countY', color: 'y', label: 'Machinery' },
    { t: 'l', id: 'layerL', count: 'countL', color: 'l', label: 'Testing laboratory' },
    { t: 'v', id: 'layerV', count: 'countV', color: 'v', label: 'Service & repair' },
    { t: 'g', id: 'layerG', count: 'countG', color: 'g', label: 'Logistics' },
    { t: 'e', id: 'layerE', count: 'countE', color: 'e', label: 'Event' }
  ];
  var LAYER_IDS = LAYERS.map(function (L) { return L.t; });
  var TYPE_LABEL = {};
  LAYERS.forEach(function (L) { TYPE_LABEL[L.t] = L.label; });
  TYPE_LABEL.s = 'Supplier';

  var KIND_LABEL = {
    accessory: 'Components & materials',
    machinery: 'Machinery',
    laboratory: 'Testing laboratory',
    service: 'Service & repair',
    logistics: 'Logistics',
    buyer: 'Buyer / procurement'
  };
  var PREC_LABEL = {
    site: 'Site coordinate',
    country: 'Country-level pin — not a factory or venue address',
    regional: 'Regional pin — not a single-country site'
  };

  var map, tiles, clusters = {}, featuredLayer, markersById = [];
  var allItems = [];
  var layersOn = { m: true, u: true, b: true, a: true, y: true, l: true, v: true, g: true, e: true };
  var upcomingOnly = true;
  var featuredOnly = false;
  var searchQ = '';
  var dirMeta = {};
  var unmappedMeta = {};
  var featuredMeta = { cta: 'verified.html', count: 0 };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function tileUrl() {
    return isDark()
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
  }

  function isFeatured(it) {
    return !!(it && (it.f || it.v));
  }

  function pinIcon(type, prec, featured) {
    if (featured) {
      return L.divIcon({
        className: 'tp-pin tp-pin-f' + (prec === 'site' ? ' is-site' : ' is-country'),
        html: '<span></span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -14]
      });
    }
    return L.divIcon({
      className: 'tp-pin tp-pin-' + type + (prec === 'site' ? ' is-site' : ' is-country'),
      html: '<span></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10]
    });
  }

  function typeLabel(it) {
    if (it.k && KIND_LABEL[it.k]) return KIND_LABEL[it.k];
    return TYPE_LABEL[it.t] || it.t;
  }

  function dateLine(it) {
    if (!it.s && !it.e) return '';
    if (it.s && it.e && it.s !== it.e) return it.s + ' → ' + it.e;
    return it.s || it.e;
  }

  function popupHtml(it) {
    var href = it.u || '#';
    var loc = it.t === 'e'
      ? [it.city, it.c].filter(Boolean).join(', ')
      : [it.city, it.c].filter(Boolean).join(', ') || it.c;
    var dates = it.t === 'e' ? dateLine(it) : '';
    var linkLbl = it.t === 'e' ? 'Open event →' : 'Open listing →';
    var cta = featuredMeta.cta || 'verified.html';
    var badges = '';
    if (it.lt === 'pro' || (it.f && it.lt !== 'verified')) {
      badges += '<span class="tp-pop-badge is-featured">Featured</span>';
    }
    if (it.v || it.lt === 'verified' || it.lt === 'pro') {
      badges += '<span class="tp-pop-badge is-verified">Verified</span>';
    }
    if (it.f && !badges) badges = '<span class="tp-pop-badge is-featured">Featured</span>';
    return '<div class="tp-pop">' +
      '<b>' + esc(it.n) + '</b>' +
      (badges ? '<div class="tp-pop-badges">' + badges + '</div>' : '') +
      (loc ? '<div class="tp-pop-meta">' + esc(loc) + '</div>' : '') +
      (dates ? '<div class="tp-pop-meta">' + esc(dates) + '</div>' : '') +
      '<div class="tp-pop-type">' + esc(typeLabel(it)) + '</div>' +
      '<span class="tp-pop-prec">' + esc(PREC_LABEL[it.p] || 'Country-level pin') + '</span>' +
      '<a class="tp-pop-link" href="' + esc(href) + '">' + linkLbl + '</a>' +
      '<a class="tp-pop-cta" href="' + esc(cta) + '">Get a featured pin →</a>' +
      '</div>';
  }

  function matches(it) {
    if (!layersOn[it.t]) return false;
    if (it.t === 'e' && upcomingOnly && !it.up) return false;
    if (featuredOnly && !isFeatured(it)) return false;
    if (!searchQ) return true;
    var hay = (it.n + ' ' + it.c + ' ' + (it.city || '') + ' ' + typeLabel(it)).toLowerCase();
    return hay.indexOf(searchQ) !== -1;
  }

  function visibleItems() {
    return allItems.filter(matches);
  }

  function rebuildLayers() {
    Object.keys(clusters).forEach(function (t) {
      clusters[t].clearLayers();
    });
    if (featuredLayer) featuredLayer.clearLayers();
    markersById = [];
    var vis = visibleItems();
    vis.forEach(function (it, idx) {
      var featured = isFeatured(it);
      var mk = L.marker([it.lat, it.lng], {
        icon: pinIcon(it.t, it.p, featured),
        title: it.n,
        keyboard: true,
        zIndexOffset: featured ? 1000 : 0,
        pane: featured ? 'featuredPane' : 'markerPane'
      });
      mk.bindPopup(popupHtml(it), { maxWidth: 280, className: 'tp-leaflet-pop' });
      mk._tpItem = it;
      mk._tpIdx = idx;
      if (featured && featuredLayer) featuredLayer.addLayer(mk);
      else if (clusters[it.t]) clusters[it.t].addLayer(mk);
      markersById.push(mk);
    });
    updateCounts(vis);
    renderList(vis);
  }

  function updateCounts(vis) {
    var n = { m: 0, u: 0, b: 0, a: 0, y: 0, l: 0, v: 0, g: 0, e: 0 };
    vis.forEach(function (it) { n[it.t] = (n[it.t] || 0) + 1; });
    LAYERS.forEach(function (L) { setText(L.count, n[L.t] || 0); });
    setText('countAll', vis.length);
    var featuredVis = vis.filter(isFeatured).length;
    setText('countF', featuredVis);
    var featNote = document.getElementById('featuredNote');
    if (featNote) {
      var cta = featuredMeta.cta || 'verified.html';
      if (featuredVis) {
        featNote.innerHTML = featuredVis + ' featured / verified pin' + (featuredVis === 1 ? '' : 's') +
          ' · <a href="' + esc(cta) + '" style="color:#f5a623;font-weight:700">Get a featured pin →</a>';
      } else {
        featNote.innerHTML = 'No featured pins yet · <a href="' + esc(cta) + '" style="color:#f5a623;font-weight:700">Get a featured pin →</a>';
      }
    }
    var labelE = document.getElementById('labelE');
    if (labelE) labelE.textContent = upcomingOnly ? 'Events (upcoming)' : 'Events (all pinned)';
    var note = document.getElementById('eventCountNote');
    if (note) {
      var skipped = dirMeta.eventsUnpinnedUpcoming || 0;
      var um = unmappedMeta.total || 0;
      var bits = [];
      if (upcomingOnly && skipped) {
        bits.push(n.e + ' of ' + (dirMeta.eventsUpcoming || n.e) + ' upcoming directory events — ' + skipped + ' have no country pin (host city TBC).');
      } else if (upcomingOnly) {
        bits.push('Upcoming events use the same filter as the events directory.');
      } else {
        bits.push('All pin-able events (past + upcoming). Withdrawn / unverified editions are omitted.');
      }
      if (um) bits.push(um + ' directory row(s) unmapped (no country or no centroid) — not placed on the map.');
      note.textContent = bits.join(' ');
      note.hidden = false;
    }
  }

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(v);
  }

  function renderList(vis) {
    var box = document.getElementById('mapResults');
    if (!box) return;
    if (!vis.length) {
      box.innerHTML = featuredOnly
        ? '<p class="tp-map-empty">No featured pins yet. <a href="' + esc(featuredMeta.cta || 'verified.html') + '" style="color:#f5a623;font-weight:700">Get a featured pin →</a></p>'
        : '<p class="tp-map-empty">No matching organisations or events. Clear search or turn a layer back on.</p>';
      return;
    }
    var byC = {};
    vis.forEach(function (it) {
      var c = it.c || 'Unspecified';
      (byC[c] = byC[c] || []).push(it);
    });
    var countries = Object.keys(byC).sort();
    var shown = 0;
    var cap = 80;
    var html = '';
    countries.forEach(function (c) {
      if (shown >= cap) return;
      var rows = byC[c].slice().sort(function (a, b) {
        return (isFeatured(b) ? 1 : 0) - (isFeatured(a) ? 1 : 0);
      });
      html += '<div class="tp-map-group">' + esc(c) + ' (' + rows.length + ')</div>';
      rows.forEach(function (it) {
        if (shown >= cap) return;
        html += '<button type="button" class="tp-map-hit" data-key="' + esc(it.t + '|' + it.n + '|' + it.c) + '">' +
          '<span class="tp-dot ' + (isFeatured(it) ? 'tp-dot-f' : 'tp-dot-' + it.t) + '"></span>' +
          '<span class="tp-map-hit-text"><b>' + esc(it.n) + '</b>' +
          '<small>' + esc(it.t === 'e' ? ([it.city, it.c].filter(Boolean).join(', ')) : (it.city || it.c)) +
          ' · ' + esc(typeLabel(it)) +
          (isFeatured(it) ? ' · Featured' : '') +
          (it.t === 'e' && dateLine(it) ? ' · ' + esc(dateLine(it)) : '') +
          (it.p === 'site' ? '' : ' · country-level') + '</small></span></button>';
        shown += 1;
      });
    });
    if (vis.length > cap) {
      html += '<p class="tp-map-more">' + (vis.length - cap) + ' more on the map — zoom, search, or filter by country name.</p>';
    }
    box.innerHTML = html;
    box.querySelectorAll('.tp-map-hit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key') || '';
        var parts = key.split('|');
        var hit = vis.filter(function (it) {
          return it.t === parts[0] && it.n === parts[1] && it.c === parts[2];
        })[0];
        if (hit) focusItem(hit);
        if (window.matchMedia('(max-width:720px)').matches) collapsePanel();
      });
    });
  }

  function focusItem(it) {
    if (!it || !map) return;
    var hit = markersById.filter(function (mk) {
      return mk._tpItem && mk._tpItem.n === it.n && mk._tpItem.c === it.c && mk._tpItem.t === it.t;
    })[0];
    if (!hit) {
      map.setView([it.lat, it.lng], 6, { animate: true });
      return;
    }
    var grp = isFeatured(it) ? featuredLayer : clusters[it.t];
    if (grp && grp.zoomToShowLayer) {
      grp.zoomToShowLayer(hit, function () { hit.openPopup(); });
    } else {
      map.setView([it.lat, it.lng], 6, { animate: true });
      hit.openPopup();
    }
    setTimeout(function () {
      if (hit.getPopup() && !hit.isPopupOpen()) hit.openPopup();
    }, 1400);
  }

  function collapsePanel() {
    var panel = document.getElementById('mapPanel');
    var btn = document.getElementById('mapPanelToggle');
    if (panel) panel.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function setLayer(t, on) {
    layersOn[t] = !!on;
    var meta = LAYERS.filter(function (L) { return L.t === t; })[0];
    var el = meta ? document.getElementById(meta.id) : null;
    if (el) el.checked = !!on;
    if (map && clusters[t]) {
      if (on && !map.hasLayer(clusters[t])) map.addLayer(clusters[t]);
      if (!on && map.hasLayer(clusters[t])) map.removeLayer(clusters[t]);
    }
  }

  function setAll(on, except) {
    LAYER_IDS.forEach(function (t) {
      if (except && except.indexOf(t) >= 0) setLayer(t, true);
      else setLayer(t, on && (!except || except.indexOf(t) >= 0));
    });
  }

  function applyUrlParams() {
    var params = new URLSearchParams(location.search);
    var layer = (params.get('layer') || params.get('layers') || '').toLowerCase();
    if (layer === 'events' || layer === 'e') {
      setAll(false, ['e']);
    } else if (layer === 'manufacturers' || layer === 'm') {
      setAll(false, ['m']);
    } else if (layer === 'utilities' || layer === 'grids') {
      setAll(false, ['u']);
    } else if (layer === 'buyers' || layer === 'b' || layer === 'customers') {
      setAll(false, layer === 'customers' ? ['u', 'b'] : ['b']);
    } else if (layer === 'suppliers' || layer === 's') {
      setAll(false, ['a', 'y', 'l', 'v', 'g']);
    } else if (layer === 'accessories' || layer === 'components' || layer === 'a') {
      setAll(false, ['a']);
    } else if (layer === 'machinery' || layer === 'y') {
      setAll(false, ['y']);
    } else if (layer === 'laboratories' || layer === 'labs' || layer === 'l') {
      setAll(false, ['l']);
    } else if (layer === 'services' || layer === 'v') {
      setAll(false, ['v']);
    } else if (layer === 'logistics' || layer === 'g') {
      setAll(false, ['g']);
    } else if (layer === 'featured' || layer === 'f') {
      featuredOnly = true;
    }
    var feat = params.get('featured');
    if (feat === '1' || feat === 'true' || feat === 'only') featuredOnly = true;
    var featEl = document.getElementById('featuredOnly');
    if (featEl) featEl.checked = featuredOnly;
    var up = params.get('upcoming');
    if (up === '0' || up === 'all' || up === 'false') upcomingOnly = false;
    var upEl = document.getElementById('upcomingOnly');
    if (upEl) upEl.checked = upcomingOnly;
    var q = params.get('q');
    if (q) {
      searchQ = q.trim().toLowerCase();
      var box = document.getElementById('mapSearch');
      if (box) box.value = q;
    }
  }

  function bindUi() {
    LAYERS.forEach(function (L) {
      var el = document.getElementById(L.id);
      if (!el) return;
      el.addEventListener('change', function () {
        setLayer(L.t, el.checked);
        rebuildLayers();
      });
    });
    var upEl = document.getElementById('upcomingOnly');
    if (upEl) {
      upEl.addEventListener('change', function () {
        upcomingOnly = upEl.checked;
        rebuildLayers();
      });
    }
    var featEl = document.getElementById('featuredOnly');
    if (featEl) {
      featEl.addEventListener('change', function () {
        featuredOnly = featEl.checked;
        rebuildLayers();
      });
    }
    var q = document.getElementById('mapSearch');
    if (q) {
      q.addEventListener('input', function () {
        searchQ = q.value.trim().toLowerCase();
        rebuildLayers();
      });
      q.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          var vis = visibleItems();
          if (vis[0]) focusItem(vis[0]);
        }
      });
    }
    var toggle = document.getElementById('mapPanelToggle');
    var panel = document.getElementById('mapPanel');
    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        var open = !panel.classList.contains('is-open');
        panel.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        setTimeout(function () {
          if (tiles) tiles.setUrl(tileUrl());
        }, 0);
      });
    }
  }

  function clusterOpts(color) {
    return {
      showCoverageOnHover: false,
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function (cluster) {
        var n = cluster.getChildCount();
        var size = n > 40 ? 'lg' : n > 12 ? 'md' : 'sm';
        return L.divIcon({
          html: '<b>' + n + '</b>',
          className: 'tp-cluster tp-cluster-' + color + ' tp-cluster-' + size,
          iconSize: L.point(36, 36)
        });
      }
    };
  }

  function initMap(data) {
    allItems = data.items || [];
    dirMeta = data.directory || {};
    unmappedMeta = data.unmapped || {};
    featuredMeta = data.featured || { cta: 'verified.html', count: 0 };
    map = L.map('tpMap', {
      worldCopyJump: true,
      zoomControl: false,
      scrollWheelZoom: true
    }).setView([20, 15], 2);
    map.createPane('featuredPane');
    map.getPane('featuredPane').style.zIndex = 650;
    L.control.zoom({ position: 'topright' }).addTo(map);

    tiles = L.tileLayer(tileUrl(), {
      attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, FAO, NOAA, USGS',
      maxZoom: 16
    }).addTo(map);

    LAYERS.forEach(function (layer) {
      clusters[layer.t] = L.markerClusterGroup(clusterOpts(layer.color));
      map.addLayer(clusters[layer.t]);
    });
    featuredLayer = L.layerGroup();
    map.addLayer(featuredLayer);

    bindUi();
    applyUrlParams();
    rebuildLayers();
    var vis = visibleItems();
    if (searchQ && vis[0]) {
      setTimeout(function () { focusItem(vis[0]); }, 240);
    }
    setTimeout(function () { map.invalidateSize(); }, 80);
    window.addEventListener('resize', function () {
      if (map) map.invalidateSize();
    });
  }

  var status = document.getElementById('mapStatus');
  fetch('data/map-points.json')
    .then(function (r) {
      if (!r.ok) throw new Error('Could not load map data');
      return r.json();
    })
    .then(function (data) {
      if (status) status.hidden = true;
      initMap(data);
    })
    .catch(function (err) {
      if (status) status.textContent = 'The map data could not be loaded. Try refreshing the page.';
      console.warn(err);
    });
})();
