#!/usr/bin/env node
/* build-discovery-desk.js — human review queue for GCC discovery → publish.
 *
 * The queue is data/gcc-intel-review.json. HOLD rows are the desk. A row
 * leaves the queue only when decision=PUBLISH with reviewer and reviewed_at.
 * approve[] overrides do not publish and do not clear a HOLD.
 *
 * Wire after build-gcc-intel-discovery.js in Netlify.
 */
'use strict';
const fs = require('fs');
const reviewLib = require('./lib/gcc-intel-review');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const candidates = (readJson('data/gcc-discovery-candidates.json', { candidates: [] }).candidates) || [];
const reviews = reviewLib.loadReview('data/gcc-intel-review.json');
const reviewById = reviewLib.byId(reviews);
const candById = {};
candidates.forEach(function (c) { if (c && c.candidate_id) candById[c.candidate_id] = c; });

const queue = reviews.filter(function (r) { return r && r.decision === 'HOLD'; });
const published = reviews.filter(reviewLib.isPublishable);
const rejected = reviews.filter(function (r) { return r && r.decision === 'REJECT'; });

const TODAY = new Date().toISOString().slice(0, 10);

function row(r) {
  const c = candById[r.candidate_id] || {};
  const primary = (c.sources || []).find(function (s) { return s.role === 'PRIMARY'; }) || (c.sources || [])[0] || {};
  const reason = r.hold_reason ? (r.hold_reason.code + ' — ' + r.hold_reason.text) : '';
  return '<article class="q-card" data-id="' + esc(r.candidate_id) + '" data-decision="' + esc(r.decision) + '">' +
    '<div class="q-meta">' +
    '<span class="badge grade">' + esc(r.evidence_status || '—') + '</span>' +
    '<span class="badge decision">' + esc(r.decision) + '</span>' +
    (r.reviewer ? '<span class="muted">reviewer ' + esc(r.reviewer) + '</span>' : '<span class="muted">reviewer unset</span>') +
    (c.buyer ? '<span class="muted">' + esc(c.buyer) + '</span>' : '') +
    '</div>' +
    '<h2>' + esc(c.title || r.candidate_id) + '</h2>' +
    '<p class="snip">' + esc(c.snippet || '') + '</p>' +
    (reason ? '<p class="hint"><b>Hold:</b> ' + esc(reason) + '</p>' : '') +
    '<div class="q-actions">' +
    (primary.url ? '<a class="btn" href="' + esc(primary.url) + '" target="_blank" rel="noopener">Open source</a>' : '') +
    '<code class="id">' + esc(r.candidate_id) + '</code>' +
    '</div>' +
    '<p class="hint">Still held. Publishing requires <code>decision: PUBLISH</code> plus <code>reviewer</code> and <code>reviewed_at</code> on this row in <code>data/gcc-intel-review.json</code>. An approve[] override does not publish a held candidate.</p>' +
    '</article>';
}

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GCC Discovery → Publish Desk — TransformerPath</title>
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="../style.css?v=14">
<link rel="icon" type="image/svg+xml" href="../brand/favicon.svg">
<style>
  .desk{max-width:900px;margin:0 auto;padding:40px 20px 80px}
  .q-card{background:var(--card);border:1px solid var(--border);border-left:4px solid var(--amber);border-radius:12px;padding:16px 18px;margin:14px 0}
  .q-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;font-size:.78rem}
  .badge{font-weight:800;letter-spacing:.4px;text-transform:uppercase;font-size:.66rem;padding:3px 8px;border-radius:6px;border:1px solid var(--border)}
  .badge.grade{color:#4ade80;border-color:rgba(74,222,128,.4);background:rgba(74,222,128,.1)}
  .badge.decision{color:var(--amber);border-color:rgba(245,166,35,.4);background:rgba(245,166,35,.1)}
  .muted{color:var(--muted)}
  .snip{color:var(--muted);font-size:.9rem;line-height:1.5;margin:6px 0 12px}
  .q-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .btn{display:inline-block;padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:.8rem;cursor:pointer;text-decoration:none}
  .btn.copy{border-color:var(--amber);color:var(--amber)}
  .id{font-size:.72rem;color:var(--muted)}
  .hint{font-size:.74rem;color:var(--muted);margin:10px 0 0;line-height:1.45}
  .stats{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0 8px}
  .stats .s{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 14px}
  .stats .s b{display:block;color:var(--accent);font-size:1.2rem}
</style>
</head>
<body>
<main class="desk">
  <p style="font-size:.72rem;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--accent);margin:0 0 8px">Internal · discovery ≠ publication</p>
  <h1 style="margin:0 0 8px;color:var(--ink)">GCC discovery → publish desk</h1>
  <p style="color:var(--muted);line-height:1.5;margin:0 0 8px">Review ledger generated <b>${esc(TODAY)}</b>. Held candidates stay held until a person sets decision=PUBLISH with reviewer and reviewed_at. Grades are not invented here.</p>
  <div class="stats">
    <div class="s"><b>${queue.length}</b><span style="font-size:.78rem;color:var(--muted)">held in review queue</span></div>
    <div class="s"><b>${published.length}</b><span style="font-size:.78rem;color:var(--muted)">PUBLISH with reviewer</span></div>
    <div class="s"><b>${rejected.length}</b><span style="font-size:.78rem;color:var(--muted)">rejected</span></div>
  </div>
  <p style="font-size:.8rem;color:var(--muted)">Ledger: <code>data/gcc-intel-review.json</code> · consumed by <code>build-gcc-intel-publish.js</code> and <code>build-gcc-source-coverage.js</code></p>
  ${published.length ? '<h2 style="margin-top:22px;color:var(--ink)">Released</h2><ul>' + published.map(function (r) {
    return '<li><code>' + esc(r.candidate_id) + '</code> · ' + esc(r.evidence_status) + ' · ' + esc(r.reviewer) + ' · ' + esc(r.reviewed_at) + '</li>';
  }).join('') + '</ul>' : ''}
  ${queue.length ? queue.map(row).join('\n') : '<p style="color:var(--muted)">Queue empty — nothing waiting on human review this build.</p>'}
</main>
<script>
document.querySelectorAll('[data-copy]').forEach(function(btn){
  btn.addEventListener('click', function(){
    var t = btn.getAttribute('data-copy') || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function(){ btn.textContent = 'Copied'; });
    } else {
      prompt('Copy approve snippet', t);
    }
  });
});
</script>
</body>
</html>
`;

fs.mkdirSync('admin', { recursive: true });
fs.writeFileSync('admin/discovery-desk.html', html);
console.log('discovery-desk: ' + queue.length + ' held, ' + published.length + ' publishable, ' + rejected.length + ' rejected');
