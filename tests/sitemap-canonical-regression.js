#!/usr/bin/env node
/* Sitemap URLs are unique, self-canonical, and indexable.
 * A noindex page must not be listed, and two locs must not share a canonical.
 */
'use strict';
const path = require('path');
const checkSitemap = require('../check-sitemap');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const root = path.join(__dirname, 'fixtures-sitemap-canonical');
const files = {};
files[path.join(root, 'index.html')] = '<link rel="canonical" href="https://transformerpath.com/"><meta name="robots" content="index,follow">';
files[path.join(root, 'events', 'wetex', 'index.html')] = '<link rel="canonical" href="https://transformerpath.com/events/wetex/"><meta name="robots" content="index,follow">';
files[path.join(root, 'events', 'wetex-2027', 'index.html')] = '<link rel="canonical" href="https://transformerpath.com/events/wetex-2027/"><meta name="robots" content="noindex,follow">';
files[path.join(root, 'events', 'wetex-2026', 'index.html')] = '<link rel="canonical" href="https://transformerpath.com/events/wetex/"><meta name="robots" content="index,follow">';

function readFile(file) {
  if (!files[file]) {
    const err = new Error('missing ' + file);
    throw err;
  }
  return files[file];
}

const good = '<?xml version="1.0"?><urlset>' +
  '<url><loc>https://transformerpath.com/</loc><lastmod>2026-10-01</lastmod></url>' +
  '<url><loc>https://transformerpath.com/events/wetex/</loc><lastmod>2026-10-02</lastmod></url>' +
  '</urlset>';
const goodResult = checkSitemap(good, root, readFile);
check('self-canonical indexable sitemap passes', goodResult.errors.length === 0, goodResult.errors.join('; '));

const noindexXml = good.replace('events/wetex/', 'events/wetex-2027/');
const noindexResult = checkSitemap(noindexXml, root, readFile);
check('noindex page is rejected', noindexResult.errors.some(function (e) { return e.indexOf('noindex') !== -1; }), noindexResult.errors.join('; '));

const sharedXml = '<?xml version="1.0"?><urlset>' +
  '<url><loc>https://transformerpath.com/events/wetex/</loc><lastmod>2026-10-01</lastmod></url>' +
  '<url><loc>https://transformerpath.com/events/wetex-2026/</loc><lastmod>2026-10-02</lastmod></url>' +
  '</urlset>';
const sharedResult = checkSitemap(sharedXml, root, readFile);
check('shared canonical is rejected', sharedResult.errors.some(function (e) { return e.indexOf('shared') !== -1 || e.indexOf('not self-canonical') !== -1; }), sharedResult.errors.join('; '));

const missingXml = '<?xml version="1.0"?><urlset>' +
  '<url><loc>https://transformerpath.com/</loc><lastmod>2026-10-01</lastmod></url>' +
  '<url><loc>https://transformerpath.com/events/missing/</loc><lastmod>2026-10-02</lastmod></url>' +
  '</urlset>';
const missingResult = checkSitemap(missingXml, root, readFile);
check('missing page is rejected', missingResult.errors.some(function (e) { return e.indexOf('no page') !== -1; }), missingResult.errors.join('; '));

if (failed) {
  console.error('SITEMAP CANONICAL REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('SITEMAP CANONICAL REGRESSION OK');
