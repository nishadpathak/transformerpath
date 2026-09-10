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

  function load() {
    fetch('data/directory-index.json').then(function (r) { return r.json(); })
      .then(function (j) { DATA = j && j.companies || []; render(); })
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
  var q = '', kind = '', country = '', type = '', minKv = 0, evFilter = '';
  var compare = {}; // id -> true

  var STOPWORDS = { manufacturer:1, manufacturers:1, supplier:1, suppliers:1, company:1, companies:1, transformer:1, transformers:1, factory:1, factories:1, for:1, the:1, a:1, an:1, and:1, make:1, makers:1, of:1, in:1, with:1, need:1 };

  function applyFilters() {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean).filter(function (w) { return !STOPWORDS[w]; });
    return DATA.filter(function (c) {
      if (kind && c.kind !== kind) return false;
      if (country && c.country !== country) return false;
      if (evFilter && c.evidence !== evFilter) return false;
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

  function rowHtml(c) {
    var selected = compare[c.id];
    return '<div class="dir-row" data-id="' + esc(c.id) + '">' +
      '<label class="dir-check"><input type="checkbox" data-cmp="' + esc(c.id) + '"' + (selected ? ' checked' : '') + '></label>' +
      '<div class="dir-main">' +
        '<a class="dir-name" href="' + (c.kind === 'manufacturer' ? 'manufacturers/' + esc(c.slug) + '/' : (c.website || '#')) + '">' + esc(c.name) + '</a>' +
        '<div class="dir-meta">' + esc(c.country) + (c.region ? ' · ' + esc(c.region) : '') + (c.kind === 'component_supplier' ? ' · Component / material supplier' : '') + '</div>' +
        '<div class="dir-tags">' + (c.capability_labels || []).slice(0, 6).map(function (l) { return '<span class="dir-tag">' + esc(l) + '</span>'; }).join('') + '</div>' +
        (c.voltage && c.voltage.value ? '<div class="dir-kv"><b>Voltage:</b> ' + esc(c.voltage.value) + '</div>' : '') +
        (c.mva && c.mva.value ? '<div class="dir-kv"><b>Rating:</b> ' + esc(c.mva.value) + '</div>' : '') +
        (c.certs && c.certs.length ? '<div class="dir-kv"><b>Standards evidence:</b> ' + esc(c.certs.join(', ')) + '</div>' : '') +
        '<div class="dir-kv"><b>Evidence:</b> ' + evBadge(c.evidence) + ' · research completeness ' + (c.research_completeness || 0) + '/6 · sources: ' + (c.sources && c.sources.capability_source ? esc(c.sources.capability_source) : (c.kind === 'manufacturer' ? 'census record' : 'website-checked')) + '</div>' +
        (c.factories && c.factories.length ? '<div class="dir-kv"><b>Factories:</b> ' + esc(c.factories.length) + ' recorded</div>' : '') +
      '</div>' +
      '<div class="dir-actions">' +
        '<button class="btn btn-outline btn-sm" data-act="compare">Compare</button> ' +
        '<a class="btn btn-outline btn-sm" href="mailto:hello@transformerpath.com?subject=' + encodeURIComponent('Request information: ' + c.name) + '">Info</a> ' +
        '<a class="btn btn-outline btn-sm" href="rfq.html?company=' + encodeURIComponent(c.name) + '">RFQ</a>' +
      '</div>' +
    '</div>';
  }

  function render() {
    if (!root) return;
    var hits = applyFilters();
    var facets = { countries: {}, kinds: {} };
    DATA.forEach(function (c) { facets.countries[c.country] = (facets.countries[c.country] || 0) + 1; facets.kinds[c.kind] = (facets.kinds[c.kind] || 0) + 1; });
    var countries = Object.keys(facets.countries).sort();

    var typeOpts = ['power', 'distribution', 'dry_type', 'special'];
    var typSel = '<option value="">All types</option>' + typeOpts.map(function (t) {
      return '<option value="' + t + '"' + (type === t ? ' selected' : '') + '>' + t.replace(/_/g, ' ').replace(/^./, function (ch) { return ch.toUpperCase(); }) + '</option>';
    }).join('');

    root.innerHTML =
      '<div class="dir-head">' +
        '<h1 style="margin:0 0 4px">Transformer Industry Directory</h1>' +
        '<p style="color:var(--muted);font-size:.92rem;margin:0 0 16px">A sourced sourcing directory over the canonical TransformerPath records (reused — no duplicates added). Find, filter, verify evidence, compare, then RFQ. <b style="color:var(--text)">No scores, no star ratings, no "best" call.</b></p>' +
      '</div>' +
      '<div class="dir-controls">' +
        '<input id="dirQ" type="search" placeholder="Search capability or company, e.g. cast resin, 220 kV, OLTC, pressboard, UAE" value="' + esc(q) + '"> ' +
        '<select id="dirKind"><option value="">All kinds</option>' + '<option value="manufacturer">Transformer manufacturer</option><option value="component_supplier">Component / material supplier</option>' + '</select> ' +
        '<select id="dirCountry"><option value="">All countries</option>' + countries.map(function (cc) { return '<option value="' + esc(cc) + '"' + (country === cc ? ' selected' : '') + '>' + esc(cc) + '</option>'; }).join('') + '</select> ' +
        '<select id="dirType">' + typSel + '</select> ' +
        '<select id="dirKv"><option value="0">Any voltage</option><option value="110">110 kV+</option><option value="220">220 kV+</option><option value="400">400 kV+</option><option value="765">765 kV+</option></select> ' +
        '<select id="dirEv"><option value="">Any evidence</option><option value="CONFIRMED">Confirmed</option><option value="COMPANY_REPORTED">Company reported</option><option value="INFERRED">Inferred</option><option value="UNKNOWN">Unknown</option></select> ' +
        '<button id="dirClear" class="btn btn-outline btn-sm">Clear</button>' +
      '</div>' +
      '<div class="dir-count" style="color:var(--muted);font-size:.85rem;margin:10px 0">' + hits.length + ' of ' + DATA.length + ' companies' +
        (hits.length ? ' · select up to 3 and hit "Compare"' : '') + '</div>' +
      '<div id="dirCompare" class="dir-compare"></div>' +
      '<div class="dir-list">' + (hits.length ? hits.slice(0, 60).map(rowHtml).join('') : '<p style="color:var(--muted)">No matching companies. Try a broader filter.</p>') + '</div>' +
      '<div class="dir-note" style="font-size:.78rem;color:var(--muted);margin-top:14px;line-height:1.6">Capability evidence is independent of commercial/paid status. <b>Potentially relevant</b> does not mean technically qualified — verify with the manufacturer before a commercial decision. UNKNOWN is shown rather than guessed.</div>';

    if (hits.length > 60) {
      var more = document.createElement('p');
      more.style.cssText = 'text-align:center;color:var(--muted);font-size:.85rem;padding:8px 0 24px';
      more.textContent = 'Showing first 60 — refine with the filters.';
      root.appendChild(more);
    }
    wire();
  }

  function wire() {
    var elQ = document.getElementById('dirQ');
    var set = function (node, fn) { if (node) node.addEventListener('change', fn); };
    if (elQ) elQ.addEventListener('input', function () { q = elQ.value; render(); });
    set(document.getElementById('dirKind'), function (e) { kind = e.target.value; render(); });
    set(document.getElementById('dirCountry'), function (e) { country = e.target.value; render(); });
    set(document.getElementById('dirType'), function (e) { type = e.target.value; render(); });
    set(document.getElementById('dirKv'), function (e) { minKv = parseInt(e.target.value, 10) || 0; render(); });
    set(document.getElementById('dirEv'), function (e) { evFilter = e.target.value; render(); });
    var clr = document.getElementById('dirClear');
    if (clr) clr.addEventListener('click', function () { q = ''; kind = ''; country = ''; type = ''; minKv = 0; evFilter = ''; render(); });

    root.addEventListener('change', function (e) {
      var t = e.target.getAttribute && e.target.getAttribute('data-cmp');
      if (t) { compare[t] = e.target.checked; renderCompare(); }
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="compare"]');
      if (b) renderCompare();
    });
  }

  function renderCompare() {
    var box = document.getElementById('dirCompare');
    if (!box) return;
    var ids = Object.keys(compare).filter(function (k) { return compare[k]; }).slice(0, 3);
    if (ids.length < 2) { box.innerHTML = ''; return; }
    var rows = ids.map(function (id) { return DATA.find(function (c) { return c.id === id; }); }).filter(Boolean);
    box.innerHTML =
      '<div class="dir-cmp-banner"><b>Technical comparison</b> — factual fields only; no score, no ranking.</div>' +
      '<div class="table-wrap"><table><thead><tr>' +
      '<th>Field</th>' + rows.map(function (c) { return '<th>' + esc(c.name.slice(0, 30)) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      '<tr><td>Country</td>' + rows.map(function (c) { return '<td>' + esc(c.country) + '</td>'; }).join('') + '</tr>' +
      '<tr><td>Reported voltage (company-level)</td>' + rows.map(function (c) { return '<td>' + evBadge(c.capability_evidence && c.capability_evidence.voltage) + ' ' + esc(c.voltage && c.voltage.value || '—') + '</td>'; }).join('') + '</tr>' +
      '<tr><td>Reported rating (company-level)</td>' + rows.map(function (c) { return '<td>' + evBadge(c.capability_evidence && c.capability_evidence.mva) + ' ' + esc(c.mva && c.mva.value || '—') + ' <span style="color:var(--muted);font-size:.72rem">(may be annual production, not a single-unit maximum)</span></td>'; }).join('') + '</tr>' +
      '<tr><td>Transformer types</td>' + rows.map(function (c) { return '<td>' + (c.capability_labels || []).join(', ') + '</td>'; }).join('') + '</tr>' +
      '<tr><td>Standards evidence</td>' + rows.map(function (c) { return '<td>' + esc((c.certs || []).join(', ') || '—') + '</td>'; }).join('') + '</tr>' +
      '<tr><td>Factories</td>' + rows.map(function (c) { return '<td>' + c.factories.length + ' recorded</td>'; }).join('') + '</tr>' +
      '<tr><td>Research completeness</td>' + rows.map(function (c) { return '<td>(' + (c.research_completeness || 0) + '/6) — DB coverage, not company quality</td>'; }).join('') + '</tr>' +
      '</tbody></table></div>' +
      '<div style="margin:8px 0"><a class="btn btn-amber btn-sm" href="rfq.html">Create RFQ</a> <a class="btn btn-outline btn-sm" href="mailto:hello@transformerpath.com?subject=' + encodeURIComponent('Quote request (compared)') + '">Request information</a></div>';
  }

  load();
})();
