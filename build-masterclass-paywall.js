#!/usr/bin/env node
/* build-masterclass-paywall.js — entitlement-aware Masterclass delivery.
 *
 * The leak: masterclass.html ships the full 26 chapters in the public static
 * HTML. This moves the PAID chapters into a server-side payload
 * (functions/lib/masterclass-chapters.js) served ONLY by the gated
 * /.netlify/functions/masterclass-content function, and rewrites the served
 * masterclass.html to a PUBLIC PREVIEW (free chapters + locked placeholders +
 * a client that fetches paid chapters with an entitlement token).
 *
 * FREE = fundamentals, classification. Everything else is gated (Learning-or-
 * higher). The full paid text is removed from the served HTML; no CSS/DOM
 * hiding. Run: node build-masterclass-paywall.js
 */
'use strict';
const fs = require('fs');
// Canonical FULL course source lives in a protected, 404'd path (never served).
// It is gitignored by design, so it is ABSENT on a Git-clone build. The generated
// outputs (functions/lib/masterclass-chapters.js payload + the served masterclass.html
// preview) are COMMITTED, so when the source is missing we skip regeneration and
// leave the committed outputs intact rather than failing the build.
const SRC_PATH = '_private/masterclass-full.html';
if (!fs.existsSync(SRC_PATH)) {
  console.log('build-masterclass-paywall: full course source absent (gitignored) — skipping regeneration, keeping committed outputs.');
  process.exit(0);
}
const src = fs.readFileSync(SRC_PATH, 'utf8');

const FREE = new Set(['fundamentals', 'classification', 'core']);
const ALL_IDS = [...src.matchAll(/<section id="([^"]+)"[^>]*>/g)].map((m) => m[1]);
console.log('chapters found:', ALL_IDS.length, '| free:', [...FREE].join(','));

