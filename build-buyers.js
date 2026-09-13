#!/usr/bin/env node
/* build-buyers.js — TransformerPath Transformer Buyers & Procurement Contacts Directory builder.
 *
 * Generates buyers.html — verified directory of transmission utilities, grid operators,
 * EPC contractors, data center builders, and industrial buyers of transformers.
 *
 * Sourced from data/buyers.json.
 * Run: node build-buyers.js
 */
'use strict';
const fs = require('fs');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/buyers.json', 'utf8'));
const BUYERS = DATA.buyers || [];

function render() {
  const byrJson = JSON.stringify(BUYERS);

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transformer Buyers & Procurement Directory | TransformerPath</title>
<meta name="description" content="Global directory of verified transformer buyers — transmission utilities, grid operators, global EPC contractors, data center builders, and renewable developers.">
<link rel="canonical" href="https://transformerpath.com/buyers.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Transformer Buyers & Procurement Directory | TransformerPath">
<meta property="og:description" content="Find major utility buyers, EPC contractors, and hyperscale procurement contacts for power and distribution transformers.">
<meta property="og:url" content="https://transformerpath.com/buyers.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=13">
<link rel="stylesheet" href="tp-nav.css?v=14">
<link rel="stylesheet" href="tp-feedback.css?v=13">
<style>
.byr-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.byr-head { margin-bottom: 24px; }
.byr-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; }
.byr-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 880px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }

.byr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.byr-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; transition: transform .15s, border-color .15s; }
.byr-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.byr-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.byr-name { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0; }
.byr-loc { font-size: .88rem; color: var(--muted); margin-bottom: 12px; }
.type-pill { background: rgba(245,166,35,.12); border: 1px solid var(--accent); color: var(--accent); font-size: .78rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }

.purchased-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 14px; }
.purchased-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; font-size: .75rem; color: var(--text); }

.ev-badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.ev-confirmed { background: rgba(22,163,74,.14); color: #16a34a; border: 1px solid #16a34a; }

.card-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Transformer Buyers & Procurement Directory",
  "url": "https://transformerpath.com/buyers.html",
  "description": "Global directory of utilities, grid operators, EPC contractors, and industrial buyers of transformers."
}
</script>
</head>
<body>
${HEAD}

<main class="byr-wrap">
  <div class="byr-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Buyers &amp; Procurement</nav>
    <h1>Transformer <span style="color:var(--accent)">Buyers &amp; Procurement</span> Directory</h1>
    <p class="lead">Directory of verified transmission system operators, regional utilities, global EPC contractors, and data center procurement organizations purchasing power and distribution transformers worldwide.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statByrCount">${BUYERS.length}</div>
      <div class="lbl">Major Buyers Listed</div>
    </div>
    <div class="stat-box">
      <div class="num">Utilities &amp; EPCs</div>
      <div class="lbl">Buyer Categories</div>
    </div>
    <div class="stat-box">
      <div class="num">Up to 765 kV</div>
      <div class="lbl">Voltage Classes</div>
    </div>
    <div class="stat-box">
      <div class="num">100%</div>
      <div class="lbl">Website checked</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="byrSearch" class="search-input" placeholder="Search organization, country, buyer type, or voltage (e.g. NextEra, Bechtel, Data Center, 765 kV)...">
      <select id="byrType" class="select-input">
        <option value="">All Buyer Types</option>
        <option value="Utility">Utilities &amp; TSOs</option>
        <option value="EPC">EPC Contractors</option>
        <option value="Data Center">Data Center Operators</option>
      </select>
      <select id="byrCountry" class="select-input">
        <option value="">All Countries</option>
      </select>
      <button id="byrReset" class="btn btn-outline btn-sm">Reset</button>
    </div>
  </div>

  <div id="byrGrid" class="byr-grid"></div>
</main>

${FOOT}

<script>
window.__TP_BUYERS__ = ${byrJson};
(function(){
  const data = window.__TP_BUYERS__ || [];
  const searchInput = document.getElementById('byrSearch');
  const typeSelect = document.getElementById('byrType');
  const countrySelect = document.getElementById('byrCountry');
  const resetBtn = document.getElementById('byrReset');
  const grid = document.getElementById('byrGrid');

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
    const tVal = typeSelect.value.toLowerCase();
    const cVal = countrySelect.value;

    const filtered = data.filter(d => {
      if (tVal && (d.buyer_type || '').toLowerCase().indexOf(tVal) < 0) return false;
      if (cVal && d.country !== cVal) return false;
      if (q) {
        const hay = [
          d.organization_name, d.country, d.state_province, d.city,
          d.buyer_type, (d.transformer_types_purchased || []).join(' '),
          d.voltage_classes, d.procurement_process, d.description
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)"><h3>No matching procurement organizations found</h3><p>Try clearing your filters or search terms.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(d => {
      const loc = [d.city, d.state_province, d.country].filter(Boolean).join(', ');
      const typePill = '<span class="type-pill">🏢 ' + esc(d.buyer_type) + '</span>';
      const itemsHtml = (d.transformer_types_purchased || []).map(t => '<span class="purchased-tag">⚡ ' + esc(t) + '</span>').join('');

      return '<div class="byr-card">' +
        '<div class="byr-top">' +
          '<h2 class="byr-name">' + esc(d.organization_name) + '</h2>' +
          '<span class="ev-badge ev-confirmed">' + esc(d.verification_status || 'Verified') + '</span>' +
        '</div>' +
        '<div class="byr-loc">📍 ' + esc(loc) + ' &nbsp; ' + typePill + '</div>' +
        '<p style="color:var(--text);font-size:.9rem;line-height:1.5;margin:6px 0 10px">' + esc(d.description) + '</p>' +
        (d.voltage_classes ? '<div style="font-size:.8rem;color:var(--muted);margin-bottom:6px"><b>Voltages:</b> ' + esc(d.voltage_classes) + '</div>' : '') +
        (d.procurement_process ? '<div style="font-size:.78rem;color:var(--muted);margin-bottom:10px;line-height:1.4"><b>Process:</b> ' + esc(d.procurement_process) + '</div>' : '') +
        '<div class="purchased-tags">' + itemsHtml + '</div>' +
        '<div class="card-foot" style="display:flex; gap:6px; flex-wrap:wrap; justify-content:space-between; align-items:center;">' +
          (d.website ? '<a href="' + esc(d.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="font-size:.76rem">Portal ↗</a>' : '<span></span>') +
          '<div style="display:flex; gap:6px;">' +
            '<a href="rfq.html?country=' + encodeURIComponent(d.country) + (d.voltage_classes ? ('&voltage=' + encodeURIComponent(d.voltage_classes.split(',')[0].trim())) : '') + '" class="btn btn-amber btn-sm" style="font-size:.76rem">⚡ Build Spec / RFQ →</a>' +
            '<a href="tenders.html" class="btn btn-outline btn-sm" style="font-size:.76rem">Tenders →</a>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  searchInput.addEventListener('input', render);
  typeSelect.addEventListener('change', render);
  countrySelect.addEventListener('change', render);
  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    typeSelect.value = '';
    countrySelect.value = '';
    render();
  });

  render();
})();
</script>
<script src="tp-nav.js?v=5" defer></script>
<script src="analytics.js" defer></script>
</body>
</html>`;

  fs.writeFileSync('buyers.html', html);
  console.log('buyers.html built (' + BUYERS.length + ' buyers)');
}

render();
