#!/usr/bin/env node
/* Guards live QA failures:
 * - learn.html price column used flex:none and widened a 390px screen
 * - methodology tables widened the document instead of scrolling inside the page
 * - the 14 Aug 2026 archive stamp rendered 3 Aug because the briefing date was not applied
 * - netlify.toml lost its [build] header, so every deploy was rejected before the build
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

const toml = fs.readFileSync('netlify.toml', 'utf8');
const commandAt = toml.search(/command\s*=/);
const buildAt = toml.indexOf('[build]');
const functionsTable = toml.indexOf('\n[functions]');
check('netlify.toml keeps build settings in the [build] table', buildAt === 0 && commandAt > buildAt && functionsTable > commandAt);

const learn = fs.readFileSync('learn.html', 'utf8');
check('learn price column can shrink', /class="price-side"/.test(learn) && !/flex:none;text-align:center/.test(learn));
check('learn plan line may wrap', /class="plan-line"/.test(learn) && /\.price-side \{[^}]*min-width:0/.test(learn));

const method = fs.readFileSync('methodology.html', 'utf8');
check('methodology page scrolls wide tables inside the column', /\.mth-wrap\{[^}]*overflow-x:auto/.test(method));

const aug14 = fs.readFileSync('intel-2026-08-14.html', 'utf8');
check('14 Aug archive stamp is the briefing day', /id="stamp">14 Aug 2026</.test(aug14));
check('14 Aug archive copies the briefing date onto the stamp', /stampEl\.textContent = BRIEFING_DATE/.test(aug14));

[
  ['intel-2026-08-16.html', '16 Aug 2026'],
  ['intel-2026-08-18.html', '18 Aug 2026'],
  ['intel-2026-08-19.html', '19 Aug 2026'],
  ['intel-2026-08-21.html', '21 Aug 2026']
].forEach(function (pair) {
  const html = fs.readFileSync(pair[0], 'utf8');
  check(pair[0] + ' stamp matches the briefing', html.indexOf('id="stamp">' + pair[1] + '<') !== -1 && html.indexOf('BRIEFING_DATE = "' + pair[1] + '"') !== -1);
});

if (failed) {
  console.error('LIVE QA LAYOUT REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — live QA layout regression');
