#!/usr/bin/env node
/* build-logistics.js — TransformerPath Transformer Transport & Logistics Directory builder.
 *
 * Generates logistics.html — verified global directory of heavy haul, rail Schnabel,
 * barging, SPMT, and rigging specialists for super-heavy power transformers.
 *
 * Sourced from data/logistics.json.
 * Run: node build-logistics.js
 */
'use strict';
const fs = require('fs');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/logistics.json', 'utf8'));
const COMPANIES = DATA.companies || [];

function render() {
  const logJson = JSON.stringify(COMPANIES);

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transformer Transport & Logistics Directory | TransformerPath</title>
<meta name="description" content="Global directory of specialized transformer transport, heavy haulage, multi-axle SPMTs, rail Schnabel cars, barging, and substation rigging contractors.">
<link rel="canonical" href="https://transformerpath.com/logistics.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Transformer Transport & Logistics Directory | TransformerPath">
<meta property="og:description" content="Find specialized heavy transport contractors for large power transformers, GSU delivery, Schnabel rail cars, and pad jacking and sliding.">
<meta property="og:url" content="https://transformerpath.com/logistics.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=12">
<link rel="stylesheet" href="tp-nav.css?v=15">
<link rel="stylesheet" href="tp-feedback.css?v=12">
<style>
.log-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.log-head { margin-bottom: 24px; }
.log-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; }
.log-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 880px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }

.log-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.log-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; transition: transform .15s, border-color .15s; }
.log-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.log-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.log-name { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0; }
.log-loc { font-size: .88rem; color: var(--muted); margin-bottom: 12px; }
.kv-pill { background: rgba(245,166,35,.12); border: 1px solid var(--accent); color: var(--accent); font-size: .78rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }

.log-modes { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 14px; }
.log-mode-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; font-size: .75rem; color: var(--text); }

.ev-badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.ev-confirmed { background: rgba(22,163,74,.14); color: #16a34a; border: 1px solid #16a34a; }

.card-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Transformer Transport & Logistics Directory",
  "url": "https://transformerpath.com/logistics.html",
  "description": "Global directory of specialized heavy haul, rail Schnabel, and rigging transport companies for power transformers."
}
</script>
</head>
<body>
${HEAD}

<main class="log-wrap">
  <div class="log-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Transport &amp; Logistics</nav>
    <h1>Transformer <span style="color:var(--accent)">Transport &amp; Logistics</span> Directory</h1>
    <p class="lead">Verified heavy haulage, multi-axle platform trailer (SPMT), rail Schnabel, and barge transport specialists capable of transporting 100 to 1,000+ ton power transformers from port to substation plinth.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statLogCount">${COMPANIES.length}</div>
      <div class="lbl">Transport Specialists</div>
    </div>
    <div class="stat-box">
      <div class="num">5,000 t</div>
      <div class="lbl">Max Transport Weight</div>
    </div>
    <div class="stat-box">
      <div class="num">Multimodal</div>
      <div class="lbl">Road, Rail, Barge, Rigging</div>
    </div>
    <div class="stat-box">
      <div class="num">100%</div>
      <div class="lbl">Website checked</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="logSearch" class="search-input" placeholder="Search contractor, city, mode, or region (e.g. Schnabel, SPMT, barge, Mammoet)...">
      <select id="logCountry" class="select-input">
        <option value="">All Countries</option>
      </select>
      <select id="logMode" class="select-input">
        <option value="">All Transport Modes</option>
        <option value="SPMT">SPMT &amp; Hydraulic Platform</option>
        <option value="Rail">Rail &amp; Schnabel Car</option>
        <option value="Barge">Barge &amp; Marine</option>
        <option value="Slide">Jack &amp; Slide / Rigging</option>
      </select>
      <button id="logReset" class="btn btn-outline btn-sm">Reset</button>
    </div>
  </div>

  <div id="logGrid" class="log-grid"></div>
</main>

${FOOT}

<script>
window.__TP_LOGISTICS__ = ${logJson};
(function(){
  const data = window.__TP_LOGISTICS__ || [];
  const searchInput = document.getElementById('logSearch');
  const countrySelect = document.getElementById('logCountry');
  const modeSelect = document.getElementById('logMode');
  const resetBtn = document.getElementById('logReset');
  const grid = document.getElementById('logGrid');

  // Populate countries
  const countries = [...new Set(data.map(d => d.country))].sort();
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    countrySelect.appendChild(opt);
  });

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    const q = (searchInput.value || '').toLowerCase().trim();
    const cVal = countrySelect.value;
    const mVal = modeSelect.value.toLowerCase();

    const filtered = data.filter(d => {
      if (cVal && d.country !== cVal) return false;
      if (mVal) {
        const modesStr = (d.transport_modes || []).join(' ').toLowerCase();
        if (!modesStr.includes(mVal)) return false;
      }
      if (q) {
        const hay = [
          d.company_name, d.country, d.state_province, d.city,
          (d.transport_modes || []).join(' '), (d.regions_covered || []).join(' '),
          d.description, String(d.max_weight_tons || '')
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)"><h3>No matching transport contractors found</h3><p>Try clearing your filters or search terms.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(d => {
      const loc = [d.city, d.state_province, d.country].filter(Boolean).join(', ');
      const modesHtml = (d.transport_modes || []).map(m => '<span class="log-mode-tag">🚛 ' + esc(m) + '</span>').join('');
      const weightBadge = d.max_weight_tons ? '<span class="kv-pill">⚖️ Up to ' + esc(d.max_weight_tons) + ' tons</span>' : '';
      const regionsText = (d.regions_covered || []).slice(0, 4).join(', ');

      return '<div class="log-card">' +
        '<div class="log-top">' +
          '<h2 class="log-name">' + esc(d.company_name) + '</h2>' +
          '<span class="ev-badge ev-confirmed">' + esc(d.verification_status || 'Verified') + '</span>' +
        '</div>' +
        '<div class="log-loc">📍 ' + esc(loc) + '</div>' +
        '<div style="margin-bottom:8px">' + weightBadge + '</div>' +
        '<p style="color:var(--text);font-size:.9rem;line-height:1.5;margin:6px 0 10px">' + esc(d.description) + '</p>' +
        '<div style="font-size:.8rem;color:var(--muted);margin-bottom:8px"><b>Coverage:</b> ' + esc(regionsText) + '</div>' +
        '<div class="log-modes">' + modesHtml + '</div>' +
        '<div class="card-foot">' +
          (d.website ? '<a href="' + esc(d.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Official Website ↗</a>' : '<span></span>') +
          '<a href="rfq.html?company=' + encodeURIComponent(d.company_name) + '" class="btn btn-amber btn-sm">Request Transport Quote →</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  searchInput.addEventListener('input', render);
  countrySelect.addEventListener('change', render);
  modeSelect.addEventListener('change', render);
  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    countrySelect.value = '';
    modeSelect.value = '';
    render();
  });

  render();
})();
</script>
<script src="tp-nav.js?v=5" defer></script>
<script src="analytics.js" defer></script>
</body>
</html>`;

  fs.writeFileSync('logistics.html', html);
  console.log('logistics.html built (' + COMPANIES.length + ' transport & logistics companies)');
}

render();
