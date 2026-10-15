#!/usr/bin/env node
/* tests/homepage-glance-regression.js
 * At a Glance is stamped from data/intel-feed-ui.json. It fails when the
 * homepage row is older than the newest day-dated item in that feed.
 * The nine 15 Oct 2026 TED notices must also be sourced Daily Intel posts.
 * Run: node tests/homepage-glance-regression.js
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

function between(html, start, end) {
  const i = html.indexOf(start);
  if (i < 0) return '';
  const j = html.indexOf(end, i + start.length);
  if (j < 0) return '';
  return html.slice(i + start.length, j);
}

function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function labelOf(iso) {
  const parts = String(iso || '').split('-');
  if (parts.length !== 3) return '';
  return Number(parts[2]) + ' ' + MON[Number(parts[1]) - 1] + ' ' + parts[0];
}

console.log('=== HOMEPAGE AT A GLANCE ===');
const feed = JSON.parse(fs.readFileSync('data/intel-feed-ui.json', 'utf8'));
const home = fs.readFileSync('index.html', 'utf8');
const today = new Date().toISOString().slice(0, 10);

let newestIso = '';
(feed.posts || []).forEach(function (p) {
  if (!p || p.datePrecision !== 'day') return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.dateIso || ''))) return;
  if (p.dateIso > today) return;
  if (!newestIso || p.dateIso > newestIso) newestIso = p.dateIso;
});
const newestPost = (feed.posts || []).find(function (p) {
  return p && p.datePrecision === 'day' && p.dateIso === newestIso && p.headline;
});

const cards = between(home, '<!--GLANCE:cards-->', '<!--/GLANCE:cards-->');
const sub = between(home, '<!--GLANCE:sub-->', '<!--/GLANCE:sub-->');
const cardDates = [];
const dateRe = /data-glance-date="(\d{4}-\d{2}-\d{2})"/g;
let m;
while ((m = dateRe.exec(cards))) cardDates.push(m[1]);
const glanceNewest = cardDates.slice().sort().pop() || '';

check('feed has a newest day-dated item', !!newestPost, newestIso);
check('At a Glance has sourced cards', cardDates.length > 0, String(cardDates.length));
check('At a Glance does not lag the newest feed item', glanceNewest === newestIso, glanceNewest + ' vs ' + newestIso);
check('At a Glance includes the newest headline', !!(newestPost && cards.indexOf('data-glance-headline="' + escAttr(newestPost.headline) + '"') >= 0), newestPost && newestPost.headline);
check('At a Glance shows the latest sourced date', sub.indexOf(labelOf(newestIso)) >= 0, sub.replace(/\s+/g, ' ').trim());
check('glance cards are not the old hand-written blurbs', cards.indexOf('SEC awards SPTC') < 0 && cards.indexOf('Weidmann commits') < 0);

console.log('=== 15 OCT 2026 TED DAILY INTEL ===');
const intel = fs.readFileSync('intel.html', 'utf8');
const timeline = between(intel, '<!--SSR:intel-timeline-->', '<!--/SSR:intel-timeline-->');
const articles = timeline.split('<article ').slice(1);
const tedUrls = [
  'https://ted.europa.eu/en/notice/-/detail/712579-2026',
  'https://ted.europa.eu/en/notice/-/detail/711752-2026',
  'https://ted.europa.eu/en/notice/-/detail/713576-2026',
  'https://ted.europa.eu/en/notice/-/detail/711561-2026',
  'https://ted.europa.eu/en/notice/-/detail/712707-2026',
  'https://ted.europa.eu/en/notice/-/detail/713886-2026',
  'https://ted.europa.eu/en/notice/-/detail/711669-2026',
  'https://ted.europa.eu/en/notice/-/detail/711925-2026',
  'https://ted.europa.eu/en/notice/-/detail/713963-2026'
];
check('timeline has nine TED notice slots to check', tedUrls.length === 9);
tedUrls.forEach(function (url) {
  const art = articles.find(function (a) { return a.indexOf(url) >= 0; });
  const id = url.slice(url.lastIndexOf('/') + 1);
  check(id + ' renders as a Daily Intel item', !!art);
  check(id + ' links its TED source', !!(art && art.indexOf('href="' + url + '"') >= 0));
  check(id + ' shows 15 Oct 2026', !!(art && art.indexOf('>15 Oct 2026<') >= 0));
});

if (failed) {
  console.error('\nHOMEPAGE GLANCE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('\nHomepage glance matches the feed' + (newestPost ? ' · ' + labelOf(newestIso) + ' · ' + newestPost.headline : '') + '.');
