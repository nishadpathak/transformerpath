#!/usr/bin/env node
/* /sitemap.xml must be well-formed XML under Google's 50k / 50 MB caps.
 * The writer keeps one urlset until a cap is crossed, then emits an index.
 * Run: node tests/sitemap-xml-valid.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const split = require('../lib/sitemap-split');

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

const xml = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
const shape = split.wellFormedErrors(xml);
check(shape.length === 0, 'committed sitemap.xml is well-formed XML' + (shape[0] ? ' (' + shape[0] + ')' : ''));
check(/<urlset[\s>]/.test(xml), 'committed sitemap is a urlset');
check(!/<sitemapindex[\s>]/.test(xml), 'committed sitemap is not an index yet');
check(Buffer.byteLength(xml, 'utf8') < split.BYTE_LIMIT, 'committed sitemap is under the byte cap');
check((xml.match(/<loc>/g) || []).length < split.URL_LIMIT, 'committed sitemap is under the URL cap');
check((xml.match(/<loc>/g) || []).length > 1000, 'committed sitemap still lists the public site');

const small = split.plan([
  { loc: 'https://transformerpath.com/', lastmod: '2026-10-14' },
  { loc: 'https://transformerpath.com/a&b.html', lastmod: '2026-10-01' }
]);
check(small.kind === 'urlset' && small.files.length === 1 && small.files[0].name === 'sitemap.xml', 'a short list stays one sitemap.xml');
check(small.files[0].xml.indexOf('a&amp;b.html') !== -1, 'loc ampersands are escaped');
check(split.wellFormedErrors(small.files[0].xml).length === 0, 'short urlset is well-formed');

const over = split.plan([
  { loc: 'https://transformerpath.com/p' + 0 + '.html', lastmod: '2026-01-01' },
  { loc: 'https://transformerpath.com/p' + 1 + '.html', lastmod: '2026-01-02' },
  { loc: 'https://transformerpath.com/p' + 2 + '.html', lastmod: '2026-01-03' }
], { urlLimit: 2, byteLimit: split.BYTE_LIMIT });
check(over.kind === 'index', 'crossing the URL cap writes a sitemap index');
check(over.files[0].name === 'sitemap.xml' && /<sitemapindex[\s>]/.test(over.files[0].xml), 'sitemap.xml is the index');
check(over.files.length === 3, 'index plus two partial urlsets');
over.files.forEach(function (file) {
  check(split.wellFormedErrors(file.xml).length === 0, file.name + ' is well-formed');
});
check(over.files[0].xml.indexOf('https://transformerpath.com/sitemap-1.xml') !== -1, 'index points at the first partial');
check(over.files[0].xml.indexOf('https://transformerpath.com/sitemap-2.xml') !== -1, 'index points at the second partial');

const fat = split.plan([
  { loc: 'https://transformerpath.com/' + 'x'.repeat(80) + '.html', lastmod: '2026-01-01' },
  { loc: 'https://transformerpath.com/' + 'y'.repeat(80) + '.html', lastmod: '2026-01-02' }
], { byteLimit: 280 });
check(fat.kind === 'index' && fat.files.length >= 2, 'crossing the byte cap writes a sitemap index');

const toml = fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8');
check(/for = "\/sitemap\.xml"/.test(toml) && /Content-Type = "application\/xml; charset=utf-8"/.test(toml), 'sitemap.xml is served as application/xml');

if (failed) {
  console.error(failed + ' sitemap XML check(s) failed');
  process.exit(1);
}
console.log('sitemap XML checks passed');
