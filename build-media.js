#!/usr/bin/env node
/* build-media.js — TransformerPath Transformer Industry Media & Publications Directory builder.
 *
 * Generates media.html — verified directory of trade magazines, peer-reviewed journals,
 * newsletters, and technical periodicals covering transformer engineering and markets.
 *
 * Sourced from data/media.json.
 * Run: node build-media.js
 */
'use strict';
const fs = require('fs');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/media.json', 'utf8'));
const PUBLICATIONS = DATA.publications || [];

function render() {
  const medJson = JSON.stringify(PUBLICATIONS);

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transformer Industry Media & Publications Directory | TransformerPath</title>
<meta name="description" content="Global directory of transformer trade magazines, peer-reviewed engineering journals, industry newsletters, and technical periodicals.">
<link rel="canonical" href="https://transformerpath.com/media.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Transformer Industry Media & Publications Directory | TransformerPath">
<meta property="og:description" content="Find verified transformer magazines, IEEE and IET power delivery journals, and industry news outlets.">
<meta property="og:url" content="https://transformerpath.com/media.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=13">
<link rel="stylesheet" href="tp-nav.css?v=15">
<link rel="stylesheet" href="tp-feedback.css?v=13">
<style>
.med-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.med-head { margin-bottom: 24px; }
.med-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; }
.med-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 880px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }

.med-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.med-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; transition: transform .15s, border-color .15s; }
.med-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.med-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.med-name { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0; }
.med-loc { font-size: .88rem; color: var(--muted); margin-bottom: 12px; }
.type-pill { background: rgba(245,166,35,.12); border: 1px solid var(--accent); color: var(--accent); font-size: .78rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }

.coverage-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 14px; }
.coverage-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; font-size: .75rem; color: var(--text); }

.ev-badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.ev-confirmed { background: rgba(22,163,74,.14); color: #16a34a; border: 1px solid #16a34a; }

.card-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Transformer Industry Media & Publications Directory",
  "url": "https://transformerpath.com/media.html",
  "description": "Global directory of trade magazines, peer-reviewed journals, and publications for the transformer industry."
}
</script>
</head>
<body>
${HEAD}

<main class="med-wrap">
  <div class="med-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Media &amp; Publications</nav>
    <h1>Transformer <span style="color:var(--accent)">Media &amp; Publications</span> Directory</h1>
    <p class="lead">Directory of verified trade magazines, peer-reviewed scholarly journals, industry periodicals, and news outlets covering transformer engineering, market developments, and technical standards.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statMedCount">${PUBLICATIONS.length}</div>
      <div class="lbl">Publications Listed</div>
    </div>
    <div class="stat-box">
      <div class="num">Trade &amp; Academic</div>
      <div class="lbl">Magazines &amp; Journals</div>
    </div>
    <div class="stat-box">
      <div class="num">Global Reach</div>
      <div class="lbl">160+ Countries</div>
    </div>
    <div class="stat-box">
      <div class="num">100%</div>
      <div class="lbl">Website checked</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="medSearch" class="search-input" placeholder="Search publication, publisher, or subject (e.g. Transformers Magazine, IEEE, T&D World, CIGRE)...">
      <select id="medType" class="select-input">
        <option value="">All Publication Types</option>
        <option value="Trade">Trade Magazines &amp; Portals</option>
        <option value="Journal">Peer-Reviewed Journals</option>
        <option value="Council">Council Publications</option>
      </select>
      <select id="medCountry" class="select-input">
        <option value="">All Countries</option>
      </select>
      <button id="medReset" class="btn btn-outline btn-sm">Reset</button>
    </div>
  </div>

  <div id="medGrid" class="med-grid"></div>
</main>

${FOOT}

<script>
window.__TP_MEDIA__ = ${medJson};
(function(){
  const data = window.__TP_MEDIA__ || [];
  const searchInput = document.getElementById('medSearch');
  const typeSelect = document.getElementById('medType');
  const countrySelect = document.getElementById('medCountry');
  const resetBtn = document.getElementById('medReset');
  const grid = document.getElementById('medGrid');

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
      if (tVal && (d.publication_type || '').toLowerCase().indexOf(tVal) < 0) return false;
      if (cVal && d.country !== cVal) return false;
      if (q) {
        const hay = [
          d.publication_name, d.country, d.publication_type,
          (d.coverage_areas || []).join(' '), d.frequency, d.language,
          d.description
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)"><h3>No matching publications found</h3><p>Try clearing your filters or search terms.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(d => {
      const typePill = '<span class="type-pill">📰 ' + esc(d.publication_type.split('(')[0].trim()) + '</span>';
      const coverageHtml = (d.coverage_areas || []).map(c => '<span class="coverage-tag">📌 ' + esc(c) + '</span>').join('');

      return '<div class="med-card">' +
        '<div class="med-top">' +
          '<h2 class="med-name">' + esc(d.publication_name) + '</h2>' +
          '<span class="ev-badge ev-confirmed">' + esc(d.verification_status || 'Verified') + '</span>' +
        '</div>' +
        '<div class="med-loc">📍 ' + esc(d.country) + ' &nbsp; ' + typePill + '</div>' +
        '<p style="color:var(--text);font-size:.9rem;line-height:1.5;margin:6px 0 10px">' + esc(d.description) + '</p>' +
        '<div style="font-size:.8rem;color:var(--muted);margin-bottom:4px"><b>Frequency:</b> ' + esc(d.frequency) + ' &nbsp;|&nbsp; <b>Language:</b> ' + esc(d.language) + '</div>' +
        (d.subscription_info ? '<div style="font-size:.78rem;color:var(--muted);margin-bottom:8px"><b>Access:</b> ' + esc(d.subscription_info) + '</div>' : '') +
        '<div class="coverage-tags">' + coverageHtml + '</div>' +
        '<div class="card-foot">' +
          (d.website ? '<a href="' + esc(d.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Official Publication Site ↗</a>' : '<span></span>') +
          '<a href="intel.html" class="btn btn-outline btn-sm">TransformerPath Intel →</a>' +
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

  fs.writeFileSync('media.html', html);
  console.log('media.html built (' + PUBLICATIONS.length + ' publications)');
}

render();
