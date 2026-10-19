#!/usr/bin/env node
/* nameplate-short-circuit.test.js
 * 63 MVA, 230 kV, 12.5% is about 1.265 kA.
 * 504 is the short-circuit power in MVA (S/z), not a current in kA.
 */
'use strict';
var np = require('../viz/nameplate-short-circuit.js');
var problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }

console.log('NAMEPLATE SHORT-CIRCUIT\n');
var r = np.nameplateShortCircuit({ mva: 63, kv: 230, ukPercent: 12.5 });
var expectedKa = 504 / (Math.sqrt(3) * 230);
ok(r.ok === true, '63 MVA, 230 kV, 12.5% is accepted');
ok(Math.abs(r.multiple - 8) < 1e-12, 'multiple is 100/uk% = 8');
ok(Math.abs(r.scKa - expectedKa) < 1e-9, 'kA is I_rated × (100/uk%) / 1000');
ok(Math.abs(r.scKa - 1.265) < 0.001, 'about 1.265 kA');
ok(r.scKaText === '1.265', 'kA displays as 1.265');
ok(Math.abs(r.scMva - 504) < 1e-9, 'short-circuit power is 504 MVA');
ok(r.scMvaText === '504', 'MVA displays as 504');
ok(r.scKaText !== '504' && r.scKaText !== '504000' && r.scKaText !== '504000.00', 'kA text is not the MVA figure');
ok(Math.abs(r.scKa - 504) > 1 && Math.abs(r.scKa - 504000) > 1, 'kA value is neither 504 nor 504000');
ok(Math.abs(r.scA - 1265.15) < 0.2, 'symmetrical current is about 1265 A');
ok(Math.abs(r.ratedA - (63000 / (Math.sqrt(3) * 230))) < 1e-6, 'rated current uses S_kVA / (√3 · kV)');

var bad = np.nameplateShortCircuit({ mva: 63, kv: 230, ukPercent: 0 });
ok(bad.ok === false && bad.scKa == null, 'zero impedance is rejected and returns no kA');

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  process.exit(1);
}
console.log('\nNAMEPLATE SHORT-CIRCUIT OK');
