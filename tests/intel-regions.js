#!/usr/bin/env node
/* /intel exposes collapsible regions, a sticky nav, and a stated-value filter.
 * Run: node tests/intel-regions.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'intel.html'), 'utf8');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}
check(html.indexOf('id="intel-value-filter"') !== -1, 'stated-value checkbox is in the page');
check(html.indexOf('Has stated contract value') !== -1, 'filter uses the stated-value label');
check(html.indexOf("nav.id = 'intel-region-nav'") !== -1, 'script builds the region nav');
check(html.indexOf('position:sticky;top:4.6rem') !== -1, 'region nav is sticky under the header');
check(html.indexOf("details.className = 'region-block'") !== -1, 'region headings become collapsible sections');
check(html.indexOf("details.open = true") !== -1, 'region sections start open');
check(html.indexOf("el.hidden = on && !el.querySelector('.val')") !== -1, 'filter uses an existing .val, not a new amount');
if (failed) process.exit(1);
console.log('intel region checks passed');
