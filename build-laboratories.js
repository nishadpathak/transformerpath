#!/usr/bin/env node
/* build-laboratories.js — Transformer Testing Laboratories Directory builder.
 *
 * Generates laboratories.html — a capability-based directory of independent
 * high-voltage, high-power short-circuit and dielectric testing laboratories.
 *
 * Sourced from data/laboratories.json.
 * Run: node build-laboratories.js
 */
'use strict';
const fs = require('fs');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());

const DATA = JSON.parse(fs.readFileSync('data/laboratories.json', 'utf8'));
const LABS = DATA.laboratories || [];

function render() {
  const labsJson = JSON.stringify(LABS);

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Independent Transformer Testing Laboratories Directory | TransformerPath</title>
<meta name="description" content="Capability-based directory of independent transformer testing laboratories — short-circuit withstand, lightning impulse, switching impulse, partial discharge, temperature rise and oil/DGA testing with ISO/IEC 17025 accreditation.">
<link rel="canonical" href="https://transformerpath.com/laboratories.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Independent Transformer Testing Laboratories Directory | TransformerPath">
<meta property="og:description" content="Find accredited independent testing laboratories capable of transformer impulse, short-circuit and dielectric testing above 400 kV.">
<meta property="og:url" content="https://transformerpath.com/laboratories.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=12">
<link rel="stylesheet" href="tp-nav.css?v=12">
<link rel="stylesheet" href="tp-feedback.css?v=12">
<style>
.lab-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.lab-head { margin-bottom: 24px; }
.lab-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; }
.lab-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 860px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }

.cap-toggles { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cap-toggle { background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; font-size: .8rem; color: var(--muted); cursor: pointer; transition: all .15s; user-select: none; }
.cap-toggle:hover, .cap-toggle.active { background: var(--accent); color: var(--navy); border-color: var(--accent); font-weight: 700; }

.lab-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.lab-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; transition: transform .15s, border-color .15s; }
.lab-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.lab-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.lab-name { font-size: 1.25rem; font-weight: 800; color: var(--ink); margin: 0; }
.lab-loc { font-size: .88rem; color: var(--muted); margin-bottom: 12px; }
.kv-pill { background: rgba(245,166,35,.12); border: 1px solid var(--accent); color: var(--accent); font-size: .78rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }

