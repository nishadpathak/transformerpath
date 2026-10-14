#!/usr/bin/env node
/* tests/intel-tender-parity.js
 * Every CONFIRMED tender-class Intel item with an official procurement ID
 * is in tenders.json. The newest company-linked event on /intelligence is
 * at least as new as the newest company-linked Intel item.
 */
'use strict';
const fs = require('fs');
const { dateFromSrcUtc } = require('../lib/src-date');

const OFFICIAL = {
  'dewa.gov.ae': true,
  'tenders.etimad.sa': true,
  'etimad.sa': true,
  'tenderboard.gov.bh': true
};
const INVENTED = { 'KW-MEWRE-75MVA-RELOC': true };

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (e) { return ''; }
}

const intel = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const items = Object.keys(intel).flatMap(function (r) { return (intel[r] && intel[r].items) || []; });
const tenders = (JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders) || [];
const ids = {};
tenders.forEach(function (t) {
  if (t.procurement_id) ids[String(t.procurement_id)] = t;
  (t.source_urls || []).forEach(function () {});
  const blob = JSON.stringify(t);
  const m = blob.match(/"procurement_id":"([^"]+)"/);
  if (m) ids[m[1]] = t;
});

let failed = 0;
function fail(msg) { console.error('FAIL ' + msg); failed++; }

items.forEach(function (it) {
  const confirmed = it.cls === 'CONFIRMED' || it.evidence_grade === 'CONFIRMED';
  const tenderClass = (it.classifications || []).indexOf('TENDER') >= 0;
  const pid = String(it.tender_id || '').trim();
  if (!confirmed || !tenderClass || !pid || INVENTED[pid]) return;
  if (!OFFICIAL[hostOf(it.url)]) return;
  const hit = tenders.some(function (t) {
    return String(t.procurement_id || '') === pid || JSON.stringify(t).indexOf(pid) >= 0;
  });
  if (!hit) fail('CONFIRMED official procurement ' + pid + ' missing from tenders.json (' + (it.title || '').slice(0, 80) + ')');
});

const dev = JSON.parse(fs.readFileSync('data/company-developments.json', 'utf8'));
const events = JSON.parse(fs.readFileSync('data/entity-events.json', 'utf8'));
let maxIntel = '';
dev.forEach(function (co) {
  (co.developments || []).forEach(function (d) {
    const day = dateFromSrcUtc(d.src, d.date_iso);
    if (day > maxIntel) maxIntel = day;
  });
});
let maxEvent = '';
const companies = events.companies_events || {};
Object.keys(companies).forEach(function (k) {
  (companies[k].events || []).forEach(function (e) {
    if (e.date && e.date > maxEvent) maxEvent = e.date;
  });
});
if (!maxIntel) fail('no company-linked Intel date');
else if (maxEvent < maxIntel) fail('intelligence max event ' + maxEvent + ' is behind Intel ' + maxIntel);
else console.log('  company-linked dates: intelligence ' + maxEvent + ' >= intel ' + maxIntel);

if (failed) {
  console.error('INTEL/TENDER PARITY: ' + failed + ' failure(s)');
  process.exit(1);
}
console.log('PASS — intel/tender parity');
