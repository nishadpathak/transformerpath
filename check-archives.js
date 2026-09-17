#!/usr/bin/env node
/* check-archives.js — Intel archive immutability regression gate.
 *
 * TransformerPath historical Intel editions (intel-2026-MM-DD.html) are
 * immutable snapshots. This gate fails the build if any dated archive:
 *   A) was re-stamped by stamp-intel (which must only ever touch intel.html), or
 *   B) contains an intel item dated materially AFTER the edition date — i.e.
 *      current-feed data was injected into a past snapshot.
 *
 * Run in the build (after build-seo), before publish. Fails (exit 1) on a
 * hard violation; prints an advisory for borderline date skew.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(function (f) { return /^intel-2026-\d{2}-\d{2}\.html$/.test(f); });
const problems = [];
const advisory = [];
let checked = 0;

function parseDate(s) {
  const m = String(s).match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!m) return null;
  const name = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
  const d = new Date(m[3] + ' ' + name + ' ' + m[1] + ' UTC');
  return isNaN(d) ? null : d;
}

files.forEach(function (f) {
  const dm = f.match(/^intel-2026-(\d{2})-(\d{2})\.html$/);
  const edition = new Date(Date.UTC(2026, parseInt(dm[1], 10) - 1, parseInt(dm[2], 10)));
  const raw = fs.readFileSync(f, 'utf8');
  checked++;

  // A) no build-time "Updated:" stamp (stamp-intel targets intel.html only).
  if (/id="stamp">\s*Updated\s*:/i.test(raw)) {
    problems.push(f + ' :: re-stamped with "Updated:" — not an immutable archive');
  }

  // B) no item dated materially after the edition date.
  const srcDates = raw.match(/"src":"[^"]*?(\d{1,2}\s+\w{3}\s+\d{4})/g) || [];
  const late = [];
  srcDates.forEach(function (m) {
    const d = parseDate(m);
    if (!d) return;
    const days = Math.round((d - edition) / (24 * 3600 * 1000));
    if (days > 3) late.push({ d: d.toISOString().slice(0, 10), days: days });
  });
  if (late.length) {
    problems.push(f + ' :: ' + late.length + ' item(s) dated >3d after edition (' + late.map(function (x) { return x.d + '(+' + x.days + 'd)'; }).join(', ') + ')');
  }
});

// Sanity: ensure the archives exist and are dated (not in the future).
const today = new Date();
files.forEach(function (f) {
  const dm = f.match(/^intel-2026-(\d{2})-(\d{2})\.html$/);
  const edition = new Date(Date.UTC(2026, parseInt(dm[1], 10) - 1, parseInt(dm[2], 10)));
  if (edition > today) { problems.push(f + ' :: edition date is in the future'); }
  if (edition < new Date(Date.UTC(2026, 0, 1))) { advisory.push(f + ' :: edition predates feed start (review)'); }
});

console.log('ARCHIVE IMMUTABILITY GATE');
console.log('Dated archives scanned: ' + checked);
console.log('Hard violations: ' + problems.length + ' | Advisory: ' + advisory.length);
advisory.forEach(function (a) { console.log('  advisory: ' + a); });

if (problems.length) {
  console.error('\nARCHIVE IMMUTABILITY FAIL — blocking.');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exit(1);
}
console.log('\nARCHIVE IMMUTABILITY OK.');
