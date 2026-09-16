/* My TransformerPath hub store — Sprints 4–7.
 *
 * Persists designs, shortlist, RFQs, supplier claim, follows, watchlists and
 * saved searches. POSTs to /.netlify/functions/account when signed in; on
 * table_missing / unconfigured / gated Professional, keeps a session copy in
 * localStorage (`tp-hub-store`) so the UI works before APPLY_SQL is run.
 *
 * Daily Intel headlines stay free. This file only personalises the /me strip.
 */
(function () {
  'use strict';
  var KEY = 'tp-hub-store';
  var RFQ_STATUSES = ['Draft', 'Sent', 'Responses', 'Closed'];
  var lastSnap = null;
  var intelCache = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function now() { return new Date().toISOString(); }
  function nid() { return 'loc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function when(iso) {
    if (!iso) return '';
    var t = Date.parse(iso);
    if (isNaN(t)) return String(iso).slice(0, 16);
    var d = new Date(t);
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }

  function empty() {
    return {
      designs: [], versions: [], projects: [], notes: [],
      shortlist: [], comparisons: [], rfqs: [], requirements: [],
      claims: [], supplier: null, facilities: [], products: [],
      analytics: { profile_views: 0, rfq_matches: 0 },
      follows: [], watchlists: [], searches: []
    };
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      var e = empty();
      Object.keys(e).forEach(function (k) { if (s[k] == null) s[k] = e[k]; });
      return s;
    } catch (x) { return empty(); }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (x) {}
    return s;
  }
  function mutate(fn) {
    var s = load();
    fn(s);
    return save(s);
  }

  function byId(arr) {
    var m = {};
    (arr || []).forEach(function (x) { if (x && x.id) m[x.id] = x; });
    return m;
  }
  function union(a, b) {
    var m = byId(a);
    (b || []).forEach(function (x) {
      if (!x) return;
      var key = x.id || (x.item_type && x.item_id ? x.item_type + ':' + x.item_id : null)
        || (x.subject_type && x.subject ? x.subject_type + ':' + x.subject : null);
      if (!key) {
        if (!m._anon) m._anon = [];
        m._anon.push(x);
        return;
      }
      var prev = m[key];
      if (!prev) m[key] = x;
      else {
        var ta = Date.parse(prev.updated_at || prev.created_at || 0) || 0;
        var tb = Date.parse(x.updated_at || x.created_at || 0) || 0;
        m[key] = tb >= ta ? Object.assign({}, prev, x) : Object.assign({}, x, prev);
      }
    });
    var out = [];
    Object.keys(m).forEach(function (k) {
      if (k === '_anon') out = out.concat(m[k]);
      else out.push(m[k]);
    });
    return out;
  }

  function canSaveDesigns(ent) {
    if (!ent) return true;
    if (ent.professional || ent.team || (ent.rank || 0) >= 2) return true;
    return false;
  }
  function sessionOk(snap) {
    if (!snap || !snap.configured) return true;
    if (snap.reason === 'table_missing' || snap.stored === false) return true;
    return false;
  }
  function designsAllowed(snap) {
    var ent = snap && snap.entitlement;
    if (canSaveDesigns(ent)) return { ok: true, gated: false };
    if (sessionOk(snap)) return { ok: true, gated: false, session: true };
    return { ok: true, gated: true };
  }

  function post(body) {
    if (window.TP_LEARNER && TP_LEARNER.post) return TP_LEARNER.post(body);
    return Promise.resolve(null);
  }

  function mergeSnap(server) {
    var local = load();
    var s = server && typeof server === 'object' ? server : {};
    var merged = Object.assign({}, s);
    merged.saved_designs = union(s.saved_designs, local.designs);
    merged.design_versions = union(s.design_versions, local.versions);
    merged.projects = union(s.projects, local.projects);
    merged.notes = union(s.notes, local.notes);
    merged.saved_items = union(s.saved_items, local.shortlist);
    merged.shortlist = union(s.shortlist, local.shortlist);
    merged.comparisons = union(s.comparisons, local.comparisons);
    merged.rfqs = union(s.rfqs, local.rfqs);
    merged.requirements = union(s.requirements, local.requirements);
    merged.company_claims = union(s.company_claims, local.claims);
    merged.supplier_profile = s.supplier_profile || local.supplier;
    merged.supplier_facilities = union(s.supplier_facilities, local.facilities);
    merged.supplier_products = union(s.supplier_products, local.products);
    merged.analytics = Object.assign({ profile_views: 0, rfq_matches: 0 }, local.analytics, s.analytics || {});
    merged.follows = union(s.follows, local.follows);
    merged.watchlists = union(s.watchlists, local.watchlists);
    merged.saved_searches = union(s.saved_searches, local.searches);
    merged.hub_mode = sessionOk(s) ? 'session' : 'account';
    lastSnap = merged;
    return merged;
  }

  function getSnap() {
    var localOnly = function () { return mergeSnap({ ok: true, configured: false, entitlement: { plan: 'free', rank: 0 }, flags: { isLearner: true } }); };
    if (!window.TP_LEARNER || !TP_LEARNER.getSnap) return Promise.resolve(localOnly());
    return TP_LEARNER.getSnap().then(function (s) {
      if (!s || !s.ok) return localOnly();
      return mergeSnap(s);
    }).catch(localOnly);
  }

  function after(res, extra) {
    if (res && res.ok && res.configured) mergeSnap(res);
    return Object.assign({ ok: true }, extra || {}, { snap: lastSnap, stored: !(res && res.stored === false), gated: !!(res && res.gated) });
  }

  /* ── Sprint 4 designs ── */
  function createDesign(fields) {
    var row = {
      id: nid(), name: (fields && fields.name) || 'Untitled', kind: (fields && fields.kind) || 'design',
      rating: (fields && fields.rating) || '', voltages: (fields && fields.voltages) || '',
      notes: (fields && fields.notes) || '', data: (fields && fields.data) || {},
      created_at: now(), updated_at: now()
    };
    var ver = { id: nid(), design_id: row.id, data: row.data, created_at: now() };
    mutate(function (st) { st.designs.unshift(row); st.versions.unshift(ver); });
    var gate = designsAllowed(lastSnap);
    if (gate.gated) return Promise.resolve({ ok: true, gated: true, row: row, stored: false });
    return post(Object.assign({ action: 'saved_design' }, row)).then(function (r) { return after(r, { row: row }); });
  }
  function renameDesign(id, fields) {
    mutate(function (st) {
      st.designs.forEach(function (d) {
        if (d.id !== id) return;
        if (fields.name != null) d.name = fields.name;
        if (fields.rating != null) d.rating = fields.rating;
        if (fields.voltages != null) d.voltages = fields.voltages;
        if (fields.notes != null) d.notes = fields.notes;
        d.updated_at = now();
      });
    });
    var gate = designsAllowed(lastSnap);
    if (gate.gated) return Promise.resolve({ ok: true, gated: true, stored: false });
    return post(Object.assign({ action: 'design_rename', id: id }, fields)).then(after);
  }
  function duplicateDesign(id) {
    var src = (load().designs || []).filter(function (d) { return d.id === id; })[0];
    if (!src && lastSnap && lastSnap.saved_designs) {
      src = lastSnap.saved_designs.filter(function (d) { return d.id === id; })[0];
    }
    if (!src) return Promise.resolve({ ok: false });
    return createDesign({
      name: (src.name || 'Untitled') + ' copy', kind: src.kind, rating: src.rating,
      voltages: src.voltages, notes: src.notes, data: src.data || {}
    });
  }
  function deleteDesign(id) {
    mutate(function (st) {
      st.designs = st.designs.filter(function (d) { return d.id !== id; });
      st.versions = st.versions.filter(function (v) { return v.design_id !== id; });
    });
    return post({ action: 'design_delete', id: id }).then(after);
  }

  function addProject(fields) {
    var row = { id: nid(), name: (fields && fields.name) || 'Untitled project', notes: (fields && fields.notes) || '', created_at: now(), updated_at: now() };
    mutate(function (st) { st.projects.unshift(row); });
    return post({ action: 'project', name: row.name, notes: row.notes }).then(function (r) { return after(r, { row: row }); });
  }
  function addNote(fields) {
    var row = { id: nid(), title: (fields && fields.title) || 'Note', body: (fields && fields.body) || '', created_at: now(), updated_at: now() };
    mutate(function (st) { st.notes.unshift(row); });
    return post({ action: 'note', title: row.title, body: row.body }).then(function (r) { return after(r, { row: row }); });
  }

  /* ── Sprint 5 buyer ── */
  function shortlistAdd(item) {
    var row = {
      id: nid(),
      item_type: item.type || item.item_type || 'company',
      item_id: String(item.id || item.item_id || item.slug || item.name || nid()),
      title: item.title || item.name || '',
      url: item.url || '',
      created_at: now()
    };
    mutate(function (st) {
      var exists = st.shortlist.some(function (x) { return x.item_type === row.item_type && x.item_id === row.item_id; });
      if (!exists) st.shortlist.unshift(row);
    });
    return post({ action: 'shortlist', item_type: row.item_type, item_id: row.item_id, title: row.title, url: row.url }).then(function (r) { return after(r, { row: row }); });
  }
  function shortlistRemove(type, id) {
    mutate(function (st) {
      st.shortlist = st.shortlist.filter(function (x) { return !(x.item_type === type && String(x.item_id) === String(id)); });
    });
    return post({ action: 'shortlist', op: 'remove', item_type: type, item_id: id }).then(after);
  }
  function saveComparison(fields) {
    var slugs = fields.slugs || '';
    var row = {
      id: nid(), name: fields.name || 'Comparison', slugs: slugs,
      url: fields.url || ('compare.html?m=' + slugs), created_at: now(), updated_at: now()
    };
    mutate(function (st) { st.comparisons.unshift(row); });
    return post({ action: 'comparison', name: row.name, slugs: row.slugs, url: row.url }).then(function (r) { return after(r, { row: row }); });
  }
  function createRfq(fields) {
    var row = {
      id: nid(),
      title: (fields && fields.title) || 'RFQ',
      reference: (fields && fields.reference) || ('RFQ-TP-' + Date.now()),
      status: RFQ_STATUSES.indexOf(fields && fields.status) >= 0 ? fields.status : 'Draft',
      kv: (fields && (fields.kv || fields.voltage)) || '',
      mva: (fields && (fields.mva || fields.rating)) || '',
      quantity: (fields && fields.quantity) || '',
      deadline: (fields && fields.deadline) || '',
      country: (fields && (fields.country || fields.destination)) || '',
      category: (fields && fields.category) || '',
      notes: (fields && (fields.notes || fields.details)) || '',
      created_at: now(), updated_at: now()
    };
    mutate(function (st) { st.rfqs.unshift(row); });
    return post(Object.assign({ action: 'rfq' }, row)).then(function (r) { return after(r, { row: row }); });
  }
  function setRfqStatus(id, status) {
    if (RFQ_STATUSES.indexOf(status) < 0) status = 'Draft';
    mutate(function (st) {
      st.rfqs.forEach(function (r) { if (r.id === id) { r.status = status; r.updated_at = now(); } });
    });
    return post({ action: 'rfq', op: 'status', id: id, status: status }).then(after);
  }
  function saveRequirement(fields) {
    var row = {
      id: nid(), title: (fields && fields.title) || 'Requirement',
      mva: (fields && (fields.mva || fields.rating)) || '',
      kv: (fields && (fields.kv || fields.voltage)) || '',
      notes: (fields && fields.notes) || '',
      created_at: now(), updated_at: now()
    };
    mutate(function (st) { st.requirements.unshift(row); });
    return post({ action: 'requirement', title: row.title, mva: row.mva, kv: row.kv, notes: row.notes }).then(function (r) { return after(r, { row: row }); });
  }

  /* ── Sprint 6 supplier ── */
  function claimCompany(fields) {
    var row = {
      id: nid(), company: fields.company || fields.name, country: fields.country || '',
      company_id: fields.company_id || fields.claimed_company_id || '',
      status: 'requested', created_at: now()
    };
    mutate(function (st) {
      st.claims.unshift(row);
      st.supplier = st.supplier || {};
      st.supplier.company_name = row.company;
      st.supplier.company_id = row.company_id || row.company;
      st.supplier.country = row.country;
    });
    return post({
      action: 'company_claim', company: row.company, country: row.country, company_id: row.company_id
    }).then(function (r) { return after(r, { row: row }); });
  }
  function saveSupplierProfile(fields) {
    mutate(function (st) {
      st.supplier = Object.assign({}, st.supplier || {}, fields, { updated_at: now() });
    });
    return post(Object.assign({ action: 'supplier_profile' }, fields)).then(after);
  }
  function addFacility(fields) {
    var row = { id: nid(), name: fields.name || 'Facility', country: fields.country || '', notes: fields.notes || '', created_at: now() };
    mutate(function (st) { st.facilities.unshift(row); });
    return post({ action: 'supplier_facility', name: row.name, country: row.country, notes: row.notes }).then(function (r) { return after(r, { row: row }); });
  }
  function addProduct(fields) {
    var row = { id: nid(), name: fields.name || 'Capability', category: fields.category || '', notes: fields.notes || '', created_at: now() };
    mutate(function (st) { st.products.unshift(row); });
    return post({ action: 'supplier_product', name: row.name, category: row.category, notes: row.notes }).then(function (r) { return after(r, { row: row }); });
  }
  function bumpAnalytics(kind) {
    mutate(function (st) {
      st.analytics = st.analytics || { profile_views: 0, rfq_matches: 0 };
      if (kind === 'profile_views') st.analytics.profile_views = (st.analytics.profile_views || 0) + 1;
      if (kind === 'rfq_matches') st.analytics.rfq_matches = (st.analytics.rfq_matches || 0) + 1;
    });
    return post({ action: 'analytics', bump: kind }).then(after);
  }

  /* ── Sprint 7 intel ── */
  function follow(fields) {
    var row = {
      id: nid(),
      subject_type: fields.type || fields.subject_type || 'market',
      subject: fields.subject || '',
      label: fields.label || fields.subject || '',
      created_at: now()
    };
    mutate(function (st) {
      var exists = st.follows.some(function (f) { return f.subject_type === row.subject_type && f.subject === row.subject; });
      if (!exists) st.follows.unshift(row);
    });
    return post({ action: 'follow', subject_type: row.subject_type, subject: row.subject, label: row.label }).then(function (r) { return after(r, { row: row }); });
  }
  function unfollow(type, subject) {
    mutate(function (st) {
      st.follows = st.follows.filter(function (f) { return !(f.subject_type === type && f.subject === subject); });
    });
    return post({ action: 'follow', op: 'remove', subject_type: type, subject: subject }).then(after);
  }
  function addWatchlist(fields) {
    var row = { id: nid(), name: fields.name || 'Watchlist', subjects: fields.subjects || [], created_at: now() };
    mutate(function (st) { st.watchlists.unshift(row); });
    return post({ action: 'watchlist', name: row.name, subjects: row.subjects }).then(function (r) { return after(r, { row: row }); });
  }
  function addSavedSearch(fields) {
    var row = {
      id: nid(), name: fields.name || 'Search', query: fields.query || '',
      href: fields.href || ('directory.html?q=' + encodeURIComponent(fields.query || '')),
      created_at: now()
    };
    mutate(function (st) { st.searches.unshift(row); });
    return post({ action: 'saved_search', name: row.name, query: row.query, href: row.href }).then(function (r) { return after(r, { row: row }); });
  }

  function flattenIntel(doc) {
    var out = [];
    if (!doc || typeof doc !== 'object') return out;
    Object.keys(doc).forEach(function (k) {
      var block = doc[k];
      if (!block || typeof block !== 'object') return;
      (block.items || []).forEach(function (it) {
        out.push(Object.assign({ market: k, market_label: block.label || k }, it));
      });
    });
    return out;
  }
  function matchIntelItems(items, follows) {
    var needles = [];
    function add(v) {
      var s = String(v || '').trim().toLowerCase();
      if (s.length >= 3 && needles.indexOf(s) < 0) needles.push(s);
    }
    (follows || []).forEach(function (f) {
      add(f.subject); add(f.label); add(f.name); add(f.query);
    });
    (load().watchlists || []).forEach(function (w) {
      add(w.name);
      (w.subjects || []).forEach(add);
    });
    (load().searches || []).forEach(function (s) { add(s.query); add(s.name); });
    if (!needles.length) return [];
    return (items || []).filter(function (it) {
      var blob = ((it.title || '') + ' ' + (it.snippet || '') + ' ' + (it.market || '') + ' ' + (it.market_label || '')).toLowerCase();
      return needles.some(function (n) { return blob.indexOf(n) >= 0; });
    });
  }
  function loadIntel() {
    if (intelCache) return Promise.resolve(intelCache);
    return fetch('data/intel.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
      .then(function (d) { intelCache = flattenIntel(d); return intelCache; })
      .catch(function () { return []; });
  }

  function matchRfqsForSupplier(rfqs, profile) {
    var country = String((profile && (profile.country || profile.claimed_country)) || '').trim().toLowerCase();
    var cats = String((profile && profile.categories) || '').toLowerCase().split(/[,;|]/).map(function (s) { return s.trim(); }).filter(Boolean);
    return (rfqs || []).filter(function (r) {
      var st = String(r.status || '');
      if (st === 'Draft') return false;
      var rc = String(r.country || r.destination || '').toLowerCase();
      var rcat = String(r.category || '').toLowerCase();
      var countryOk = !country || !rc || rc.indexOf(country) >= 0 || country.indexOf(rc) >= 0;
      var catOk = !cats.length || !rcat || cats.some(function (c) { return rcat.indexOf(c) >= 0 || c.indexOf(rcat) >= 0; });
      return countryOk && catOk;
    });
  }

  /* ── render ── */
  function el(id) { return document.getElementById(id); }
  function emptyP(t) { return '<p class="ws-empty">' + t + '</p>'; }

  function renderDash(snap) {
    var host = el('hubDash');
    if (!host) return;
    var flags = (snap && snap.flags) || {};
    var designs = (snap && snap.saved_designs) || [];
    var skills = (snap && snap.skills) || [];
    var saved = ((snap && snap.saved_items) || []).length + ((snap && snap.shortlist) || []).length;
    var rfqs = (snap && snap.rfqs) || [];
    var inbox = (snap && snap.rfq_inbox) || [];
    var follows = (snap && snap.follows) || [];
    var grid = snap && snap.grid_lab;
    var tiles = [];
    function tile(href, label, n, sub) {
      tiles.push('<a class="ws-tile" href="' + href + '"><div class="l">' + esc(label) + '</div><div class="n">' + esc(String(n)) + '</div><div class="ws-sub">' + esc(sub || '') + '</div></a>');
    }
    var cont = 'Open Grid Lab';
    if (grid && grid.aggregate_percent) cont = 'Grid Systems ' + grid.aggregate_percent + '%';
    tile('#learning', 'Continue', cont, 'Learning + Grid Lab');
    tile('#designs', 'Engineering', designs.length, 'saved designs');
    tile('#skills', 'Skills', skills.length || '0', 'passport evidence');
    tile('#saved', 'Saved', saved, 'items + shortlist');
    tile('#overview', 'Intel', follows.length, 'follows / watchlists');
    if (flags.isBuyer) tile('#rfqs', 'RFQs', rfqs.length, 'buyer board');
    if (flags.isSupplier) tile('#supplier', 'Supplier inbox', inbox.length, 'matching RFQs');
    host.innerHTML = tiles.join('');
  }

  function gateNote(snap) {
    var g = designsAllowed(snap);
    if (g.gated) {
      return '<p class="ws-sub">My Designs saves to your account on <b>Professional</b> or <b>Team</b>. Drafts stay on this device. <a href="pricing.html">Upgrade →</a></p>';
    }
    if (g.session) {
      return '<p class="ws-sub">Session mode — designs persist in this browser until APPLY_SQL is run on Supabase, then they sync to your account.</p>';
    }
    return '<p class="ws-sub">Professional entitlement — saved calculator work and versions live on this account.</p>';
  }

  function renderDesigns(snap) {
    var host = el('tpDesigns');
    if (!host) return;
    var rows = (snap && snap.saved_designs) || [];
    var vers = (snap && snap.design_versions) || [];
    var list = rows.length ? rows.map(function (d) {
      var nVer = vers.filter(function (v) { return v.design_id === d.id; }).length;
      return '<div class="ws-row">' +
        '<span class="ws-note-title">' + esc(d.name || 'Untitled') + '</span>' +
        '<span class="ws-sub">' + esc(d.rating || '') + (d.voltages ? ' · ' + esc(d.voltages) : '') +
          ' · edited ' + esc(when(d.updated_at || d.created_at)) +
          (nVer ? ' · ' + nVer + ' version' + (nVer === 1 ? '' : 's') : '') + '</span>' +
        '<button class="btn btn-outline btn-sm" data-rename-design="' + esc(d.id) + '" type="button">Rename</button>' +
        '<button class="btn btn-outline btn-sm" data-dup-design="' + esc(d.id) + '" type="button">Duplicate</button>' +
        '<button class="ws-x" data-del-design="' + esc(d.id) + '" type="button" aria-label="Delete">✕</button></div>';
    }).join('') : emptyP('No saved designs yet. Create one below or save from the <a href="calculator.html">IEC calculator</a>.');
    host.innerHTML = gateNote(snap) + list;
  }

  function renderProjects(snap) {
    var host = el('tpProjects');
    if (!host) return;
    var rows = (snap && snap.projects) || [];
    host.innerHTML = rows.length ? rows.map(function (p) {
      return '<div class="ws-row"><span class="ws-note-title">' + esc(p.name) + '</span><span class="ws-sub">' + esc((p.notes || '').slice(0, 80)) + '</span></div>';
    }).join('') : emptyP('No projects yet — a stub that persists when the projects table exists.');
  }

  function renderShortlist(snap) {
    var host = el('tpShortlist');
    if (!host) return;
    var rows = (snap && snap.shortlist) || [];
    host.innerHTML = rows.length ? rows.map(function (i) {
      var href = i.url || '#';
      return '<div class="ws-row"><a href="' + esc(href) + '">' + esc(i.title || i.item_id) + '</a>' +
        '<span class="ws-sub">' + esc(i.item_type) + '</span>' +
        '<button class="ws-x" data-unshort="' + esc(i.item_type) + '|' + esc(i.item_id) + '" type="button" aria-label="Remove">✕</button></div>';
    }).join('') : emptyP('Nothing shortlisted. Use Shortlist on directory cards — the public directory stays free.');
  }

  function renderComparisons(snap) {
    var host = el('tpComparisons');
    if (!host) return;
    var rows = (snap && snap.comparisons) || [];
    host.innerHTML = rows.length ? rows.map(function (c) {
      return '<div class="ws-row"><a href="' + esc(c.url || ('compare.html?m=' + (c.slugs || ''))) + '">' + esc(c.name || 'Comparison') + '</a>' +
        '<span class="ws-sub">' + esc(c.slugs || '') + '</span></div>';
    }).join('') : emptyP('No saved comparisons. Open <a href="compare.html">compare.html</a> and save a workspace.');
  }

  function renderRfqs(snap) {
    var host = el('tpRfqBoard');
    if (!host) return;
    var rows = (snap && snap.rfqs) || [];
    var cols = RFQ_STATUSES.map(function (st) {
      var items = rows.filter(function (r) { return String(r.status || 'Draft') === st; });
      var cards = items.map(function (r) {
        var next = RFQ_STATUSES[Math.min(RFQ_STATUSES.indexOf(st) + 1, RFQ_STATUSES.length - 1)];
        return '<div class="ws-idbox" style="margin-bottom:8px"><div class="ws-note-title">' + esc(r.title || r.reference || 'RFQ') + '</div>' +
          '<div class="ws-sub">' + esc(r.mva || r.rating || '') + ' ' + esc(r.kv || r.voltage || '') +
          (r.country ? ' · ' + esc(r.country) : '') + (r.deadline ? ' · due ' + esc(r.deadline) : '') + '</div>' +
          (st !== 'Closed' ? '<button class="btn btn-outline btn-sm" data-rfq-status="' + esc(r.id) + '|' + esc(next) + '" type="button">Move to ' + esc(next) + '</button>' : '') +
          '</div>';
      }).join('') || '<p class="ws-empty">None</p>';
      return '<div class="ws-col"><h4>' + esc(st) + ' (' + items.length + ')</h4>' + cards + '</div>';
    }).join('');
    host.innerHTML = '<div class="ws-kanban">' + cols + '</div>';
  }

  function renderRequirements(snap) {
    var host = el('tpRequirements');
    if (!host) return;
    var rows = (snap && snap.requirements) || [];
    host.innerHTML = rows.length ? rows.map(function (r) {
      return '<div class="ws-row"><span class="ws-note-title">' + esc(r.title) + '</span><span class="ws-sub">' + esc(r.mva || '') + ' ' + esc(r.kv || '') + '</span></div>';
    }).join('') : emptyP('No saved requirements. Example: 100 MVA 132/33 kV.');
  }

  function renderSupplier(snap) {
    var claimsEl = el('tpClaims');
    var profile = (snap && snap.supplier_profile) || {};
    var claims = (snap && snap.company_claims) || [];
    if (claimsEl) {
      claimsEl.innerHTML = claims.length ? claims.map(function (c) {
        return '<div class="ws-row"><span class="ws-note-title">' + esc(c.company) + '</span><span class="ws-sub">' + esc(c.country || '') + ' · ' + esc(c.status || 'requested') + '</span></div>';
      }).join('') : emptyP('No company claims yet. Request a claim below — Verified Manufacturer is identity/contact verification, never technical approval.');
    }
    var about = el('tpSupplierAbout');
    if (about) {
      about.innerHTML = profile.company_name
        ? '<p><b>' + esc(profile.company_name) + '</b> · ' + esc(profile.country || 'country unset') + '</p><p class="ws-sub">' + esc(profile.categories || '') + '</p><p class="ws-sub">' + esc(profile.about || profile.capabilities || '') + '</p>'
        : emptyP('Claim a company to attach supplier_profiles.claimed_company_id on this account.');
    }
    var fac = el('tpFacilities');
    if (fac) {
      var rows = (snap && snap.supplier_facilities) || [];
      fac.innerHTML = rows.length ? rows.map(function (f) {
        return '<div class="ws-row"><span class="ws-note-title">' + esc(f.name) + '</span><span class="ws-sub">' + esc(f.country || '') + '</span></div>';
      }).join('') : emptyP('No facilities listed yet.');
    }
    var prod = el('tpProducts');
    if (prod) {
      var pr = (snap && snap.supplier_products) || [];
      prod.innerHTML = pr.length ? pr.map(function (p) {
        return '<div class="ws-row"><span class="ws-note-title">' + esc(p.name) + '</span><span class="ws-sub">' + esc(p.category || '') + '</span></div>';
      }).join('') : emptyP('No products / capabilities listed yet.');
    }
    var inbox = el('tpRfqInbox');
    if (inbox) {
      var items = (snap && snap.rfq_inbox) || matchRfqsForSupplier((snap && snap.rfqs) || [], profile);
      inbox.innerHTML = items.length ? items.map(function (r) {
        return '<div class="ws-row"><span class="ws-note-title">' + esc(r.title || r.reference || 'RFQ') + '</span><span class="ws-sub">' + esc(r.country || '') + ' · ' + esc(r.category || '') + ' · ' + esc(r.status || '') + '</span></div>';
      }).join('') : emptyP('No matching RFQs. Simple match: buyer country + category against your claimed company.');
    }
    var an = el('tpSupplierAnalytics');
    if (an) {
      var a = (snap && snap.analytics) || { profile_views: 0, rfq_matches: 0 };
      an.innerHTML = '<div class="ws-idgrid">' +
        '<div class="ws-idbox"><div class="lbl">Profile views</div><div>' + esc(a.profile_views || 0) + '</div></div>' +
        '<div class="ws-idbox"><div class="lbl">RFQ matches</div><div>' + esc(a.rfq_matches || ((snap && snap.rfq_inbox) || []).length) + '</div></div></div>' +
        '<p class="ws-sub">Stub counters — synthetic and persisted. Verified Manufacturer never means a technical approval.</p>';
    }
  }

  function renderFollows(snap) {
    var host = el('tpFollows');
    if (!host) return;
    var rows = (snap && snap.follows) || [];
    host.innerHTML = rows.length ? rows.map(function (f) {
      return '<span class="ws-tag">' + esc(f.label || f.subject) + ' <span class="ws-sub">' + esc(f.subject_type) + '</span>' +
        '<button class="ws-x" data-unfollow="' + esc(f.subject_type) + '|' + esc(f.subject) + '" type="button" aria-label="Unfollow">✕</button></span>';
    }).join('') : '<span class="ws-empty">Follow a company, project or market from Intel or a listing page.</span>';
  }

  function renderWatchlists(snap) {
    var host = el('tpWatchlists');
    if (!host) return;
    var rows = (snap && snap.watchlists) || [];
    host.innerHTML = rows.length ? rows.map(function (w) {
      return '<div class="ws-row"><span class="ws-note-title">' + esc(w.name) + '</span><span class="ws-sub">' + esc((w.subjects || []).join(', ')) + '</span></div>';
    }).join('') : emptyP('No watchlists yet.');
  }

  function renderSearches(snap) {
    var host = el('tpSavedSearches');
    if (!host) return;
    var rows = (snap && snap.saved_searches) || [];
    host.innerHTML = rows.length ? rows.map(function (s) {
      return '<div class="ws-row"><a href="' + esc(s.href || ('directory.html?q=' + encodeURIComponent(s.query || ''))) + '">' + esc(s.name || s.query) + '</a><span class="ws-sub">' + esc(s.query || '') + '</span></div>';
    }).join('') : emptyP('No saved searches. Try /directory?q=765+kV and save it here.');
  }

  function renderIntelStrip(snap) {
    var host = el('tpIntelStrip');
    if (!host) return;
    loadIntel().then(function (items) {
      var follows = (snap && snap.follows) || [];
      var hits = matchIntelItems(items, follows.concat(snap.saved_searches || []).concat(snap.watchlists || []));
      if (!hits.length) {
        host.innerHTML = emptyP('No matching Intel yet. Follow GCC, a company or a project — Daily Intel headlines stay free on <a href="intel.html">/intel</a>.');
        return;
      }
      host.innerHTML = hits.slice(0, 8).map(function (it) {
        var href = it.url || 'intel.html';
        return '<div class="ws-row"><a href="' + esc(href) + '">' + esc(it.title) + '</a><span class="ws-sub">' + esc(it.market_label || it.market || '') + (it.isNew ? ' · new' : '') + '</span></div>';
      }).join('') + '<p class="ws-sub">Personalised from follows / watchlists / saved searches. Headlines are not paywalled.</p>';
    });
  }

  function renderAll(snap) {
    lastSnap = snap || lastSnap;
    renderDash(lastSnap);
    renderDesigns(lastSnap);
    renderProjects(lastSnap);
    renderShortlist(lastSnap);
    renderComparisons(lastSnap);
    renderRfqs(lastSnap);
    renderRequirements(lastSnap);
    renderSupplier(lastSnap);
    renderFollows(lastSnap);
    renderWatchlists(lastSnap);
    renderSearches(lastSnap);
    renderIntelStrip(lastSnap);
    var notesEl = el('tpNotes');
    if (notesEl && lastSnap && lastSnap.notes) {
      notesEl.innerHTML = lastSnap.notes.length ? lastSnap.notes.map(function (n) {
        return '<div class="ws-row"><span class="ws-note-title">' + esc(n.title || 'Note') + '</span><span class="ws-sub">' + esc((n.body || '').slice(0, 80)) + '</span></div>';
      }).join('') : emptyP('No notes yet.');
    }
  }

  function bindForms() {
    var root = el('tpWorkspace');
    if (!root || root.getAttribute('data-tp-hub-bound')) return;
    root.setAttribute('data-tp-hub-bound', '1');

    function refresh() {
      getSnap().then(renderAll);
      if (window.TP_HUB && window.TP_HUB.onRefresh) window.TP_HUB.onRefresh();
    }

    var df = el('designForm');
    if (df) df.addEventListener('submit', function (e) {
      e.preventDefault();
      createDesign({
        name: df.elements.name.value, rating: df.elements.rating.value,
        voltages: df.elements.voltages.value, notes: df.elements.notes.value, kind: 'design'
      }).then(refresh);
      df.reset();
    });
    var pf = el('projectForm');
    if (pf) pf.addEventListener('submit', function (e) {
      e.preventDefault();
      addProject({ name: pf.elements.name.value, notes: pf.elements.notes.value }).then(refresh);
      pf.reset();
    });
    var nf = el('noteForm');
    if (nf) nf.addEventListener('submit', function (e) {
      e.preventDefault();
      addNote({ title: nf.elements.title.value, body: nf.elements.body.value }).then(refresh);
      nf.reset();
    });
    var rf = el('rfqHubForm');
    if (rf) rf.addEventListener('submit', function (e) {
      e.preventDefault();
      createRfq({
        title: rf.elements.title.value, kv: rf.elements.kv.value, mva: rf.elements.mva.value,
        quantity: rf.elements.quantity.value, deadline: rf.elements.deadline.value,
        country: rf.elements.country.value, notes: rf.elements.notes.value, status: 'Draft'
      }).then(refresh);
      rf.reset();
    });
    var rq = el('reqForm');
    if (rq) rq.addEventListener('submit', function (e) {
      e.preventDefault();
      saveRequirement({ title: rq.elements.title.value, mva: rq.elements.mva.value, kv: rq.elements.kv.value, notes: rq.elements.notes.value }).then(refresh);
      rq.reset();
    });
    var cf = el('claimHubForm');
    if (cf) cf.addEventListener('submit', function (e) {
      e.preventDefault();
      claimCompany({ company: cf.elements.company.value, country: cf.elements.country.value, company_id: cf.elements.company_id.value }).then(refresh);
      cf.reset();
    });
    var sp = el('supplierForm');
    if (sp) sp.addEventListener('submit', function (e) {
      e.preventDefault();
      saveSupplierProfile({
        company_name: sp.elements.company_name.value, country: sp.elements.country.value,
        categories: sp.elements.categories.value, about: sp.elements.about.value, capabilities: sp.elements.capabilities.value
      }).then(refresh);
    });
    var ff = el('facilityForm');
    if (ff) ff.addEventListener('submit', function (e) {
      e.preventDefault();
      addFacility({ name: ff.elements.name.value, country: ff.elements.country.value }).then(refresh);
      ff.reset();
    });
    var prf = el('productForm');
    if (prf) prf.addEventListener('submit', function (e) {
      e.preventDefault();
      addProduct({ name: prf.elements.name.value, category: prf.elements.category.value }).then(refresh);
      prf.reset();
    });
    var fl = el('followForm');
    if (fl) fl.addEventListener('submit', function (e) {
      e.preventDefault();
      follow({ type: fl.elements.type.value, subject: fl.elements.subject.value, label: fl.elements.subject.value }).then(refresh);
      fl.reset();
    });
    var wl = el('watchlistForm');
    if (wl) wl.addEventListener('submit', function (e) {
      e.preventDefault();
      addWatchlist({ name: wl.elements.name.value, subjects: String(wl.elements.subjects.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean) }).then(refresh);
      wl.reset();
    });
    var ss = el('searchForm');
    if (ss) ss.addEventListener('submit', function (e) {
      e.preventDefault();
      addSavedSearch({ name: ss.elements.name.value, query: ss.elements.query.value }).then(refresh);
      ss.reset();
    });
    var cmp = el('compareSaveForm');
    if (cmp) cmp.addEventListener('submit', function (e) {
      e.preventDefault();
      saveComparison({ name: cmp.elements.name.value, slugs: cmp.elements.slugs.value }).then(refresh);
      cmp.reset();
    });

    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute('data-rename-design')) {
        var id = t.getAttribute('data-rename-design');
        var next = window.prompt('New design name');
        if (next) renameDesign(id, { name: next }).then(refresh);
      } else if (t.getAttribute('data-dup-design')) {
        duplicateDesign(t.getAttribute('data-dup-design')).then(refresh);
      } else if (t.getAttribute('data-del-design')) {
        deleteDesign(t.getAttribute('data-del-design')).then(refresh);
      } else if (t.getAttribute('data-unshort')) {
        var a = t.getAttribute('data-unshort').split('|');
        shortlistRemove(a[0], a[1]).then(refresh);
      } else if (t.getAttribute('data-rfq-status')) {
        var b = t.getAttribute('data-rfq-status').split('|');
        setRfqStatus(b[0], b[1]).then(refresh);
      } else if (t.getAttribute('data-unfollow')) {
        var c = t.getAttribute('data-unfollow').split('|');
        unfollow(c[0], c[1]).then(refresh);
      }
    });
  }

  window.TP_HUB = {
    getSnap: getSnap, mergeSnap: mergeSnap, renderAll: renderAll, bindForms: bindForms,
    createDesign: createDesign, renameDesign: renameDesign, duplicateDesign: duplicateDesign, deleteDesign: deleteDesign,
    addProject: addProject, addNote: addNote,
    shortlistAdd: shortlistAdd, shortlistRemove: shortlistRemove, saveComparison: saveComparison,
    createRfq: createRfq, setRfqStatus: setRfqStatus, saveRequirement: saveRequirement,
    claimCompany: claimCompany, saveSupplierProfile: saveSupplierProfile, addFacility: addFacility, addProduct: addProduct,
    bumpAnalytics: bumpAnalytics, follow: follow, unfollow: unfollow, addWatchlist: addWatchlist, addSavedSearch: addSavedSearch,
    canSaveDesigns: canSaveDesigns, designsAllowed: designsAllowed, matchIntelItems: matchIntelItems, flattenIntel: flattenIntel,
    matchRfqsForSupplier: matchRfqsForSupplier, RFQ_STATUSES: RFQ_STATUSES, load: load
  };
})();
