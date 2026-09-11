#!/usr/bin/env node
/* build-services.js — TransformerPath Transformer Service & Repair Directory builder.
 *
 * Generates services.html — verified global directory of companies that service,
 * repair, rewind, and refurbish power and distribution transformers.
 *
 * Sourced from data/services.json.
 * Run: node build-services.js
 */
'use strict';
const fs = require('fs');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/services.json', 'utf8'));
const SERVICES = DATA.services || [];

function render() {
  const servJson = JSON.stringify(SERVICES);

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transformer Service & Repair Companies Directory | TransformerPath</title>
<meta name="description" content="Global directory of verified transformer service, repair, rewinding, oil processing, high-voltage field testing, and life extension specialists. Sourced evidence and verified capabilities.">
<link rel="canonical" href="https://transformerpath.com/services.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Transformer Service & Repair Companies Directory | TransformerPath">
<meta property="og:description" content="Find verified transformer repair specialists, emergency field service teams, on-site oil regeneration, rewinding, and diagnostics up to 1,200 kV.">
<meta property="og:url" content="https://transformerpath.com/services.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=12">
<link rel="stylesheet" href="tp-nav.css?v=12">
<link rel="stylesheet" href="tp-feedback.css?v=12">
<style>
.srv-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.srv-head { margin-bottom: 24px; }
.srv-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; }
.srv-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 880px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }

.srv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.srv-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; transition: transform .15s, border-color .15s; }
.srv-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.srv-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.srv-name { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0; }
.srv-loc { font-size: .88rem; color: var(--muted); margin-bottom: 12px; }
.kv-pill { background: rgba(245,166,35,.12); border: 1px solid var(--accent); color: var(--accent); font-size: .78rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }

.srv-types { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 14px; }
.srv-type-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; font-size: .75rem; color: var(--text); }

.ev-badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.ev-confirmed { background: rgba(22,163,74,.14); color: #16a34a; border: 1px solid #16a34a; }

.card-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Transformer Service & Repair Companies Directory",
  "url": "https://transformerpath.com/services.html",
  "description": "Global directory of verified transformer service, repair, rewinding, and field engineering specialists."
}
</script>
</head>
<body>
${HEAD}

<main class="srv-wrap">
  <div class="srv-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Service &amp; Repair</nav>
    <h1>Transformer <span style="color:var(--accent)">Service &amp; Repair</span> Directory</h1>
    <p class="lead">Independent, verified directory of specialized companies providing transformer field service, emergency active-part repair, mobile vacuum oil treatment, factory rewinding, and diagnostic testing. Filter by voltage class, service type, and location.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statSrvCount">${SERVICES.length}</div>
      <div class="lbl">Specialist Companies</div>
    </div>
    <div class="stat-box">
      <div class="num">1,200 kV</div>
      <div class="lbl">Max Voltage Serviced</div>
    </div>
    <div class="stat-box">
      <div class="num">1,500 MVA</div>
      <div class="lbl">Max Capacity Repaired</div>
    </div>
    <div class="stat-box">
      <div class="num">100%</div>
      <div class="lbl">Website-Verified</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="srvSearch" class="search-input" placeholder="Search company, city, capability, or keyword (e.g. rewind, oil processing, DGA, 500 kV)...">
      <select id="srvCountry" class="select-input">
        <option value="">All Countries</option>
      </select>
      <select id="srvType" class="select-input">
        <option value="">All Service Types</option>
        <option value="Field Service">Field Service &amp; Assembly</option>
        <option value="Oil Processing">Oil Processing &amp; Vacuum</option>
        <option value="Winding">Winding Repair &amp; Rewind</option>
        <option value="Testing">On-Site Testing &amp; Diagnostics</option>
        <option value="Life Extension">Life Extension &amp; Retrofits</option>
      </select>
      <button id="srvReset" class="btn btn-outline btn-sm">Reset</button>
    </div>
  </div>

  <div id="srvGrid" class="srv-grid"></div>
</main>

${FOOT}

<script>
window.__TP_SERVICES__ = ${servJson};
(function(){
  const data = window.__TP_SERVICES__ || [];
  const searchInput = document.getElementById('srvSearch');
  const countrySelect = document.getElementById('srvCountry');
  const typeSelect = document.getElementById('srvType');
  const resetBtn = document.getElementById('srvReset');
  const grid = document.getElementById('srvGrid');

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
    const tVal = typeSelect.value.toLowerCase();

    const filtered = data.filter(d => {
      if (cVal && d.country !== cVal) return false;
      if (tVal) {
        const typesStr = (d.service_types || []).join(' ').toLowerCase();
        if (!typesStr.includes(tVal)) return false;
      }
      if (q) {
        const hay = [
          d.company_name, d.country, d.state_province, d.city,
          (d.service_types || []).join(' '), d.voltage_capability_kv,
          d.description, (d.certifications || []).join(' ')
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)"><h3>No matching service providers found</h3><p>Try clearing your filters or search terms.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(d => {
      const loc = [d.city, d.state_province, d.country].filter(Boolean).join(', ');
      const typesHtml = (d.service_types || []).map(t => '<span class="srv-type-tag">' + esc(t) + '</span>').join('');
      const kv = d.voltage_capability_kv ? '<span class="kv-pill">⚡ ' + esc(d.voltage_capability_kv) + '</span>' : '';
      const mva = d.capacity_mva ? '<span class="kv-pill" style="margin-left:4px">📦 ' + esc(d.capacity_mva) + ' MVA</span>' : '';

      return '<div class="srv-card">' +
        '<div class="srv-top">' +
          '<h2 class="srv-name">' + esc(d.company_name) + '</h2>' +
          '<span class="ev-badge ev-confirmed">' + esc(d.verification_status || 'Verified') + '</span>' +
        '</div>' +
        '<div class="srv-loc">📍 ' + esc(loc) + '</div>' +
        '<div style="margin-bottom:8px">' + kv + mva + '</div>' +
        '<p style="color:var(--text);font-size:.9rem;line-height:1.5;margin:6px 0 12px">' + esc(d.description) + '</p>' +
        '<div class="srv-types">' + typesHtml + '</div>' +
        '<div class="card-foot">' +
          (d.website ? '<a href="' + esc(d.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Official Website ↗</a>' : '<span></span>') +
          '<a href="rfq.html?company=' + encodeURIComponent(d.company_name) + '" class="btn btn-amber btn-sm">RFQ / Inquiry →</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  searchInput.addEventListener('input', render);
  countrySelect.addEventListener('change', render);
  typeSelect.addEventListener('change', render);
  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    countrySelect.value = '';
    typeSelect.value = '';
    render();
  });

  render();
})();
</script>
<script src="tp-nav.js?v=5" defer></script>
<script src="analytics.js" defer></script>
</body>
</html>`;

  fs.writeFileSync('services.html', html);
  console.log('services.html built (' + SERVICES.length + ' service & repair companies)');
}

render();
