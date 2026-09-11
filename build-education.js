#!/usr/bin/env node
/* build-education.js — TransformerPath Transformer Education & Training Providers Directory builder.
 *
 * Generates education.html — verified directory of universities, technical institutes,
 * testing academies, and masterclass providers for transformer engineering.
 *
 * Sourced from data/education.json.
 * Run: node build-education.js
 */
'use strict';
const fs = require('fs');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/education.json', 'utf8'));
const PROVIDERS = DATA.providers || [];

function render() {
  const eduJson = JSON.stringify(PROVIDERS);

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transformer Education & Training Providers Directory | TransformerPath</title>
<meta name="description" content="Global directory of verified universities, high-voltage laboratories, technical training institutes, and certification providers for transformer engineering.">
<link rel="canonical" href="https://transformerpath.com/education.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Transformer Education & Training Providers Directory | TransformerPath">
<meta property="og:description" content="Find verified university high-voltage programs, Doble masterclasses, CIGRE tutorials, and professional transformer engineering certifications.">
<meta property="og:url" content="https://transformerpath.com/education.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=12">
<link rel="stylesheet" href="tp-nav.css?v=12">
<link rel="stylesheet" href="tp-feedback.css?v=12">
<style>
.edu-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.edu-head { margin-bottom: 24px; }
.edu-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; }
.edu-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 880px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }

.edu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.edu-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; transition: transform .15s, border-color .15s; }
.edu-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.edu-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.edu-name { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0; }
.edu-loc { font-size: .88rem; color: var(--muted); margin-bottom: 12px; }
.mode-pill { background: rgba(245,166,35,.12); border: 1px solid var(--accent); color: var(--accent); font-size: .78rem; font-weight: 800; padding: 3px 9px; border-radius: 999px; }

.course-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 14px; }
.course-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; font-size: .75rem; color: var(--text); }

.ev-badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.ev-confirmed { background: rgba(22,163,74,.14); color: #16a34a; border: 1px solid #16a34a; }

.card-foot { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Transformer Education & Training Providers Directory",
  "url": "https://transformerpath.com/education.html",
  "description": "Global directory of universities, technical institutes, and training academies for transformer engineering."
}
</script>
</head>
<body>
${HEAD}

<main class="edu-wrap">
  <div class="edu-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Education &amp; Training</nav>
    <h1>Transformer <span style="color:var(--accent)">Education &amp; Training</span> Directory</h1>
    <p class="lead">Directory of universities, high-voltage laboratories, professional training institutes, and certification bodies delivering specialized education in transformer design, dielectric diagnostics, and life-cycle asset management.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statEduCount">${PROVIDERS.length}</div>
      <div class="lbl">Institutions Listed</div>
    </div>
    <div class="stat-box">
      <div class="num">In-Person &amp; Online</div>
      <div class="lbl">Delivery Formats</div>
    </div>
    <div class="stat-box">
      <div class="num">Degree &amp; CPD</div>
      <div class="lbl">Accredited Certifications</div>
    </div>
    <div class="stat-box">
      <div class="num">100%</div>
      <div class="lbl">Website-Verified</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="eduSearch" class="search-input" placeholder="Search institution, course, or certification (e.g. Doble, TU Delft, DGA, Masterclass)...">
      <select id="eduMode" class="select-input">
        <option value="">All Delivery Modes</option>
        <option value="In-Person">In-Person Classroom / Lab</option>
        <option value="Online">Online / Virtual</option>
        <option value="Hybrid">Hybrid</option>
      </select>
      <select id="eduCountry" class="select-input">
        <option value="">All Countries</option>
      </select>
      <button id="eduReset" class="btn btn-outline btn-sm">Reset</button>
    </div>
  </div>

  <div id="eduGrid" class="edu-grid"></div>
</main>

${FOOT}

<script>
window.__TP_EDUCATION__ = ${eduJson};
(function(){
  const data = window.__TP_EDUCATION__ || [];
  const searchInput = document.getElementById('eduSearch');
  const modeSelect = document.getElementById('eduMode');
  const countrySelect = document.getElementById('eduCountry');
  const resetBtn = document.getElementById('eduReset');
  const grid = document.getElementById('eduGrid');

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
    const mVal = modeSelect.value.toLowerCase();
    const cVal = countrySelect.value;

    const filtered = data.filter(d => {
      if (mVal && (d.delivery_mode || '').toLowerCase().indexOf(mVal) < 0) return false;
      if (cVal && d.country !== cVal) return false;
      if (q) {
        const hay = [
          d.provider_name, d.country, d.state_province, d.city,
          (d.course_types || []).join(' '), d.delivery_mode,
          d.certification_offered, d.description
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)"><h3>No matching education providers found</h3><p>Try clearing your filters or search terms.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(d => {
      const loc = [d.city, d.state_province, d.country].filter(Boolean).join(', ');
      const modePill = '<span class="mode-pill">🎓 ' + esc(d.delivery_mode.split('(')[0].trim()) + '</span>';
      const coursesHtml = (d.course_types || []).map(c => '<span class="course-tag">📚 ' + esc(c) + '</span>').join('');

      return '<div class="edu-card">' +
        '<div class="edu-top">' +
          '<h2 class="edu-name">' + esc(d.provider_name) + '</h2>' +
          '<span class="ev-badge ev-confirmed">' + esc(d.verification_status || 'Verified') + '</span>' +
        '</div>' +
        '<div class="edu-loc">📍 ' + esc(loc) + ' &nbsp; ' + modePill + '</div>' +
        '<p style="color:var(--text);font-size:.9rem;line-height:1.5;margin:6px 0 10px">' + esc(d.description) + '</p>' +
        (d.certification_offered ? '<div style="font-size:.8rem;color:var(--muted);margin-bottom:8px"><b>Credential:</b> ' + esc(d.certification_offered) + '</div>' : '') +
        '<div class="course-tags">' + coursesHtml + '</div>' +
        '<div class="card-foot">' +
          (d.website ? '<a href="' + esc(d.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Official Provider Portal ↗</a>' : '<span></span>') +
          '<a href="learn.html" class="btn btn-outline btn-sm">TransformerPath Learn →</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  searchInput.addEventListener('input', render);
  modeSelect.addEventListener('change', render);
  countrySelect.addEventListener('change', render);
  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    modeSelect.value = '';
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

  fs.writeFileSync('education.html', html);
  console.log('education.html built (' + PROVIDERS.length + ' education providers)');
}

render();
