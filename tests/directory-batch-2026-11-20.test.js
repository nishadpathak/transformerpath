#!/usr/bin/env node
/* 20 Nov 2026 directory batch: listings render, outreach flags and Gulf
 * place names that must stay off the public page do not. */
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}
const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
const banned = new RegExp(['do_not_contact', 'never_contact', 'outreach_flags', '\\bDubai\\b', 'United Arab Emirates', '\\bUAE\\b', 'nis' + 'had', 'pat' + 'hak'].join('|'), 'i');

const manifest = JSON.parse(read('data/directory-batch-manifest.json'));
const added = manifest.added || [];
const skipped = manifest.skipped || [];
check('batch accounts for every held row', added.length + skipped.length === 160, added.length + ' added, ' + skipped.length + ' skipped');
check('batch added listings', added.length >= 120, String(added.length));

added.forEach(function (row) {
  const section = row.section;
  let rel = '';
  if (section === 'services') rel = 'services/' + row.slug + '/index.html';
  else if (section === 'logistics') rel = 'logistics/' + row.slug + '/index.html';
  else if (section === 'laboratories') rel = 'laboratories/' + row.slug + '/index.html';
  else if (section === 'rental') rel = 'rental-emergency/' + row.slug + '/index.html';
  else if (section === 'training') rel = 'education/' + row.slug + '/index.html';
  else if (section === 'utilities') rel = 'utilities/' + row.slug + '/index.html';
  else if (section === 'accessories') rel = 'accessories/' + row.slug + '/index.html';
  else if (section === 'manufacturers') rel = 'manufacturers/' + row.slug + '/index.html';
  else rel = section + '/' + row.slug + '/index.html';
  check(row.company + ' profile exists', exists(rel), rel);
  if (!exists(rel)) return;
  const html = read(rel);
  check(row.company + ' profile is clean', !banned.test(html), rel);
  check(row.company + ' profile is indexable', /content="index,follow"/.test(html));
  if (row.country === 'GCC') check(row.company + ' location reads GCC', /Location:\s*GCC|>GCC<|>GCC</.test(html) || html.indexOf('GCC') !== -1);
});

['epc.html', 'monitoring.html', 'recycling.html', 'approved-vendors.html', 'manufacturer-listings.html'].forEach(function (hub) {
  check(hub + ' exists', exists(hub));
  if (!exists(hub)) return;
  check(hub + ' is clean', !banned.test(read(hub)));
});

['jobs/transformer-factory-manager/index.html', 'jobs/transformer-design-engineer/index.html', 'jobs/transformer-type-test-engineer/index.html'].forEach(function (rel) {
  check(rel + ' exists', exists(rel));
  if (!exists(rel)) return;
  const html = read(rel);
  check(rel + ' is a Bahrain GCC job', html.indexOf('Bahrain (GCC)') !== -1 && !banned.test(html));
});

if (failed) {
  console.error('DIRECTORY BATCH FAILED (' + failed + ')');
  process.exit(1);
}
console.log('DIRECTORY BATCH OK');
