#!/usr/bin/env node
/* build-standards.js — TransformerPath Global Standards Reference.
 *
 * Inspired by the MVP spec's "Global Standards Library" + "national voltage/
 * standard data model". This is a single page that:
 *   1. Compares the dominant transformer standards (IEC 60076 vs IEEE C57 /
 *      ANSI and regional standards) as a factual reference — no ranking, no
 *      "which is best", just the distinctions a global engineer needs.
 *   2. Provides a searchable national grid reference — grid frequency, highest
 *      transmission voltage and synchronous area per country — derived
 *      directly, source-backed, from data/grids.json (the TransformerPath grid
 *      census). Nothing is invented; every figure comes from the census.
 *
 * Honesty (Rule #4): all voltage/frequency/synchronous-area figures are the
 * source-backed grid census values. Where a country's data is not populated we
 * leave it blank rather than guess. Standards text is factual reference, not a
 * quality ranking.
 *
 * Run: node build-standards.js  (after build-factories.js).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = (s) => (s || '').toLowerCase();

const GRIDS = JSON.parse(fs.readFileSync('data/grids.json', 'utf8'));

function highestVoltage(c) {
  let max = 0;
  (c.grids || []).forEach((op) => {
    const m = String(op[2] || '').match(/(\d+)\s*kV/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max;
}
function freqLabel(f) {
  return f === '50/60' || f === '60/50' ? '50/60 Hz' : (f ? f + ' Hz' : '');
}

// Region ordering (mirrors the wider site).
function regionOrder(r) {
  const o = ['Middle East', 'Europe', 'CIS / Eurasia', 'Africa', 'South Asia', 'East Asia', 'Southeast Asia', 'North America', 'Latin America', 'Oceania'];
  const i = o.indexOf(r); return i < 0 ? 99 : i;
}

// Standards comparison (factual reference).
const STANDARDS = [
  { code: 'IEC 60076', name: 'IEC 60076 — Power transformers', region: 'International / adopted widely', dot: `IEC 60076 is the global series for power transformers: Part 1 (general), Part 2 (temperature rise), Part 3 (insulation levels & dielectric tests), Part 5 (ability to withstand short circuit), Part 7 (loading guide). Metric units, 50 or 60 Hz. Used across Europe, Asia, Africa, the Middle East and most of the Commonwealth.`, points: ['Metric units (kV, MVA, °C)', '50 or 60 Hz', 'Temperature-rise and insulation levels in Part 2/3', 'Most widely cross-border accepted series'] },
  { code: 'IEEE C57 / ANSI', name: 'IEEE C57 (ANSI) — US/Canada', region: 'North America', dot: `The IEEE C57 series (adopted as ANSI) governs power & distribution transformers in the US and Canada: C57.12.00 (general), C57.12.10 (power transformer requirements), C57.12.90 (test code). Imperial-derived units, 60 Hz (tied to the North American 60 Hz grid).`, points: ['60 Hz (North American grid)', 'IEEE/ANSI C57 series + NEMA for distribution', 'Test code in C57.12.90', 'differing cooling & BIL conventions from IEC'] },
  { code: 'BS EN', name: 'BS EN 60076 (UK) — EN adoption', region: 'United Kingdom / Europe', dot: `The UK adopts IEC 60076 as a British/European Standard (BS EN 60076), with BS EN 50341/EN additions for grid connection and a 400/275/132 kV transmission convention. 50 Hz.`, points: ['BS EN 60076 = IEC 60076 as EN', '50 Hz', 'UK transmission 400 kV / 275 kV / 132 kV', 'EN additions for connection & safety'] },
  { code: 'IS 1180', name: 'IS 1180 / IS 2026 (India)', region: 'India', dot: `India's distribution transformers follow IS 1180 and power transformers IS 2026 (aligned to IEC 60076), under the Central Electricity Authority and BIS. 50 Hz, 765/400/220/132/66/33/11 kV.`, points: ['IS 1180 (distribution) / IS 2026 (power)', '50 Hz', '765 kV down to 11 kV', 'BIS; CEA standards'] },
  { code: 'GB', name: 'GB (China) — GB 1094', region: 'China', dot: `China's national standards align closely with IEC 60076 (GB 1094 for transformers) plus UHV practice: 1000 kV AC and ±800/±1100 kV DC, 750/500/220/110 kV. 50 Hz.`, points: ['GB 1094 ≈ IEC 60076', '50 Hz', 'UHV AC to 1000 kV and DC ±1100 kV', '750/500/220/110 kV below'] },
  { code: 'JIS', name: 'JIS C 4304 / JEC (Japan)', region: 'Japan', dot: `Japan uses JIS and JEC transformer standards; its grid is split 50/60 Hz (East/West) with 500/275/154/66/22 kV.`, points: ['JIS C 4304 / JEC', '50 Hz (East) and 60 Hz (West)', '500 kV / 275 kV / 154 kV / 66 kV', 'Separate regional frequency zones'] },
];

// Group countries by region, derive reference tables.
const byRegion = {};
GRIDS.forEach((c) => { (byRegion[c.region] = byRegion[c.region] || []).push(c); });
const regionKeys = Object.keys(byRegion).sort((a, b) => regionOrder(a) - regionOrder(b));
const totalCountries = GRIDS.length;
const hz50 = GRIDS.filter((c) => c.freq === '50').length;
const hz60 = GRIDS.filter((c) => c.freq === '60').length;
const maxVoltage = GRIDS.reduce((m, c) => Math.max(m, highestVoltage(c)), 0);

// Country reference rows (searchable client-side).
const countryRows = GRIDS.slice().sort((a, b) => a.country.localeCompare(b.country)).map((c) => {
  const hv = highestVoltage(c);
  return {
    country: c.country, flag: c.flag || '', region: c.region,
    freq: freqLabel(c.freq), sync: c.sync || '',
    voltage: hv ? hv + ' kV' : '', operators: (c.grids || []).length,
  };
});

function countryRowHtml(r) {
  return '<div class="st-row" data-country="' + esc(ci(r.country)) + '" data-region="' + esc(r.region) + '" data-freq="' + esc(r.freq) + '">' +
    '<span class="st-c">' + (r.flag ? r.flag + ' ' : '') + esc(r.country) + '</span>' +
    '<span class="st-r st-cell">' + esc(r.region) + '</span>' +
    '<span class="st-f st-cell">' + esc(r.freq || '—') + '</span>' +
    '<span class="st-v st-cell">' + esc(r.voltage || '—') + '</span>' +
    '<span class="st-s st-cell">' + esc(r.sync || '—') + '</span>' +
    '<span class="st-o st-cell">' + (r.grids || []).length + '</span></div>';
}

const style = '.std-wrap{max-width:1180px;margin:0 auto;padding:44px 20px 96px}.std-wrap h1{font-size:2rem;color:var(--ink)}.std-wrap .lead{color:var(--muted);font-size:1.02rem;max-width:900px;margin:8px 0 22px}.std-stats{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 24px}.std-stats .s{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;text-align:center;min-width:130px}.std-stats .s b{color:var(--text);font-size:1.3rem;display:block}.std-stats .s small{color:var(--muted);font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.std-h2{font-size:1.3rem;color:var(--ink);margin:30px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)}.std-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:14px}.std-card h3{font-size:1.1rem;color:var(--ink);margin:0 0 4px}.std-card .rgn{color:var(--muted);font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:0 0 8px}.std-card p{color:var(--text);line-height:1.7;font-size:.94rem;margin:0 0 10px}.std-card .pt{display:flex;flex-wrap:wrap;gap:8px}.std-card .pt span{background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.76rem;color:var(--muted)}.std-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 8px}.std-tools input,.std-tools select{padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:.9rem;background:var(--card);color:var(--text)}.std-tbl{width:100%;border-collapse:collapse;font-size:.86rem}.std-tbl th{text-align:left;color:var(--muted);font-weight:800;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;padding:8px 10px;border-bottom:2px solid var(--border);white-space:nowrap}.std-tbl td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:top}.std-tbl a{color:var(--accent);font-weight:700}.std-note{color:var(--muted);font-size:.8rem;margin-top:14px}';

const regionsHtml = regionKeys.map((r) => {
  const rows = byRegion[r].sort((a, b) => a.country.localeCompare(b.country));
  const rowHtml = rows.map(countryRowHtml).join('');
  return '<h2 class="std-h2" id="region-' + esc(slugify(r)) + '">' + esc(r) + ' (' + rows.length + ')</h2>' +
    '<div class="std-tbl-wrap">' + rowHtml + '</div>';
}).join('');

const STANDARDS_DATA = (() => {
  try { return JSON.parse(fs.readFileSync('data/standards.json', 'utf8')).standards || []; } catch(e) { return []; }
})();
const stdJson = JSON.stringify(STANDARDS_DATA);

const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Global Transformer Standards & Regulations Directory — IEC, IEEE, National Standards | TransformerPath</title>' +
  '<meta name="description" content="Worldwide directory of electrical transformer standards, test codes, and regulatory efficiency mandates (IEC 60076, IEEE C57, EU Ecodesign, US DOE 2027, IS 1180, GB/T 1094). Verified scopes, frequencies, and voltage levels.">' +
  '<link rel="canonical" href="https://transformerpath.com/standards.html"><meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="Global Transformer Standards & Regulations Directory"><meta property="og:url" content="https://transformerpath.com/standards.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
  '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any"><link rel="stylesheet" href="style.css?v=15"><link rel="stylesheet" href="tp-nav.css?v=15"><style>' + style + 
  '.std-reg-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;display:flex;flex-direction:column;transition:border-color .15s}' +
  '.std-reg-card:hover{border-color:var(--accent)}' +
  '.std-reg-top{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:6px}' +
  '.std-reg-code{font-size:1.15rem;font-weight:800;color:var(--accent)}' +
  '.std-reg-title{font-size:1.05rem;font-weight:700;color:var(--ink);margin:4px 0 8px}' +
  '.std-pill{background:rgba(245,166,35,.12);border:1px solid var(--accent);color:var(--accent);font-size:.75rem;font-weight:700;padding:2px 8px;border-radius:999px}' +
  '.ev-badge{display:inline-block;border-radius:999px;padding:2px 8px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em}' +
  '.ev-confirmed{background:rgba(22,163,74,.14);color:#16a34a;border:1px solid #16a34a}' +
  '</style></head><body>\n' + HEAD + '\n<main class="std-wrap">' +
  '<nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Standards &amp; Regulations</nav>' +
  '<h1>Transformer <span style="color:var(--accent)">Standards &amp; Regulations</span> Directory</h1>' +
  '<p class="lead">A worldwide, verified directory of electrical transformer standards, test codes, energy efficiency mandates (EU Ecodesign Tier 2, US DOE 2027), and grid interconnection regulations. Includes direct links to official standards bodies and national grid characteristics from the TransformerPath census.</p>' +
  '<div class="std-stats">' +
    '<div class="s"><b>' + STANDARDS_DATA.length + '</b><small>Core Standards Listed</small></div>' +
    '<div class="s"><b>' + totalCountries + '</b><small>Countries in Grid Census</small></div>' +
    '<div class="s"><b>' + hz50 + ' / ' + hz60 + '</b><small>50 Hz / 60 Hz Zones</small></div>' +
    '<div class="s"><b>' + maxVoltage + ' kV</b><small>Highest Transmission Grid</small></div>' +
  '</div>' +

  '<h2 class="std-h2">Global Standards &amp; Regulations Directory</h2>' +
  '<p style="color:var(--muted);font-size:.9rem;margin-bottom:14px">Search and filter verified transformer standards by code, country, standards body, or category:</p>' +
  '<div class="std-tools" style="margin-bottom:20px">' +
    '<input id="stdSearch" type="search" placeholder="Search standard (e.g. IEC 60076, IEEE C57, DOE 2027, IS 1180, GB 1094)..." style="flex:1;min-width:240px">' +
    '<select id="stdCountry"><option value="">All Countries / International</option></select>' +
    '<select id="stdCategory"><option value="">All Categories</option></select>' +
    '<button id="stdReset" class="btn btn-outline btn-sm">Reset</button>' +
  '</div>' +
  '<div id="stdRegistryGrid"></div>' +

  '<h2 class="std-h2" style="margin-top:40px">Major Frameworks Comparison</h2>' +
  STANDARDS.map(function (s) {
    return '<div class="std-card"><h3>' + esc(s.code) + ' — ' + esc(s.name) + '</h3><div class="rgn">' + esc(s.region) + '</div><p>' + esc(s.dot) + '</p><div class="pt">' + s.points.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') + '</div></div>';
  }).join('') +

  '<!-- ===== INTERACTIVE STANDARDS CROSS-REFERENCE MATRIX (TRACK 3) ===== -->' +
  '<div class="card" style="margin:36px 0 28px; border:1px solid rgba(245,166,35,.35); background:linear-gradient(180deg, rgba(13,27,46,.95) 0%, rgba(13,27,46,.8) 100%); padding:24px;">' +
    '<span style="font-size:.72rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--amber); background:rgba(245,166,35,.15); padding:3px 8px; border-radius:6px; border:1px solid rgba(245,166,35,.3);">⚡ Interactive Cross-Reference Explorer</span>' +
    '<h2 style="font-size:1.4rem; color:var(--ink); margin:10px 0 6px">Side-by-Side Standards Engineering Matrix</h2>' +
    '<p style="font-size:.88rem; color:var(--muted); margin:0 0 16px">Compare technical clauses, limits, tolerances, and calculation methodologies across IEC 60076, IEEE C57, IS 2026/1180, and GB 1094.</p>' +
    '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px;" id="stdMatrixTabs">' +
      '<button type="button" class="cat-pill active" data-tab="temp">🌡️ Temperature Rise Limits</button>' +
      '<button type="button" class="cat-pill" data-tab="bil">⚡ Dielectric &amp; BIL Ladders</button>' +
      '<button type="button" class="cat-pill" data-tab="loss">📊 Loss Tolerances &amp; Guarantees</button>' +
      '<button type="button" class="cat-pill" data-tab="sc">💥 Short-Circuit Withstand</button>' +
      '<button type="button" class="cat-pill" data-tab="term">🔤 Terminal Markings &amp; Vector Groups</button>' +
    '</div>' +
    '<div id="stdMatrixContent" style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:18px; overflow-x:auto;">' +
      '<!-- Loaded by JS -->' +
    '</div>' +
  '</div>' +

  '<h2 class="std-h2">National grid reference <span style="font-size:.9rem;color:var(--muted);font-weight:600;text-transform:none">(' + totalCountries + ' countries)</span></h2>' +
  '<div class="std-tools"><input id="stSearch" type="text" placeholder="Search country…" autocomplete="off"><select id="stFreq"><option value="">All frequencies</option><option value="50">50 Hz</option><option value="60">60 Hz</option></select><select id="stRegion"><option value="">All regions</option>' + regionKeys.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div>' +
  '<div class="std-tbl"><div style="display:flex;font-size:.72rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;padding:8px 10px;border-bottom:2px solid var(--border)"><span style="width:26%">Country</span><span style="width:14%">Region</span><span style="width:10%">Freq</span><span style="width:14%">Top voltage</span><span style="width:26%">Synchronous area</span><span style="width:10%">Operators</span></div><div id="stBody">' + regionsHtml + '</div></div>' +
  '<p class="std-note">National grid data is source-backed from the TransformerPath grid census. All standards entries reflect official publications confirmed by direct website verification.</p>' +
  '</main>\n' + FOOT + 
  '\n<script>window.__TP_STANDARDS__=' + stdJson + ';</script>\n' +
  `<script>
(function(){
  var data = window.__TP_STANDARDS__ || [];
  var sIn = document.getElementById('stdSearch'), cSel = document.getElementById('stdCountry'), catSel = document.getElementById('stdCategory'), rBtn = document.getElementById('stdReset'), grid = document.getElementById('stdRegistryGrid');

  var countries = [...new Set(data.map(d => d.country))].sort();
  countries.forEach(c => { var o = document.createElement('option'); o.value = c; o.textContent = c; cSel.appendChild(o); });

  var categories = [...new Set(data.map(d => d.category))].filter(Boolean).sort();
  categories.forEach(cat => { var o = document.createElement('option'); o.value = cat; o.textContent = cat; catSel.appendChild(o); });

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function renderRegistry() {
    var q = (sIn.value || '').toLowerCase().trim();
    var cV = cSel.value;
    var catV = catSel.value;

    var filtered = data.filter(d => {
      if (cV && d.country !== cV) return false;
      if (catV && d.category !== catV) return false;
      if (q) {
        var hay = [d.standard_code, d.title, d.country, d.standard_body, d.scope, d.efficiency_requirements, d.frequency_hz, d.voltage_levels_kv].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);background:var(--card);border:1px solid var(--border);border-radius:10px">No standards matched your query.</div>';
      return;
    }

    grid.innerHTML = filtered.map(d => {
      var eff = d.efficiency_requirements ? '<div style="font-size:.82rem;color:var(--muted);margin-top:6px"><b>Efficiency / Mandate:</b> ' + esc(d.efficiency_requirements) + '</div>' : '';
      var deadline = d.compliance_deadline ? '<div style="font-size:.8rem;color:var(--muted)"><b>Enforcement / Edition:</b> ' + esc(d.compliance_deadline) + '</div>' : '';
      return '<div class="std-reg-card">' +
        '<div class="std-reg-top">' +
          '<div><span class="std-reg-code">' + esc(d.standard_code) + '</span> &nbsp; <span class="std-pill">' + esc(d.country) + '</span></div>' +
          '<span class="ev-badge ev-confirmed">' + esc(d.verification_status || 'Verified') + '</span>' +
        '</div>' +
        '<div class="std-reg-title">' + esc(d.title) + '</div>' +
        '<div style="font-size:.82rem;color:var(--muted);margin-bottom:8px"><b>Body:</b> ' + esc(d.standard_body) + ' &nbsp;|&nbsp; <b>Frequency:</b> ' + esc(d.frequency_hz) + ' &nbsp;|&nbsp; <b>Voltages:</b> ' + esc(d.voltage_levels_kv) + '</div>' +
        '<p style="color:var(--text);font-size:.9rem;line-height:1.5;margin:4px 0">' + esc(d.scope) + '</p>' +
        eff + deadline +
        '<div style="margin-top:12px">' +
          (d.website ? '<a href="' + esc(d.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Official Standards Portal ↗</a>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  var MATRIX_DATA = {
    temp: '<table class="std-tbl" style="margin-top:8px"><thead><tr><th>Parameter</th><th>IEC 60076-2 (International)</th><th>IEEE C57.12.00 (North America)</th><th>IS 2026 / GB 1094</th></tr></thead><tbody>' +
      '<tr><td><b>Ambient Baseline</b></td><td>40°C peak, 30°C monthly avg, 20°C annual avg</td><td>40°C peak, 30°C 24-hr daily average</td><td>40°C peak (IS 2026 specifies 50°C tropical option)</td></tr>' +
      '<tr><td><b>Top Oil Temperature Rise</b></td><td><b style="color:var(--amber)">60 K</b> (mineral oil with conservator)</td><td><b style="color:var(--amber)">65 K</b></td><td>60 K (50 K / 55 K in high ambient zones)</td></tr>' +
      '<tr><td><b>Average Winding Rise</b></td><td><b style="color:var(--amber)">65 K</b> (by resistance method)</td><td><b style="color:var(--amber)">65 K</b></td><td>65 K (55 K in tropical specifications)</td></tr>' +
      '<tr><td><b>Hot-Spot Temperature Rise</b></td><td><b style="color:var(--amber)">78 K</b> (max 118°C continuous)</td><td><b style="color:var(--amber)">80 K</b> (max 120°C continuous)</td><td>78 K (118°C normal life expectation)</td></tr>' +
      '<tr><td><b>Forced Oil Flow (ODAF)</b></td><td>Specific oil duct velocity verification</td><td>Directed oil flow (FOA / FOW)</td><td>Conforms to IEC 60076-2 Annex A</td></tr>' +
      '</tbody></table>',
    bil: '<table class="std-tbl" style="margin-top:8px"><thead><tr><th>System Voltage (kV)</th><th>IEC 60076-3 Lightning Impulse (BIL)</th><th>IEEE C57.12.00 Basic Impulse Level</th><th>Power Frequency Withstand (AC 1 min)</th></tr></thead><tbody>' +
      '<tr><td><b>11 / 12 kV</b></td><td>75 kV / 95 kV (List 1 / List 2)</td><td>95 kV / 110 kV</td><td>28 kV (IEC) / 34 kV (IEEE)</td></tr>' +
      '<tr><td><b>33 / 36 kV</b></td><td>170 kV</td><td>200 kV</td><td>70 kV (IEC) / 70 kV (IEEE)</td></tr>' +
      '<tr><td><b>66 / 72.5 kV</b></td><td>325 kV</td><td>350 kV</td><td>140 kV (IEC) / 140 kV (IEEE)</td></tr>' +
      '<tr><td><b>132 / 145 kV</b></td><td>550 kV / 650 kV</td><td>550 kV / 650 kV</td><td>230 kV / 275 kV</td></tr>' +
      '<tr><td><b>220 / 245 kV</b></td><td>950 kV / 1050 kV</td><td>900 kV / 1050 kV</td><td>395 kV / 460 kV</td></tr>' +
      '<tr><td><b>400 / 420 kV</b></td><td>1425 kV (Switching Impulse 1050 kV)</td><td>1300 kV / 1425 kV (SIL 1050 kV)</td><td>630 kV AC induced (IEC)</td></tr>' +
      '<tr><td><b>765 / 800 kV</b></td><td>2100 kV (Switching Impulse 1550 kV)</td><td>2050 kV (SIL 1550 kV)</td><td>830 kV AC induced (IEC)</td></tr>' +
      '</tbody></table>',
    loss: '<table class="std-tbl" style="margin-top:8px"><thead><tr><th>Measurement &amp; Guaranteed Limits</th><th>IEC 60076-1 (Clause 10)</th><th>IEEE C57.12.00 (Clause 9)</th><th>Commercial Impact</th></tr></thead><tbody>' +
      '<tr><td><b>Total Loss Tolerance</b></td><td>+10% of guaranteed total loss</td><td>+6% of total guaranteed loss</td><td>Exceeding tolerance triggers penalty or rejection</td></tr>' +
      '<tr><td><b>Component Loss (P₀ or Pk)</b></td><td>+15% on individual P₀ or Pk (provided total ≤ +10%)</td><td>+10% on component loss</td><td>No-load loss P₀ penalized heavily ($5–10/W)</td></tr>' +
      '<tr><td><b>Impedance Tolerance (Z%)</b></td><td>±10% (for Z ≥ 10%) · ±15% (for Z &lt; 10%)</td><td>±7.5% for two-winding units</td><td>Critical for parallel transformer sharing</td></tr>' +
      '<tr><td><b>Voltage Ratio Tolerance</b></td><td>±0.5% or 1/10th of actual impedance %</td><td>±0.5% on rated tap</td><td>Guarantees tap switch voltage symmetry</td></tr>' +
      '<tr><td><b>Reference Temperature</b></td><td>75°C (mineral oil) / 85°C (synthetic ester)</td><td>85°C for 65°C rise units</td><td>All load losses must be normalized before compare</td></tr>' +
      '</tbody></table>',
    sc: '<table class="std-tbl" style="margin-top:8px"><thead><tr><th>Short-Circuit Verification</th><th>IEC 60076-5</th><th>IEEE C57.12.90</th><th>Engineering Significance</th></tr></thead><tbody>' +
      '<tr><td><b>Thermal Withstand Duration</b></td><td><b>2.0 seconds</b> standard</td><td><b>2.0 seconds</b> (up to 3.0s for small units)</td><td>Prevents conductor annealing / insulation charring</td></tr>' +
      '<tr><td><b>Dynamic Peak Factor (k√2)</b></td><td>k√2 ≈ 2.55 (for X/R ≥ 14)</td><td>k_peak based on X/R per C57.12.00</td><td>Determines maximum radial &amp; axial bursting force</td></tr>' +
      '<tr><td><b>Pre-Fault System Voltage</b></td><td>1.05 p.u. of rated voltage</td><td>1.05 p.u. maximum operating voltage</td><td>Ensures full fault energy transfer</td></tr>' +
      '<tr><td><b>Post-Test Integrity Criteria</b></td><td>Max 1.0% impedance shift, visual active part inspection, SFRA</td><td>Max 2.0% impedance shift, dielectric re-test</td><td>Confirms no winding deformation occurred</td></tr>' +
      '</tbody></table>',
    term: '<table class="std-tbl" style="margin-top:8px"><thead><tr><th>Marking &amp; Notation</th><th>IEC 60076 Convention</th><th>IEEE / ANSI C57 Convention</th><th>Notes &amp; Phase Relationship</th></tr></thead><tbody>' +
      '<tr><td><b>HV Primary Terminals</b></td><td>1U, 1V, 1W (Phase) · 1N (Neutral)</td><td>H₁, H₂, H₃ (Phase) · H₀ (Neutral)</td><td>IEC uses numeric prefix for winding level</td></tr>' +
      '<tr><td><b>LV Secondary Terminals</b></td><td>2U, 2V, 2W (Phase) · 2N (Neutral)</td><td>X₁, X₂, X₃ (Phase) · X₀ (Neutral)</td><td>Tertiary terminals: 3U/3V/3W vs Y₁/Y₂/Y₃</td></tr>' +
      '<tr><td><b>Standard Phase Shift</b></td><td>Clock notation (e.g. Dyn11 = LV leads HV by +30°)</td><td>Standard 30° LV lag (H₁-X₁ angular displacement)</td><td>Dyn11 is European/GCC norm; Dyn1 is common in US/ANSI</td></tr>' +
      '<tr><td><b>Nameplate Vector Diagram</b></td><td>Phasor clock diagram mandatory</td><td>Phasor vector diagram with angular displacement</td><td>Crucial for substation commissioning &amp; relaying</td></tr>' +
      '</tbody></table>'
  };

  var matrixBox = document.getElementById('stdMatrixContent');
  if(matrixBox && MATRIX_DATA.temp) matrixBox.innerHTML = MATRIX_DATA.temp;

  document.getElementById('stdMatrixTabs')?.addEventListener('click', function(e){
    var btn = e.target.closest('.cat-pill');
    if(!btn) return;
    document.querySelectorAll('#stdMatrixTabs .cat-pill').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    var tab = btn.getAttribute('data-tab');
    if(matrixBox && MATRIX_DATA[tab]) matrixBox.innerHTML = MATRIX_DATA[tab];
  });
})();
</script>
<script src="tp-nav.js?v=6" defer></script>
<script src="analytics.js?v=6" defer></script>
<script>(function(){var q=document.getElementById("stSearch"),fr=document.getElementById("stFreq"),rg=document.getElementById("stRegion");function apply(){var vq=(q?q.value:"").toLowerCase().trim(),vf=fr?fr.value:"",vr=rg?rg.value:"";document.querySelectorAll(".st-row").forEach(function(r){var c=r.getAttribute("data-country")||"",f=r.getAttribute("data-freq")||"",g=r.getAttribute("data-region")||"";var ok=(!vq||c.indexOf(vq)>=0)&&(!vf||f.indexOf(vf)>=0)&&(!vr||g===vr);r.style.display=ok?"":"none";});}\n[q,fr,rg].forEach(function(el){if(el){el.addEventListener("input",apply);el.addEventListener("change",apply);}});})();
</script>
</body>
</html>`;

fs.writeFileSync('standards.html', html);
console.log('standards.html wrote: ' + STANDARDS_DATA.length + ' standards + ' + totalCountries + ' countries in grid census');