.cap-table { width: 100%; border-collapse: collapse; font-size: .84rem; margin: 12px 0 16px; }
.cap-table td { padding: 5px 6px; border-bottom: 1px solid var(--border); }
.cap-table .c-name { color: var(--text); }
.cap-table .c-status { text-align: right; font-weight: 800; }
.c-yes { color: #10b981; }
.c-no { color: var(--muted); opacity: .4; }

.accred-box { background: rgba(255,255,255,.03); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: .8rem; color: var(--muted); margin-bottom: 14px; }
.accred-box b { color: var(--text); }

.card-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
</style>
</head>
<body>
${HEAD}

<main class="lab-wrap">
  <div class="lab-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › Testing Laboratories</nav>
    <h1>Transformer <span style="color:var(--accent)">Testing Laboratories</span> Directory</h1>
    <p class="lead">Independent, capability-based directory of accredited high-voltage, dielectric and short-circuit testing laboratories for power, distribution and specialty transformers. Filter specifically by impulse ratings above 400 kV, short-circuit test capabilities, and ISO/IEC 17025 accreditations.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statLabCount">10</div>
      <div class="lbl">Laboratories Listed</div>
    </div>
    <div class="stat-box">
      <div class="num">1,200 kV</div>
      <div class="lbl">Peak Test Rating</div>
    </div>
    <div class="stat-box">
      <div class="num">10,000 MVA</div>
      <div class="lbl">Max Short-Circuit</div>
    </div>
    <div class="stat-box">
      <div class="num">100%</div>
      <div class="lbl">ISO/IEC 17025 Accredited</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="labSearch" class="search-input" placeholder="Search laboratories by name, location or keyword (KEMA, CESI, CPRI, VEIKI)...">
      <select id="voltageFilter" class="select-input">
        <option value="0">Any Test Voltage</option>
        <option value="400">Above 400 kV</option>
        <option value="765">Above 765 kV</option>
        <option value="1000">1,000 kV+ (UHV)</option>
      </select>
      <select id="countryFilter" class="select-input">
        <option value="">All Countries</option>
        <option value="Netherlands">Netherlands</option>
        <option value="Italy">Italy</option>
        <option value="Germany">Germany</option>
        <option value="Hungary">Hungary</option>
        <option value="India">India</option>
        <option value="USA">USA</option>
        <option value="South Korea">South Korea</option>
        <option value="United Kingdom">United Kingdom</option>
      </select>
    </div>
    <div class="filter-row" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div style="font-size:.82rem;font-weight:700;color:var(--muted);text-transform:uppercase">Required Test Capabilities:</div>
      <div class="cap-toggles" id="capToggles">
        <span class="cap-toggle" data-cap="lightning_impulse">⚡ Lightning Impulse</span>
        <span class="cap-toggle" data-cap="switching_impulse">⚡ Switching Impulse</span>
        <span class="cap-toggle" data-cap="short_circuit">💥 Short-Circuit Withstand</span>
        <span class="cap-toggle" data-cap="partial_discharge">🔬 Partial Discharge</span>
        <span class="cap-toggle" data-cap="temperature_rise">🌡️ Temperature Rise</span>
        <span class="cap-toggle" data-cap="sound_level">🔊 Sound / Noise Level</span>
        <span class="cap-toggle" data-cap="oil_testing">🛢️ Oil &amp; DGA Analysis</span>
        <span class="cap-toggle" data-cap="materials_testing">🧪 Insulation &amp; Materials</span>
      </div>
    </div>
  </div>

  <div class="lab-grid" id="labGrid"></div>

  <div style="background:linear-gradient(135deg, rgba(245,166,35,.10) 0%, rgba(20,37,61,.30) 100%);border:1px solid var(--accent);border-radius:14px;padding:26px;text-align:center;margin-top:40px">
    <h3 style="color:var(--ink);margin:0 0 8px">Need Independent Laboratory Testing or Third-Party Witnessing?</h3>
    <p style="color:var(--muted);font-size:.92rem;max-width:640px;margin:0 auto 16px">TransformerPath assists utilities, grid operators and OEMs in coordinating type-testing slots, specialized impulse testing, and short-circuit withstand verification with independent accredited laboratories.</p>
    <a href="rfq.html?type=testing" class="btn btn-amber">Inquire for Laboratory Testing &rarr;</a>
  </div>
</main>

${FOOT}

<script>
var LABS = ${labsJson};
var requiredCaps = {};
var minVoltage = 0;
var selectedCountry = '';
var searchQuery = '';

var CAP_NAMES = {
  lightning_impulse: '⚡ Lightning Impulse (1.2/50 μs)',
  switching_impulse: '⚡ Switching Impulse (250/2500 μs)',
  short_circuit: '💥 Short-Circuit Withstand',
  partial_discharge: '🔬 Partial Discharge (PD)',
  temperature_rise: '🌡️ Temperature Rise Test',
  sound_level: '🔊 Sound / Noise Measurement',
  dielectric_withstand: '⚡ Power-Frequency Dielectric',
  oil_testing: '🛢️ Oil & DGA Laboratory',
  materials_testing: '🧪 Insulation Materials Testing',
  sfra: '📈 SFRA Frequency Response'
};

function renderCards() {
  var grid = document.getElementById('labGrid');
  var hits = LABS.filter(function(lab) {
    if (minVoltage > 0 && lab.max_voltage_kv < minVoltage) return false;
    if (selectedCountry && lab.country !== selectedCountry) return false;
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      var text = (lab.name + ' ' + lab.city + ' ' + lab.country + ' ' + lab.description + ' ' + (lab.accreditation ? lab.accreditation.scope : '')).toLowerCase();
      if (text.indexOf(q) < 0) return false;
    }
    for (var cap in requiredCaps) {
      if (requiredCaps[cap] && (!lab.capabilities || !lab.capabilities[cap])) return false;
    }
    return true;
  });

  document.getElementById('statLabCount').textContent = hits.length;

  if (!hits.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No testing laboratories match all selected capabilities. Try loosening filters.</div>';
    return;
  }

  grid.innerHTML = hits.map(function(lab) {
    var capRows = Object.keys(CAP_NAMES).map(function(k) {
      var ok = lab.capabilities && lab.capabilities[k];
      return '<tr><td class="c-name">' + CAP_NAMES[k] + '</td><td class="c-status ' + (ok ? 'c-yes"><span class="cmp-yes">✓ Yes</span>' : 'c-no"><span class="sub-l">—</span>') + '</td></tr>';
    }).join('');

    var isUhv = lab.max_voltage_kv >= 765;

    return '<div class="lab-card" style="box-shadow:0 4px 18px rgba(0,0,0,.12)">' +
      '<div class="lab-top">' +
        '<h2 class="lab-name" style="font-size:1.28rem">' + lab.name + '</h2>' +
        '<span class="kv-pill ' + (isUhv ? 'uhv' : '') + '">' + lab.max_voltage_kv + ' kV Peak</span>' +
      '</div>' +
      '<div class="lab-loc">📍 ' + lab.city + ', ' + lab.country + (lab.third_party_independent ? ' · <span style="color:#10b981;font-weight:700">Third-Party Independent</span>' : '') + '</div>' +
      '<p style="font-size:.86rem;color:var(--muted);line-height:1.5;margin:0 0 12px">' + lab.description + '</p>' +
      '<div class="accred-box">' +
        '<div><b>Accreditation:</b> <span style="color:var(--accent);font-weight:700">' + (lab.accreditation.standard || 'ISO/IEC 17025') + '</span> (' + lab.accreditation.body + ')</div>' +
        '<div style="font-size:.76rem;margin-top:4px"><b>Scope:</b> ' + lab.accreditation.scope + '</div>' +
        (lab.short_circuit_capacity ? '<div style="font-size:.76rem;margin-top:4px;color:var(--text)"><b>Short-Circuit:</b> ' + lab.short_circuit_capacity + '</div>' : '') +
      '</div>' +
      '<table class="cap-table"><tbody>' + capRows + '</tbody></table>' +
      '<div class="card-foot">' +
        '<span style="font-size:.74rem;color:var(--muted)">Reviewed: ' + (lab.last_verified || '2026') + '</span>' +
        '<div style="display:flex;gap:6px">' +
          (lab.website ? '<a href="' + lab.website + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Website ↗</a>' : '') +
          '<a href="rfq.html?company=' + encodeURIComponent(lab.name) + '&service=testing" class="btn btn-amber btn-sm">Inquire →</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

document.getElementById('labSearch').addEventListener('input', function(e) {
  searchQuery = e.target.value.trim();
  renderCards();
});

document.getElementById('voltageFilter').addEventListener('change', function(e) {
  minVoltage = parseInt(e.target.value, 10) || 0;
  renderCards();
});

document.getElementById('countryFilter').addEventListener('change', function(e) {
  selectedCountry = e.target.value;
  renderCards();
});

document.getElementById('capToggles').addEventListener('click', function(e) {
  var t = e.target.closest('.cap-toggle');
  if (!t) return;
  var cap = t.getAttribute('data-cap');
  if (requiredCaps[cap]) {
    delete requiredCaps[cap];
    t.classList.remove('active');
  } else {
    requiredCaps[cap] = true;
    t.classList.add('active');
  }
  renderCards();
});

renderCards();
</script>
<script src="analytics.js" defer></script>
</body>
</html>`;

  fs.writeFileSync('laboratories.html', html);
  console.log('build-laboratories.js wrote laboratories.html with', LABS.length, 'records');
}

render();
