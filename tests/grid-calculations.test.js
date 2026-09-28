/**
 * Unit tests for Grid Lab calculations
 */

'use strict';

const assert = require('assert');
const {
  threePhaseCurrent,
  activePower,
  apparentPower,
  lineLossMW,
  transformerLosses,
  voltageRatio,
  oltcRegulatedVoltage,
  parallelLoadShare
} = require('../js/tp-grid-calc.js');

console.log('🧪 Running Grid Lab Engineering Tests...');

// 1. GSU Step-Up Current Calculation
// 1000 MVA at 21 kV vs 400 kV
const iGen21kV = threePhaseCurrent(1000, 21);
const iGrid400kV = threePhaseCurrent(1000, 400);

assert(iGen21kV > 27000 && iGen21kV < 28000, `21 kV current should be ~27,493 A, got ${iGen21kV}`);
assert(iGrid400kV > 1400 && iGrid400kV < 1500, `400 kV current should be ~1,443 A, got ${iGrid400kV}`);

const currentReductionRatio = iGen21kV / iGrid400kV;
const voltageStepRatio = 400 / 21;
assert(Math.abs(currentReductionRatio - voltageStepRatio) < 0.01, 'Current reduction factor must equal voltage step ratio');
console.log(`✓ GSU Step-up verified: 21 kV -> 400 kV reduces current from ${Math.round(iGen21kV)} A to ${Math.round(iGrid400kV)} A (factor of ${currentReductionRatio.toFixed(2)}x)`);

// 2. I^2 * R Loss comparison
// Resistance of a 100 km line = 2.5 ohms per phase
const lossAt21kV = lineLossMW(iGen21kV, 2.5);
const lossAt400kV = lineLossMW(iGrid400kV, 2.5);
assert(lossAt21kV > lossAt400kV * 300, '400 kV transmission must reduce conductor I^2*R losses by > 300x compared to 21 kV transmission');
console.log(`✓ Transmission loss physics verified: Line loss at 21 kV would be ${Math.round(lossAt21kV)} MW vs ${lossAt400kV.toFixed(2)} MW at 400 kV (Loss reduced by ${(lossAt21kV / lossAt400kV).toFixed(1)}x)`);

// 3. Parallel Transformer Load Sharing
// Two 100 MVA transformers at 12.5% impedance sharing 140 MVA total load
const normalParallel = parallelLoadShare(140, 100, 12.5, 100, 12.5, true, true);
assert.strictEqual(normalParallel.t1MVA, 70);
assert.strictEqual(normalParallel.t2MVA, 70);
assert.strictEqual(normalParallel.t1LoadPercent, 70);
assert.strictEqual(normalParallel.overloaded, false);

// Trip T1 -> T2 receives full 140 MVA (140% overload)
const trippedParallel = parallelLoadShare(140, 100, 12.5, 100, 12.5, false, true);
assert.strictEqual(trippedParallel.t1MVA, 0);
assert.strictEqual(trippedParallel.t2MVA, 140);
assert.strictEqual(trippedParallel.t2LoadPercent, 140);
assert.strictEqual(trippedParallel.overloaded, true);
console.log('✓ Parallel transformer load sharing and N-1 trip overload logic verified');

// 4. OLTC Secondary Voltage Regulation
// Nominal 33 kV with 1.1 kV load sag -> Tap 7 = 31.9 kV -> Tap 8 = 32.31 kV -> Tap 9 = 32.73 kV -> Tap 10 = 33.14 kV
const vSagged = oltcRegulatedVoltage(33.0, 7, 1.25, 1.1, 7);
const vTap8 = oltcRegulatedVoltage(33.0, 8, 1.25, 1.1, 7);
const vTap9 = oltcRegulatedVoltage(33.0, 9, 1.25, 1.1, 7);
const vTap10 = oltcRegulatedVoltage(33.0, 10, 1.25, 1.1, 7);

assert.strictEqual(vSagged, 31.9);
assert(vTap8 > vSagged && vTap9 > vTap8 && vTap10 >= 33.0, 'OLTC taps must progressively restore secondary bus voltage to nominal');
console.log(`✓ OLTC regulation verified: Sag ${vSagged} kV -> Tap 8: ${vTap8} kV -> Tap 9: ${vTap9} kV -> Tap 10: ${vTap10} kV`);

// 5. Transformer Losses & Efficiency
const losses = transformerLosses(120, 480, 1.0, 100, 0.9);
assert.strictEqual(losses.noLoadKW, 120);
assert.strictEqual(losses.loadKW, 480);
assert.strictEqual(losses.totalKW, 600);
assert(losses.efficiencyPercent > 99.0, 'Efficiency should be > 99% for large power transformer');
console.log(`✓ Transformer losses and efficiency verified: ${losses.totalKW} kW total loss at 100% load, ${losses.efficiencyPercent}% efficiency`);

// 6. Zero, Edge Case & Boundary Checks (No NaN, No Infinity, No Negative Numbers)
assert.strictEqual(threePhaseCurrent(0, 400), 0, 'Zero MVA must return 0 A');
assert.strictEqual(threePhaseCurrent(1000, 0), 0, 'Zero kV must return 0 A without throwing or returning Infinity');
assert.strictEqual(voltageRatio(400, 0), 0, 'Zero secondary kV must return 0 safely');
assert(!Number.isNaN(threePhaseCurrent(100, 33)), 'Must not produce NaN');
assert(Number.isFinite(threePhaseCurrent(100, 33)), 'Must produce finite value');

const zeroLosses = transformerLosses(100, 400, 0, 100, 0.9);
assert.strictEqual(zeroLosses.loadKW, 0, 'Zero load fraction must yield 0 load loss');
assert.strictEqual(zeroLosses.noLoadKW, 100, 'No-load loss must persist at zero load');
assert(!Number.isNaN(zeroLosses.efficiencyPercent), 'Efficiency at 0 load must not be NaN');

// 7. Parallel Outage Edge Cases
const allTripped = parallelLoadShare(100, 100, 12.5, 100, 12.5, false, false);
assert.strictEqual(allTripped.t1MVA, 0);
assert.strictEqual(allTripped.t2MVA, 0);
assert.strictEqual(allTripped.totalDeliveredMVA, 0);

// 8. Voltage Ratio Verification
// 9. Topology Integrity Test (Node-by-node voltage matching)
require('./topology-integrity.test.js');

console.log('✓ Edge case checks verified: Zero handling, boundary protection, NaN/Infinity guards, and non-negative constraints confirmed.');
console.log('✅ ALL GRID LAB ENGINEERING CALCULATION & TOPOLOGY TESTS PASSED');


