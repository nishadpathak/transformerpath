#!/usr/bin/env node
/* Case-study related reading must resolve to pages that exist.
 * The old course page is gone; a hash on that file is not a link.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const banned = /webinar|consulting|masterclass|onboarding session|capstone review/i;
const data = JSON.parse(fs.readFileSync('data/case-studies.json', 'utf8'));
const studies = data.case_studies || [];
check('case studies are present', studies.length > 0);

studies.forEach(function (c) {
  check(c.slug + ' principle has no retired course wording', !banned.test(c.related_principle || ''));
  (c.related_links || []).forEach(function (link) {
    const file = String(link).split('#')[0].split('?')[0];
    check(c.slug + ' link stays on a real page', !banned.test(link) && !file.endsWith('masterclass.html') && fs.existsSync(file), link);
  });
  const htmlPath = path.join('case-studies', c.slug, 'index.html');
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
  check(c.slug + ' page does not point at the retired course file', html.indexOf('masterclass.html') === -1 && html.indexOf('design course.html#') === -1);
  check(c.slug + ' page keeps the site navigation stylesheet', html.indexOf('tp-nav.css') !== -1);
  (c.related_links || []).forEach(function (link) {
    const file = String(link).split('#')[0];
    const href = '../../' + file;
    check(c.slug + ' page links ' + file, html.indexOf('href="' + href + '"') !== -1, href);
  });
});

if (failed) {
  console.error('CASE STUDY LINKS REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — case study links regression');
