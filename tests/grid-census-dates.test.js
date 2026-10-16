#!/usr/bin/env node
/* The grid census verification date stays 7 July 2026.
 * Each operator row and utility profile shows that operator record's own
 * updated date from data/grid-operator-dates.json (git blame of the operator
 * lines). The census date is not reused as an operator date, and the utility
 * page does not stamp the build clock.
 */
'use strict';
const fs = require('fs');
const dates = require('../lib/grid-record-dates');

const problems = [];
function ok(c, m) {
  console.log((c ? '  ok — ' : '  ✗ ') + m);
  if (!c) problems.push(m);
}
function read(rel) { return fs.readFileSync(rel, 'utf8'); }

console.log('GRID CENSUS VS OPERATOR DATES\n');
const doc = dates.load();
ok(doc.census_verified === '2026-07-07', 'census verification is 2026-07-07');
ok(dates.censusLabel(doc) === 'Census verified 7 July 2026', 'census label is 7 July 2026');
ok(dates.operatorLabel('DEWA', doc) === 'Record updated 11 July 2026', 'DEWA record is 11 July 2026');
ok(dates.operatorLabel('PLN', doc) === 'Record updated 28 August 2026', 'PLN record is 28 August 2026');
ok(dates.operatorLabel('Not A Real Operator', doc) === 'Record updated: Not available', 'unknown operator is not given a date');
const operatorDays = Object.keys(doc.operators).map(function (name) { return doc.operators[name]; });
ok(operatorDays.length === 166, '166 operator record dates');
ok(operatorDays.every(function (day) { return day !== doc.census_verified; }), 'no operator record uses the census verification date');
ok(operatorDays.filter(function (day) { return day === '2026-07-11'; }).length === 154, '154 operator records updated 11 July 2026');
ok(operatorDays.filter(function (day) { return day === '2026-10-16'; }).length === 2, 'KEGOC and EDC records updated 16 October 2026');
ok(operatorDays.filter(function (day) { return day === '2026-08-28'; }).length === 10, '10 operator records updated 28 August 2026');

const blamed = dates.blameOperatorDates();
if (blamed) {
  const drift = Object.keys(doc.operators).filter(function (name) { return blamed[name] !== doc.operators[name]; });
  ok(drift.length === 0, 'committed operator dates match git blame' + (drift.length ? ': ' + drift.slice(0, 5).join(', ') : ''));
} else {
  console.log('  ok — blame skipped (shallow history)');
}

const grids = read('grids.html');
ok(grids.includes('const LAST_VERIFIED = "2026-07-07"'), 'directory keeps the census constant');
ok(grids.includes('Census verified 7 July 2026'), 'directory shows the census label');
ok(!grids.includes('Data last verified 2026-07-07'), 'directory no longer presents the census date as a single data stamp');
ok((grids.match(/Record updated 11 July 2026/g) || []).length === 154, 'directory lists 154 records updated 11 July 2026');
ok((grids.match(/Record updated 16 October 2026/g) || []).length === 2, 'directory lists KEGOC and EDC updated 16 October 2026');
ok((grids.match(/Record updated 28 August 2026/g) || []).length === 10, 'directory lists 10 records updated 28 August 2026');

const germany = read('grids/germany/index.html');
ok(germany.includes('Census verified 7 July 2026'), 'Germany page shows the census date');
ok((germany.match(/Record updated 11 July 2026/g) || []).length === 4, 'Germany shows four operator record dates');

const indonesia = read('grids/indonesia/index.html');
ok(indonesia.includes('Census verified 7 July 2026'), 'Indonesia page shows the census date');
ok(indonesia.includes('Record updated 28 August 2026'), 'Indonesia shows the PLN record date');

const dewa = read('utilities/dewa/index.html');
ok(dewa.includes('Census verified 7 July 2026. Record updated 11 July 2026.'), 'DEWA profile states both dates');
ok(!/Last reviewed:/.test(dewa), 'DEWA profile does not use a last-reviewed stamp');

const builder = read('build-utilities.js');
ok(!builder.includes('new Date().toISOString()'), 'utility builder does not stamp the build clock');

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  problems.forEach(function (m) { console.error('  ' + m); });
  process.exit(1);
}
console.log('\nGRID CENSUS VS OPERATOR DATES OK');
