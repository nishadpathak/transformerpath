#!/usr/bin/env node
/* Directory introductions stay factual: no invented founding year, year shown when present. */
const intro = require('../directory-intro');
let failed = 0;
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name);
  else { failed++; console.log('  ✗ ' + name); }
}
const plain = intro.supplierIntro({
  name: 'Delta Star',
  role: 'transformer manufacturer',
  city: 'Lynchburg, VA',
  country: 'USA',
  products: ['PT', 'DT']
});
check('names the company and place', plain.indexOf('Delta Star') >= 0 && plain.indexOf('Lynchburg, VA') >= 0);
check('names products from type codes', plain.indexOf('power transformers') >= 0 && plain.indexOf('distribution transformers') >= 0);
check('does not invent a founding year', !/\b(18|19|20)\d{2}\b/.test(plain) && /not yet recorded/.test(plain));

const dated = intro.supplierIntro({
  name: 'Example Works',
  role: 'transformer manufacturer',
  country: 'India',
  products: ['DRY'],
  established: 1974,
  voltage: '245 kV'
});
check('prints a year only when supplied', dated.indexOf('1974') >= 0 && dated.indexOf('245 kV') >= 0);
check('does not call sourced voltage confirmed', dated.indexOf('CONFIRMED') < 0);

const buyer = intro.enrichExisting({
  description: 'Dubai vertically integrated utility.',
  established: 1992,
  capacity: '1.5 MVA to 500 MVA',
  products: ['400/132 kV Transmission Autotransformers']
});
check('keeps the researched buyer description', buyer.indexOf('Dubai vertically integrated utility') >= 0);
check('adds the recorded establishment year', buyer.indexOf('Established 1992') >= 0);
check('adds the procurement range', buyer.indexOf('1.5 MVA to 500 MVA') >= 0);

if (failed) {
  console.error('FAIL ' + failed);
  process.exit(1);
}
console.log('PASS');
