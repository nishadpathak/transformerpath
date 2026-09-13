#!/usr/bin/env node
/**
 * Production gate runner.
 *
 * Runs every automated pre-deployment gate and fails (exit 1) if any P0
 * integrity gate regresses. Each gate is a standalone script so it can also be
 * run individually.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const GATES = [
  { name: 'canonical stat consistency', script: 'check-stats.js', p0: true },
  { name: 'verification terminology', script: 'check-verification-terms.js', p0: true },
  { name: 'MVA semantic integrity', script: 'check-mva.js', p0: true },
  { name: 'directory quality & evidence', script: 'check-directory-quality.js', p0: true },
  { name: 'part-coverage smoke', script: 'smoke-part-coverage.js', p0: true },
  { name: 'search smoke', script: 'search-smoke.js', p0: false }
];

const results = [];
for (const g of GATES) {
  const r = spawnSync(process.execPath, [path.join(__dirname, g.script)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });
  const ok = r.status === 0;
  results.push({ name: g.name, ok, p0: g.p0, status: r.status });
  process.stdout.write('\n########## GATE: ' + g.name + ' ##########\n');
  if (r.stdout) process.stdout.write(r.stdout);
  if (!ok && r.stderr) process.stderr.write(r.stderr);
}

console.log('\n================ GATE SUMMARY ================');
let failedP0 = 0;
for (const r of results) {
  const tag = r.ok ? 'PASS' : r.p0 ? 'FAIL (P0)' : 'FAIL';
  if (!r.ok && r.p0) failedP0++;
  console.log('  ' + tag.padEnd(10) + r.name);
}

if (failedP0 > 0) {
  console.error('\nBUILD FAILED: ' + failedP0 + ' P0 integrity gate(s) regressed.');
  process.exit(1);
}
const anyFail = results.some((r) => !r.ok);
console.log('\n' + (anyFail ? 'Build OK (non-P0 warnings above).' : 'All gates passed.'));
process.exit(0);
