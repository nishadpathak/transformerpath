#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const l = require('../lib/company-profile-locales');
const html = require('../lib/seo-html');
const dates = require('../lib/sitemap-dates');

const pairs = l.allPairs(), languages = {};
assert.equal(l.localeForCountry('Mexico'), 'es');
assert.equal(l.localeForCountry('Brazil'), 'pt-BR');
for (const country of ['Belize', 'Guyana', 'Suriname', 'Haiti', 'USA']) {
  assert.equal(l.localeForCountry(country), null);
}
const alternates = (s) => [...s.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
  .map((m) => [m[1], m[2]]);
const get = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const paths = new Set(), sourceFiles = new Set();
for (const p of pairs) {
  assert(!paths.has(p.native), p.native);
  assert(!sourceFiles.has(p.rel), p.rel);
  paths.add(p.native);
  sourceFiles.add(p.rel);
  assert.equal(l.localeForRel(p.native), p.lang);
  assert.equal(l.localeForRel(p.rel), 'en');
  languages[p.lang] = (languages[p.lang] || 0) + 1;
  assert.equal(p.checked, '2026-11-24');
  assert.equal(dates.dateFor(p.native, {}, {}), '2026-11-25');
  assert.deepEqual(Object.entries(p.alternates), [['en', p.en], [p.lang,p.local], ['x-default',p.en]]);
  const source = '<html lang="en"><head><link rel="canonical" href="' + p.en + '"></head><body><main><h1>English</h1></main></body></html>';
  const english = l.englishCounterpart(source, p);
  assert.equal(l.englishCounterpart(english, p), english, 'build injection idempotent');
  assert.throws(() => l.englishCounterpart(source.replace('</head>', '<meta name="robots" content="noindex"></head>'), p));
  const local = l.render(p);
  assert(local.includes('<html lang="' + p.lang + '"'));
  assert(local.includes('rel="canonical" href="' + p.local + '"'));
  assert(!html.isNoindex(local));
  assert.deepEqual(alternates(english), alternates(local));
  assert(local.includes('href="' + new URL(p.en).pathname + '" lang="en" hreflang="en"'));
  assert(local.includes('href="#main"'));
  assert(local.includes('min-height:44px'));
  assert(local.includes('<time datetime="' + p.checked + '"'));
  for (const url of p.urls) assert(local.includes('href="' + html.esc(url) + '"'));
  assert(!/<form\b|mailto:|tel:|<iframe\b/.test(local), p.native);
}

assert.deepEqual(languages, {'pt-BR':2, es:8});
const dist = process.argv[2];
if (dist) {
  const sitemapFiles = fs.readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f));
  const xml = sitemapFiles.map((f) => get(dist,f)).join('');
  const indexedPaths = new Set([...xml.matchAll(/<loc>https:\/\/transformerpath\.com([^<]+)<\/loc>/g)].map((m) => m[1]));
  const index = JSON.parse(get(dist,'data/directory-index.json'));
  const sitemapPath = (p) => path.join(dist,p);
  for (const p of pairs) {
    const en = get(dist, p.rel);
    const native = get(dist, p.native);
    assert.deepEqual(alternates(en), Object.entries(p.alternates));
    assert.deepEqual(alternates(native), Object.entries(p.alternates));
    assert(indexedPaths.has(new URL(p.en).pathname));
    assert(indexedPaths.has(new URL(p.local).pathname));
    assert.equal(xml.split('<loc>' + p.local + '</loc>').length, 2);
    assert(xml.includes('<loc>' + p.local + '</loc><lastmod>2026-11-25</lastmod>'));
    assert.equal(index.companies.filter((r) => r.slug === html.publicPath(p.rel).split('/')[2]).length, 1);
    assert(!fs.statSync(sitemapPath(p.native)).isDirectory());
  }
  console.log('LATAM audit:', l.auditInventory(index, indexedPaths));
}
console.log('Company profile locales: reviewed source data, canonical identity, reciprocity, source dates and inventory checks passed.');
