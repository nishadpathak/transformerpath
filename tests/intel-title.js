#!/usr/bin/env node
/* /intel keeps one stable title. Run: node tests/intel-title.js */
'use strict';
const fs = require('fs');
const path = require('path');
const catalog = require('../lib/seo-catalog');
const fit = require('../lib/seo-fit');
const html = fs.readFileSync(path.join(__dirname, '..', 'intel.html'), 'utf8');
const visible = 'Daily Transformer Intel — tenders, awards & prices | TransformerPath';
const title = 'Daily Transformer Intel — tenders, awards &amp; prices | TransformerPath';
const checks = [
  ['<title>' + title + '</title>', 'title element'],
  ['property="og:title" content="' + title + '"', 'og:title'],
  ['name="twitter:title" content="' + title + '"', 'twitter:title']
];
let failed = 0;
checks.forEach(function (row) {
  if (html.indexOf(row[0]) === -1) { failed++; console.error('FAIL ' + row[1]); }
  else console.log('ok ' + row[1]);
});
const draft = catalog.draft('intel.html', html, catalog.create());
if (draft.draftTitle !== visible) {
  failed++;
  console.error('FAIL catalog title ' + draft.draftTitle);
} else console.log('ok catalog title');
if (!draft.lockedTitle) {
  failed++;
  console.error('FAIL catalog does not lock the intel title');
} else console.log('ok catalog lock');
const item = { draft: draft.draftTitle, lockedTitle: true, salt: 'intel', pads: draft.padsTitle };
fit.assignUnique([item], 'title', 50, 60);
if (item.title !== visible) {
  failed++;
  console.error('FAIL seo fit shortened the title to ' + item.title);
} else console.log('ok seo fit keeps the 68-character title');
const seo = fs.readFileSync(path.join(__dirname, '..', 'check-seo.js'), 'utf8');
if (seo.indexOf("title === 'Daily Transformer Intel — tenders, awards & prices | TransformerPath'") === -1) {
  failed++;
  console.error('FAIL check-seo does not allow this title');
} else console.log('ok check-seo exemption');
if (failed) process.exit(1);
console.log('intel title checks passed');
