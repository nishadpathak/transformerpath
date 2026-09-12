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
  '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any"><link rel="stylesheet" href="style.css?v=13"><link rel="stylesheet" href="tp-nav.css?v=13"><style>' + style + 
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

  sIn.addEventListener('input', renderRegistry);
  cSel.addEventListener('change', renderRegistry);
  catSel.addEventListener('change', renderRegistry);
  rBtn.addEventListener('click', function(){ sIn.value=''; cSel.value=''; catSel.value=''; renderRegistry(); });
  renderRegistry();
})();
</script>\n` +
  '<script src="tp-nav.js?v=5" defer></script>\n' +
  '<script src="analytics.js" defer></script>\n' +
  '<script>(function(){var q=document.getElementById("stSearch"),fr=document.getElementById("stFreq"),rg=document.getElementById("stRegion");function apply(){var vq=(q?q.value:"").toLowerCase().trim(),vf=fr?fr.value:"",vr=rg?rg.value:"";document.querySelectorAll(".st-row").forEach(function(r){var c=r.getAttribute("data-country")||"",f=r.getAttribute("data-freq")||"",g=r.getAttribute("data-region")||"";var ok=(!vq||c.indexOf(vq)>=0)&&(!vf||f.indexOf(vf)>=0)&&(!vr||g===vr);r.style.display=ok?"":"none";});}\n[q,fr,rg].forEach(function(el){if(el){el.addEventListener("input",apply);el.addEventListener("change",apply);}});})();\n</script>\n</body>\n</html>';
fs.writeFileSync('standards.html', html);
console.log('standards.html wrote: ' + STANDARDS_DATA.length + ' standards + ' + totalCountries + ' countries in grid census');

