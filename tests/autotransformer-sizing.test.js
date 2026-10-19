#!/usr/bin/env node
/* autotransformer-sizing.test.js — co-ratio, equivalent rating, winding currents.
 * The worked check is 100 MVA at 132/66 kV: 50 MVA, I_LV 874.8 A, series and
 * common 437.4 A. No turns ratio and no impedance split.
 */
'use strict';
var sizing = require('../viz/autotransformer-sizing.js');
var problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }

console.log('AUTOTRANSFORMER SIZING\n');
var r = sizing.autotransformerSizing({ throughMva: 100, hvKv: 132, lvKv: 66 });
ok(r.ok === true, '100 MVA, 132/66 kV is accepted');
ok(Math.abs(r.coRatio - 0.5) < 1e-12, 'co-ratio is 1 − 66/132 = 0.5');
ok(Math.abs(r.equivalentMva - 50) < 1e-9, 'equivalent rating is 50 MVA');
ok(r.equivalentMvaText === '50', 'equivalent rating displays as 50 MVA');
ok(r.iLvText === '874.8', 'I_LV displays as 874.8 A');
ok(r.iSeriesText === '437.4', 'series current displays as 437.4 A');
ok(r.iCommonText === '437.4', 'common current displays as 437.4 A');
ok(Math.abs(r.iLvA - (100000 / (Math.sqrt(3) * 66))) < 1e-9, 'I_LV = S / (√3 · V_LV)');
ok(Math.abs(r.iSeriesA - (100000 / (Math.sqrt(3) * 132))) < 1e-9, 'series current is the HV line current');
ok(Math.abs(r.iCommonA - (r.iLvA - r.iSeriesA)) < 1e-9, 'common current is I_LV − I_HV');
ok(!Object.prototype.hasOwnProperty.call(r, 'turns') && !Object.prototype.hasOwnProperty.call(r, 'zPercent'), 'result has no turns ratio and no impedance split');

var bad = sizing.autotransformerSizing({ throughMva: 100, hvKv: 66, lvKv: 132 });
ok(bad.ok === false && !bad.equivalentMva, 'HV must be higher than LV');
var zero = sizing.autotransformerSizing({ throughMva: 0, hvKv: 132, lvKv: 66 });
ok(zero.ok === false, 'zero throughput is rejected');

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  process.exit(1);
}
console.log('\nAUTOTRANSFORMER SIZING OK');
