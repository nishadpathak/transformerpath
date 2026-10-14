#!/usr/bin/env node
/* tests/company-timeline-regression.js
 * Kolektor Etra 8 Oct Barajevo item is on the company timeline and /intelligence.
 * TARIL and Voltamp October items are on their timelines.
 * Latest company activity on /intelligence is not older than the newest Intel
 * item that resolves to a company.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

function read(p) { return fs.readFileSync(p, 'utf8'); }

console.log('=== COMPANY TIMELINE REGRESSION ===');
const devs = JSON.parse(read('data/company-developments.json'));
function row(name) { return devs.find(function (d) { return d.name === name; }); }

const kolektor = row('Kolektor ETRA');
check('Kolektor ETRA has developments', !!kolektor);
const barajevo = kolektor && kolektor.developments.find(function (d) { return /Barajevo/i.test(d.title) && d.date_iso === '2026-10-08'; });
check('Kolektor Barajevo item is 2026-10-08', !!barajevo);
check('Kolektor Barajevo facility_id is unset (no SOURCED plant)', !barajevo || barajevo.facility_id == null);

const kolektorPage = 'manufacturers/kolektor-etra/index.html';
check('Kolektor profile exists', fs.existsSync(kolektorPage));
if (fs.existsSync(kolektorPage)) {
  const html = read(kolektorPage);
  check('Kolektor timeline contains Barajevo', /Barajevo/.test(html) && /Company timeline/.test(html));
}

const tarilPage = 'manufacturers/transformers-and-rectifiers-india-taril/index.html';
if (fs.existsSync(tarilPage)) {
  const html = read(tarilPage);
  check('TARIL timeline contains 8 Oct DVC order', /TARIL wins DVC order/.test(html) && /8 Oct 2026/.test(html));
} else check('TARIL profile exists', false);

const voltampPage = 'manufacturers/voltamp-transformers/index.html';
if (fs.existsSync(voltampPage)) {
  const html = read(voltampPage);
  check('Voltamp timeline contains Unit-III Jarod', /Unit-III/.test(html) && /Jarod/.test(html));
} else check('Voltamp profile exists', false);

const intel = read('intelligence.html');
const actAt = intel.indexOf('Latest company activity');
check('intelligence has Latest company activity', actAt >= 0);
const activity = actAt >= 0 ? intel.slice(actAt, actAt + 20000) : '';
check('intelligence activity contains Barajevo', /Barajevo/.test(activity));

const dates = activity.match(/20\d{2}-\d{2}-\d{2}/g) || [];
const latestActivity = dates.slice().sort().pop() || '';
let newestResolved = '';
devs.forEach(function (d) {
  (d.developments || []).forEach(function (x) {
    if (x.date_iso && x.date_iso > newestResolved) newestResolved = x.date_iso;
  });
});
check('latest company activity is not older than newest resolved Intel item', latestActivity >= newestResolved, latestActivity + ' vs ' + newestResolved);

if (failed) {
  console.error('COMPANY TIMELINE REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('COMPANY TIMELINE REGRESSION OK — activity ' + latestActivity + ', newest resolved ' + newestResolved);
