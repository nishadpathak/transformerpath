#!/usr/bin/env node
/* The 15 Nov 2026 directory batch: listings render, outreach flags do not. */
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

const manifest = JSON.parse(read('data/directory-batch-manifest.json'));
check('batch added listings', (manifest.added || []).length >= 120, String((manifest.added || []).length));
check('batch skipped listings that were already present', (manifest.skipped || []).length >= 16, String((manifest.skipped || []).length));

const hubs = {
  'approved-vendors': ['data/approved-vendors.json', 'approved-vendors.html', 'approved-vendors'],
  epc: ['data/epc-contractors.json', 'epc.html', 'epc'],
  monitoring: ['data/monitoring-software.json', 'monitoring.html', 'monitoring'],
  recycling: ['data/recycling.json', 'recycling.html', 'recycling']
};
Object.keys(hubs).forEach(function (key) {
  const spec = hubs[key];
  const rows = JSON.parse(read(spec[0])).companies || [];
  const hub = read(spec[1]);
  check(spec[1] + ' has no outreach flag', !/do_not_contact|never_contact|outreach_flags/i.test(hub));
  check(spec[1] + ' has no banned name', !new RegExp(['nis' + 'had', 'elin' + 'ts', 'hed' + 'rich', 'consult' + 'ing'].join('|'), 'i').test(hub));
  rows.forEach(function (row) {
    check(row.name + ' is on ' + spec[1], hub.indexOf(row.name) !== -1);
    const profile = spec[2] + '/' + row.slug + '/index.html';
    check(row.name + ' profile exists', exists(profile));
    if (!exists(profile)) return;
    const html = read(profile);
    check(row.name + ' profile is indexable', /content="index,follow"/.test(html));
    check(row.name + ' profile hides outreach flags', !/do_not_contact|never_contact|outreach_flags/i.test(html));
  });
});

const services = JSON.parse(read('data/services.json')).services.filter(function (row) { return row.directory_publish === true; });
services.forEach(function (row) {
  const rel = 'services/' + String(row.id).replace(/^srv:/, '') + '/index.html';
  check(row.company_name + ' service profile exists', exists(rel));
  if (!exists(rel)) return;
  const html = read(rel);
  check(row.company_name + ' service profile hides flags', !/do_not_contact|never_contact/i.test(html) && /content="index,follow"/.test(html));
});

if (failed) {
  console.error('DIRECTORY BATCH FAILED (' + failed + ')');
  process.exit(1);
}
console.log('DIRECTORY BATCH OK');