function stripTags(s) { return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function sentences(t, n) { const m = t.match(/(?:[^.!?]+[.!?]+){0,' + (n || 2) + '}/); return (m ? m[0] : t).trim(); }
function extractSection(id) {
  const re = new RegExp('<section id="' + id + '"[^>]*>[\\s\\S]*?</section>');
  const m = src.match(re);
  if (!m) return null;
  const block = m[0];
  if ((block.match(/<section\b/g) || []).length !== 1) return null; // safety: must be a flat section
  return block;
}

function derive(block) {
  const title = stripTags((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || '');
  const p = stripTags((block.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
  const preview = sentences(p, 2);
  const h3s = [...block.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => stripTags(m[1])).filter(Boolean);
  const h4s = [...block.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/g)].map((m) => stripTags(m[1])).filter(Boolean);
  const objectives = h3s.concat(h4s).slice(0, 5);
  const cap = (block.match(/class="cap"[^>]*>([\s\S]*?)<\\?\/?[a-z]/i) || [])[1] || '';
  const teaser = cap ? stripTags(cap).slice(0, 160) : 'Technical chapter with sourced diagrams and engineering context.';
  return { title: title || id, preview: preview || 'Chapter preview available to Learning subscribers.', objectives: objectives.length ? objectives : [], teaser };
}

const paid = {};
// GO DEEPER — map each chapter to its best-fit volume in the TransformerPath
// series (the ACTUAL uploaded book titles/volumes). Masterclass teaches; the
// books provide deep professional reference. This is a reference link, not
// imported book content.
const GO_DEEPER = {
  fundamentals: { v: 1, t: 'The Transformer Path — A Practical Guide: From Specification to Service · Edition 1' },
  classification: { v: 1, t: 'The Transformer Path — A Practical Guide · Edition 1' },
  core: { v: 1, t: 'The Transformer Path — A Practical Guide · Edition 1' },
  windings: { v: 6, t: 'Transformer Manufacturing' },
  insulation: { v: 7, t: 'Transformer Insulation and Materials' },
  cooling: { v: 8, t: 'Transformer Components' },
  construction: { v: 8, t: 'Transformer Components' },
  drytype: { v: 12, t: 'Special Transformers' },
  materials: { v: 7, t: 'Transformer Insulation and Materials' },
  design: { v: 1, t: 'The Transformer Path — A Practical Guide · Edition 1' },
  losses: { v: 9, t: 'Losses, Efficiency and Economics' },
  testing: { v: 3, t: 'Transformer Testing (planned)' },
  standards: { v: 16, t: 'Standards, Quality and Assurance' },
  vectorgroups: { v: 1, t: 'The Transformer Path — A Practical Guide · Edition 1' },
  inrush: { v: 11, t: 'Protection, Control and the Network' },
  special: { v: 12, t: 'Special Transformers' },
  sitelife: { v: 13, t: 'Installation, Commissioning and Site Work' },
  protection: { v: 11, t: 'Protection, Control and the Network' },
  procurement: { v: 9, t: 'Losses, Efficiency and Economics' },
  aftersales: { v: 15, t: 'Maintenance, Repair and Refurbishment' },
  bushings: { v: 8, t: 'Transformer Components' },
  tapchangers: { v: 8, t: 'Transformer Components' },
  stresscontrol: { v: 7, t: 'Transformer Insulation and Materials' },
  fireenv: { v: 15, t: 'Maintenance, Repair and Refurbishment' },
  powerdesign: { v: 2, t: 'Power Transformer Design · Edition 1' },
  datalab: { v: 18, t: "The Transformer Engineer's Handbook" },
};
function goDeeperBlock(id) {
  const r = GO_DEEPER[id];
  if (!r) return '';
  return '<div class="mc-go-deeper"><b>Go deeper in the TransformerPath series</b> — <a href="/books/volume-' + r.v + '/">Volume ' + r.v + ' · ' + r.t.replace(/"/g, '&quot;') + '</a></div>';
}
function injectGoDeeper(html, id) {
  const block = goDeeperBlock(id);
  if (!block) return html;
  const i = html.lastIndexOf('</section>');
  return i >= 0 ? html.slice(0, i) + block + html.slice(i) : html;
}

const lockedBlocks = {};
ALL_IDS.forEach((id) => {
  if (FREE.has(id)) return;
  const block = extractSection(id);
  if (!block) { console.error('!! could not cleanly extract section: ' + id); process.exit(1); }
  const info = derive(block);
  paid[id] = { title: info.title, preview: info.preview, objectives: info.objectives, teaser: info.teaser, html: injectGoDeeper(block, id) };
  // Locked placeholder (public preview — does NOT contain the full chapter).
  lockedBlocks[id] =
    '<section id="' + id + '" class="mc-locked" data-chapter="' + id + '">' +
    '<div class="mc-lock-tag">🔒 Learning content</div>' +
    '<h2>' + info.title.replace(/"/g, '&quot;') + '</h2>' +
    '<p class="mc-lock-preview">' + info.preview.replace(/"/g, '&quot;') + '</p>' +
    (info.objectives.length ? '<ul class="mc-lock-obj">' + info.objectives.map((o) => '<li>' + o.replace(/"/g, '&quot;') + '</li>').join('') + '</ul>' : '') +
    '<div class="mc-lock-cta"><b>Unlock full Masterclass</b><span>Learning · $199 / 12 months · Professional and Team include Learning.</span><br><a class="btn btn-amber" href="pricing.html">Unlock →</a> <a class="btn btn-outline btn-sm" href="pricing.html">View plans</a></div>' +
    '</section>';
});

// Generate the server-side chapters payload (full HTML, NOT served publicly).
const payload = '/* AUTO-GENERATED by build-masterclass-paywall.js — paid Masterclass chapters.\n' +
  ' * This module is imported ONLY by the gated /functions/masterclass-content.js\n' +
  ' * and is never served as static HTML. Do not edit by hand.\n' +
  ' */\nmodule.exports = ' + JSON.stringify(paid, null, 2) + ';\n';
fs.mkdirSync('functions/lib', { recursive: true });
fs.writeFileSync('functions/lib/masterclass-chapters.js', payload);
console.log('paid chapters payload: ' + Object.keys(paid).length + ' chapters -> functions/lib/masterclass-chapters.js');

// Rewrite the served masterclass.html: replace each paid section with a locked
// place, keep free sections + header/hero/nav/breadcrumb/course JS.
let out = src;
ALL_IDS.forEach((id) => {
  if (FREE.has(id)) return;
  const block = extractSection(id);
  if (!block) return;
  out = out.replace(block, lockedBlocks[id]);
});
// Inject the GO DEEPER book reference into each FREE chapter of the served page.
FREE.forEach((id) => {
  const block = extractSection(id);
  if (!block || !GO_DEEPER[id]) return;
  out = out.replace(block, injectGoDeeper(block, id));
});

// Inject the entitlement-aware client loader: for each locked section, request
// the chapter from the gated function with the entitlement token cookie. If the
// server verifies the entitlement it injects the full chapter; otherwise the
// locked preview stays. Fail-closed (no token -> locked).
const CLIENT =
  '<script>\n' +
  'document.addEventListener(\'DOMContentLoaded\', function(){\n' +
  '  var secs = document.querySelectorAll(\'.mc-locked[data-chapter]\');\n' +
  '  if(!window.fetch) return;\n' +
  '  // Present the entitlement token to the gated function (same-origin cookie).\n' +
  '  function loadChapter(id, sec){\n' +
  '    fetch(\'/.netlify/functions/masterclass-content?chapter=\'+encodeURIComponent(id), { credentials:\'include\', headers:{ Accept:\'application/json\' } })\n' +
  '      .then(function(r){ return r.json(); }).catch(function(){ return {locked:true}; })\n' +
  '      .then(function(res){\n' +
  '        if(res && res.ok && res.html){ sec.innerHTML = res.html; sec.classList.remove(\'mc-locked\'); } \n' +
  '        else if(res && res.locked){ /* keep the locked preview */ }\n' +
  '      });\n' +
  '  }\n' +
  '  secs.forEach(function(sec){ loadChapter(sec.getAttribute(\'data-chapter\'), sec); });\n' +
  '});\n' +
  '</script>\n';

out = out.replace('</body>', CLIENT + '</body>');
fs.writeFileSync('masterclass.html', out);
console.log('masterclass.html rewritten: paid chapters removed from served HTML; ' + FREE.size + ' free chapters kept; entitlement-aware loader injected.');
