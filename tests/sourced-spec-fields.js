#!/usr/bin/env node
/* Sourced cooling, MVA and country pages: cited values only, no thin pages.
 * Run: node tests/sourced-spec-fields.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const spec = require('../lib/sourced-spec-fields');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const doc = spec.load();
const errors = spec.validate(doc);
check('every sourced value has a quote, URL and checked_at', errors.length === 0, errors.slice(0, 8).join('; '));
check('a cooling code inside a longer word is not a class', spec.quoteHasCode('donanımlı fabrika', 'ONAN') === false);
check('AF in an assembly note is not stored as a cooling class',
  !(doc.companies || []).some(function (c) { return (c.cooling || []).some(function (row) { return row.code === 'AF'; }); }));

const pages = spec.landings(doc);
check('eight combination pages', pages.length === 8, String(pages.length));
check('every page has at least three manufacturers', pages.every(function (p) { return p.companies.length >= 3; }));
check('no India page below 25 MVA', !pages.some(function (p) { return p.country === 'India' && p.floor < 25; }));
check('Elsan stays off the Türkiye 5 MVA ONAF page',
  !pages.some(function (p) {
    return p.slug === 'onaf-5-mva-turkiye' && p.companies.some(function (c) { return c.slug === 'elsan-transformator'; });
  }));
check('Classic has cooling and no landing page',
  doc.companies.some(function (c) { return c.slug === 'classic-transformers' && c.cooling && c.cooling.length; }) &&
  !pages.some(function (p) { return p.companies.some(function (c) { return c.slug === 'classic-transformers'; }); }));

const titles = {};
const descs = {};
pages.forEach(function (p) {
  check(p.slug + ' title window', p.title.length >= 50 && p.title.length <= 60, String(p.title.length) + ' ' + p.title);
  check(p.slug + ' description window', p.description.length >= 140 && p.description.length <= 160, String(p.description.length));
  if (titles[p.title]) check(p.slug + ' unique title', false, titles[p.title]);
  titles[p.title] = p.slug;
  if (descs[p.description]) check(p.slug + ' unique description', false, descs[p.description]);
  descs[p.description] = p.slug;
});
const index = spec.indexCopy();
check('index title window', index.title.length >= 50 && index.title.length <= 60, String(index.title.length));
check('index description window', index.description.length >= 140 && index.description.length <= 160, String(index.description.length));
check('index description is not a landing description', !descs[index.description]);

const blob = JSON.stringify(doc);
check('no personal names in the sourced file', !/\b(ajay|prabhat|jitendra|mamtora|g[uü]re|atilla)\b/i.test(blob));
check('no Dubai or UAE branding in the sourced file', !/\bDubai\b|\bUAE\b|United Arab Emirates/.test(blob));

const companyBuilder = fs.readFileSync(path.join(__dirname, '..', 'build-company-pages.js'), 'utf8');
check('company prune keeps spec and sourced hubs',
  /'sourced'/.test(companyBuilder) && /'specs'/.test(companyBuilder));

if (failed) {
  console.error('SOURCED SPEC FIELDS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('SOURCED SPEC FIELDS PASS pages=' + pages.length);
