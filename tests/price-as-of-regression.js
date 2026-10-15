#!/usr/bin/env node
/* Copper and aluminium stay on the recorded LME observation. The public
 * note says that date and that there is no automatic refresh. */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const latest = JSON.parse(fs.readFileSync('data/materials-latest.json', 'utf8'));
const home = fs.readFileSync('index.html', 'utf8');
const materials = fs.readFileSync('materials.html', 'utf8');
const loader = fs.readFileSync('material-latest.js', 'utf8');
const intel = fs.readFileSync('intel.html', 'utf8');
const NOTE = 'prices as of ';
const CADENCE = 'updated when a new LME official settlement is recorded';

console.log('=== PRICE AS-OF NOTE ===');
['copper', 'aluminium'].forEach(function (id) {
  const row = (latest.rows || []).find(function (r) { return r.id === id; });
  check(id + ' observation is still 2026-08-20', row && row.observation_date === '2026-08-20', row && row.observation_date);
  check(id + ' price was not rewritten', row && row.value === (id === 'copper' ? 14170 : 3182), row && String(row.value));
  check(id + ' note names the recorded date and the real cadence', row && row.note.indexOf('Prices as of 2026-08-20') >= 0 && row.note.indexOf(CADENCE) >= 0);
});
check('homepage fallback states the as-of note', home.indexOf(NOTE) >= 0 && home.indexOf(CADENCE) >= 0);
check('homepage still says this is not a live feed', /not a live feed/i.test(home));
check('materials page states the as-of note', materials.indexOf('prices as of 2026-08-20') >= 0 && materials.indexOf(CADENCE) >= 0);
check('loader builds the note from the observation date', loader.indexOf(NOTE) >= 0 && loader.indexOf(CADENCE) >= 0 && /observation_date/.test(loader));
check('intel materials note uses historical status', /st==='historical'/.test(intel));
check('intel materials note is built from observation_date and the recorded cadence', intel.indexOf(NOTE) >= 0 && intel.indexOf(CADENCE) >= 0 && /observation_date/.test(intel) && /m\.note/.test(intel));
check('intel fills the materials desk after that markup exists', intel.indexOf('DOMContentLoaded') >= 0 && intel.indexOf('id="matRowsTab"') > intel.indexOf('DOMContentLoaded'));

if (failed) {
  console.error('PRICE AS-OF NOTE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PRICE AS-OF NOTE OK');
