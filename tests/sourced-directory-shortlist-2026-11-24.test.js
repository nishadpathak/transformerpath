#!/usr/bin/env node
/* Run after the five directory builders and build-directory-index.js. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const checked = '2026-11-24';
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const manifest = json('data/directory-batch-manifest.json');
const indexed = json('data/directory-index.json').companies;
const sitemapDates = require('../lib/sitemap-dates');
const dates = sitemapDates.load();
const groups = [
  ['services', 'services', 'services', 'service_repair', ['techplus-engineering', 'cacla-engineering']],
  ['laboratories', 'laboratories', 'laboratories', 'testing_laboratory', ['iee-usp-high-power', 'lubrisider-chile', 'vps-singapore-transformer-oil']],
  ['machinery', 'machinery', 'machinery', 'machinery_manufacturer', ['whitelegg-coil-winding', 'nittoku-transformer-winding']],
  ['accessories', 'accessories', 'suppliers', 'component_supplier', ['oji-f-tex', 'tervakoski-oy-delfort']],
  ['utilities', 'utility-listings', 'companies', null, ['uetcl', 'gridco']]
];

for (const [section, file, key, kind, slugs] of groups) {
  const data = json('data/' + file + '.json');
  const categoryIndex = read(section + '.html');
  if (section === 'machinery') assert.equal(data.total_machinery_records, data[key].length);
  if (section === 'laboratories') assert.equal(data.total_laboratories, data[key].length);
  for (const slug of slugs) {
    const only = data[key].filter(row => (row.slug || row.id?.split(':').at(-1)) === slug);
    assert.equal(only.length, 1, slug + ' is a single primary record');
    const [row] = only;
    const source = row.verification_source || row.source || row.website;
    assert.equal(new URL(source).protocol, 'https:', slug + ' has an official HTTPS citation');
    assert.equal(Boolean(row.country), true, slug + ' records a country');
    assert.equal(row.verification_date === checked || row.last_verified === checked || row.evidence_source?.includes(checked), true);
    const rel = section + '/' + slug + '/index.html';
    const url = 'https://transformerpath.com/' + section + '/' + slug + '/';
    const html = read(rel);
    assert.equal(manifest.pages[rel], checked);
    assert.equal(sitemapDates.dateFor(rel, dates), checked, slug + ' retains its item-specific sitemap date');
    assert.ok(html.includes('<link rel="canonical" href="' + url + '">'), slug + ' has its own canonical page');
    assert.ok(html.includes('name="robots" content="index,follow"'), slug + ' is indexable');
    assert.ok(html.includes('href="' + source + '"'), slug + ' links directly to source evidence');
    assert.ok(categoryIndex.includes(slug), slug + ' is discoverable in its category page');
    if (kind) {
      const entities = indexed.filter(entity => entity.slug === slug);
      assert.equal(entities.length, 1, slug + ' is a unique cross-index entity');
      assert.equal(entities[0].kind, kind);
    } else {
      assert.equal(categoryIndex.split('href="utilities/' + slug + '/"').length - 1, 1, slug + ' is linked once in the utilities index');
    }
    if (section === 'laboratories') {
      assert.equal(row.accreditation, undefined, slug + ' does not infer accreditation');
      assert.notEqual(row.third_party_independent, true, slug + ' does not infer independent status');
      assert.ok(html.includes('Published test scope'));
    }
    if (section === 'accessories') assert.equal(row.listing_status, 'unclaimed');
  }
}
console.log('SOURCED BUYER SHORTLISTS OK: 11 unique source-backed profiles across five verticals.');
