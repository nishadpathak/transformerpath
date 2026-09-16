#!/usr/bin/env node
/* check-design.js — Design Engine validation harness (Section U).
 * Runs benchmark inputs through design-engine.js and reports honest validation
 * states. It is a GATE in spirit: it asserts that
 *   (a) no class config uses a forbidden positioning term, and
 *   (b) the engine never returns PASS where nothing was calculated / a value is
 *       missing (it must return NOT_CALCULATED or INSUFFICIENT_DATA there).
 * It does NOT assert that the physics for any class is correct — that requires
 * independent benchmark validation per class, which is a separate effort.
 *
 * Run: node check-design.js
 */
'use strict';
const de = require('./design-engine');
const fs = require('fs');

let problems = [];
function assert(ok, msg) { if (!ok) problems.push(msg); else console.log('  ok — ' + msg); }

// Positioning test: no class config uses a forbidden term.
const FORBID = de.CONFIG.positioning_rules.forbidden;
de.CONFIG.classes.forEach((c) => {
  const j = JSON.stringify(c).toLowerCase();
  FORBID.forEach((w) => { if (j.indexOf(w.toLowerCase()) >= 0) problems.push('class ' + c.key + ' config uses forbidden term "' + w + '"'); });
});
console.log('POSITIONING — forbidden terms present in class config: ' + (problems.filter((p) => /forbidden term/.test(p)).length) + '\n');

// Positioning guard on the served engineering tools: they must never over-claim.
['calculator.html', 'tools.html', 'test-report.html'].forEach((f) => {
  if (!fs.existsSync(f)) return;
  const s = fs.readFileSync(f, 'utf8').toLowerCase();
  ['iec compliant', 'ieee compliant', 'fea validated', 'cfd validated', 'manufacturing-ready', 'guaranteed design', 'certified design'].forEach((w) => {
    if (s.indexOf(w) >= 0) problems.push('served page ' + f + ' contains forbidden design claim "' + w + '"');
  });
});

// Benchmark 1: a plausible distribution transformer (CURRENT).
const dist = {
  cls: 'distribution_transformer',
  power_kva: 1000, hv_kv: 11, lv_kv: 0.433, freq: 50, voltage_ratio: 11 / 0.433, vector_group: 'Dyn11',
  flux_density_T: 1.62, flux_density_limit: 1.7,
  current_density: 3.1, current_density_limit: 3.5,
  calc_impedance_pct: 4.3, target_impedance_pct: 4.0, impedance_tolerance: 0.1,
  calc_load_loss: 10500, load_loss_limit: 11000,
  temp_rise_K: 58, temp_rise_limit: 65,
  tap_percent: 5, regulation_percent: 4, impedance_pct: 4.2,
  window_utilization: 0.74, window_utilization_limit: 0.85,
  sc_stress_MPa: 82, sc_stress_limit: 120,
  cooling_class: 'ONAN', cooling_required_kW: 26, cooling_available_kW: 30,
};
console.log('BENCHMARK 1 — distribution_transformer (status CURRENT)');
const r1 = de.validate(dist.cls, dist);
r1.checks.forEach((c) => console.log('  [' + c.status + '] ' + c.label + ' — ' + c.note));
// A valid design must not have NOT_CALCULATED/INSUFFICIENT_DATA for its structured modules.
const bad1 = r1.checks.filter((c) => c.status === 'INSUFFICIENT_DATA' || c.status === 'NOT_CALCULATED');
assert(bad1.length === 0, 'full benchmark design has no NOT_CALCULATED / INSUFFICIENT_DATA');
assert(r1.checks.some((c) => c.id === 'impedance' && c.status === 'PASS'), 'impedance within tolerance -> PASS');

// Benchmark 2: shunt reactor (SCAFFOLD) — modules not structured must be NOT_CALCULATED.
console.log('\nBENCHMARK 2 — shunt_reactor (status SCAFFOLD)');
const reactor = { mvar: 100, voltage_kv: 400, freq: 50, cooling_class: 'ONAN', cooling_required_kW: 180 };
const r2 = de.validate('shunt_reactor', reactor);
r2.checks.forEach((c) => console.log('  [' + c.status + '] ' + c.label + ' — ' + c.note));
// Scaffold class must not claim a PASS it did not compute.
// Scaffold class must not claim a PASS it did not compute (data-availability
// "specification present" is not a physics PASS, so it is excluded).
const passOnScaffold = r2.checks.filter((c) => c.status === 'PASS' && c.id !== 'missing_input');
assert(passOnScaffold.length === 0, 'shunt-reactor (scaffold) returns no physics PASS');

// Benchmark 3: missing critical input -> INSUFFICIENT_DATA (never a PASS).
console.log('\nBENCHMARK 3 — missing critical input');
const r3 = de.validate('distribution_transformer', { power_kva: 1000 });
const miss = r3.checks.find((c) => c.id === 'missing_input');
assert(miss && miss.status === 'INSUFFICIENT_DATA', 'missing critical input -> INSUFFICIENT_DATA');

// Benchmark 4: extreme out-of-range flux density -> WARNING, not PASS.
console.log('\nBENCHMARK 4 — extreme flux density');
const r4 = de.validate('distribution_transformer', Object.assign({}, dist, { flux_density_T: 2.1 }));
const fd = r4.checks.find((c) => c.id === 'flux_density');
assert(fd && fd.status === 'WARNING', 'flux density 2.1 T > limit -> WARNING');

console.log('\nDESIGN-ENGINE VALIDATION: ' + (problems.length ? problems.length + ' problem(s)' : 'PASS'));
problems.forEach((p) => console.log('  ✗ ' + p));
process.exitCode = problems.length ? 1 : 0;
