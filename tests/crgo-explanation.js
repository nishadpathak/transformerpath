#!/usr/bin/env node
/* Homepage links the CRGO phrase to the existing explanation. No CRGO price is added.
 * Run: node tests/crgo-explanation.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const page = fs.readFileSync(path.join(root, 'materials', 'crgo', 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'build-materials-pages.js'), 'utf8');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}
const link = '<a href="/materials/crgo/#crgo-why">CRGO: no public daily index — see why</a>';
check(home.indexOf(link) !== -1, 'homepage uses the CRGO explanation link');
check(home.indexOf('GRADE NOT SPECIFIED') === -1, 'homepage no longer says GRADE NOT SPECIFIED');
check(page.indexOf('id="crgo-why"') !== -1, 'CRGO page has the explanation anchor');
check(page.indexOf('There is no public daily index for CRGO.') !== -1, 'explanation says there is no public daily index');
check(page.indexOf('does not publish a CRGO price') !== -1, 'explanation does not invent a price');
check(page.indexOf('No verified reference') !== -1, 'reference table still has no verified price');
check(builder.indexOf('id="crgo-why"') !== -1, 'builder keeps the explanation anchor');
if (failed) process.exit(1);
console.log('CRGO explanation checks passed');
