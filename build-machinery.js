#!/usr/bin/env node
/* build-machinery.js — Transformer Manufacturing Machinery Directory builder.
 *
 * Generates machinery.html — the dedicated global directory of transformer
 * manufacturing equipment, test systems and processing machinery.
 *
 * Sourced from data/machinery.json.
 * Run: node build-machinery.js
 */
'use strict';
const fs = require('fs');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(u) {
  if (!u) return '';
  const s = String(u).trim();
  if (/^https?:\/\/[a-z0-9]/i.test(s)) return esc(s);
  return '';
}

const DATA = JSON.parse(fs.readFileSync('data/machinery.json', 'utf8'));
const MACHINES = DATA.machinery || [];
const CATEGORIES = DATA.categories || [];

function renderCardServer(m) {
  const features = (m.key_features || []).map(function(f) {
    return '<li style="margin:3px 0;font-size:.82rem;color:var(--muted)">' + esc(f) + '</li>';
  }).join('');

  const webUrl = safeUrl(m.website);

  return '<div class="mach-card" style="box-shadow:0 4px 18px rgba(0,0,0,.12)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<span class="mach-cat-tag">' + esc(m.category) + '</span>' +
      '<span style="font-size:.78rem;color:var(--muted);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:999px">' + esc(m.country) + '</span>' +
    '</div>' +
    '<h2 class="mach-name" style="font-size:1.25rem">' + esc(m.name) + '</h2>' +
    '<div class="mach-maker">By <b>' + esc(m.manufacturer) + '</b> · ' + esc(m.city) + ', ' + esc(m.country) + '</div>' +
    '<div class="spec-badges" style="margin:4px 0 10px">' +
      '<span class="kg-spec-pill" style="color:var(--accent);border-color:rgba(245,166,35,.35)">⚙️ ' + esc(m.machine_type) + '</span>' +
      '<span class="kg-spec-pill" style="color:#10b981;border-color:rgba(16,185,129,.35)">🤖 ' + esc(m.automation_level) + '</span>' +
    '</div>' +
    '<div class="mach-detail">' +
      '<p><span class="label">Capacity / Range:</span> <b style="color:var(--text)">' + esc(m.capacity_range) + '</b></p>' +
      '<p><span class="label">Application:</span> ' + esc(m.transformer_application) + '</p>' +
      '<p><span class="label">Proven Reference Base:</span> ' + esc(m.installations_count || 'Verified manufacturing plants') + '</p>' +
      '<div style="margin-top:10px"><span class="label">Key Technical Highlights:</span><ul style="padding-left:18px;margin:4px 0">' + features + '</ul></div>' +
    '</div>' +
    '<div class="card-foot">' +
      '<span class="verified-tag">Reviewed: ' + esc(m.last_verified || '2026') + '</span>' +
      '<div style="display:flex;gap:6px">' +
        (webUrl ? '<a href="' + webUrl + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Website ↗</a>' : '') +
        '<a href="rfq.html?company=' + encodeURIComponent(m.manufacturer || '') + '&machinery=' + encodeURIComponent(m.name || '') + '" class="btn btn-amber btn-sm">RFQ →</a>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function render() {
  const uniqueCountries = [...new Set(MACHINES.map(m => m.country).filter(Boolean))].sort();
  const uniqueMakers = [...new Set(MACHINES.map(m => m.manufacturer).filter(Boolean))];
  const initialCardsHtml = MACHINES.map(renderCardServer).join('');

  const countryOptions = uniqueCountries.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('\n        ');
  const machJson = JSON.stringify(MACHINES);

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transformer Manufacturing Machinery Directory | TransformerPath</title>
<meta name="description" content="Global directory of transformer manufacturing machinery — core cutting lines, foil & wire winding machines, vapour-phase drying (VPD), oil filtration plants, corrugated fin machines and test bay systems.">
<link rel="canonical" href="https://transformerpath.com/machinery.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Transformer Manufacturing Machinery Directory | TransformerPath">
<meta property="og:description" content="Transformer production equipment: core cutting, winding, vapour-phase drying, oil purification, tank lines and high-voltage test bays.">
<meta property="og:url" content="https://transformerpath.com/machinery.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=13">
<link rel="stylesheet" href="tp-nav.css?v=15">
<link rel="stylesheet" href="tp-feedback.css?v=13">
<style>
.mach-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.mach-head { margin-bottom: 24px; }
.mach-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; overflow-wrap: anywhere; }
.mach-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 860px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.cat-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.pill-btn { background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 5px 13px; font-size: .82rem; color: var(--muted); cursor: pointer; transition: all .15s; }
.pill-btn:hover, .pill-btn.active { background: var(--accent); color: var(--navy); border-color: var(--accent); font-weight: 700; }

.mach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
.mach-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; transition: transform .15s, border-color .15s; }
.mach-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.mach-cat-tag { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); margin-bottom: 6px; }
.mach-name { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0 0 6px; }
.mach-maker { font-size: .92rem; color: var(--muted); margin-bottom: 12px; }
.mach-maker b { color: var(--text); }
.mach-detail { font-size: .85rem; line-height: 1.55; color: var(--text); margin-bottom: 14px; flex-grow: 1; }
.mach-detail p { margin: 4px 0; }
.mach-detail .label { color: var(--muted); font-weight: 600; }
.spec-badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.spec-badge { background: rgba(255,255,255,.05); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; font-size: .74rem; color: var(--muted); }

