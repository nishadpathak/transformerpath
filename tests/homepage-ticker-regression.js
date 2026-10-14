#!/usr/bin/env node
/* tests/homepage-ticker-regression.js
 * The homepage ticker must not present the Aug–Sep 2026 DEWA close window as
 * still open, and the hero CTA must not call a delayed briefing "today's".
 * Run: node tests/homepage-ticker-regression.js
 */
'use strict';
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
let failures = [];
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failures.push(label);
}
const ticker = (html.match(/const TICKER = "([\s\S]*?)";/) || [])[1] || '';
check('ticker dates the DEWA tenders and marks them closed', /closed 25 Aug – 17 Sep 2026/.test(ticker));
check('ticker does not leave that close window undated', !/tenders close 25 Aug/.test(ticker));
check('static hero CTA does not say today’s briefing', !/Read today’s briefing/.test(html) && /Open the latest sourced briefing/.test(html));
check('delayed coverage rewrites the hero CTA', /Coverage is delayed — open the latest briefing/.test(html) && /hero-intel-cta/.test(html));
if (failures.length) {
  console.error('\n' + failures.length + ' homepage ticker check(s) failed');
  process.exit(1);
}
console.log('\nHomepage ticker checks passed.');
