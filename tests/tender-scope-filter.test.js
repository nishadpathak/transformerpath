#!/usr/bin/env node
/* The tender listing offers a Confirmed transformer scope filter, and a
 * scope label appears only on rows whose source confirms transformer scope.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const html = fs.readFileSync('tenders.html', 'utf8');
const builder = fs.readFileSync('build-tenders.js', 'utf8');
check('listing has the confirmed-scope control', html.includes('id="scopeFilter"') && html.includes('>Confirmed transformer scope</button>'));
check('builder emits the same control', builder.includes('id="scopeFilter"') && builder.includes('Confirmed transformer scope</button>'));

const rows = [...html.matchAll(/<div class="t-row" data-scope="(CONFIRMED|INFERRED|UNKNOWN)">([\s\S]*?)<\/div>/g)];
check('every tender row carries a scope', rows.length >= 150, String(rows.length));
let mislabelled = 0;
rows.forEach(function (m) {
  const badge = m[2].includes('Confirmed transformer scope');
  if ((m[1] === 'CONFIRMED') !== badge) mislabelled++;
  if (/ · (?:CONFIRMED|INFERRED|UNKNOWN)</.test(m[2])) mislabelled++;
});
check('badge is only on confirmed-scope rows', mislabelled === 0, String(mislabelled));
check('at least one confirmed row is badged', rows.some(function (m) { return m[1] === 'CONFIRMED'; }));
check('inferred rows are not badged', rows.some(function (m) { return m[1] === 'INFERRED' && !m[2].includes('scope-badge'); }));

if (failed) {
  console.error('TENDER SCOPE FILTER FAILED (' + failed + ')');
  process.exit(1);
}
console.log('TENDER SCOPE FILTER OK');
