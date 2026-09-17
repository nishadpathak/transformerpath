#!/usr/bin/env node
/* viz-math.test.js — unit test the deterministic visualization math.
 * Note: these verify the MATH/logic, not any browser rendering.
 */
'use strict';
const { vecGroup, parallelCheck, inrush, shortCircuitForces, calcStatus, thermalEngine } = require('../viz/viz-math.js');
let problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }
function norm(a) { return ((a % 360) + 360) % 360; }

console.log('VECTOR GROUP MATH\n');
const g11 = vecGroup('D', 'y', 11);
ok(g11.clockN === 11, 'Dyn11 -> clock 11');
ok(norm(g11.lvAngles[0] - g11.hvAngles[0]) === 30, 'Dyn11 LV leads HV by 30 deg (phasor 0)');
const g0 = vecGroup('Y', 'y', 0);
ok(g0.disp === 0 && norm(g0.lvAngles[0] - g0.hvAngles[0]) === 0, 'Yy0 LV in phase with HV');
const g5 = vecGroup('D', 'y', 5);
ok(norm(g5.lvAngles[0] - g5.hvAngles[0]) === norm(-g5.disp), 'Dyn5 phase displacement = clock*30 deg (LV lags by 150 deg)');

console.log('\nPARALLEL COMPATIBILITY\n');
let p = parallelCheck(g11, g11, {});
ok(p.compatible === true, 'same vector group -> parallel compatible');
p = parallelCheck(g11, g5, {});
ok(p.compatible === false, 'different clock (11 vs 5) -> NOT directly parallelable');
p = parallelCheck(g11, g11, { zImpedanceA: 5, zImpedanceB: 7 });
ok(p.compatible === false, 'impedance mismatch (5 vs 7 %) -> NOT parallelable');
p = parallelCheck(g11, g11, { ratioA: 1.0, ratioB: 1.03 });
ok(p.compatible === false, 'voltage ratio mismatch (3%) -> NOT parallelable');

console.log('\nINRUSH MATH (analytical)\n');
// Close at voltage zero (alpha=0), zero residual => worst-case flux offset ~2 p.u.
const worst = inrush({ switchingAngleDeg: 0, residualFluxPu: 0, saturationPu: 1.2 });
ok(Math.max.apply(null, worst.flux) > 1.6, 'worst-case flux peak > 1.6 p.u. (close at voltage zero)');
ok(worst.peakCurrent > 2, 'worst-case magnetising current spikes (>2 p.u.)');
// Close at voltage peak (alpha=90), zero residual => no flux offset => tiny current.
const benign = inrush({ switchingAngleDeg: 90, residualFluxPu: 0, saturationPu: 1.2 });
ok(Math.max.apply(null, benign.flux) < 1.3, 'close at voltage peak -> flux stays near rated');
ok(benign.peakCurrent < 1.5, 'benign switching -> small magnetising current');
// Residual flux increases the peak.
const residual = inrush({ switchingAngleDeg: 0, residualFluxPu: 0.7, saturationPu: 1.2 });
ok(residual.peakCurrent >= worst.peakCurrent, 'positive residual flux increases inrush current');

console.log('\nSHORT-CIRCUIT FORCE SCALING (F ~ I^2)\n');
[[1,1],[2,4],[5,25],[10,100]].forEach(function (p) {
  var r = shortCircuitForces(p[0]);
  ok(Math.abs(r.forceMultiplier - p[1]) < 1e-9, p[0] + 'x current -> ~' + p[1] + 'x force');
});
ok(/actual force distribution depends on winding geometry/.test(shortCircuitForces(3).quali), 'short-circuit result carries the geometry/leakage-field qualification');

