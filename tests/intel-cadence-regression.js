#!/usr/bin/env node
/* Coverage cadence is published from the registries. Market pages keep
 * their own coverage line. No frequency is invented. */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

console.log('=== INTEL COVERAGE CADENCE ===');
const cadence = JSON.parse(fs.readFileSync('data/intel-cadence.json', 'utf8'));
const gcc = JSON.parse(fs.readFileSync('data/gcc-source-registry.json', 'utf8'));
const registry = JSON.parse(fs.readFileSync('data/source-registry.json', 'utf8'));
const method = fs.readFileSync('methodology.html', 'utf8');
const intel = fs.readFileSync('intel.html', 'utf8');
const uae = fs.readFileSync('markets/uae/index.html', 'utf8');

check('methodology has the cadence section', method.indexOf('id="coverage-cadence"') >= 0);
check('intel.html points at the cadence section', /methodology\.html#coverage-cadence/.test(intel));
check('UAE market page still carries its coverage line', /id="gcc-coverage"/.test(uae));
check('cadence page does not replace market coverage with a single GCC status', method.indexOf('id="gcc-coverage"') < 0);

const flat = [];
(cadence.countries || []).forEach(function (c) {
  (c.sources || []).forEach(function (s) { flat.push(s); });
});

(gcc.sources || []).forEach(function (s) {
  const row = flat.find(function (x) { return x.source_id === s.source_id && x.registry === 'gcc-source-registry'; });
  check('GCC source ' + s.source_id + ' is published', !!row);
  if (!row) return;
  check(s.source_id + ' cadence matches the registry', row.cadence === s.crawl_frequency, row.cadence + ' vs ' + s.crawl_frequency);
  check(s.source_id + ' appears on the methodology page', method.indexOf(s.source_id) >= 0);
});

const gccIds = {};
(gcc.sources || []).forEach(function (s) { gccIds[s.source_id] = 1; });
(registry.sources || []).forEach(function (s) {
  if (gccIds[s.source_id]) {
    const dupes = flat.filter(function (x) { return x.source_id === s.source_id; });
    check(s.source_id + ' is published once, from the registry that records a cadence', dupes.length === 1 && dupes[0].registry === 'gcc-source-registry');
    return;
  }
  const row = flat.find(function (x) { return x.source_id === s.source_id && x.registry === 'source-registry'; });
  check('registry source ' + s.source_id + ' is published', !!row);
  if (!row) return;
  if (!s.crawl_frequency) check(s.source_id + ' cadence stays Not recorded', row.cadence_label === 'Not recorded' && row.cadence == null);
});

const meed = flat.find(function (s) { return s.source_id === 'meed'; });
check('MEED keeps a blank country as not recorded', !!(meed && !meed.country) && method.indexOf('Country not recorded') >= 0);

const toml = fs.readFileSync('netlify.toml', 'utf8');
(cadence.jobs || []).forEach(function (job) {
  check(job.id + ' schedule matches netlify.toml', toml.indexOf('schedule = "' + job.schedule + '"') >= 0, job.schedule);
  check(job.id + ' is on the methodology page', method.indexOf(job.id) >= 0 && method.indexOf(job.schedule) >= 0);
});

if (failed) {
  console.error('INTEL COVERAGE CADENCE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('INTEL COVERAGE CADENCE OK — ' + flat.length + ' sources');
