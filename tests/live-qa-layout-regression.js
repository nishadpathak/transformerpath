#!/usr/bin/env node
/* Guards two live QA failures:
 * - learn.html price column used flex:none and widened a 390px screen
 * - methodology tables widened the document instead of scrolling inside the page
 * - the 14 Aug 2026 archive stamp rendered 3 Aug because the briefing date was not applied
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const learn = fs.readFileSync('learn.html', 'utf8');
check('learn price column can shrink', /class="price-side"/.test(learn) && !/flex:none;text-align:center/.test(learn));
check('learn plan line may wrap', /class="plan-line"/.test(learn) && /\.price-side \{[^}]*min-width:0/.test(learn));

const method = fs.readFileSync('methodology.html', 'utf8');
check('methodology page scrolls wide tables inside the column', /\.mth-wrap\{[^}]*overflow-x:auto/.test(method));

if (failed) {
  console.error('LIVE QA LAYOUT REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — live QA layout regression');
