#!/usr/bin/env node
/* Homepage and intel name both sourced copper figures. Neither number changes.
 * Run: node tests/copper-reference-note.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const intel = fs.readFileSync(path.join(root, 'intel.html'), 'utf8');
const materials = fs.readFileSync(path.join(root, 'data', 'materials-latest.json'), 'utf8');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}
check(home.indexOf('≈$14,170/t') !== -1, 'homepage still shows $14,170/t');
check(home.indexOf('LME 3-month official settlement on 20 Aug 2026') !== -1, 'homepage names the 3-month series and date');
check(home.indexOf('LME cash settlement of $14,545/t on 14 Aug 2026') !== -1, 'homepage points at the intel cash figure');
check(intel.indexOf('$14,545 / t') !== -1, 'intel still shows $14,545/t');
check(intel.indexOf('homepage uses the LME 3-month official settlement, $14,170/t on 20 Aug 2026') !== -1, 'intel points at the homepage 3-month figure');
check(materials.indexOf('"value": 14170') !== -1, 'materials-latest.json copper value is unchanged');
check(materials.indexOf('"observation_date": "2026-08-20"') !== -1, 'materials observation date is unchanged');
if (failed) process.exit(1);
console.log('copper reference checks passed');
