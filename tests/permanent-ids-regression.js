#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { execSync } = require('child_process');

const STABLE = {
  'cg-power-and-industrial-solutions': 'TPM-000117',
  'hitachi-energy': 'TPM-000329',
  'a-plus-power-solution': 'TPM-000001'
};
const STABLE_FACILITY = {
  'fac:hitachi-energy-usa:south-boston-va': 'TPF-000001'
};

function load() {
  return JSON.parse(fs.readFileSync('data/permanent-ids.json', 'utf8'));
}

function fail(msg) {
  console.error('FAIL — ' + msg);
  process.exit(1);
}

const before = load();
Object.keys(STABLE).forEach(function (slug) {
  if (!before.companies[slug] || before.companies[slug].id !== STABLE[slug]) {
    fail(slug + ' should keep ' + STABLE[slug]);
  }
});
Object.keys(STABLE_FACILITY).forEach(function (fid) {
  if (!before.facilities[fid] || before.facilities[fid].id !== STABLE_FACILITY[fid]) {
    fail(fid + ' should keep ' + STABLE_FACILITY[fid]);
  }
});

const snapshot = {};
Object.keys(before.companies).forEach(function (slug) {
  snapshot[slug] = before.companies[slug].id;
});
const facilitySnapshot = {};
Object.keys(before.facilities).forEach(function (fid) {
  facilitySnapshot[fid] = before.facilities[fid].id;
});

execSync('node build-permanent-ids.js', { stdio: 'pipe' });
const after = load();

Object.keys(snapshot).forEach(function (slug) {
  if (!after.companies[slug] || after.companies[slug].id !== snapshot[slug]) {
    fail('TPM id changed for ' + slug);
  }
});
Object.keys(facilitySnapshot).forEach(function (fid) {
  if (!after.facilities[fid] || after.facilities[fid].id !== facilitySnapshot[fid]) {
    fail('TPF id changed for ' + fid);
  }
});
if (after.counts.companies < 900) {
  fail('expected the existing manufacturer ID registry to stay above 900, got ' + after.counts.companies);
}
if (after.next_company_n !== after.counts.next_company_n) {
  fail('company counter drifted');
}

const used = {};
Object.keys(after.companies).forEach(function (slug) {
  const id = after.companies[slug].id;
  if (!/^TPM-\d{6}$/.test(id)) fail('bad company id ' + id);
  if (used[id]) fail('reused company id ' + id);
  used[id] = slug;
});
Object.keys(after.facilities).forEach(function (fid) {
  const id = after.facilities[fid].id;
  if (!/^TPF-\d{6}$/.test(id)) fail('bad facility id ' + id);
  if (used[id]) fail('reused facility id ' + id);
  used[id] = fid;
});

const hitachi = fs.readFileSync('manufacturers/hitachi-energy/index.html', 'utf8');
if (hitachi.indexOf('data-copy-id="TPM-000329"') < 0) {
  fail('Hitachi Energy profile is missing the copy button for TPM-000329');
}
const cg = fs.readFileSync('manufacturers/cg-power-and-industrial-solutions/index.html', 'utf8');
if (cg.indexOf('data-copy-id="TPM-000117"') < 0) {
  fail('CG Power profile is missing the copy button for TPM-000117');
}

console.log('PASS — permanent IDs stable (CG ' + STABLE['cg-power-and-industrial-solutions'] +
  '; Hitachi ' + STABLE['hitachi-energy'] + '; ' + after.counts.companies + ' TPM / ' +
  after.counts.facilities + ' TPF)');
