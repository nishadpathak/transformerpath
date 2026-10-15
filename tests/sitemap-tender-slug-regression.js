#!/usr/bin/env node
/* Tender pages live at /tenders/<full title slug>/. The sitemap date must use
 * that same slug. A tender added during the build is not in HEAD blame yet, so
 * its own last_verified is the content date. */
'use strict';
const dates = require('../lib/sitemap-dates');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const longTitle = 'Augstsprieguma tikls tenders a rebuild of 110 kV substation No. 6 TEC-1';
const fullSlug = 'augstsprieguma-tikls-tenders-a-rebuild-of-110-kv-substation-no-6-tec-1';
const pages = dates.tenderPageDates([
  { title: 'Short tender', last_verified: '2026-10-15' },
  { title: longTitle, last_verified: '2026-10-15' }
], {
  'Short tender': '2026-09-01'
});

check('a shared verification day does not replace a blame date', pages['tenders/short-tender/index.html'] === '2026-09-01');
check('new long tender uses the full directory slug', pages['tenders/' + fullSlug + '/index.html'] === '2026-10-15');
check('new long tender is not stored under a 32-character slug', !pages['tenders/augstsprieguma-tikls-tenders-a-r/index.html']);

if (failed) {
  console.error('SITEMAP TENDER SLUG REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — sitemap tender slug regression');
