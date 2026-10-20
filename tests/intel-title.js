#!/usr/bin/env node
/* /intel keeps one stable title. Run: node tests/intel-title.js */
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'intel.html'), 'utf8');
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
if (failed) process.exit(1);
console.log('intel title checks passed');
