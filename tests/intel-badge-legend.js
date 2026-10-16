#!/usr/bin/env node
/* Every Intel badge the page or its renderers can show must have a legend
 * entry. DECONFIRMED is not a grade: DE is the German source-language tag
 * and CONFIRMED is the scope grade, and the two must not be glued together.
 *
 * Surfaces: intel.html (static markup and client templates), build_ssr.js,
 * build-intel-feed-ui.js, intel-feed-ui.js. Dated intel-2026 archives are
 * frozen snapshots and are not republished as the live Intel page.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

function decode(s) {
  return String(s).replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) {
    return String.fromCharCode(parseInt(h, 16));
  });
}

function badgeTexts(src) {
  const out = [];
  const re = /class="[^"]*\b(?:lang-badge|cls-badge|age-badge|new-badge)\b[^"]*"[^>]*>([^<]*)/g;
  let m;
  while ((m = re.exec(src))) {
    const text = decode(m[1]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (/[\$+]/.test(text) || text.indexOf("'") >= 0) continue;
    out.push(text);
  }
  return out;
}

function legendTokens(src) {
  const set = new Set();
  const re = /data-legend="([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) set.add(decode(m[1]).trim());
  return set;
}

const intel = fs.readFileSync('intel.html', 'utf8');
const legend = legendTokens(intel);
const renderers = ['intel.html', 'build_ssr.js', 'build-intel-feed-ui.js', 'intel-feed-ui.js'];
const seen = new Set();

console.log('=== INTEL BADGE LEGEND ===');
check('legend has entries', legend.size > 0, 'no data-legend tokens');

renderers.forEach(function (file) {
  badgeTexts(fs.readFileSync(file, 'utf8')).forEach(function (text) { seen.add(text); });
});

const langRe = /lang:\s*"([^"]+)"/g;
let lm;
while ((lm = langRe.exec(intel))) {
  if (lm[1] && lm[1] !== 'en') seen.add(String(lm[1]).toUpperCase());
}
const clsRe = /(?:CONFIRMED|INFERRED|PIPELINE|SUPPORTED|WATCH):\s*\{\s*help:/g;
let cm;
while ((cm = clsRe.exec(intel))) seen.add(cm[0].split(':')[0]);
const evRe = /evidence_grade:\s*"([^"]+)"/g;
let em;
while ((em = evRe.exec(intel))) seen.add(em[1]);

const missing = [...seen].filter(function (text) { return !legend.has(text); }).sort();
check('every rendered badge has a legend entry', missing.length === 0, missing.join(', '));

const staticHtml = intel.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const titles = staticHtml.match(/<div class="card-title">[\s\S]*?<\/div>/g) || [];
const glued = [];
titles.forEach(function (title) {
  const text = title.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  if (/[A-Z]{2,}(?:-[A-Z]+)?(?:CONFIRMED|INFERRED|PIPELINE|SUPPORTED|WATCH|NEW)/.test(text)) glued.push(text.trim().slice(0, 140));
});
check('language badges are not glued to scope grades', glued.length === 0, glued.slice(0, 3).join(' || '));

const de = (staticHtml.match(/class="lang-badge"[^>]*>DE</g) || []).length;
const deTitles = (staticHtml.match(/title="Source language: DE\."/g) || []).length;
const gluedDe = /class="lang-badge"[^>]*>DE(?:CONFIRMED|INFERRED|PIPELINE|SUPPORTED|WATCH)/.test(staticHtml);
check('German source badges stay DE', de > 0 && de === deTitles && !gluedDe, de + ' badges, ' + deTitles + ' titles');
check('German source badges stay DE (at least 3 on this page)', de >= 3, String(de));
check('legend defines DE as German', legend.has('DE') && intel.indexOf('DE — German source language') >= 0);
check('legend defines CONFIRMED', legend.has('CONFIRMED'));

const clientJoins = /\[langBadge, cls, ev, it\.isNew \? '<span class="new-badge">NEW<\/span>' : ''\]\.filter\(Boolean\)\.join\(' '\)/.test(intel);
const ssrJoins = /\[langBadge, cls, ev, newBadge\]\.filter\(Boolean\)\.join\(' '\)/.test(fs.readFileSync('build_ssr.js', 'utf8'));
check('client card separates badges with a space', clientJoins);
check('SSR card separates badges with a space', ssrJoins);
check('feed age badge is not glued to the date', !/<\/span>' \+ age/.test(fs.readFileSync('intel-feed-ui.js', 'utf8')) && !/<\/span>' \+ age/.test(fs.readFileSync('build-intel-feed-ui.js', 'utf8')));

if (failed) {
  console.error('INTEL BADGE LEGEND FAILED (' + failed + ')');
  process.exit(1);
}
console.log('INTEL BADGE LEGEND OK (' + seen.size + ' badges, ' + legend.size + ' legend entries)');
