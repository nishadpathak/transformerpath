#!/usr/bin/env node
/* The homepage must not carry a delayed-coverage label unless that is the
 * stamped public status. A fetch fallback must not invent one. */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const PHRASE = 'COVERAGE DELAYED';
const home = fs.readFileSync('index.html', 'utf8');
const status = JSON.parse(fs.readFileSync('data/intel-status.json', 'utf8'));
const stamped = (home.match(/id="hero-live-status">([^<]*)</) || [])[1] || '';

console.log('=== HOMEPAGE COVERAGE LABEL ===');
check('visible banner matches intel-status.json', stamped === status.status, stamped + ' vs ' + status.status);
check('script does not default the banner to a delayed label', !/st\.status\s*\|\|\s*['"][^'"]*COVERAGE DELAYED/.test(home));
if (String(status.status).indexOf(PHRASE) < 0) {
  check('homepage HTML does not contain COVERAGE DELAYED', home.indexOf(PHRASE) < 0);
} else {
  check('delayed status is confined to the visible banner', stamped.indexOf(PHRASE) >= 0);
  const outside = home.replace(stamped, '');
  check('COVERAGE DELAYED is not repeated outside the stamped banner', outside.indexOf(PHRASE) < 0);
}

if (failed) {
  console.error('HOMEPAGE COVERAGE LABEL FAILED (' + failed + ')');
  process.exit(1);
}
console.log('HOMEPAGE COVERAGE LABEL OK — banner ' + stamped);
