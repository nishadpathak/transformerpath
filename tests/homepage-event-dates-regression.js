#!/usr/bin/env node
/* Homepage event dates must match the canonical edition records.
 * Saudi Elenex is 1–4 Nov 2027. A 2–5 November copy must not
 * be printed on the homepage or written back by the events migration.
 * Run: node tests/homepage-event-dates-regression.js
 */
'use strict';
const fs = require('fs');
const { platformToday } = require('../lib/event-status');
const { homepageEventsSentence, rangeLabel } = require('../lib/homepage-events');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

function byId(list, id) {
  return (list || []).find(function (e) { return e && e.id === id; });
}

console.log('=== HOMEPAGE EVENT DATES ===');
const events = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const canonFile = JSON.parse(fs.readFileSync('data/events-canonical.json', 'utf8'));
const canon = canonFile.canonical_editions || [];
const today = platformToday();
const elenex = byId(events, 'saudi-elenex-2027');
const elenexCanon = byId(canon, 'saudi-elenex-2027');

check('events.json has Saudi Elenex 2027', !!elenex);
check('canonical editions have Saudi Elenex 2027', !!elenexCanon);
check('Saudi Elenex starts 1 Nov 2027', elenex && elenex.start === '2027-11-01' && elenexCanon && elenexCanon.start === '2027-11-01', (elenex && elenex.start) + ' / ' + (elenexCanon && elenexCanon.start));
check('Saudi Elenex ends 4 Nov 2027', elenex && elenex.end === '2027-11-04' && elenexCanon && elenexCanon.end === '2027-11-04', (elenex && elenex.end) + ' / ' + (elenexCanon && elenexCanon.end));
check('Saudi Elenex dates agree between events.json and the canonical record', elenex && elenexCanon && elenex.start === elenexCanon.start && elenex.end === elenexCanon.end);

const home = fs.readFileSync('index.html', 'utf8');
const para = (home.match(/<p id="home-next-events">([\s\S]*?)<\/p>/) || [])[1] || '';
const expected = homepageEventsSentence(canon, today);
check('homepage events paragraph is present', para.length > 0);
check('homepage events paragraph matches the canonical editions', para === expected, para + ' vs ' + expected);

const body = para.replace(/^Next confirmed editions: /, '').replace(new RegExp('\\. Official pages checked ' + today.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.$'), '');
const pieces = body ? body.split('; ') : [];
check('homepage lists at least one confirmed edition', pieces.length > 0, body);
const dateTail = /^(.*) \((\d{1,2}(?:\u2013\d{1,2})? [A-Z][a-z]{2} \d{4}(?:\u2013\d{1,2} [A-Z][a-z]{2} \d{4})?)\)$/;
pieces.forEach(function (piece) {
  const m = piece.match(dateTail);
  check('edition label has a date: ' + piece, !!m, piece);
  if (!m) return;
  const name = m[1];
  const printed = m[2];
  const rec = canon.find(function (e) { return (e.name || e.n) === name; }) || events.find(function (e) { return (e.name || e.n) === name; });
  check(name + ' is an events record', !!rec);
  if (!rec) return;
  const want = rangeLabel(rec.start || rec.s, rec.end || rec.e);
  check(name + ' homepage date matches events data', printed === want, printed + ' vs ' + want);
});

check('homepage prints Saudi Elenex 2027 as 1–4 Nov 2027', para.indexOf('Saudi Elenex 2027 (1\u20134 Nov 2027)') >= 0, para);
check('homepage does not print the 2–5 November Elenex date', !/Saudi Elenex 2026 \((0?2)[\u2013-](0?5)/.test(para) && para.indexOf('2\u20135 November') < 0 && para.indexOf('02\u201305 November') < 0);

const mig = fs.readFileSync('scripts/migrate-events-depth.js', 'utf8');
const blockStart = mig.indexOf("n === 'Saudi Elenex 2026'");
const blockEnd = mig.indexOf("n === 'ELECRAMA 2027", blockStart);
const block = blockStart >= 0 && blockEnd > blockStart ? mig.slice(blockStart, blockEnd) : '';
check('migration keeps the Saudi Elenex block', block.length > 0);
check('migration stores 1–4 Nov 2027 for Saudi Elenex', /start: '2027-11-01'/.test(block) && /end: '2027-11-04'/.test(block), block.slice(0, 240));
check('migration does not write 2–5 November back onto Saudi Elenex', !/2026-11-02/.test(block) && !/2026-11-05/.test(block) && !/2\u20135 November/.test(block));

const stats = fs.readFileSync('build-site-stats.js', 'utf8');
check('homepage stamp reads the canonical event record', stats.indexOf("readJson('data/events-canonical.json'") >= 0 && stats.indexOf('homepageEventsSentence') >= 0);

if (failed) {
  console.error('\nHOMEPAGE EVENT DATES FAILED (' + failed + ')');
  process.exit(1);
}
console.log('\nHomepage event dates match the canonical editions.');
