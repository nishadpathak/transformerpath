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
const listingRichness = require('./lib/listing-richness');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const CSSV = (JSON.parse(fs.readFileSync('data/config.json', 'utf8')).assets || {}).css || 14;
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

const DATA = JSON.parse(fs.readFileSync('data/laboratories.json', 'utf8'));
const LABS = DATA.laboratories || [];
function tpmFor(slug) {
  try {
    const lookup = JSON.parse(fs.readFileSync('data/permanent-id-lookup.json', 'utf8'));
    return (lookup.by_slug && lookup.by_slug[slug]) || '';
  } catch (e) { return ''; }
}
function labSlug(lab) { return String(lab && lab.id || '').replace(/^lab:/, ''); }
const exhibitorTags = require('./lib/exhibitor-tags');
const eventBadges = require('./event-badges');

const CAP_NAMES = {
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

/* A capability checkmark needs an explicit true. Placeholder rows whose
 * prose says the scope is not restated are not a sourced true, even if the
 * JSON still holds a boolean. */
function scopeUnsourced(lab) {
  const sc = String(lab.short_circuit_capacity || '');
  const scope = String((lab.accreditation && lab.accreditation.scope) || '');
  return /not restated/i.test(sc) || /as published on the laboratory website/i.test(scope);
}

function capClaim(lab, k) {
  if (scopeUnsourced(lab)) return 'unknown';
  const raw = lab.capabilities ? lab.capabilities[k] : undefined;
  if (raw === true) return 'yes';
  if (raw === false) return 'no';
  return 'unknown';
}

function capCell(lab, k) {
  const claim = capClaim(lab, k);
  if (claim === 'yes') return 'c-yes"><span class="cmp-yes">✓ Yes</span>';
  if (claim === 'no') return 'c-no"><span class="sub-l">—</span>';
  return 'c-unknown"><span class="sub-l">Not stated</span>';
}

function voltagePill(lab) {
  const kv = lab.max_voltage_kv;
  if (typeof kv !== 'number' || !isFinite(kv)) return '';
  const isUhv = kv >= 765;
  return '<span class="kv-pill' + (isUhv ? ' uhv' : '') + '">' + esc(kv) + ' kV Peak</span>';
}

function accreditationVerified(lab) {
  const a = lab.accreditation;
  if (!a || !a.standard || String(a.standard).indexOf('17025') < 0) return false;
  const body = String(a.body || '').trim();
  if (!body || /as published/i.test(body)) return false;
  return true;
}

/* A published note is not an accreditation object, so it does not
 * increase the verified ISO/IEC 17025 count. */
function publicNote(lab) {
  const rec = lab && lab.public_record;
  if (!rec || !rec.card_note) return '';
  return '<div class="accred-box"><div style="font-size:.76rem"><b>Published accreditation:</b> ' + esc(rec.card_note) + '</div></div>';
}

function profileRecord(lab) {
  const rec = lab.public_record;
  const loc = esc([lab.city, lab.country].filter(Boolean).join(', '));
  const web = lab.website ? ' · <a href="' + esc(lab.website) + '">Official website</a>' : '';
  if (!rec) {
    return '<p>Unclaimed listing. Accreditation is not claimed.</p>' +
      '<p>' + esc(lab.description || '') + '</p>' +
      '<p>' + loc + web + '</p>';
  }
  let html = '<p>Unclaimed directory listing. The facts below are copied from the company\'s public website. Checked ' + esc(rec.checked || lab.last_verified || '') + '.</p>';
  html += '<p>' + esc(lab.description || '') + '</p>';
  html += '<p>' + loc + web + '</p>';
  (rec.sections || []).forEach(function (section) {
    html += '<h2 style="font-size:1.15rem;margin:22px 0 8px">' + esc(section.heading || '') + '</h2>';
    (section.paragraphs || []).forEach(function (p) {
      html += '<p>' + esc(p) + '</p>';
    });
    if (section.items && section.items.length) {
      html += '<ul>';
      section.items.forEach(function (item) { html += '<li>' + esc(item) + '</li>'; });
      html += '</ul>';
    }
  });
  if (rec.sources && rec.sources.length) {
    html += '<h2 style="font-size:1.15rem;margin:22px 0 8px">Sources</h2><ul>';
    rec.sources.forEach(function (src) {
      const url = safeUrl(src.url);
      const label = esc(src.label || src.url || '');
      html += '<li>' + (url ? '<a href="' + url + '">' + label + '</a>' : label) + '</li>';
    });
    html += '</ul>';
  }
  return html;
}

function independentVerified(lab) {
  return lab.third_party_independent === true && !scopeUnsourced(lab);
}

function renderCardServer(lab) {
  const capRows = Object.keys(CAP_NAMES).map(function(k) {
    return '<tr><td class="c-name">' + esc(CAP_NAMES[k]) + '</td><td class="c-status ' + capCell(lab, k) + '</td></tr>';
  }).join('');

  const webUrl = safeUrl(lab.website);

  let accredHtml = '';
  if (lab.accreditation) {
    const std = esc(lab.accreditation.standard || 'ISO/IEC 17025');
    const body = lab.accreditation.body ? ' (' + esc(lab.accreditation.body) + ')' : '';
    const scope = lab.accreditation.scope ? '<div style="font-size:.76rem;margin-top:4px"><b>Scope:</b> ' + esc(lab.accreditation.scope) + '</div>' : '';
    accredHtml = '<div class="accred-box">' +
      '<div><b>Accreditation:</b> <span style="color:var(--accent);font-weight:700">' + std + '</span>' + body + '</div>' +
      scope +
      (lab.short_circuit_capacity ? '<div style="font-size:.76rem;margin-top:4px;color:var(--text)"><b>Short-Circuit:</b> ' + esc(lab.short_circuit_capacity) + '</div>' : '') +
    '</div>';
  } else if (lab.short_circuit_capacity) {
    accredHtml = '<div class="accred-box"><div style="font-size:.76rem;color:var(--text)"><b>Short-Circuit:</b> ' + esc(lab.short_circuit_capacity) + '</div></div>';
  }
  accredHtml += publicNote(lab);

  return '<div class="lab-card" style="box-shadow:0 4px 18px rgba(0,0,0,.12)">' +
    '<div class="lab-top">' +
      '<h2 class="lab-name" style="font-size:1.28rem">' + (lab.profile_page ? '<a href="/laboratories/' + esc(labSlug(lab)) + '/">' + esc(lab.name) + '</a>' : '<span>' + esc(lab.name) + '</span>') + (function () { const badge = eventBadges.htmlFor({ slug: labSlug(lab), name: lab.name }); return badge ? ' ' + badge : ''; })() + '</h2>' +
      (tpmFor(labSlug(lab)) ? '<p style="margin:4px 0 8px;font-size:.78rem;color:var(--muted)">Permanent company ID ' + esc(tpmFor(labSlug(lab))) + '</p>' : '') +
      voltagePill(lab) +
    '</div>' +
    '<div class="lab-loc">📍 ' + esc(lab.city) + ', ' + esc(lab.country) + (independentVerified(lab) ? ' · <span style="color:#10b981;font-weight:700">Third-Party Independent</span>' : '') + '</div>' +
    '<p style="font-size:.86rem;color:var(--muted);line-height:1.5;margin:0 0 12px">' + esc(lab.description) + '</p>' +
    exhibitorTags.block(exhibitorTags.forSlug(String(lab.id || '').replace(/^lab:/, '')), { claim: true }) +
    accredHtml +
    '<table class="cap-table"><tbody>' + capRows + '</tbody></table>' +
    '<div class="card-foot">' +
      '<span style="font-size:.74rem;color:var(--muted)">Reviewed: ' + esc(lab.last_verified || '2026') + '</span>' +
      '<div style="display:flex;gap:6px">' +
        (webUrl ? '<a href="' + webUrl + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Website ↗</a>' : '') +
        '<a href="rfq.html?company=' + encodeURIComponent(lab.name || '') + '&service=testing" class="btn btn-amber btn-sm">Inquire →</a>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function render() {
  const uniqueCountries = [...new Set(LABS.map(l => l.country).filter(Boolean))].sort();
  const maxVoltage = Math.max.apply(null, LABS.map(l => (typeof l.max_voltage_kv === 'number' ? l.max_voltage_kv : 0)));
  const accreditedCount = LABS.filter(accreditationVerified).length;
  const independentCount = LABS.filter(independentVerified).length;

  const countryOptions = uniqueCountries.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('\n        ');
  const initialCardsHtml = LABS.map(renderCardServer).join('');
  const labsJson = JSON.stringify(LABS.map(function (lab) {
    const slug = labSlug(lab);
    const copy = Object.assign({}, lab);
    const id = tpmFor(slug);
    if (id) copy.permanent_id = id;
    return copy;
  }));

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Independent Transformer Testing Laboratories Directory | TransformerPath</title>
<meta name="description" content="Directory of transformer testing and laboratory listings. Voltage, short-circuit capability and ISO/IEC 17025 accreditation are shown only when a source records them.">
<link rel="canonical" href="https://transformerpath.com/laboratories.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Independent Transformer Testing Laboratories Directory | TransformerPath">
<meta property="og:description" content="Transformer testing and laboratory listings. Ratings and ISO/IEC 17025 accreditation appear only when a source records them.">
<meta property="og:url" content="https://transformerpath.com/laboratories.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=${CSSV}">
<link rel="stylesheet" href="tp-nav.css?v=15">
<link rel="stylesheet" href="tp-feedback.css?v=13">
<style>
.lab-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.lab-head { margin-bottom: 24px; }
.lab-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; overflow-wrap: anywhere; }
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
.kv-pill { background: rgba(245,166,35,.12); border: 1px solid var(--accent); color: var(--accent); font-size: .78rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.kv-pill.uhv { background: rgba(239,68,68,.15); border-color: #ef4444; color: #f87171; }
.kv-pill.kv-unstated { background: transparent; border-color: var(--border); color: var(--muted); font-weight: 700; }

.cap-table { width: 100%; border-collapse: collapse; font-size: .84rem; margin: 12px 0 16px; }
.cap-table td { padding: 5px 6px; border-bottom: 1px solid var(--border); }
.cap-table .c-name { color: var(--text); }
.cap-table .c-status { text-align: right; font-weight: 800; }
.c-yes { color: #10b981; }
.c-no { color: var(--muted); opacity: .4; }
.c-unknown { color: var(--muted); font-weight: 700; }

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
    <p class="lead">Directory of transformer testing, monitoring and laboratory listings. Voltage, short-circuit capability and ISO/IEC 17025 accreditation are shown only when a source records them. <a href="/knowledge/standard-transformer-oil-tests.html">Standard transformer oil tests</a> explains what each routine oil test is for and what the results indicate.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statLabCount">${LABS.length}</div>
      <div class="lbl">Laboratories Listed</div>
    </div>
    <div class="stat-box">
      <div class="num">${maxVoltage.toLocaleString()} kV</div>
      <div class="lbl">Peak Test Voltage</div>
    </div>
    <div class="stat-box">
      <div class="num">${accreditedCount} of ${LABS.length}</div>
      <div class="lbl">ISO/IEC 17025 verified</div>
    </div>
    <div class="stat-box">
      <div class="num">${independentCount} of ${LABS.length}</div>
      <div class="lbl">Third-party independent verified</div>
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
        ${countryOptions}
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
        <span class="cap-toggle" data-cap="dielectric_withstand">⚡ Power-Frequency Dielectric</span>
        <span class="cap-toggle" data-cap="oil_testing">🛢️ Oil &amp; DGA Analysis</span>
        <span class="cap-toggle" data-cap="materials_testing">🧪 Insulation &amp; Materials</span>
        <span class="cap-toggle" data-cap="sfra">📈 SFRA Frequency Response</span>
      </div>
    </div>
  </div>

  <div class="lab-grid" id="labGrid">${initialCardsHtml}</div>

  <div style="background:linear-gradient(135deg, rgba(245,166,35,.10) 0%, rgba(20,37,61,.30) 100%);border:1px solid var(--accent);border-radius:14px;padding:26px;text-align:center;margin-top:40px">
    <h3 style="color:var(--ink);margin:0 0 8px">Need Independent Laboratory Testing or Third-Party Witnessing?</h3>
    <p style="color:var(--muted);font-size:.92rem;max-width:640px;margin:0 auto 16px">TransformerPath assists utilities, grid operators and OEMs in coordinating type-testing slots, specialized impulse testing, and short-circuit withstand verification with independent accredited laboratories.</p>
    <a href="rfq.html?type=testing" class="btn btn-amber">Inquire for Laboratory Testing &rarr;</a>
  </div>
</main>

${FOOT}

${eventBadges.mountHtml()}<script>
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

function scopeUnsourced(lab) {
  var sc = String(lab.short_circuit_capacity || '');
  var scope = String((lab.accreditation && lab.accreditation.scope) || '');
  return /not restated/i.test(sc) || /as published on the laboratory website/i.test(scope);
}

function capClaim(lab, k) {
  if (scopeUnsourced(lab)) return 'unknown';
  var raw = lab.capabilities ? lab.capabilities[k] : undefined;
  if (raw === true) return 'yes';
  if (raw === false) return 'no';
  return 'unknown';
}

function voltagePill(lab) {
  var kv = lab.max_voltage_kv;
  if (typeof kv !== 'number' || !isFinite(kv)) return '';
  var isUhv = kv >= 765;
  return '<span class="kv-pill' + (isUhv ? ' uhv' : '') + '">' + esc(kv) + ' kV Peak</span>';
}

function renderCards() {
  var grid = document.getElementById('labGrid');
  var hits = LABS.filter(function(lab) {
    if (minVoltage > 0 && (typeof lab.max_voltage_kv !== 'number' || lab.max_voltage_kv < minVoltage)) return false;
    if (selectedCountry && lab.country !== selectedCountry) return false;
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      var accredScope = (lab.accreditation && lab.accreditation.scope) ? lab.accreditation.scope : '';
      var text = (lab.name + ' ' + lab.city + ' ' + lab.country + ' ' + lab.description + ' ' + accredScope).toLowerCase();
      if (text.indexOf(q) < 0) return false;
    }
    for (var cap in requiredCaps) {
      if (requiredCaps[cap] && capClaim(lab, cap) !== 'yes') return false;
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
      var claim = capClaim(lab, k);
      var cell = claim === 'yes'
        ? 'c-yes"><span class="cmp-yes">✓ Yes</span>'
        : (claim === 'no' ? 'c-no"><span class="sub-l">—</span>' : 'c-unknown"><span class="sub-l">Not stated</span>');
      return '<tr><td class="c-name">' + esc(CAP_NAMES[k]) + '</td><td class="c-status ' + cell + '</td></tr>';
    }).join('');

    var webUrl = safeUrl(lab.website);

    var accredHtml = '';
    if (lab.accreditation) {
      var std = esc(lab.accreditation.standard || 'ISO/IEC 17025');
      var body = lab.accreditation.body ? ' (' + esc(lab.accreditation.body) + ')' : '';
      var scope = lab.accreditation.scope ? '<div style="font-size:.76rem;margin-top:4px"><b>Scope:</b> ' + esc(lab.accreditation.scope) + '</div>' : '';
      accredHtml = '<div class="accred-box">' +
        '<div><b>Accreditation:</b> <span style="color:var(--accent);font-weight:700">' + std + '</span>' + body + '</div>' +
        scope +
        (lab.short_circuit_capacity ? '<div style="font-size:.76rem;margin-top:4px;color:var(--text)"><b>Short-Circuit:</b> ' + esc(lab.short_circuit_capacity) + '</div>' : '') +
      '</div>';
    } else if (lab.short_circuit_capacity) {
      accredHtml = '<div class="accred-box"><div style="font-size:.76rem;color:var(--text)"><b>Short-Circuit:</b> ' + esc(lab.short_circuit_capacity) + '</div></div>';
    }
    if (lab.public_record && lab.public_record.card_note) {
      accredHtml += '<div class="accred-box"><div style="font-size:.76rem"><b>Published accreditation:</b> ' + esc(lab.public_record.card_note) + '</div></div>';
    }

    var labSlug = String(lab.id || '').replace(/^lab:/, '');
    var eventBadge = (typeof TPEventBadges !== 'undefined' && TPEventBadges.htmlFor) ? TPEventBadges.htmlFor({ slug: labSlug, name: lab.name }) : '';
    var nameHtml = lab.profile_page ? '<a href="/laboratories/' + esc(labSlug) + '/">' + esc(lab.name) + '</a>' : '<span>' + esc(lab.name) + '</span>';
    var tpmHtml = lab.permanent_id ? '<p style="margin:4px 0 8px;font-size:.78rem;color:var(--muted)">Permanent company ID ' + esc(lab.permanent_id) + '</p>' : '';
    return '<div class="lab-card" style="box-shadow:0 4px 18px rgba(0,0,0,.12)">' +
      '<div class="lab-top">' +
        '<h2 class="lab-name" style="font-size:1.28rem">' + nameHtml + (eventBadge ? ' ' + eventBadge : '') + '</h2>' +
        tpmHtml +
        voltagePill(lab) +
      '</div>' +
      '<div class="lab-loc">📍 ' + esc(lab.city) + ', ' + esc(lab.country) + (!scopeUnsourced(lab) && lab.third_party_independent ? ' · <span style="color:#10b981;font-weight:700">Third-Party Independent</span>' : '') + '</div>' +
      '<p style="font-size:.86rem;color:var(--muted);line-height:1.5;margin:0 0 12px">' + esc(lab.description) + '</p>' +
      accredHtml +
      '<table class="cap-table"><tbody>' + capRows + '</tbody></table>' +
      '<div class="card-foot">' +
        '<span style="font-size:.74rem;color:var(--muted)">Reviewed: ' + esc(lab.last_verified || '2026') + '</span>' +
        '<div style="display:flex;gap:6px">' +
          (webUrl ? '<a href="' + webUrl + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Website ↗</a>' : '') +
          '<a href="rfq.html?company=' + encodeURIComponent(lab.name || '') + '&service=testing" class="btn btn-amber btn-sm">Inquire →</a>' +
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
</script>
<script src="analytics.js" defer></script>
</body>
</html>`;

  fs.writeFileSync('laboratories.html', html);
  console.log('build-laboratories.js wrote laboratories.html with', LABS.length, 'records (SSR + dynamic stats + client esc)');
  LABS.filter(function (lab) { return lab.profile_page; }).forEach(function (lab) {
    const slug = labSlug(lab);
    const url = 'https://transformerpath.com/laboratories/' + slug + '/';
    const id = tpmFor(slug);
    const badge = eventBadges.htmlFor({ slug: slug, name: lab.name });
    const htmlPage = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>' + esc(lab.name) + ' — Unclaimed laboratory listing | TransformerPath</title>' +
      '<meta name="description" content="' + esc((lab.description || lab.name).slice(0, 180)) + '">' +
      '<link rel="canonical" href="' + url + '">' +
      '<meta name="robots" content="' + listingRichness.robots(listingRichness.stubProfileIndexable()) + '">' +
      '<link rel="stylesheet" href="../../style.css?v=' + CSSV + '"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
      '</head><body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap" style="max-width:900px;margin:0 auto;padding:44px 20px 88px">' +
      '<nav style="font-size:.8rem;color:var(--muted)"><a href="../../laboratories.html">Laboratories</a> › ' + esc(lab.name) + '</nav>' +
      '<h1>' + esc(lab.name) + (badge ? ' ' + badge : '') + '</h1>' +
      (id ? '<p style="font-size:.82rem;color:var(--muted)">Permanent company ID <span data-copy-id="' + esc(id) + '">' + esc(id) + '</span> <span style="opacity:.75">(stable directory identity — not a certification)</span></p>' : '') +
      profileRecord(lab) +
      '</main>\n' + FOOT + '\n' + (badge ? eventBadges.deferScript() : '') + '</body></html>\n';
    fs.mkdirSync('laboratories/' + slug, { recursive: true });
    fs.writeFileSync('laboratories/' + slug + '/index.html', htmlPage);
  });
}

render();
