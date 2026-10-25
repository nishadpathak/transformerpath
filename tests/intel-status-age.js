#!/usr/bin/env node
/* The public Intel label must follow the sourced calendar day on the day
 * someone opens the page. A same-day source reads "Updated <date>".
 * That label has to age with lib/intel-freshness.js and tp-freshness.js.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const { classifyIntelStatus, statusDotColor } = require('../lib/intel-freshness');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const sandbox = {
  console: console,
  Date: Date,
  document: {
    readyState: 'loading',
    addEventListener: function () {},
    querySelectorAll: function () { return []; },
    getElementById: function () { return null; }
  }
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('tp-freshness.js', 'utf8'), sandbox, { filename: 'tp-freshness.js' });
const clock = sandbox.TPIntelClock;
check('browser clock is installed', !!(clock && clock.classify && clock.dot));

const now = new Date('2026-10-19T12:00:00Z');
const cases = [
  ['2026-10-19', 'Updated 19 Oct 2026'],
  ['2026-10-18', 'UPDATED 18 Oct 2026'],
  ['2026-10-17', 'DATA CURRENT'],
  ['2026-10-16', 'DATA CURRENT'],
  ['2026-10-14', 'REFRESH DELAYED'],
  ['2026-10-08', 'INTEL COVERAGE DELAYED'],
  ['2026-09-01', 'DATA STALE'],
  ['2026-10-20', 'INTEL COVERAGE DELAYED']
];
cases.forEach(function (row) {
  const node = classifyIntelStatus({ latestSourceIso: row[0], now: now });
  const browser = clock.classify({ latestSourceIso: row[0], now: now });
  check(row[0] + ' node label', node.statusLabel === row[1], node.statusLabel);
  check(row[0] + ' browser matches node', browser.statusLabel === node.statusLabel && browser.reason === node.reason, browser.statusLabel + ' / ' + browser.reason);
  check(row[0] + ' dot matches', clock.dot(browser.statusLabel) === statusDotColor(node.statusLabel));
});

const home = fs.readFileSync('index.html', 'utf8');
const intel = fs.readFileSync('intel.html', 'utf8');
check('homepage fetch uses the live clock', /TPIntelClock\.classify\(/.test(home));
check('intel stamp uses the live clock', /TPIntelClock\.classify\(/.test(intel));
check('intel freshness line uses the live clock', (intel.match(/TPIntelClock\.classify\(/g) || []).length >= 2);
check('homepage does not bake a coverage-delayed fallback', home.indexOf('COVERAGE DELAYED') === -1);

const status = JSON.parse(fs.readFileSync('data/intel-status.json', 'utf8'));
const aged = classifyIntelStatus({ latestSourceIso: status.latest_source_iso, now: new Date() });
if (aged.ageDays > 0) {
  check('stored source day is not the words Updated today', aged.statusLabel !== 'Updated today', aged.statusLabel + ' age ' + aged.ageDays);
  check('stored source label names its calendar day when it says Updated', !/^updated /i.test(aged.statusLabel) || aged.statusLabel.slice(8) === aged.latest_source_date, aged.statusLabel);
  check('browser agrees for the stored source day', clock.classify({
    latestSourceIso: status.latest_source_iso,
    now: new Date()
  }).statusLabel === aged.statusLabel);
}

if (failed) {
  console.error('INTEL STATUS AGE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('INTEL STATUS AGE OK');
