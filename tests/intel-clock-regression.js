#!/usr/bin/env node
/* tests/intel-clock-regression.js — competing-clock protection.
 *
 * Failure mode this guards: a desk rebuild with no new source discoveries
 * paints DATA CURRENT because build_at / last_successful_refresh moved.
 *
 * Simulate: latest_source_date frozen >72h ago, two rebuilds with different
 * build_at. Assert:
 *   - latest_source_date is unchanged across rebuilds
 *   - only build_at changes
 *   - public status never becomes DATA CURRENT from the rebuild alone
 *
 * Run: node tests/intel-clock-regression.js
 */
'use strict';
const { classifyIntelStatus, dayIso } = require('../lib/intel-freshness');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

function daysAgoIso(n, from) {
  const t = new Date(from.getTime());
  t.setUTCDate(t.getUTCDate() - n);
  return t.toISOString().slice(0, 10);
}

console.log('=== INTEL CLOCK REGRESSION (no-new-source rebuild) ===');

const NOW = new Date('2026-09-30T16:00:00.000Z');
const SOURCE_FROZEN = daysAgoIso(5, NOW); // >72h, within coverage-lag window if claim allowed
const SOURCE_STALE = daysAgoIso(40, NOW);  // clearly stale
const BUILD_A = '2026-09-30T10:00:00.000Z';
const BUILD_B = '2026-09-30T18:00:00.000Z'; // later rebuild, same sources

// --- Case 1: frozen source >72h, discovery claim disallowed (production honesty) ---
const a1 = classifyIntelStatus({
  latestSourceIso: SOURCE_FROZEN,
  latestCheckedAt: SOURCE_FROZEN,
  buildAt: BUILD_A,
  dataCurrentClaimAllowed: false,
  now: NOW
});
const b1 = classifyIntelStatus({
  latestSourceIso: SOURCE_FROZEN,
  latestCheckedAt: SOURCE_FROZEN,
  buildAt: BUILD_B,
  dataCurrentClaimAllowed: false,
  now: NOW
});

check('frozen source iso is a calendar day', !!dayIso(SOURCE_FROZEN), SOURCE_FROZEN);
check('rebuild A → B keeps latest_source_iso identical', a1.latest_source_iso === b1.latest_source_iso, a1.latest_source_iso + ' vs ' + b1.latest_source_iso);
check('rebuild A → B changes only build_at', a1.build_at === BUILD_A && b1.build_at === BUILD_B);
check('rebuild does not invent a newer source date', a1.latest_source_iso === SOURCE_FROZEN && b1.latest_source_iso === SOURCE_FROZEN);
check('status is never DATA CURRENT when claim disallowed', a1.statusLabel !== 'DATA CURRENT' && b1.statusLabel !== 'DATA CURRENT', a1.statusLabel + '/' + b1.statusLabel);
check('status stable across rebuilds (claim disallowed)', a1.statusLabel === b1.statusLabel, a1.statusLabel + ' → ' + b1.statusLabel);
check('expected INTEL COVERAGE DELAYED when claim disallowed', a1.statusLabel === 'INTEL COVERAGE DELAYED', a1.statusLabel);

// --- Case 2: source >72h even if claim were allowed — still not CURRENT ---
const a2 = classifyIntelStatus({
  latestSourceIso: SOURCE_FROZEN,
  buildAt: BUILD_A,
  dataCurrentClaimAllowed: true,
  now: NOW
});
const b2 = classifyIntelStatus({
  latestSourceIso: SOURCE_FROZEN,
  buildAt: BUILD_B,
  dataCurrentClaimAllowed: true,
  now: NOW
});
check('>72h source is not DATA CURRENT even if claim allowed', a2.statusLabel !== 'DATA CURRENT', a2.statusLabel);
check('>72h rebuild still does not flip to DATA CURRENT', b2.statusLabel !== 'DATA CURRENT', b2.statusLabel);
check('>72h source date unchanged across rebuild', a2.latest_source_iso === b2.latest_source_iso && a2.latest_source_iso === SOURCE_FROZEN);

// --- Case 3: clearly stale source (40d) ---
const a3 = classifyIntelStatus({
  latestSourceIso: SOURCE_STALE,
  buildAt: BUILD_B,
  dataCurrentClaimAllowed: true,
  now: NOW
});
check('40d-old source → DATA STALE (not CURRENT)', a3.statusLabel === 'DATA STALE', a3.statusLabel);

// --- Case 4: fresh source CAN be CURRENT; rebuild next day without new source ages honestly ---
const FRESH = daysAgoIso(1, NOW);
const day0 = classifyIntelStatus({
  latestSourceIso: FRESH,
  buildAt: BUILD_A,
  dataCurrentClaimAllowed: true,
  now: NOW
});
const dayPlus = new Date(NOW.getTime() + 5 * 86400000); // +5 days, same frozen source
const day5 = classifyIntelStatus({
  latestSourceIso: FRESH,
  buildAt: dayPlus.toISOString(),
  dataCurrentClaimAllowed: true,
  now: dayPlus
});
check('1d-old source with claim allowed → DATA CURRENT', day0.statusLabel === 'DATA CURRENT', day0.statusLabel);
check('same source five days later is not CURRENT after rebuild', day5.statusLabel !== 'DATA CURRENT', day5.statusLabel);
check('source iso still the original fresh day after later rebuild', day5.latest_source_iso === FRESH);

if (failed) {
  console.error('\nINTEL CLOCK REGRESSION: FAIL (' + failed + ')');
  process.exit(1);
}
console.log('\nPASS — rebuild without new sources cannot mint DATA CURRENT');
