/* SSR directory search.
 *
 * /directory?q=765+kV  (and /directory.html?q=…) is rewritten here so crawlers
 * and no-JS visitors receive segmented match results in the first HTML, not
 * the generic vertical cards on directory.html.
 *
 * Query parsing lives in lib/directory-search.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { search } = require('../lib/directory-search');

function loadCompanies() {
  try {
    const bundled = require('../data/directory-search-index.json');
    if (bundled && Array.isArray(bundled.companies)) return bundled.companies;
  } catch (e) { /* not bundled — try disk */ }
  const candidates = [
    path.join(__dirname, '..', 'data', 'directory-search-index.json'),
    path.join(__dirname, '..', 'data', 'directory-index.json'),
    path.join(process.cwd(), 'data', 'directory-search-index.json'),
    path.join(process.cwd(), 'data', 'directory-index.json'),
  ];
  for (let i = 0; i < candidates.length; i++) {
    try {
      const j = JSON.parse(fs.readFileSync(candidates[i], 'utf8'));
      if (j && Array.isArray(j.companies)) return j.companies;
    } catch (e) { /* next */ }
  }
  return null;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function card(hit) {
  const reasons = (hit.match_reasons || []).map((r) => '<span class="match-reason">' + esc(r.label) + '</span>').join(' ');
  const kv = hit.voltage && hit.voltage.value ? esc(hit.voltage.value) : '';
  const labels = (hit.capability_labels || []).slice(0, 5).map((l) => '<span class="dir-tag">' + esc(l) + '</span>').join('');
  return (
    '<article class="sr-card" data-kind="' + esc(hit.kind) + '">' +
      '<a class="sr-title" href="' + esc(hit.href) + '">' + esc(hit.name) + '</a>' +
      '<div class="sr-tag">' + esc(hit.country || '') + (hit.region ? ' · ' + esc(hit.region) : '') +
        (kv ? ' · <b>' + kv + '</b>' : '') +
        (hit.evidence ? ' · ' + esc(hit.evidence) : '') + '</div>' +
      (reasons ? '<div class="sr-reasons">' + reasons + '</div>' : '') +
      (labels ? '<div class="dir-tags">' + labels + '</div>' : '') +
    '</article>'
  );
}

function page(q, result) {
  const segs = result.segments || {};
  const segBits = [];
  if (segs.voltageKv != null) segBits.push('voltage ≥ ' + segs.voltageKv + ' kV');
  if (segs.mva != null) segBits.push('capacity ≥ ' + segs.mva + ' MVA');
  (segs.types || []).forEach((t) => segBits.push('type: ' + t.replace(/_/g, ' ')));
  (segs.tokens || []).forEach((t) => segBits.push('“' + t + '”'));
  const segLine = segBits.length ? 'Segmented as: ' + segBits.join(' · ') : 'No structured segments parsed.';
  const list = result.hits.length
    ? '<div class="entity-group-grid">' + result.hits.map(card).join('') + '</div>'
    : '<div class="sr-empty"><div class="sr-empty-title">No structured matches</div>' +
      '<p class="sr-empty-desc">Nothing in the directory index supports this query on voltage, capacity, type or name. That is a data gap, not a ranking failure.</p></div>';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Directory search: ${esc(q)} — TransformerPath</title>
<meta name="description" content="Segmented directory results for ${esc(q)} — voltage, capacity and type matches from the TransformerPath census.">
<link rel="canonical" href="https://transformerpath.com/directory?q=${encodeURIComponent(q)}">
<meta name="robots" content="index,follow">
<link rel="stylesheet" href="/style.css?v=14">
<link rel="stylesheet" href="/tp-nav.css?v=14">
<link rel="icon" href="/brand/favicon.ico" sizes="any">
<style>
.directory-wrap{max-width:1120px;margin:0 auto;padding:42px 20px 90px}
.entity-group-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:16px}
.sr-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px}
.sr-title{display:block;font-weight:700;color:var(--accent);text-decoration:none;margin-bottom:4px}
.sr-tag{color:var(--muted);font-size:.82rem;margin-bottom:8px}
.sr-reasons{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.match-reason{background:rgba(245,166,35,.12);border:1px solid var(--amber);border-radius:999px;padding:2px 9px;font-size:.72rem;color:var(--text)}
.dir-tag{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 9px;font-size:.72rem;margin:2px 3px 2px 0}
.sr-empty{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:32px 24px;text-align:center}
.sr-empty-title{font-weight:700;font-size:1.1rem;margin-bottom:8px}
.dir-search{display:flex;gap:8px;margin:16px 0 8px}
.dir-search input{flex:1;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font:inherit}
.dir-search button{padding:12px 18px;border:0;border-radius:8px;background:var(--amber);color:var(--navy);font-weight:800;cursor:pointer}
</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header>
  <div class="container nav">
    <a href="/index.html" class="logo" style="display:inline-flex;align-items:center;gap:9px"><span class="word">Transformer<span class="accent">Path</span></span></a>
    <nav class="tpnav" id="mainNav" aria-label="Primary">
      <a href="/intel.html">Intel</a>
      <a href="/directory.html">Directory</a>
      <a href="/projects.html">Projects</a>
      <a href="/tenders.html">Tenders</a>
      <a href="/learn.html">Learn</a>
      <a href="/grid-lab.html">Grid Lab</a>
      <a href="/workspace.html" data-tp-account>My TransformerPath</a>
    </nav>
  </div>
</header>
<main id="main" class="directory-wrap">
  <p style="font-size:.8rem;color:var(--muted)"><a href="/directory.html" style="color:var(--accent)">Directory</a> · segmented search</p>
  <h1>Results for “${esc(q)}”</h1>
  <form class="dir-search" action="/directory" method="get" role="search">
    <input type="search" name="q" value="${esc(q)}" required>
    <button type="submit">Search</button>
  </form>
  <p style="color:var(--muted);font-size:.9rem">${esc(segLine)}</p>
  <p style="font-weight:700">${result.total} match${result.total === 1 ? '' : 'es'}${result.total > result.hits.length ? ' (showing ' + result.hits.length + ')' : ''}</p>
  ${list}
  <p style="margin-top:24px;font-size:.84rem;color:var(--muted)">Matches are structured (voltage, capacity, type, country, name) against the live directory index. Generic vertical cards are not used for <code>?q=</code> results.</p>
</main>
</body>
</html>`;
}

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const q = String(qs.q || '').replace(/\+/g, ' ').trim();
  if (!q) {
    return { statusCode: 302, headers: { Location: '/directory.html' }, body: '' };
  }
  const companies = loadCompanies();
  if (!companies) {
    return {
      statusCode: 503,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: '<!DOCTYPE html><html><body><p>Directory index unavailable.</p><p><a href="/directory.html">Open the directory</a></p></body></html>',
    };
  }
  const result = search(companies, q, { limit: 80 });
  return {
    statusCode: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' },
    body: page(q, result),
  };
};
