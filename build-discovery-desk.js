#!/usr/bin/env node
/* build-discovery-desk.js — human review queue for GCC discovery → publish.
 *
 * Reads data/gcc-discovery-candidates.json + publish overrides and writes
 * admin/discovery-desk.html — a simple desk listing HOLD_FOR_REVIEW /
 * REVIEW_QUEUE / REVIEW_REQUIRED items with copy-ready override snippets.
 *
 * Wire after build-gcc-intel-discovery.js in Netlify.
 */
'use strict';
const fs = require('fs');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const candidates = (readJson('data/gcc-discovery-candidates.json', { candidates: [] }).candidates) || [];
const overrides = readJson('data/gcc-discovery-publish-overrides.json', { approve: [], reject: [] });
const approve = new Set(overrides.approve || []);
const reject = new Set(overrides.reject || []);

const QUEUE_DECISIONS = new Set(['HOLD_FOR_REVIEW', 'REVIEW_QUEUE', 'INTERNAL_COVERAGE_ONLY']);
const queue = candidates.filter(function (c) {
  if (!c) return false;
  if (reject.has(c.candidate_id)) return false;
  if (approve.has(c.candidate_id)) return false;
  if (QUEUE_DECISIONS.has(c.publish_decision)) return true;
  if (c.evidence_grade === 'REVIEW_REQUIRED') return true;
  if (c.evidence_grade === 'SUPPORTED' && c.publish_decision !== 'PUBLISH') return true;
  return false;
});

const published = candidates.filter(function (c) {
  return approve.has(c.candidate_id) || c.evidence_grade === 'CONFIRMED';
});

const TODAY = new Date().toISOString().slice(0, 10);

function row(c) {
  const primary = (c.sources || []).find(function (s) { return s.role === 'PRIMARY'; }) || (c.sources || [])[0] || {};
  const approveSnippet = JSON.stringify({ approve: [c.candidate_id] }, null, 2);
  return '<article class="q-card" data-id="' + esc(c.candidate_id) + '">' +
    '<div class="q-meta">' +
    '<span class="badge grade">' + esc(c.evidence_grade || '—') + '</span>' +
    '<span class="badge decision">' + esc(c.publish_decision || '—') + '</span>' +
    (c.buyer ? '<span class="muted">' + esc(c.buyer) + '</span>' : '') +
    '</div>' +
    '<h2>' + esc(c.title) + '</h2>' +
    '<p class="snip">' + esc(c.snippet || '') + '</p>' +
    '<div class="q-actions">' +
    (primary.url ? '<a class="btn" href="' + esc(primary.url) + '" target="_blank" rel="noopener">Open source</a>' : '') +
    '<button type="button" class="btn copy" data-copy="' + esc(approveSnippet) + '">Copy approve override</button>' +
    '<code class="id">' + esc(c.candidate_id) + '</code>' +
    '</div>' +
    '<p class="hint">To publish: add <code>"' + esc(c.candidate_id) + '"</code> to ' +
    '<code>data/gcc-discovery-publish-overrides.json</code> → <code>approve</code>, then rebuild.</p>' +
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
  <p style="color:var(--muted);line-height:1.5;margin:0 0 8px">Human review queue generated <b>${esc(TODAY)}</b>. Approve by editing overrides, never by inventing grades.</p>
  <div class="stats">
    <div class="s"><b>${queue.length}</b><span style="font-size:.78rem;color:var(--muted)">in review queue</span></div>
    <div class="s"><b>${(overrides.approve||[]).length}</b><span style="font-size:.78rem;color:var(--muted)">approved overrides</span></div>
    <div class="s"><b>${(overrides.reject||[]).length}</b><span style="font-size:.78rem;color:var(--muted)">rejected</span></div>
    <div class="s"><b>${published.length}</b><span style="font-size:.78rem;color:var(--muted)">CONFIRMED / approved pool</span></div>
  </div>
  <p style="font-size:.8rem;color:var(--muted)">Artifact: <code>data/gcc-discovery-publish-overrides.json</code> · consumed by <code>build-gcc-intel-publish.js</code></p>
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
console.log('discovery-desk: ' + queue.length + ' queued, ' + (overrides.approve || []).length + ' approved overrides');
