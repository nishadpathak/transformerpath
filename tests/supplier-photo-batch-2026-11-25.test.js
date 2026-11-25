#!/usr/bin/env node
/* Run after the normal build from the repository root. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { directoryCard } = require('../lib/directory-ssr');
const { accessoryEvidenceUrl } = require('../lib/listing-richness');
const { materializeSupplierCatalogue } = require('../lib/supplier-catalogue-overlay');
const json = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const direct = json('data/directory-batch-manifest.json').direct_profile_links;
const data = json('data/accessories.json').suppliers;
const indexed = json('data/directory-index.json').companies;
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const client = fs.readFileSync('tp-directory.js', 'utf8');
const profileUrl = vm.runInNewContext(client.slice(client.indexOf('function profileUrl('), client.indexOf('function availabilityMark(')) + '; profileUrl');
const today = '2026-11-25';
const slugs = [
  'accord-transformer-and-switchgear-ltd', 'sruti-copper-pvt-ltd', 'hetvi-enterprise',
  'impedance-electrical-power-pvt-ltd', 'phitech-solutions', 'prabha-bidyut-opc-pvt-ltd',
  'powerstar-electricals-limited', 'duraflux-transformers', 'urja-mac',
  'sansion-power-electric-co-ltd', 'hitech-insulation-chennai', 'saffron-transformer-components-pvt-ltd',
  'antelp-corporation-private-limited'
];
assert.deepEqual(data.filter(row => slugs.includes(row.slug)).length, slugs.length);
for (const slug of slugs) {
  const row = data.find(x => x.slug === slug);
  const href = '/accessories/' + slug + '/';
  const path = href.slice(1) + 'index.html';
  const c = indexed.filter(row => row.slug === slug);
  assert.equal(c.length, 1, slug + ' listed once');
  assert.equal(c[0].kind, 'component_supplier');
  assert.ok(c[0].canonical_id, slug + ' retains a canonical entity');
  assert.equal(c[0].profile_url, href);
  assert.equal(c[0].source_meta.source_url, row.directory_evidence_url);
  assert.equal(c[0].last_verified, today);
  assert.equal(profileUrl(c[0]), href);
  assert.equal(directoryCard(c[0]).split('href="' + href + '"').length - 1, 2);
  assert.equal(row.listing_status, 'unclaimed');
  assert.equal(row.verification_status, 'Unclaimed');
  assert.ok(direct.includes(path));
  const html = fs.readFileSync(path, 'utf8');
  assert.ok(html.includes('<link rel="canonical" href="https://transformerpath.com' + href + '">'));
  assert.ok(html.includes('name="robots" content="index,follow"'));
  assert.ok(html.includes('href="' + row.directory_evidence_url + '"'));
  assert.ok(html.includes('Open source ↗'));
  assert.ok(sitemap.includes('<loc>https://transformerpath.com' + href + '</loc><lastmod>' + today + '</lastmod>'));
  assert.doesNotMatch(html, /do_not_contact|never_contact/i);
}
assert.deepEqual(materializeSupplierCatalogue(path.resolve('data')), [], 'materialization is idempotent');
const saffron = data.find(r => r.slug === 'saffron-transformer-components-pvt-ltd');
assert.equal(saffron.website, undefined, 'government citation is not an official company website');
assert.ok(!fs.readFileSync('accessories/saffron-transformer-components-pvt-ltd/index.html', 'utf8').includes('Official website ↗'));
assert.equal(indexed.find(r => r.slug === saffron.slug).source_meta.source_type, 'government_industry_record');
assert.equal(accessoryEvidenceUrl({directory_evidence_url:'javascript:alert(1)'}), '');
assert.equal(accessoryEvidenceUrl({directory_evidence_url:'https://user:password@example.com/'}), '');
const antelp = data.find(r => r.slug === 'antelp-corporation-private-limited');
assert.equal(antelp.website, undefined, 'equipment OEM project report is not Antelp official website');
assert.equal(antelp.city, 'Bhiwadi');
assert.equal(antelp.state, 'Rajasthan');
assert.deepEqual(antelp.categories, ['Silicon steel slitting']);
assert.doesNotMatch(JSON.stringify(antelp), /\bBIS\b/);
assert.equal(indexed.find(r => r.slug === antelp.slug).source_meta.source_type, 'equipment_oem_project_report');
assert.ok(!data.some(r => /bhairavnath|redmond|snehal|vitech|electro-mechanical-industries/.test(r.slug || '')));
const tel = json('data/manufacturers.json').flatMap(g => g.makers || []).filter(row => row[0] === 'Telawne Power Equipments');
assert.equal(tel.length, 1);
assert.ok(tel[0][3].split(',').includes('DRY'));
assert.equal(indexed.filter(r => r.slug === 'telawne-power-equipments').length, 1);
assert.ok(sitemap.includes('<loc>https://transformerpath.com/manufacturers/telawne-power-equipments/</loc><lastmod>' + today + '</lastmod>'));
assert.ok(!fs.existsSync('dist/data/supplier-catalogue-overlay-2026-11-25.json'), 'compact internal source is not in public dist');
for (const file of ['data/directory-index.json', 'data/accessories.json']) {
  const publicRows = json('dist/' + file);
  const rows = publicRows.companies || publicRows.suppliers;
  for (const slug of slugs) assert.equal(rows.filter(r => r.slug === slug).length, 1, 'global search feed ' + file + ': ' + slug);
}
console.log('Supplier photo batch: ' + slugs.length + ' unique direct and indexed profiles verified.');