.card-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.verified-tag { font-size: .72rem; color: var(--muted); }

.rfq-banner { background: rgba(245,166,35,.07); border: 1px solid var(--accent); border-radius: 14px; padding: 24px; text-align: center; margin-top: 40px; }
.rfq-banner h3 { color: var(--ink); margin: 0 0 8px; }
.rfq-banner p { color: var(--muted); font-size: .92rem; max-width: 600px; margin: 0 auto 16px; }
</style>
</head>
<body>
${HEAD}

<main class="mach-wrap">
  <div class="mach-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › Manufacturing Machinery</nav>
    <h1>Transformer <span style="color:var(--accent)">Manufacturing Machinery</span> Directory</h1>
    <p class="lead">The structured procurement directory of equipment for electrical transformer manufacturing — from CRGO core cutting lines and high-voltage winding machines to vapour-phase drying ovens and high-voltage impulse test bays.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statTotal">${MACHINES.length}</div>
      <div class="lbl">Machines Listed</div>
    </div>
    <div class="stat-box">
      <div class="num">${CATEGORIES.length}</div>
      <div class="lbl">Equipment Classes</div>
    </div>
    <div class="stat-box">
      <div class="num">${uniqueMakers.length}</div>
      <div class="lbl">Equipment Builders</div>
    </div>
    <div class="stat-box">
      <div class="num">${uniqueCountries.length}</div>
      <div class="lbl">Manufacturing Countries</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="machSearch" class="search-input" placeholder="Search by machine model, manufacturer (Georg, Tuboly, Hedrich), or country...">
      <select id="machCountry" class="search-input" style="max-width:200px">
        <option value="">All Countries</option>
        ${countryOptions}
      </select>
    </div>
    <div class="cat-pills" id="catPills">
      <button class="pill-btn active" data-cat="">🌐 All Equipment</button>
      <button class="pill-btn" data-cat="MAC_CORE">⚙️ Core Cutting</button>
      <button class="pill-btn" data-cat="MAC_WINDING">🌀 Winding Lines</button>
      <button class="pill-btn" data-cat="MAC_DRYING">♨️ Vapour-Phase &amp; Drying</button>
      <button class="pill-btn" data-cat="MAC_OIL_FILTRATION">🛢️ Oil Treatment</button>
      <button class="pill-btn" data-cat="MAC_FABRICATION">🏭 Tank &amp; Fin Lines</button>
      <button class="pill-btn" data-cat="MAC_INSULATION_CNC">📐 Insulation CNC</button>
      <button class="pill-btn" data-cat="MAC_TESTING">⚡ Test Bays &amp; Impulse</button>
    </div>
  </div>

  <div class="mach-grid" id="machGrid">${initialCardsHtml}</div>

  <div class="rfq-banner">
    <h3>Planning a Transformer Factory Expansion or Greenfield Plant?</h3>
    <p>Browse equipment categories and connect with transformer machinery manufacturers for factory equipment procurement.</p>
    <a href="rfq.html?type=machinery" class="btn btn-amber">Request Machinery RFQ &rarr;</a>
  </div>
</main>

${FOOT}

