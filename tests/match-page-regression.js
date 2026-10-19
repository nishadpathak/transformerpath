#!/usr/bin/env node
/* tests/match-page-regression.js
 * /match must not list manufacturers before a match is run, the submit
 * button must not say Verified, and a voltage that already includes "kV"
 * must not render as "550 kV kV".
 * Run: node tests/match-page-regression.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('match.html', 'utf8');
let failures = [];
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failures.push(label);
}

check('submit button does not say Verified', !/Match Verified/.test(html) && /Match suppliers/.test(html));
const load = html.slice(html.indexOf("fetch('data/manufacturer-intel.json')"), html.indexOf('function loadSample'));
check('loading the directory does not run a match', load.indexOf('runMatch(') === -1);
check('the page starts with no result cards', /id="matchPrompt"/.test(html) && /Nothing is listed until you submit/.test(html));
check('voltage line uses withUnit', /Max Voltage: \$\{withUnit\(c\.reported_voltage, 'kV'\)\}/.test(html));

const fn = html.match(/function withUnit\(value, unit\) \{[\s\S]*?\n\}/);
if (!fn) {
  check('withUnit is defined', false);
} else {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fn[0], context);
  check('550 kV is not doubled', context.withUnit('550 kV', 'kV') === '550 kV', context.withUnit('550 kV', 'kV'));
  check('190,000 MVA is not doubled', context.withUnit('190,000 MVA', 'MVA') === '190,000 MVA', context.withUnit('190,000 MVA', 'MVA'));
  check('a bare number still gains its unit', context.withUnit(400, 'kV') === '400 kV');
}

if (failures.length) {
  console.error('\n' + failures.length + ' match page check(s) failed');
  process.exit(1);
}
console.log('\nMatch page checks passed.');
