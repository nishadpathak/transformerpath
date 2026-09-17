#!/usr/bin/env node
/* tests/engine-sanity.js — design-core first-pass regression + sanity harness.
 *
 * This is a REGRESSION and DIMENSIONAL-CONSISTENCY harness for the analytical
 * core. It is NOT independent validation: it does not compare against an
 * external/third-party design calculation, and it does not grant any
 * compliance/validation status. It ensures the analytical relations are
 * internally consistent and that missing/invalid inputs never silently produce
 * a plausible number.
 *
 * Run: node tests/engine-sanity.js
 */
'use strict';
const { designCore } = require('../engine/design-core');
let problems = [];
function ok(c, msg) { console.log((c ? '  ok — ' : '  ✗ ') + msg); if (!c) problems.push(msg); }

const BASE = {
  rating_kva: 1000, freq: 50, phases: 3, hv_kv: 11, lv_kv: 0.433,
  peak_flux_density_T: 1.6, net_core_area_m2: 0.09, current_density_A_mm2: 3.0,
  mean_turn_length_m: 1.2, winding_material: 'copper',
};

function num(v) { return (v === null || v === undefined || isNaN(v)) ? null : v; }

console.log('REG / SANITY — analytical design-core (first-pass, BETA)\n');
const r = designCore(BASE);
ok(num(r.results.volts_per_turn) > 0, 'volts/turn > 0 for 1.6 T, 0.09 m2, 50 Hz');
ok(r.results.hv_line_current_A > 0, 'HV line current > 0');
ok(r.results.hv_turns > 0, 'HV turns > 0');
ok(r.results.hv_conductor_area_mm2 > 0, 'HV conductor area > 0');
ok(r.results.hv_dc_resistance_ohm > 0, 'HV DC resistance > 0');
ok(r.results.hv_conductor_mass_kg > 0, 'HV conductor mass > 0');

// Sanity invariants (standard relations).
const r2 = designCore(Object.assign({}, BASE, { rating_kva: 2000 }));
ok(Math.abs(r2.results.hv_line_current_A / r.results.hv_line_current_A - 2) < 0.01, 'doubling kVA doubles HV current');

const r3 = designCore(Object.assign({}, BASE, { peak_flux_density_T: 3.2 }));
ok(Math.abs((r3.results.volts_per_turn / r.results.volts_per_turn) - 2) < 0.01, 'doubling flux density doubles volts/turn');

const r4 = designCore(Object.assign({}, BASE, { current_density_A_mm2: 1.5 }));
ok(Math.abs(r4.results.hv_conductor_area_mm2 / r.results.hv_conductor_area_mm2 - 2) < 0.01, 'halving current density doubles conductor area');

// Temperature affects resistance, not mass/volts.
const r5 = designCore(Object.assign({}, BASE, { winding_temp_C: 20 }));
ok(r.results.hv_dc_resistance_ohm !== r5.results.hv_dc_resistance_ohm, 'resistance changes with winding temperature');
ok(r5.results.hv_conductor_mass_kg === r.results.hv_conductor_mass_kg, 'mass is temperature-independent');

// Missing input -> NO plausible number (no invention).
const r6 = designCore(Object.assign({}, BASE, { net_core_area_m2: 0 }));
ok(num(r6.results.volts_per_turn) === null, 'missing core area -> volts/turn is null (no invented value)');

// Invalid/extreme inputs do not crash.
try { designCore(Object.assign({}, BASE, { rating_kva: 0 })); designCore(Object.assign({}, BASE, { hv_kv: 0 })); ok(true, 'zero/invalid inputs do not throw'); }
catch (e) { ok(false, 'zero/invalid inputs must not throw: ' + e.message); }

console.log('\nENGINE SANITY: ' + (problems.length ? problems.length + ' PROBLEM(S)' : 'PASS'));
process.exitCode = problems.length ? 1 : 0;