console.log('\nCALCULATION STATUS (equation closure != validation)\n');
ok(calcStatus({}).state === 'INSUFFICIENT_DATA', 'no input -> INSUFFICIENT DATA');
ok(calcStatus({ analytical: true, inputsComplete: true }).state === 'CALCULATED', 'analysis only -> CALCULATED');
ok(calcStatus({ analytical: true, inputsComplete: true, benchmark: true }).state === 'BENCHMARKED', 'analysis + benchmark -> BENCHMARKED (not VALIDATED)');
ok(calcStatus({ analytical: true, inputsComplete: true, benchmark: true, criterion: true }).state === 'CRITERION_CHECKED', 'analysis + benchmark + criterion -> CRITERION_CHECKED');
ok(calcStatus({ analytical: true, inputsComplete: true, benchmark: true, criterion: true, fea: true }).state === 'PRELIMINARY_ENGINEERING', 'FEA done but no qualified review -> PRELIMINARY ENGINEERING');
ok(calcStatus({ analytical: true, inputsComplete: true, benchmark: true, criterion: true, fea: true, manufacturing: true, qualified: true }).state === 'ENGINEERING_REVIEWED', 'qualified review -> ENGINEERING_REVIEWED (not generic VALIDATED)');
ok(/Analytical model benchmark validated/.test(calcStatus({ analytical: true, inputsComplete: true, benchmark: true }).scope), 'benchmarked states its scope explicitly (not "Design validated")');
ok(calcStatus({ analytical: true, inputsComplete: true, criterion: false }).state !== 'VALIDATED', 'no criterion -> never VALIDATED');
// Weakest-link propagation (paper Item 6/7): no precedence shortcut to the top.
ok(calcStatus({ analytical: true, inputsComplete: true, qualified: true }).state !== 'ENGINEERING_REVIEWED', 'qualified review ALONE does NOT reach ENGINEERING_REVIEWED (needs benchmark + criterion)');
ok(calcStatus({ analytical: true, inputsComplete: true, benchmark: true, criterion: true, fea: true, manufacturing: true, qualified: true }).state === 'ENGINEERING_REVIEWED', 'benchmark + criterion + FEA/MTG + qualified review -> ENGINEERING_REVIEWED');
ok(calcStatus({ analytical: true, inputsComplete: true, modelScope: false, benchmark: true, criterion: true }).state === 'PRELIMINARY_ENGINEERING', 'model applicability uncertain -> capped at PRELIMINARY_ENGINEERING');
var cs = calcStatus({ analytical: true, inputsComplete: true, benchmark: true, criterion: true });
ok(cs.overall_runtime_status === cs.state, 'overall_runtime_status mirrors the weakest-link state');
ok(cs.input_sufficiency === 'SUFFICIENT' && cs.benchmark_status === 'BENCHMARKED_WITHIN_TOLERANCE' && cs.criterion_status === 'CRITERION_SUPPLIED_AND_EVALUATED', 'machine-readable credibility fields populated');
ok(calcStatus({}).input_sufficiency === 'INSUFFICIENT_DATA' && calcStatus({}).criterion_status === 'CRITERION_MISSING', 'missing inputs -> input_sufficiency INSUFFICIENT_DATA, criterion missing');

console.log('\nLOADING / HOT-SPOT / LIFE\n');
ok(thermalEngine({}).state === 'INSUFFICIENT_DATA', 'missing load/ambient/mode -> INSUFFICIENT DATA');
ok(thermalEngine({ loadPU: 1, ambientC: 20, mode: 'ONAN', durationH: 24 }).state === 'CALCULATED', 'valid inputs -> CALCULATED (labelled example dataset)');
var a = thermalEngine({ loadPU: 1, ambientC: 20, mode: 'ONAN', durationH: 24 });
var b = thermalEngine({ loadPU: 1.5, ambientC: 20, mode: 'ONAF', durationH: 2 });
ok(a.series.topOil[0] !== null && typeof a.series.topOil[0] === 'number', 'liquid-filled -> top-oil state present');
ok(b.final.hotSpot > a.final.hotSpot, '150% for 2h -> higher hot-spot than 100% continuous (for the same steady ambient)');
ok(b.final.lossOfLifeH > 0 && thermalEngine({ loadPU: 1.5, ambientC: 20, mode: 'ONAF', durationH: 24 }).final.lossOfLifeH > b.final.lossOfLifeH, 'loss-of-life accumulates (24h > 2h at the same load)');
var dry = thermalEngine({ loadPU: 1.5, ambientC: 20, mode: 'AN', durationH: 2, dryType: true });
ok(dry.series.topOil.every(function (v) { return v === null; }), 'dry-type -> NO top-liquid state');
ok(dry.final.hotSpot > 20, 'dry-type winding hot-spot rises above ambient');

console.log('\nVIZ MATH: ' + (problems.length ? problems.length + ' problem(s)' : 'PASS'));
process.exitCode = problems.length ? 1 : 0;