<script>
var MACHINES = ${machJson};
var activeCat = '';
var activeCountry = '';
var activeQuery = '';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(u) {
  if (!u) return '';
  var s = String(u).trim();
  if (/^https?:\\/\\/[a-z0-9]/i.test(s)) return esc(s);
  return '';
}

function renderCards() {
  var grid = document.getElementById('machGrid');
  var hits = MACHINES.filter(function(m) {
    if (activeCat && m.category_id !== activeCat) return false;
    if (activeCountry && m.country !== activeCountry) return false;
    if (activeQuery) {
      var q = activeQuery.toLowerCase();
      var text = (m.name + ' ' + m.manufacturer + ' ' + m.country + ' ' + m.category + ' ' + m.transformer_application + ' ' + (m.key_features||[]).join(' ')).toLowerCase();
      if (text.indexOf(q) < 0) return false;
    }
    return true;
  });

  document.getElementById('statTotal').textContent = hits.length;

  if (!hits.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No machinery records match your filter criteria. Try clearing search filters.</div>';
    return;
  }

  grid.innerHTML = hits.map(function(m) {
    var features = (m.key_features || []).map(function(f) {
      return '<li style="margin:3px 0;font-size:.82rem;color:var(--muted)">' + esc(f) + '</li>';
    }).join('');

    var webUrl = safeUrl(m.website);

    return '<div class="mach-card" style="box-shadow:0 4px 18px rgba(0,0,0,.12)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<span class="mach-cat-tag">' + esc(m.category) + '</span>' +
        '<span style="font-size:.78rem;color:var(--muted);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:999px">' + esc(m.country) + '</span>' +
      '</div>' +
      '<h2 class="mach-name" style="font-size:1.25rem">' + esc(m.name) + '</h2>' +
      '<div class="mach-maker">By <b>' + esc(m.manufacturer) + '</b> · ' + esc(m.city) + ', ' + esc(m.country) + '</div>' +
      '<div class="spec-badges" style="margin:4px 0 10px">' +
        '<span class="kg-spec-pill" style="color:var(--accent);border-color:rgba(245,166,35,.35)">⚙️ ' + esc(m.machine_type) + '</span>' +
        '<span class="kg-spec-pill" style="color:#10b981;border-color:rgba(16,185,129,.35)">🤖 ' + esc(m.automation_level) + '</span>' +
      '</div>' +
      '<div class="mach-detail">' +
        '<p><span class="label">Capacity / Range:</span> <b style="color:var(--text)">' + esc(m.capacity_range) + '</b></p>' +
        '<p><span class="label">Application:</span> ' + esc(m.transformer_application) + '</p>' +
        '<p><span class="label">Proven Reference Base:</span> ' + esc(m.installations_count || 'Verified manufacturing plants') + '</p>' +
        '<div style="margin-top:10px"><span class="label">Key Technical Highlights:</span><ul style="padding-left:18px;margin:4px 0">' + features + '</ul></div>' +
      '</div>' +
      '<div class="card-foot">' +
        '<span class="verified-tag">Reviewed: ' + esc(m.last_verified || '2026') + '</span>' +
        '<div style="display:flex;gap:6px">' +
          (webUrl ? '<a href="' + webUrl + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Website ↗</a>' : '') +
          '<a href="rfq.html?company=' + encodeURIComponent(m.manufacturer || '') + '&machinery=' + encodeURIComponent(m.name || '') + '" class="btn btn-amber btn-sm">RFQ →</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

document.getElementById('machSearch').addEventListener('input', function(e) {
  activeQuery = e.target.value.trim();
  renderCards();
});

document.getElementById('machCountry').addEventListener('change', function(e) {
  activeCountry = e.target.value;
  renderCards();
});

document.getElementById('catPills').addEventListener('click', function(e) {
  if (!e.target.classList.contains('pill-btn')) return;
  document.querySelectorAll('#catPills .pill-btn').forEach(function(b) { b.classList.remove('active'); });
  e.target.classList.add('active');
  activeCat = e.target.getAttribute('data-cat');
  renderCards();
});
</script>
<script src="analytics.js" defer></script>
</body>
</html>`;

  fs.writeFileSync('machinery.html', html);
  console.log('build-machinery.js wrote machinery.html with', MACHINES.length, 'records (SSR + dynamic stats + client esc)');
}

render();
