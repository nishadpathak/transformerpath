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

(doc.directory_replacements || []).forEach(function (row) {
  const file = fs.readFileSync(row.file, 'utf8');
  const surface = {
    'data/buyers.json': 'buyers.html',
    'data/education.json': 'education.html',
    'data/services.json': 'services.html'
  }[row.file];
  assert(file.indexOf(row.to) !== -1, row.file + ' should use ' + row.to);
  assert(file.indexOf(row.from) === -1, row.file + ' should drop ' + row.from);
  if (surface) {
    const html = fs.readFileSync(surface, 'utf8');
    assert(html.indexOf(row.to) !== -1, surface + ' should link ' + row.to);
    assert(html.indexOf(row.from) === -1, surface + ' should drop ' + row.from);
  }
});

(doc.dropped_sources || []).forEach(function (row) {
  const file = fs.readFileSync(row.file, 'utf8');
  assert(file.indexOf(row.from) === -1, row.from + ' should be gone from ' + row.file);
});
const transwest = fs.readFileSync('projects/transwest-express-transmission-project/index.html', 'utf8');
assert(transwest.indexOf('TransWest-Express-Wyoming.pdf') === -1, 'project page should drop the dead brochure');
assert(transwest.indexOf('utilitydive.com/news/blm-transwest-express-transmission') !== -1, 'project page should keep the Utility Dive source');

console.log('link-fixes: ok');
