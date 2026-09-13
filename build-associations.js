#!/usr/bin/env node
/* build-associations.js — TransformerPath Transformer Industry Associations Directory builder.
 *
 * Generates associations.html — verified directory of international, regional, and national
 * engineering bodies, standards councils, and trade associations for transformers.
 *
 * Sourced from data/associations.json.
 * Run: node build-associations.js
 */
'use strict';
const fs = require('fs');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/associations.json', 'utf8'));
const ASSOCIATIONS = DATA.associations || [];

function render() {
  const ascJson = JSON.stringify(ASSOCIATIONS);

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transformer Industry Associations Directory | TransformerPath</title>
<meta name="description" content="Global directory of transformer trade associations, standards councils, and engineering bodies (CIGRE, IEEE PES, IEC, NEMA, IEEMA, ZVEI, JEMA, CEEIA).">
<link rel="canonical" href="https://transformerpath.com/associations.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Transformer Industry Associations Directory | TransformerPath">
<meta property="og:description" content="Global directory of transformer engineering committees, standards organizations, and electrical manufacturing associations.">
<meta property="og:url" content="https://transformerpath.com/associations.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=12">
<link rel="stylesheet" href="tp-nav.css?v=15">
<link rel="stylesheet" href="tp-feedback.css?v=12">
<style>
.asc-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.asc-head { margin-bottom: 24px; }
.asc-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; }
.asc-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 880px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }

.asc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.asc-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; transition: transform .15s, border-color .15s; }
.asc-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.asc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.asc-name { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0; }
.asc-loc { font-size: .88rem; color: var(--muted); margin-bottom: 12px; }
.scope-pill { background: rgba(245,166,35,.12); border: 1px solid var(--accent); color: var(--accent); font-size: .78rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }

.focus-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 14px; }
.focus-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; font-size: .75rem; color: var(--text); }

.ev-badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.ev-confirmed { background: rgba(22,163,74,.14); color: #16a34a; border: 1px solid #16a34a; }

.card-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Transformer Industry Associations Directory",
  "url": "https://transformerpath.com/associations.html",
  "description": "Global directory of trade associations, standards bodies, and engineering councils for transformers."
}
</script>
</head>
<body>
${HEAD}

<main class="asc-wrap">
  <div class="asc-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Industry Associations</nav>
    <h1>Transformer <span style="color:var(--accent)">Industry Associations</span> Directory</h1>
    <p class="lead">Directory of global, regional, and national engineering associations, technical standards committees, and electrical manufacturing federations driving transformer technology, policy, and standardization.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statAscCount">${ASSOCIATIONS.length}</div>
      <div class="lbl">Key Bodies Listed</div>
    </div>
    <div class="stat-box">
      <div class="num">Global &amp; National</div>
      <div class="lbl">Scope Coverage</div>
    </div>
    <div class="stat-box">
      <div class="num">Standards &amp; Tech</div>
      <div class="lbl">Technical Committees</div>
    </div>
    <div class="stat-box">
      <div class="num">100%</div>
      <div class="lbl">Verified Official Portals</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="ascSearch" class="search-input" placeholder="Search association, standards committee, or focus area (e.g. CIGRE, IEEE, IEC, NEMA, IEEMA)...">
      <select id="ascScope" class="select-input">
        <option value="">All Scopes</option>
        <option value="Global">Global</option>
        <option value="Regional">Regional</option>
        <option value="National">National</option>
      </select>
      <select id="ascCountry" class="select-input">
        <option value="">All Countries</option>
      </select>
      <button id="ascReset" class="btn btn-outline btn-sm">Reset</button>
    </div>
  </div>

  <div id="ascGrid" class="asc-grid"></div>
</main>

${FOOT}

<script>
window.__TP_ASSOCIATIONS__ = ${ascJson};
(function(){
  const data = window.__TP_ASSOCIATIONS__ || [];
  const searchInput = document.getElementById('ascSearch');
  const scopeSelect = document.getElementById('ascScope');
  const countrySelect = document.getElementById('ascCountry');
  const resetBtn = document.getElementById('ascReset');
  const grid = document.getElementById('ascGrid');

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
    const sVal = scopeSelect.value.toLowerCase();
    const cVal = countrySelect.value;

    const filtered = data.filter(d => {
      if (sVal && (d.scope || '').toLowerCase().indexOf(sVal) < 0) return false;
      if (cVal && d.country !== cVal) return false;
      if (q) {
        const hay = [
          d.association_name, d.country, d.scope,
          (d.focus_areas || []).join(' '), (d.publications || []).join(' '),
          d.description, d.membership_type
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)"><h3>No matching industry associations found</h3><p>Try clearing your filters or search terms.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(d => {
      const scopeBadge = '<span class="scope-pill">🌐 ' + esc(d.scope) + '</span>';
      const focusHtml = (d.focus_areas || []).map(f => '<span class="focus-tag">' + esc(f) + '</span>').join('');

      return '<div class="asc-card">' +
        '<div class="asc-top">' +
          '<h2 class="asc-name">' + esc(d.association_name) + '</h2>' +
          '<span class="ev-badge ev-confirmed">' + esc(d.verification_status || 'Verified') + '</span>' +
        '</div>' +
        '<div class="asc-loc">📍 ' + esc(d.country) + ' &nbsp; ' + scopeBadge + '</div>' +
        '<p style="color:var(--text);font-size:.9rem;line-height:1.5;margin:6px 0 10px">' + esc(d.description) + '</p>' +
        '<div style="font-size:.8rem;color:var(--muted);margin-bottom:6px"><b>Membership:</b> ' + esc(d.membership_type) + '</div>' +
        '<div class="focus-tags">' + focusHtml + '</div>' +
        '<div class="card-foot">' +
          (d.website ? '<a href="' + esc(d.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Official Association Portal ↗</a>' : '<span></span>') +
          '<a href="standards.html" class="btn btn-outline btn-sm">Related Standards →</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  searchInput.addEventListener('input', render);
  scopeSelect.addEventListener('change', render);
  countrySelect.addEventListener('change', render);
  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    scopeSelect.value = '';
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

  fs.writeFileSync('associations.html', html);
  console.log('associations.html built (' + ASSOCIATIONS.length + ' associations)');
}

render();
