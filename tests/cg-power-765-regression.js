#!/usr/bin/env node
/* tests/cg-power-765-regression.js
 * CG Power profile summary and evidence both state 765 kV as the highest
 * sourced voltage.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const page = 'manufacturers/cg-power-and-industrial-solutions/index.html';
console.log('=== CG POWER 765 kV REGRESSION ===');
check('CG Power profile exists', fs.existsSync(page));
const html = fs.existsSync(page) ? fs.readFileSync(page, 'utf8') : '';
const summary = html.match(/Highest sourced voltage evidence<\/th>\s*<td[^>]*>(\d+)\s*kV/i);
const evidence = html.match(/Voltage class evidence<\/th>\s*<td[^>]*>(\d+)\s*kV/i);
check('summary states 765 kV', summary && Number(summary[1]) === 765, summary ? summary[1] : 'missing');
check('evidence states 765 kV', evidence && Number(evidence[1]) === 765, evidence ? evidence[1] : 'missing');
check('summary is not the stale 400 kV', !/Highest sourced voltage evidence<\/th>\s*<td>400\s*kV/i.test(html));

if (failed) {
  console.error('CG POWER 765 kV REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('CG POWER 765 kV REGRESSION OK');
