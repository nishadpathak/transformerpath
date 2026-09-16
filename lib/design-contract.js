#!/usr/bin/env node
/* lib/design-contract.js — paper/code credibility alignment fixes (Design Bench).
 *
 * PURPOSE
 *   Codifies FIVE corrections so implementation, tests and paper claims match.
 *   Each is a pure, unit-testable function with a self-test (run: node
 *   lib/design-contract.js). These are the CORRECTED behaviors the Design Bench
 *   must use; the old embedded values (the IEC 60815 ladder a=22.0..e=53.7, the
 *   11.30 MN canon treated as validation, the "10^8"/"eight orders" claim, the
 *   implied winding-specific thermal model) must be removed/replaced with these.
 *   Until the originating module is updated, this file is the authoritative
 *   specification of the corrected behaviour and its regression tests.
 *
 * Run: node lib/design-contract.js
 */
'use strict';

// ── 1. ZN TOPOLOGY ──────────────────────────────────────────────────────────
// Only phase-voltage/current (Y/D) is implemented. Zig-zag (Z/ZN) has no true
// winding model, so it must be rejected as UNSUPPORTED_TOPOLOGY — never treated
// as Y or D, and never allowing a normal accepted design.
var YD_CONNECTIONS = ['Y', 'Yn', 'D', 'Dn', 'y', 'yn', 'd', 'dn'];
var ZIGZAG = /^z{1,2}n?$/i;
function connectionStatus(conn) {
  var c = String(conn || '').trim();
  if (YD_CONNECTIONS.indexOf(c) >= 0) return { status: 'SUPPORTED', connection: c.toUpperCase() };
  if (ZIGZAG.test(c)) return { status: 'UNSUPPORTED_TOPOLOGY', connection: c.toUpperCase(), reason: 'Zig-zag (Z/ZN) neutral-earthing winding has NO implemented electrical model; not treated as Y or D.' };
  return { status: 'UNSUPPORTED_TOPOLOGY', connection: (c || '?').toUpperCase(), reason: 'Connection not in the implemented Y/D set.' };
}

// ── 2. IEC TS 60815 CREEPAGE ───────────────────────────────────────────────
// No embedded standard-derived ladder. Creepage is computed from an ENGINEER-
// SUPPLIED specific creepage distance (USCD, mm/kV) x phase-earth voltage.
// If no USCD criterion is supplied, criterion_status is MISSING and there is
// NO PASS. (The built-in ladder a=22.0, b=27.8, c=34.7, d=43.3, e=53.7 is
// standard-derived and must not ship as executable data without clear licence.)
var IEC_LADDER_EMBEDDED = [22.0, 27.8, 34.7, 43.3, 53.7]; // DO NOT USE AS EXECUTABLE DATA
function creepage(input) {
  var i = input || {};
  var uscd = i.uscd_mm_per_kV;
  var vPe = i.phase_earth_voltage_kV;
  if (uscd == null || '' === uscd || vPe == null || '' === vPe) {
    return { creepage_mm: null, criterion_status: 'MISSING', note: 'Engineer-supplied USCD (mm/kV) or phase-earth voltage missing — no criterion, no PASS.' };
  }
  var c = +uscd * +vPe;
  return { creepage_mm: +c.toFixed(2), criterion_status: 'SUPPLIED', formula: 'creepage = USCD x phase-earth voltage' };
}

// ── 3. SHORT-CIRCUIT FORCE EVIDENCE ─────────────────────────────────────
// Separate the three classes. An embedded canon is NOT an independent benchmark.
var FORCE_CANON = {
  kind: 'EMBEDDED_CANON', value: 11.30, units: 'MN',
  basis: 'Canonical case bundled in the tool for routine display/illustration.',
  provenance: 'Internal; NOT an independent validation. Must be supplemented by an INDEPENDENT_BENCHMARK with external reference.',
  independent: false
};
var FORCE_INDEPENDENT = {
  kind: 'INDEPENDENT_BENCHMARK', value: null, units: 'MN', basis: null, inputs: null, tolerance: null, source: null,
  note: 'Populate from an externally derived reference with matched basis (system fault level vs canonical/infinite-bus). Do NOT compare different bases as the same case.'
};
var FORCE_IDENTITY = {
  kind: 'IDENTITY_DIMENSIONAL_TEST',
  tests: ['F / (N·i)^2 is constant across current multipliers (dimension/identity check, not an independent benchmark).'],
  note: 'The F~I^2 and F/(N·i)^2 constant checks are IDENTITY/DIMENSIONAL, not independent validation.'
};
function forceEvidence() { return { embedded_canon: FORCE_CANON, independent_benchmark: FORCE_INDEPENDENT, identity: FORCE_IDENTITY }; }
function forceClassify(check) {
  if (check === 'canon') return FORCE_CANON; if (check === 'independent') return FORCE_INDEPENDENT; return FORCE_IDENTITY;
}

