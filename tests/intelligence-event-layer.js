#!/usr/bin/env node
/* tests/intelligence-event-layer.js
 * The Intelligence tiles are the event layer. They must say so, and they
 * must link to the manufacturer census instead of reading as the census.
 * Run: node tests/intelligence-event-layer.js
 */
'use strict';
const fs = require('fs');
const html = fs.readFileSync('intelligence.html', 'utf8');
const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
let failures = [];
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failures.push(label);
}
check('company tile is labelled as the event layer', /Companies in the event layer/.test(html));
check('factory tile is labelled as events', /Factory expansion events/.test(html));
check('tiles are not labelled as the bare census', !/<small>Companies<\/small>/.test(html) && !/<small>Factory expansions<\/small>/.test(html));
check('page links to the manufacturer census', /href="manufacturers\.html"/.test(html) && /Manufacturer census: \d+ companies/.test(html));
check('census link uses the site-stats manufacturer count', html.indexOf('Manufacturer census: ' + stats.manufacturers + ' companies') !== -1, String(stats.manufacturers));
if (failures.length) {
  console.error('\n' + failures.length + ' intelligence tile check(s) failed');
  process.exit(1);
}
console.log('\nIntelligence tile checks passed.');
