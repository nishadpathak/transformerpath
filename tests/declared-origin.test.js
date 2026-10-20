/* Declared origin stays sourced, labelled, and off the census count. */
'use strict';
const fs = require('fs');
const path = require('path');
const declared = require('../lib/declared-origin');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const doc = declared.load(root);
const errors = declared.validate(doc);
check('seeded rows cite an official page', errors.length === 0, errors.join('; '));
const slugs = JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'));
const known = {};
slugs.forEach(function (row) { if (row && row.slug) known[row.slug] = row; });
(doc.companies || []).forEach(function (row) {
  check(row.slug + ' is an existing listing', !!known[row.slug]);
  check(row.slug + ' is not singled out', !/featured|spotlight|elin/i.test(JSON.stringify(row)));
});
check('seed count is the sourced set', (doc.companies || []).length === 10, String((doc.companies || []).length));

const stats = JSON.parse(fs.readFileSync(path.join(root, 'data/site-stats.json'), 'utf8'));
check('manufacturer count stays 887', stats.manufacturers === 887, String(stats.manufacturers));

const directory = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
check('directory filter is labelled Declared origin', directory.indexOf('aria-label="Declared origin"') >= 0 && directory.indexOf('id="fOrigin"') >= 0);
check('directory explains the field', directory.indexOf('class="declared-origin-note"') >= 0 && directory.indexOf(declared.NOTE) >= 0);
check('directory row prints the label', directory.indexOf('Declared origin: ') >= 0);

const spare = fs.readFileSync(path.join(root, 'spare-capacity/index.html'), 'utf8');
check('spare-capacity filters declared origin', spare.indexOf('id="sc-origin"') >= 0 && spare.indexOf('>Declared origin<') >= 0);
check('spare-capacity keeps the neutral note', spare.indexOf(declared.NOTE) >= 0);
check('unsourced spare-capacity cells are a dash', (spare.match(/data-label="Declared origin">—/g) || []).length >= 1);

const pricing = fs.readFileSync(path.join(root, 'pricing.html'), 'utf8');
check('pricing keeps $699', pricing.indexOf('$699') >= 0 && pricing.indexOf('Featured + Verified — $699/yr plus tax') >= 0);
check('pricing inclusions name the check', pricing.indexOf('declared-origin check') >= 0 && pricing.indexOf(declared.NOTE) >= 0);
const noteStart = pricing.indexOf('class="declared-origin-note"');
const priceNote = pricing.slice(noteStart, pricing.indexOf('</p>', noteStart));
check('pricing note adds no link', noteStart >= 0 && priceNote.indexOf('href=') < 0);
check('pricing keeps the existing $699 checkout', pricing.indexOf('href="https://buy.stripe.com/14AbIU0dG6lnbocghQfYY0Q"') >= 0);

const claim = fs.readFileSync(path.join(root, 'claim-listing/bhel/index.html'), 'utf8');
check('claim page lists the check under $699', claim.indexOf('>Featured+Verified $699/yr<') >= 0 && claim.indexOf('declared-origin check') >= 0);
check('claim page keeps the existing checkout', claim.indexOf('https://buy.stripe.com/14AbIU0dG6lnbocghQfYY0Q') >= 0);

const profile = fs.readFileSync(path.join(root, 'manufacturers/bhel/index.html'), 'utf8');
const plain = fs.readFileSync(path.join(root, 'manufacturers/weg/index.html'), 'utf8');
check('sourced profile shows Declared origin', profile.indexOf('<b>Declared origin</b>: India') >= 0 && profile.indexOf('origin_source') < 0 && profile.indexOf('https://www.bhel.com/') >= 0);
check('sourced profile shows the checked date', profile.indexOf('checked 2026-10-20') >= 0);
const plainField = plain.slice(plain.indexOf('data-declared-origin'), plain.indexOf('declared-origin-note'));
check('unsourced profile shows a dash', plainField.indexOf('<b>Declared origin</b>: —') >= 0 && plainField.indexOf('<a ') < 0);

const placeBrand = new RegExp('\\bDu' + 'bai\\b|\\bU' + 'AE\\b|United Arab ' + 'Emirates', 'i');
['data/declared-origins.json', 'pricing.html', 'spare-capacity/index.html'].forEach(function (rel) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  check(rel + ' keeps brand copy free of a place name', !placeBrand.test(text));
});

if (failed) {
  console.error('DECLARED ORIGIN FAILED (' + failed + ')');
  process.exit(1);
}
console.log('DECLARED ORIGIN PASS');
