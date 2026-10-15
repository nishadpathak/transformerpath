#!/usr/bin/env node
/* The audited broken links: replacements resolve in the data, and removed sites are flagged. */
'use strict';
const fs = require('fs');
const assert = require('assert');

const doc = JSON.parse(fs.readFileSync('data/link-fixes.json', 'utf8'));
const manuf = fs.readFileSync('data/manufacturers.json', 'utf8');
const integrity = JSON.parse(fs.readFileSync('data/directory-integrity.json', 'utf8'));

doc.replaced.forEach(function (row) {
  assert(manuf.indexOf(row.to) !== -1, row.slug + ' census should use ' + row.to);
  assert(manuf.indexOf(row.from) === -1, row.slug + ' census should drop ' + row.from);
  const html = fs.readFileSync('manufacturers/' + row.slug + '/index.html', 'utf8');
  assert(html.indexOf(row.to) !== -1, row.slug + ' profile should link ' + row.to);
  assert(html.indexOf(row.from) === -1, row.slug + ' profile should drop ' + row.from);
});

doc.removed.forEach(function (row) {
  assert(manuf.indexOf(row.from) === -1, row.from + ' should be gone from the census');
  const html = fs.readFileSync('manufacturers/' + row.slug + '/index.html', 'utf8');
  assert(html.indexOf(row.from) === -1, row.slug + ' profile should not link the dead site');
  assert(html.indexOf('official_website_click') === -1, row.slug + ' should not show an official website');
});

['Sandas & Co', 'Qingdao Transformer Group'].forEach(function (name) {
  const flag = integrity.flags.find(function (f) {
    return f.directory === 'manufacturers' && f.name === name && f.field === 'website';
  });
  assert(flag && flag.label === 'dead' && flag.checked, name + ' website removal is flagged');
});

console.log('link-fixes: ok');