// ── 4. STALE 10^8 CLAIM ─────────────────────────────────────────────────────
var STALE_CLAIM_CORRECTION = {
  old: 'force error was 10^8 / "eight orders of magnitude"',
  corrected: 'approximately 80,600x / approximately 4.9 orders of magnitude',
  note: 'Replace stale "10^8"/"eight orders of magnitude" text with the corrected ~80,600x / ~4.9 orders. Intentionally preserved historical artifacts: label them SUPERSEDED, do not edit.'
};

// ── 5. THERMAL SCOPE ───────────────────────────────────────────────────────
// Winding-specific only if EVERY winding carries its own current, conductor
// area, current density, material, starting temperature, duration and criterion.
// Otherwise label as "per-winding adiabatic screening under stated common
// assumptions" — never "independent winding-specific thermal model".
function thermalScope(input) {
  var w = input || {};
  function present(x) { return x != null && x !== ''; }
  var perWinding = (w.windings || []).map(function (x) {
    return { winding: x.id, specific: ['current_A','conductor_area_mm2','current_density_A_mm2','material','start_temp_C','duration_h','criterion'].every(function (k) { return present(x[k]); }) };
  });
  var allSpecific = perWinding.every(function (x) { return x.specific; });
  return {
    scope: allSpecific ? 'WINDING_SPECIFIC' : 'COMMON_ASSUMPTIONS',
    label: allSpecific ? 'independent winding-specific thermal model' : 'per-winding adiabatic screening under stated common assumptions',
    perWinding: perWinding,
    note: allSpecific ? 'Each winding carries its own inputs.' : 'Not all windings carry independent inputs (material/current-density/start-temp/criterion may be common); do NOT claim a fully independent winding-specific thermal model.'
  };
}

module.exports = { connectionStatus, creepage, forceEvidence, forceClassify, STALE_CLAIM_CORRECTION, thermalScope };

// ── Self-test ───────────────────────────────────────────────────────────────
if (require.main === module) {
  var S = require('./design-contract');
  var fails = 0; function ok(c, m) { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ok — ' + m); }
  console.log('DESIGN-CONTRACT FIXES self-test');
  // ZN
  ok(S.connectionStatus('Y').status === 'SUPPORTED', 'Y supported');
  ok(S.connectionStatus('D').status === 'SUPPORTED', 'D supported');
  ok(S.connectionStatus('Z').status === 'UNSUPPORTED_TOPOLOGY', 'Z -> UNSUPPORTED_TOPOLOGY (not treated as Y/D)');
  ok(S.connectionStatus('ZN').status === 'UNSUPPORTED_TOPOLOGY', 'ZN -> UNSUPPORTED_TOPOLOGY');
  ok(S.connectionStatus('z').status === 'UNSUPPORTED_TOPOLOGY', 'zig-zag lowercase -> UNSUPPORTED_TOPOLOGY');
  // creepage
  ok(S.creepage({ uscd_mm_per_kV: 34.7, phase_earth_voltage_kV: 100 }).creepage_mm === 3470, 'creepage = USCD x Vpe (34.7 * 100 = 3470 mm)');
  ok(S.creepage({ phase_earth_voltage_kV: 100 }).criterion_status === 'MISSING', 'missing USCD -> CRITERION STATUS MISSING, no PASS');
  ok(S.creepage({}).creepage_mm === null, 'no criterion -> creepage null (no PASS)');
  // force evidence
  var fe = S.forceEvidence();
  ok(fe.embedded_canon.kind === 'EMBEDDED_CANON' && fe.embedded_canon.independent === false, '11.30 MN is EMBEDDED_CANON, not independent');
  ok(fe.independent_benchmark.kind === 'INDEPENDENT_BENCHMARK', 'independent benchmark is a separate class');
  ok(fe.identity.kind === 'IDENTITY_DIMENSIONAL_TEST', 'F/(N·i)^2 constant is IDENTITY/DIMENSIONAL');
  // stale claim
  ok(/80,600/.test(S.STALE_CLAIM_CORRECTION.corrected) && /4\.9 orders/.test(S.STALE_CLAIM_CORRECTION.corrected), 'stale 10^8 corrected to ~80,600x / ~4.9 orders');
  // thermal scope
  var tsCommon = S.thermalScope({ windings: [ { id: 'HV', current_A: 1, material: 'copper' } ] });
  ok(tsCommon.scope === 'COMMON_ASSUMPTIONS' && /screening under stated common assumptions/.test(tsCommon.label), 'common winding inputs -> COMMON_ASSUMPTIONS wording');
  var tsSpecific = S.thermalScope({ windings: [ { id: 'HV', current_A: 1, conductor_area_mm2: 1, current_density_A_mm2: 1, material: 'copper', start_temp_C: 20, duration_h: 1, criterion: 1 } ] });
  ok(tsSpecific.scope === 'WINDING_SPECIFIC', 'all winding-specific inputs -> WINDING_SPECIFIC');
  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'DESIGN-CONTRACT FIXES PASS'));
  process.exitCode = fails ? 1 : 0;
}
