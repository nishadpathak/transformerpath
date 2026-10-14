#!/usr/bin/env node
/* tests/awards-wording-regression.js
 * Homepage "Confirmed" and "Awards" appear together only beside the
 * confirmed transformer_scope count, not beside the tracked total.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const confirmed = stats.awardsConfirmed;
const inferred = stats.awardsInferred;
const unknown = stats.awardsUnknown;

console.log('=== AWARDS WORDING REGRESSION ===');
check('site-stats awards is the tracked total', stats.awards === confirmed + inferred + unknown, stats.awards + ' vs ' + (confirmed + inferred + unknown));
check('homepage says Awards tracked', /Awards tracked/.test(html));
check('homepage does not say Confirmed Awards', !/Confirmed Awards/.test(html));

const together = [];
const re = /confirmed awards/ig;
let m;
while ((m = re.exec(html))) {
  const start = Math.max(0, m.index - 40);
  together.push(html.slice(start, m.index + m[0].length));
}
check('Confirmed+Awards appears once', together.length === 1, JSON.stringify(together));
check('that pairing is the confirmed-scope count', together.length === 1 && together[0].indexOf(String(confirmed)) >= 0, together[0]);
check('pairing is not the tracked total', together.length === 1 && together[0].indexOf('>' + stats.awards + '<') < 0 && !new RegExp('>' + stats.awards + '<[^>]*>\\s*confirmed awards', 'i').test(html));
check('inferred count is present', html.indexOf('data-stat="awardsInferred">' + inferred) >= 0);
check('unknown count is present', html.indexOf('data-stat="awardsUnknown">' + unknown) >= 0);

if (failed) {
  console.error('AWARDS WORDING REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('AWARDS WORDING REGRESSION OK');
