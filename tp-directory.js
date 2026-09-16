/* ============================================================================
   TransformerPath — Industry Directory client.
   ----------------------------------------------------------------------------
   A sourced sourcing directory over data/directory-index.json (which reuses the
   canonical manufacturer + component-supplier records; it adds no records).

   Core workflow: FIND -> FILTER -> VERIFY EVIDENCE -> COMPARE -> RFQ.
   It is deliberately fact-based and neutral:
     - capability evidence is shown as CONFIRMED / COMPANY_REPORTED / INFERRED /
       UNKNOWN (independent of commercial/paid status);
     - there is NO overall score, star rating, tier ranking or "best" call;
     - shortlists require an account and are wired to the workspace (deferred).

   If the index cannot load, the page degrades to an explanatory state.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('directoryRoot');
  var DATA = null;

  var EV = {
    CONFIRMED: 'Confirmed', COMPANY_REPORTED: 'Company reported',
    INFERRED: 'Inferred', UNKNOWN: 'Unknown'
  };
  var EV_CLASS = {
    CONFIRMED: 'ev-confirmed', COMPANY_REPORTED: 'ev-reported',
    INFERRED: 'ev-inferred', UNKNOWN: 'ev-unknown'
  };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var STATS = {};

  function load() {
    Promise.all([
      fetch('data/directory-index.json').then(function (r) { return r.json(); }),
      fetch('data/site-stats.json').then(function (r) { return r.json(); }).catch(function () { return {}; })
    ]).then(function (pair) {
        var j = pair[0];
        STATS = pair[1] || {};
        DATA = j && j.companies || [];
        var params = new URLSearchParams(window.location.search);
        if (params.get('q')) q = params.get('q');
        if (params.get('kind')) kind = params.get('kind');
        if (params.get('country')) country = params.get('country');
        if (params.get('minKv')) minKv = parseInt(params.get('minKv'), 10) || 0;
        var landing = document.getElementById('dirLanding');
        if (q && landing) landing.style.display = 'none';
        render();
      })
      .catch(function () {
        root.innerHTML = '<p style="color:var(--muted)">The directory index could not be loaded. Refresh, or report this page.</p>';
      });
  }

  function searchText(c) {
    var types = [];
    ['power', 'distribution', 'dry_type', 'special'].forEach(function (t) {
      Object.keys(c.transformer_types && c.transformer_types[t] || {}).forEach(function (k) { if (k !== '__present') types.push(k.replace(/_/g, ' ')); });
    });
    var fac = (c.factories || []).map(function (f) { return (f.city + ' ' + f.country); }).join(' ');
    return [
      c.name, c.country, c.region, c.headquarters,
      (c.product_codes || []).join(' '),               // raw coded types: PT, GSU, DT, CAST_RESIN, ...
      (c.capability_labels || []).join(' '),           // human labels
      types.join(' '),                                 // subtype keys: gsu, autotransformer, ...
      c.voltage && c.voltage.value, c.mva && c.mva.value,
      (c.certs || []).join(' '), fac
    ].join(' ').toLowerCase();
  }

  // ── State ────────────────────────────────────────────────────────────────
  var q = '', kind = '', country = '', type = '', minKv = 0, evFilter = '', onlyMultiPlant = false, minComp = 0;
  var compare = {}; // id -> true

  var STOPWORDS = { manufacturer:1, manufacturers:1, supplier:1, suppliers:1, company:1, companies:1, transformer:1, transformers:1, factory:1, factories:1, for:1, the:1, a:1, an:1, and:1, make:1, makers:1, of:1, in:1, with:1, need:1 };

  function applyFilters() {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean).filter(function (w) { return !STOPWORDS[w]; });
    return DATA.filter(function (c) {
      if (kind && c.kind !== kind) return false;
      if (country && c.country !== country) return false;
      if (evFilter && c.evidence !== evFilter) return false;
      if (onlyMultiPlant && (!c.factories || c.factories.length <= 1)) return false;
      var compScore = c.completeness_score != null ? c.completeness_score : (c.research_completeness ? Math.min(100, c.research_completeness * 15) : 40);
      if (minComp > 0 && compScore < minComp) return false;
      if (type) {
        var t = c.transformer_types || {};
        var hit = /^power/i.test(type) ? t.power && t.power.__present || t.power && t.power[type.split('.')[1]] : false;
        if (!hit) {
          if (type.indexOf('.') < 0 && t[type] && t[type].__present) hit = true;
        }
        if (!hit) return false;
      }
      if (minKv > 0 && (!c.voltage || !c.voltage.num || c.voltage.num < minKv)) return false;
      if (words.length && !words.every(function (w) { return searchText(c).indexOf(w) >= 0; })) return false;
      return true;
    });
  }

  function evBadge(e) { return '<span class="ev-badge ' + (EV_CLASS[e] || 'ev-unknown') + '">' + esc(EV[e] || e) + '</span>'; }

  var KIND_LABELS = {
    manufacturer: 'Transformer OEM',
    component_supplier: 'Components & Accessories',
    machinery_manufacturer: 'Machinery Maker',
    testing_laboratory: 'Testing Laboratory',
    service_repair: 'Service & Repair',
    transport_logistics: 'Transport & Logistics',
    industry_association: 'Industry Association',
    education_provider: 'Education & Training',
    buyer_procurement: 'Buyer & Utility',
    media_publication: 'Media & Journal'
  };

  var KIND_ICONS = {
    manufacturer: '⚡',
    component_supplier: '🧩',
    machinery_manufacturer: '⚙️',
    testing_laboratory: '🔬',
    service_repair: '🛠️',
    transport_logistics: '🚢',
    industry_association: '🏛️',
    education_provider: '🎓',
    buyer_procurement: '🏢',
    media_publication: '📰'
  };

  function profileUrl(c) {
    var slug = c.slug ? String(c.slug).replace(/^(acc|mach|lab|srv|log|asc|edu|buy|med):/, '') : '';
    if (c.kind === 'manufacturer' && slug) return 'manufacturers/' + esc(slug) + '/';
    if (c.kind === 'component_supplier') return slug ? 'accessories/' + esc(slug) + '/' : 'accessories.html';
    if (c.kind === 'machinery_manufacturer') return 'machinery.html';
    if (c.kind === 'testing_laboratory') return 'laboratories.html';
    if (c.kind === 'service_repair') return 'services.html';
    if (c.kind === 'transport_logistics') return 'logistics.html';
    if (c.kind === 'industry_association') return 'associations.html';
    if (c.kind === 'education_provider') return 'education.html';
    if (c.kind === 'buyer_procurement') return 'buyers.html';
    if (c.kind === 'media_publication') return 'media.html';
    return c.website || '#';
  }

  function cardHtml(c) {
    var selected = compare[c.id];
    var compScore = c.completeness_score != null ? c.completeness_score : (c.research_completeness ? Math.min(100, c.research_completeness * 15) : 40);
    var compClass = compScore >= 70 ? 'kg-comp-high' : (compScore >= 45 ? 'kg-comp-mid' : 'kg-comp-low');
    var isUhv = c.voltage && c.voltage.num && c.voltage.num >= 765;
    var isEhv = c.voltage && c.voltage.num && c.voltage.num >= 400 && !isUhv;

    var specsHtml = [];
    if (c.voltage && c.voltage.value) {
      specsHtml.push('<span class="kg-spec-pill ' + (isUhv ? 'uhv' : (isEhv ? 'ehv' : '')) + '">⚡ ' + esc(c.voltage.value) + (isUhv ? ' UHV' : (isEhv ? ' EHV' : '')) + '</span>');
    }
    if (c.mva && c.mva.value) {
      specsHtml.push('<span class="kg-spec-pill">📦 ' + esc(c.mva.value) + '</span>');
    }
    if (c.factories && c.factories.length) {
      specsHtml.push('<span class="kg-spec-pill fac">🏭 ' + c.factories.length + ' Plant' + (c.factories.length !== 1 ? 's' : '') + '</span>');
    }
    if (c.certs && c.certs.length) {
      specsHtml.push('<span class="kg-spec-pill">📜 ' + esc(c.certs.slice(0, 2).join(', ')) + '</span>');
    }

    var kindIcon = KIND_ICONS[c.kind] || '🏢';
    var kindText = KIND_LABELS[c.kind] || c.kind;

    return '<div class="kg-card" data-id="' + esc(c.id) + '">' +
      '<div class="kg-card-check">' +
        '<input type="checkbox" title="Select for side-by-side comparison" data-cmp="' + esc(c.id) + '"' + (selected ? ' checked' : '') + '>' +
      '</div>' +
      '<div class="kg-card-main">' +
        '<div class="kg-card-head">' +
          '<a class="kg-card-title" href="' + profileUrl(c) + '" data-track="directory_profile_click" data-track-entity="' + esc(c.name) + '" data-track-kind="' + esc(c.kind) + '" data-track-country="' + esc(c.country) + '">' + esc(c.name) + '</a>' +
          '<span class="kg-card-loc">' + esc(c.country) + (c.region ? ' · ' + esc(c.region) : '') + '</span>' +
          '<span class="dir-tag" style="background:rgba(245,166,35,.12);border-color:var(--amber);color:var(--text);font-weight:700">' + kindIcon + ' ' + esc(kindText) + '</span>' +
          evBadge(c.evidence) +
        '</div>' +
        (specsHtml.length ? '<div class="kg-card-specs">' + specsHtml.join('') + '</div>' : '') +
        '<div class="dir-tags">' + (c.capability_labels || []).slice(0, 6).map(function (l) { return '<span class="dir-tag">' + esc(l) + '</span>'; }).join('') + '</div>' +
        '<div class="kg-comp-wrapper">' +
          '<span>Completeness: <b>' + compScore + '%</b></span>' +
          '<span class="kg-comp-bar"><span class="kg-comp-fill ' + compClass + '" style="width:' + compScore + '%"></span></span>' +
          '<span style="font-size:.72rem;color:var(--muted)">· Provenance: ' + (c.sources && c.sources.capability_source ? esc(c.sources.capability_source) : (c.provenance_type || 'Verified source')) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="kg-card-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-shortlist="' + esc(c.id) + '" data-short-name="' + esc(c.name) + '" data-short-kind="' + esc(c.kind || 'company') + '" data-short-url="' + esc(profileUrl(c)) + '">Shortlist</button>' +
        '<a class="btn btn-amber btn-sm" href="rfq.html?company=' + encodeURIComponent(c.name) + '" data-track="rfq_started_directory" data-track-entity="' + esc(c.name) + '">RFQ</a>' +
        '<a class="btn btn-outline btn-sm" href="' + profileUrl(c) + '" data-track="directory_profile_click" data-track-entity="' + esc(c.name) + '">Profile →</a>' +
        (c.website ? '<a class="btn btn-outline btn-sm" href="' + esc(c.website) + '" target="_blank" rel="noopener" style="font-size:.72rem" data-track="official_website_click" data-track-entity="' + esc(c.name) + '">Site ↗</a>' : '') +
      '</div>' +
    '</div>';
  }

  function render() {
    if (!root) return;
    var hits = applyFilters();
    var facets = { countries: {}, kinds: {} };
    DATA.forEach(function (c) {
      facets.countries[c.country] = (facets.countries[c.country] || 0) + 1;
      facets.kinds[c.kind] = (facets.kinds[c.kind] || 0) + 1;
    });
    var countries = Object.keys(facets.countries).sort();

    var typeOpts = ['power', 'distribution', 'dry_type', 'special'];
    var typSel = '<option value="">All Transformer Types</option>' + typeOpts.map(function (t) {
      return '<option value="' + t + '"' + (type === t ? ' selected' : '') + '>' + t.replace(/_/g, ' ').replace(/^./, function (ch) { return ch.toUpperCase(); }) + '</option>';
    }).join('');

    var tabsConfig = [
      { key: '', label: '🌐 All Ecosystem', count: DATA.length },
      { key: 'manufacturer', label: '⚡ Manufacturers', count: facets.kinds.manufacturer || 0 },
      { key: 'component_supplier', label: '🧩 Components & Materials', count: facets.kinds.component_supplier || 0 },
      { key: 'service_repair', label: '🛠️ Service & Repair', count: facets.kinds.service_repair || 0 },
      { key: 'transport_logistics', label: '🚢 Logistics', count: facets.kinds.transport_logistics || 0 },
      { key: 'testing_laboratory', label: '🔬 Testing Labs', count: facets.kinds.testing_laboratory || 0 },
      { key: 'machinery_manufacturer', label: '⚙️ Machinery', count: facets.kinds.machinery_manufacturer || 0 },
      { key: 'industry_association', label: '🏛️ Associations', count: facets.kinds.industry_association || 0 },
      { key: 'education_provider', label: '🎓 Education', count: facets.kinds.education_provider || 0 },
      { key: 'buyer_procurement', label: '🏢 Buyers', count: facets.kinds.buyer_procurement || 0 },
      { key: 'media_publication', label: '📰 Media', count: facets.kinds.media_publication || 0 }
    ].filter(function (t) { return t.key === '' || t.count > 0; });

    var existingControls = root.querySelector('.dir-controls');
    if (existingControls) {
      // Update quick pill states
      var pills = root.querySelectorAll('.kg-quick-pill');
      pills.forEach(function (p) {
        if (p.hasAttribute('data-set-minkv')) {
          var v = parseInt(p.getAttribute('data-set-minkv'), 10);
          p.classList.toggle('on', minKv === v);
        } else if (p.hasAttribute('data-toggle')) {
          p.classList.toggle('on', !!onlyMultiPlant);
        } else if (p.hasAttribute('data-set-ev')) {
          p.classList.toggle('on', evFilter === p.getAttribute('data-set-ev'));
        } else if (p.hasAttribute('data-set-mincomp')) {
          p.classList.toggle('on', minComp === parseInt(p.getAttribute('data-set-mincomp'), 10));
        }
      });

      // Update ecosystem tabs
      var tabBtns = root.querySelectorAll('.kg-tab-btn');
      tabBtns.forEach(function (tb) {
        tb.classList.toggle('active', tb.getAttribute('data-set-kind') === kind);
      });

      // Update input and select values only if out of sync and not currently focused
      var elQ = document.getElementById('dirQ');
      if (elQ && document.activeElement !== elQ && elQ.value !== q) elQ.value = q;
      var elC = document.getElementById('dirCountry');
      if (elC && document.activeElement !== elC && elC.value !== country) elC.value = country;
      var elT = document.getElementById('dirType');
      if (elT && document.activeElement !== elT && elT.value !== type) elT.value = type;
      var elK = document.getElementById('dirKv');
      if (elK && document.activeElement !== elK && elK.value !== String(minKv)) elK.value = String(minKv);
      var elE = document.getElementById('dirEv');
      if (elE && document.activeElement !== elE && elE.value !== evFilter) elE.value = evFilter;

      // Update count
      var countEl = root.querySelector('.dir-count');
      if (countEl) {
        countEl.innerHTML = '<span>Showing <b>' + hits.length + '</b> of ' + DATA.length + ' verified records</span><span style="font-size:.8rem;color:var(--accent);font-weight:600">Tip: Select up to 5 entities to compare side-by-side</span>';
      }

      // Update list
      var listEl = root.querySelector('.dir-list');
      if (listEl) {
        listEl.innerHTML = hits.length ? hits.slice(0, 60).map(cardHtml).join('') : '<div class="card" style="text-align:center;padding:40px;color:var(--muted)"><h3>No matching entities found</h3><p style="margin:8px 0">Try relaxing your search terms or clearing the voltage/evidence filters.</p><button id="btnResetEmpty" class="btn btn-amber btn-sm">Clear All Filters</button></div>';
      }

      var moreEl = root.querySelector('.dir-more-note');
      if (hits.length > 60) {
        if (!moreEl && listEl) {
          moreEl = document.createElement('p');
          moreEl.className = 'dir-more-note';
          moreEl.style.cssText = 'text-align:center;color:var(--muted);font-size:.85rem;padding:12px 0 24px';
          listEl.parentNode.insertBefore(moreEl, listEl.nextSibling);
        }
        if (moreEl) moreEl.textContent = 'Showing top 60 matches — use the search bar or filters above to refine your shortlist.';
      } else if (moreEl) {
        moreEl.remove();
      }

      renderCompare();
      renderCmpDock();
      return;
    }

    var tabsHtml = tabsConfig.map(function (t) {
      return '<button class="kg-tab-btn ' + (kind === t.key ? 'active' : '') + '" data-set-kind="' + esc(t.key) + '">' + t.label + ' <span class="badge-cnt">' + t.count + '</span></button>';
    }).join('');

    root.innerHTML =
      '<div class="kg-hero-banner">' +
        '<nav style="font-size:.82rem;color:var(--muted);margin-bottom:10px"><a href="index.html" style="color:var(--amber)">Home</a> › Transformer Industry Directory</nav>' +
        '<p style="margin:0 0 6px;color:#fff;font-size:1.15rem;font-weight:700;letter-spacing:-.02em">Search the industry knowledge graph</p>' +
        (q ? '<p style="color:#f5a623;font-size:.92rem;margin:0 0 10px">Showing directory matches for “' + esc(q) + '”. For companies, plants, projects, tenders and intel in one view, use <a href="search.html?q=' + encodeURIComponent(q) + '" style="color:#f5a623;font-weight:800">universal search →</a></p>' : '') +
        '<p style="color:#b8c4d4;font-size:.95rem;margin:0;max-width:840px;line-height:1.5">An interconnected, sourced database connecting power and distribution transformer OEMs, component &amp; material suppliers, service contractors, heavy transport, testing laboratories, associations, training academies, and buyers. <b>Factual evidence, sourced records, zero subjective rankings.</b></p>' +
        '<div class="kg-kpi-grid">' +
          '<div class="kg-kpi-box"><div class="kg-kpi-val">' + (STATS.manufacturers || facets.kinds.manufacturer || DATA.length) + '</div><div class="kg-kpi-lbl">Manufacturers</div></div>' +
          '<div class="kg-kpi-box"><div class="kg-kpi-val">' + (STATS.factories || '—') + '</div><div class="kg-kpi-lbl">Sourced plants</div></div>' +
          '<div class="kg-kpi-box"><div class="kg-kpi-val">' + (STATS.capabilities || '—') + '</div><div class="kg-kpi-lbl">Capabilities</div></div>' +
          '<div class="kg-kpi-box"><div class="kg-kpi-val">' + (STATS.manufacturingCountries || countries.length) + '</div><div class="kg-kpi-lbl">Countries</div></div>' +
          '<div class="kg-kpi-box"><div class="kg-kpi-val">' + DATA.length + '</div><div class="kg-kpi-lbl">Indexed entities</div></div>' +
        '</div>' +
      '</div>' +

      // Ecosystem Tab Navigation
      '<div class="kg-tabs-bar" style="overflow-x:auto;white-space:nowrap;padding-bottom:6px">' +
        tabsHtml +
      '</div>' +

      // Quick filter pills
      '<div class="kg-quick-bar">' +
        '<span class="kg-quick-lbl">Quick Filters:</span>' +
        '<button class="kg-quick-pill ' + (minKv === 400 ? 'on' : '') + '" data-set-minkv="400">⚡ ≥400 kV (EHV)</button>' +
        '<button class="kg-quick-pill ' + (minKv === 765 ? 'on' : '') + '" data-set-minkv="765">⚡ 765 kV (UHV)</button>' +
        '<button class="kg-quick-pill ' + (onlyMultiPlant ? 'on' : '') + '" data-toggle="multiPlant">🏭 Multi-Plant OEMs</button>' +
        '<button class="kg-quick-pill ' + (evFilter === 'CONFIRMED' ? 'on' : '') + '" data-set-ev="CONFIRMED">✅ Confirmed Evidence</button>' +
        '<button class="kg-quick-pill ' + (minComp === 70 ? 'on' : '') + '" data-set-mincomp="70">⭐ ≥70% Profile Completeness</button>' +
      '</div>' +

      // Main search & dropdown filter bar
      '<div class="dir-controls">' +
        '<input id="dirQ" type="search" placeholder="Search entity, capability, brand or keyword (e.g. 400 kV, OLTC, pressboard, VPD, Georg, KEMA)..." value="' + esc(q) + '">' +
        '<select id="dirCountry"><option value="">All Countries (' + countries.length + ')</option>' + countries.map(function (cc) { return '<option value="' + esc(cc) + '"' + (country === cc ? ' selected' : '') + '>' + esc(cc) + ' (' + facets.countries[cc] + ')</option>'; }).join('') + '</select>' +
        '<select id="dirType">' + typSel + '</select>' +
        '<select id="dirKv"><option value="0">Any Voltage Class</option><option value="110"' + (minKv===110?' selected':'') + '>110 kV+ (HV)</option><option value="220"' + (minKv===220?' selected':'') + '>220 kV+ (HV)</option><option value="400"' + (minKv===400?' selected':'') + '>400 kV+ (EHV)</option><option value="765"' + (minKv===765?' selected':'') + '>765 kV+ (UHV)</option></select>' +
        '<select id="dirEv"><option value="">Any Evidence Level</option><option value="CONFIRMED"' + (evFilter==='CONFIRMED'?' selected':'') + '>Confirmed</option><option value="COMPANY_REPORTED"' + (evFilter==='COMPANY_REPORTED'?' selected':'') + '>Company Reported</option><option value="INFERRED"' + (evFilter==='INFERRED'?' selected':'') + '>Inferred</option><option value="UNKNOWN"' + (evFilter==='UNKNOWN'?' selected':'') + '>Unknown</option></select>' +
        '<button id="dirClear" class="btn btn-outline btn-sm">Reset</button>' +
      '</div>' +

      '<div class="dir-count" style="display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:.85rem;margin:14px 0 10px">' +
        '<span>Showing <b>' + hits.length + '</b> of ' + DATA.length + ' verified records</span>' +
        '<span style="font-size:.8rem;color:var(--accent);font-weight:600">Tip: Select up to 5 entities to compare side-by-side</span>' +
      '</div>' +

      '<div id="dirCompare" class="dir-compare"></div>' +
      '<div class="dir-list">' + (hits.length ? hits.slice(0, 60).map(cardHtml).join('') : '<div class="card" style="text-align:center;padding:40px;color:var(--muted)"><h3>No matching entities found</h3><p style="margin:8px 0">Try relaxing your search terms or clearing the voltage/evidence filters.</p><button id="btnResetEmpty" class="btn btn-amber btn-sm">Clear All Filters</button></div>') + '</div>' +
      '<div class="dir-note" style="font-size:.78rem;color:var(--muted);margin-top:20px;line-height:1.6;border-top:1px solid var(--border);padding-top:14px">Capability evidence is independent of commercial/paid status. <b>Potentially relevant</b> does not mean technically qualified — verify with the manufacturer before a commercial decision. UNKNOWN is shown rather than guessed.</div>' +

      // Floating bottom comparison dock
      '<div id="tpCmpDock" class="tp-cmp-dock"></div>';

    if (hits.length > 60) {
      var more = document.createElement('p');
      more.className = 'dir-more-note';
      more.style.cssText = 'text-align:center;color:var(--muted);font-size:.85rem;padding:12px 0 24px';
      more.textContent = 'Showing top 60 matches — use the search bar or filters above to refine your shortlist.';
      root.appendChild(more);
    }

    renderCompare();
    renderCmpDock();
    wire();
  }

  function renderCmpDock() {
    var dock = document.getElementById('tpCmpDock');
    if (!dock) return;
    var ids = Object.keys(compare).filter(function (k) { return compare[k]; }).slice(0, 5);
    if (!ids.length) {
      dock.className = 'tp-cmp-dock';
      dock.innerHTML = '';
      return;
    }
    var rows = ids.map(function (id) { return DATA.find(function (c) { return c.id === id; }); }).filter(Boolean);
    dock.className = 'tp-cmp-dock visible';
    var chips = rows.map(function (c) {
      return '<span class="tp-cmp-dock-chip">' + esc(c.name.slice(0, 22)) + '</span>';
    }).join('');

    var mSlugs = rows.map(function (c) { return c.slug; }).filter(Boolean);
    var compareLink = mSlugs.length ? 'compare.html?m=' + mSlugs.join(',') : '#dirCompare';

    dock.innerHTML =
      '<div class="tp-cmp-dock-info">⚖️ <b>' + rows.length + ' of 5</b> selected for comparison</div>' +
      '<div class="tp-cmp-dock-chips">' + chips + '</div>' +
      '<div class="tp-cmp-dock-actions">' +
        (rows.length >= 2
          ? '<a class="btn btn-amber btn-sm" href="' + esc(compareLink) + '" id="btnDockCompare">Compare Side-by-Side →</a>'
          : '<span style="font-size:.76rem;color:#cbd5e1">Pick 1 more to compare</span>') +
        '<button class="btn btn-outline btn-sm" id="btnDockClear" style="color:#fff;border-color:rgba(255,255,255,.3)">Clear</button>' +
      '</div>';

    var btnClear = document.getElementById('btnDockClear');
    if (btnClear) btnClear.addEventListener('click', function () {
      compare = {};
      render();
    });
  }

  function renderCompare() {
    var box = document.getElementById('dirCompare');
    if (!box) return;
    var ids = Object.keys(compare).filter(function (k) { return compare[k]; }).slice(0, 5);
    if (ids.length < 2) { box.innerHTML = ''; return; }
    var rows = ids.map(function (id) { return DATA.find(function (c) { return c.id === id; }); }).filter(Boolean);
    box.innerHTML =
      '<div class="dir-cmp-banner" style="background:rgba(245,166,35,.08);border:1px solid var(--amber);border-radius:12px;padding:14px 18px;margin-bottom:16px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
          '<div><b style="color:var(--text);font-size:1.02rem">⚖️ Technical Knowledge Graph Comparison</b> — Comparing ' + rows.length + ' entities across verified capability fields</div>' +
          '<div style="display:flex;gap:6px">' +
            '<a class="btn btn-amber btn-sm" href="compare.html?m=' + rows.map(function(c){return c.slug;}).filter(Boolean).join(',') + '">Open Full Page Comparison ↗</a>' +
            '<button class="btn btn-outline btn-sm" id="btnCloseCmp">Close</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap" style="background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);margin-bottom:20px">' +
        '<table><thead><tr>' +
        '<th style="width:180px;background:var(--navy);color:#fff">Field</th>' + rows.map(function (c) { return '<th style="background:var(--navy);color:#fff">' + esc(c.name.slice(0, 32)) + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        '<tr><td>Entity Classification</td>' + rows.map(function (c) { return '<td><span class="dir-tag" style="font-weight:700">' + (KIND_ICONS[c.kind]||'') + ' ' + esc(KIND_LABELS[c.kind] || c.kind) + '</span></td>'; }).join('') + '</tr>' +
        '<tr><td>Country / Location</td>' + rows.map(function (c) { return '<td>' + esc(c.country) + (c.region ? ' (' + esc(c.region) + ')' : '') + '</td>'; }).join('') + '</tr>' +
        '<tr><td>Reported Max Voltage</td>' + rows.map(function (c) { return '<td>' + evBadge(c.capability_evidence && c.capability_evidence.voltage) + ' <b>' + esc(c.voltage && c.voltage.value || '—') + '</b></td>'; }).join('') + '</tr>' +
        '<tr><td>Reported Power / Rating</td>' + rows.map(function (c) { return '<td>' + evBadge(c.capability_evidence && c.capability_evidence.mva) + ' <b>' + esc(c.mva && c.mva.value || '—') + '</b></td>'; }).join('') + '</tr>' +
        '<tr><td>Capabilities / Products</td>' + rows.map(function (c) { return '<td>' + (c.capability_labels || []).slice(0, 5).join(', ') + '</td>'; }).join('') + '</tr>' +
        '<tr><td>Documented Standards</td>' + rows.map(function (c) { return '<td>' + esc((c.certs || []).join(', ') || '—') + '</td>'; }).join('') + '</tr>' +
        '<tr><td>Manufacturing Facilities</td>' + rows.map(function (c) { return '<td>🏭 ' + c.factories.length + ' recorded plant(s)</td>'; }).join('') + '</tr>' +
        '<tr><td>Profile Completeness</td>' + rows.map(function (c) {
          var score = (c.completeness_score != null ? c.completeness_score : (c.research_completeness ? Math.min(100, c.research_completeness * 15) : 40));
          return '<td><b>' + score + '%</b> (' + (c.provenance_type || 'Verified') + ')</td>';
        }).join('') + '</tr>' +
        '<tr><td>Direct Action</td>' + rows.map(function (c) { return '<td><a class="btn btn-amber btn-sm" href="rfq.html?company=' + encodeURIComponent(c.name) + '">Submit RFQ</a></td>'; }).join('') + '</tr>' +
        '</tbody></table>' +
      '</div>';

    var btnClose = document.getElementById('btnCloseCmp');
    if (btnClose) btnClose.addEventListener('click', function () {
      box.innerHTML = '';
    });
  }

  function wire() {
    var elQ = document.getElementById('dirQ');
    var set = function (node, fn) { if (node) node.addEventListener('change', fn); };
    if (elQ) elQ.addEventListener('input', function () { q = elQ.value; render(); });
    set(document.getElementById('dirCountry'), function (e) { country = e.target.value; render(); });
    set(document.getElementById('dirType'), function (e) { type = e.target.value; render(); });
    set(document.getElementById('dirKv'), function (e) { minKv = parseInt(e.target.value, 10) || 0; render(); });
    set(document.getElementById('dirEv'), function (e) { evFilter = e.target.value; render(); });

    var clr = document.getElementById('dirClear');
    if (clr) clr.addEventListener('click', function () {
      q = ''; kind = ''; country = ''; type = ''; minKv = 0; evFilter = ''; onlyMultiPlant = false; minComp = 0;
      var elQ = document.getElementById('dirQ'); if (elQ) elQ.value = '';
      var elC = document.getElementById('dirCountry'); if (elC) elC.value = '';
      var elT = document.getElementById('dirType'); if (elT) elT.value = '';
      var elK = document.getElementById('dirKv'); if (elK) elK.value = '0';
      var elE = document.getElementById('dirEv'); if (elE) elE.value = '';
      render();
    });

    // Wire ecosystem tab buttons
    var tabs = root.querySelectorAll('[data-set-kind]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        kind = tab.getAttribute('data-set-kind');
        render();
      });
    });

    // Wire quick filter pills
    var kvPills = root.querySelectorAll('[data-set-minkv]');
    kvPills.forEach(function (p) {
      p.addEventListener('click', function () {
        var v = parseInt(p.getAttribute('data-set-minkv'), 10);
        minKv = (minKv === v) ? 0 : v;
        render();
      });
    });

    var compPills = root.querySelectorAll('[data-set-mincomp]');
    compPills.forEach(function (p) {
      p.addEventListener('click', function () {
        var c = parseInt(p.getAttribute('data-set-mincomp'), 10);
        minComp = (minComp === c) ? 0 : c;
        render();
      });
    });

    var evPills = root.querySelectorAll('[data-set-ev]');
    evPills.forEach(function (p) {
      p.addEventListener('click', function () {
        var e = p.getAttribute('data-set-ev');
        evFilter = (evFilter === e) ? '' : e;
        render();
      });
    });

    var togglePills = root.querySelectorAll('[data-toggle="multiPlant"]');
    togglePills.forEach(function (p) {
      p.addEventListener('click', function () {
        onlyMultiPlant = !onlyMultiPlant;
        render();
      });
    });

    // Wire comparison checkboxes & analytics tracking
    root.addEventListener('change', function (e) {
      var t = e.target.getAttribute && e.target.getAttribute('data-cmp');
      if (t) {
        compare[t] = e.target.checked;
        logDirActivity('compare', { entity: t, checked: e.target.checked });
        if (window.TP_EVENT) window.TP_EVENT('compare_selected', { entity: t, checked: e.target.checked });
        renderCompare();
        renderCmpDock();
      }
    });

    root.addEventListener('click', function (e) {
      var sl = e.target.closest ? e.target.closest('[data-shortlist]') : null;
      if (sl) {
        e.preventDefault();
        var item = {
          type: sl.getAttribute('data-short-kind') || 'company',
          id: sl.getAttribute('data-shortlist'),
          title: sl.getAttribute('data-short-name') || '',
          url: sl.getAttribute('data-short-url') || ''
        };
        if (window.TP_HUB && TP_HUB.shortlistAdd) {
          TP_HUB.shortlistAdd(item).then(function () {
            sl.textContent = 'Shortlisted';
            sl.disabled = true;
          });
        } else {
          window.location.href = 'workspace.html?auth=in#shortlist';
        }
        return;
      }
      var a = e.target.closest ? e.target.closest('a[data-track]') : null;
      if (a) {
        var trk = a.getAttribute('data-track');
        var ent = a.getAttribute('data-track-entity');
        var cnt = a.getAttribute('data-track-country');
        if (trk === 'directory_profile_click') logDirActivity('profile_click', { entity: ent, country: cnt });
        else if (trk === 'official_website_click') logDirActivity('website_click', { entity: ent });
        else if (trk === 'rfq_started_directory') logDirActivity('rfq', { entity: ent });
      }
    });
  }

  function logDirActivity(action, meta) {
    try {
      var raw = localStorage.getItem('tp_dir_analytics');
      var log = raw ? JSON.parse(raw) : { searches: 0, profile_views: 0, comparisons: 0, website_clicks: 0, rfq_starts: 0, last_activity: null, countries: {} };
      if (action === 'search') log.searches++;
      else if (action === 'profile_click') log.profile_views++;
      else if (action === 'compare') log.comparisons++;
      else if (action === 'website_click') log.website_clicks++;
      else if (action === 'rfq') log.rfq_starts++;
      if (meta && meta.country) log.countries[meta.country] = (log.countries[meta.country] || 0) + 1;
      log.last_activity = new Date().toISOString();
      localStorage.setItem('tp_dir_analytics', JSON.stringify(log));
    } catch (e) {}
  }

  load();
})();
