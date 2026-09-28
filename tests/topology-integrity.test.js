/**
 * Automated Electrical Topology Integrity Test for TransformerPath Grid Lab
 * Asserts that every stage's receiving winding nominal voltage matches the upstream bus voltage exactly.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('⚡ Running Automated Electrical Grid Topology Integrity Test...');

const gridLabSrc = fs.readFileSync(path.join(__dirname, '../js/tp-grid-lab.js'), 'utf8');

// Extract STAGES array from source
const stagesMatch = gridLabSrc.match(/const STAGES = (\[[\s\S]*?\]);/);
assert(stagesMatch, 'STAGES array must be present in js/tp-grid-lab.js');

let STAGES;
try {
  STAGES = eval(stagesMatch[1]);
} catch (e) {
  throw new Error('Failed to evaluate STAGES from js/tp-grid-lab.js: ' + e.message);
}

assert(Array.isArray(STAGES) && STAGES.length === 10, `Expected exactly 10 canonical stages, found ${STAGES.length}`);

function parseVoltage(str) {
  if (!str || str === '—') return null;
  const match = str.match(/([0-9.]+)\s*kV/i);
  if (match) return parseFloat(match[1]);
  if (str.includes('415 V') || str.includes('0.415 kV')) return 0.415;
  return null;
}

let upstreamBusKV = null;

STAGES.forEach((stage, idx) => {
  const vInKV = parseVoltage(stage.vIn);
  const vOutKV = parseVoltage(stage.vOut);

  console.log(`  [Stage ${idx + 1}] ${stage.shortName.padEnd(24)} | In: ${(stage.vIn).padEnd(10)} | Out: ${stage.vOut}`);

  if (idx === 0) {
    // Generation source has no upstream bus
    assert(vInKV === null, 'Generation stage must have no upstream bus voltage');
    assert(vOutKV === 21.0, `Generator output must be 21.0 kV, got ${vOutKV}`);
    upstreamBusKV = vOutKV;
  } else {
    // Every subsequent stage must have vIn matching upstream bus voltage
    assert(vInKV !== null, `Stage ${idx + 1} (${stage.id}) must have a defined input voltage`);
    assert.strictEqual(
      vInKV,
      upstreamBusKV,
      `TOPOLOGY ERROR at Stage ${idx + 1} (${stage.name}): Upstream bus is ${upstreamBusKV} kV but stage expects ${vInKV} kV! Voltage mismatch detected.`
    );

    // Update upstream bus for next stage
    if (vOutKV !== null) {
      upstreamBusKV = vOutKV;
    }
  }
});

console.log('✓ All 10 electrical stages verified: 100% voltage node continuity without incompatible jumps.');
console.log('✅ GRID TOPOLOGY INTEGRITY TEST PASSED');
