#!/usr/bin/env node
/* The supply-chain tracker has no observation date in its source.
 * It must not be labelled as a quarter. */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const html = fs.readFileSync('intel.html', 'utf8');
const start = html.indexOf('Supply Chain Tracker');
const end = html.indexOf('A press operation', start);
const block = start >= 0 && end > start ? html.slice(start, end) : '';

console.log('=== SUPPLY CHAIN LABEL ===');
check('tracker block is present', block.length > 0);
check('label says the baselines are undated', block.indexOf('Undated engineering baselines — no source date on file') >= 0);
check('label does not claim Q3', block.indexOf('Q3') < 0);
check('label does not claim Q4', block.indexOf('Q4') < 0);
check('tracker has no observation date', !/20\d{2}-\d{2}-\d{2}|Q[1-4]\s+20\d{2}/.test(block));

if (failed) {
  console.error('SUPPLY CHAIN LABEL FAILED (' + failed + ')');
  process.exit(1);
}
console.log('SUPPLY CHAIN LABEL OK');
