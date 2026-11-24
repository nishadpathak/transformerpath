#!/usr/bin/env node
/* Run after the directory builders, build-directory-index.js and build-sitemap.js. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const manifest = json('data/directory-batch-manifest.json');
const entities = json('data/directory-index.json').companies;
const sitemap = read('sitemap.xml');
const { directoryCard } = require('../lib/directory-ssr');
const vm = require('node:vm');
const client = read('tp-directory.js');
const clientProfile = client.slice(client.indexOf('function profileUrl('), client.indexOf('function availabilityMark('));
const browserProfileUrl = vm.runInNewContext(clientProfile + '; profileUrl', { esc: String });
const cases = [
  [
    "services",
    "services",
    "service_repair",
    "industrias-explorer",
    "Colombia",
    "https://industriasexplorer.com/servicios"
  ],
  [
    "services",
    "services",
    "service_repair",
    "ssei-ecuador",
    "Ecuador",
    "https://www.ssei.com.ec/servicios"
  ],
  [
    "services",
    "services",
    "service_repair",
    "iesersa-guatemala",
    "Guatemala",
    "https://iesersa.com.gt/index.php/servicios/"
  ],
  [
    "logistics",
    "companies",
    "transport_logistics",
    "aht-colombia",
    "Colombia",
    "https://www.ahtcolombia.com/sectores/"
  ],
  [
    "logistics",
    "companies",
    "transport_logistics",
    "rl-heavy-lift-panama",
    "Panama",
    "https://rltransportca.com/es/"
  ],
  [
    "laboratories",
    "laboratories",
    "testing_laboratory",
    "cidet-sabaneta",
    "Colombia",
    "https://cidet.org.co/certifica/laboratorios/laboratorio-de-analisis-quimico/"
  ],
  [
    "laboratories",
    "laboratories",
    "testing_laboratory",
    "secamb-peru",
    "Peru",
    "https://www.secamb.com.pe/servicios/analisis-aceite-dielectrico/"
  ],
  [
    "machinery",
    "machinery",
    "machinery_manufacturer",
    "soto-filhos-transformer-winding",
    "Brazil",
    "https://www.sotofilhos.com.br/produtos/ListadeRebobinadeiras/"
  ],
  [
    "accessories",
    "suppliers",
    "component_supplier",
    "ci-importex-colombia",
    "Colombia",
    "https://www.importex.com.co/es/productos/"
  ]
];
const checked = '2026-11-24';
const slugOf = row => row.slug || row.id?.split(':').at(-1);

for (const [section, key, kind, slug, country, citation] of cases) {
  const rel = section + '/' + slug + '/index.html';
  const category = read(section + '.html');
  const url = 'https://transformerpath.com/' + section + '/' + slug + '/';
  const profile = read(rel);
  const [row, duplicate] = json('data/' + section + '.json')[key].filter(item => slugOf(item) === slug);
  assert.ok(row && !duplicate, slug + ' is one source record');
  assert.equal(row.country, country);
  assert.equal(row.website, citation);
  assert.equal(new URL(citation).protocol, 'https:');
  assert.equal(row.verification_date === checked || row.last_verified === checked || row.evidence_source?.includes(checked), true);
  assert.ok(profile.includes('<link rel="canonical" href="' + url + '">'), slug + ' has a canonical profile');
  assert.ok(profile.includes('name="robots" content="index,follow"'), slug + ' is indexable');
  assert.ok(profile.includes('href="' + citation.replace(/&/g, '&amp;') + '"'), slug + ' links to the scoped source');
  assert.ok(category.includes(slug), slug + ' is discoverable in its category');
  const matching = entities.filter(entity => entity.slug === slug);
  assert.equal(matching.length, 1, slug + ' appears once in Global Search');
  assert.equal(matching[0].kind, kind);
  assert.equal(matching[0].country, country);
  const href = '/' + section + '/' + slug + '/';
  assert.equal(matching[0].profile_url, href, slug + ' has a direct indexed profile');
  assert.equal(browserProfileUrl(matching[0]), href, slug + ' has a direct client link');
  assert.equal(directoryCard(matching[0]).split('href="' + href + '"').length - 1, 2, slug + ' title and action directly link');
  assert.ok(manifest.direct_profile_links.includes(rel));
  assert.equal(manifest.pages[rel], checked);
  const sitemapEntry = sitemap.split('<url>').find(entry => entry.includes('<loc>' + url + '</loc>'));
  assert.ok(sitemapEntry?.split('</url>')[0]?.includes('<lastmod>' + checked + '</lastmod>'), slug + ' has an item-specific sitemap date');
  assert.equal(row.max_voltage_kv || row.capacity_mva || row.max_weight_tons || row.voltage_capability_kv, undefined, slug + ' does not infer maximum ratings');
  if (section === 'laboratories') {
    assert.equal(row.accreditation, undefined, slug + ' cannot infer a blanket test accreditation');
    assert.notEqual(row.third_party_independent, true, slug + ' cannot infer independent status');
    assert.ok(profile.includes('Published test scope'));
  }
  if (section === 'accessories') assert.equal(row.listing_status, 'unclaimed');
}

assert.equal(manifest.direct_profile_links.length, cases.length);
assert.equal(browserProfileUrl({ kind: 'testing_laboratory', slug: 'legacy' }), 'laboratories.html');
assert.equal(browserProfileUrl({ kind: 'testing_laboratory', slug: 'legacy', profile_url: '//invalid.example/' }), 'laboratories.html');

const cidet = read('laboratories/cidet-sabaneta/index.html');
assert.ok(cidet.includes('11-LAB-024') && cidet.includes('9 February 2030') && cidet.includes('not electrical testing of a complete transformer'));
assert.ok(!read('directory.html').includes('Independent impulse, short-circuit and dielectric labs with ISO/IEC 17025 scope.'));
// Run the deployed Global Search index builder, including the raw category
// records whose display names can differ from their unified-index names.
const searchSource = [...read('search.html').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(x => x[1]).find(script => script.includes('function buildIndex()'));
const start = searchSource.indexOf('let INDEX =');
const end = searchSource.indexOf('const fh =');
const loadGlobalSearch = vm.runInNewContext(searchSource.slice(start, end) + '; buildIndex', {
  document: { getElementById: () => ({ textContent: '' }) },
  fetch: rel => Promise.resolve({ json: () => json(rel) }),
  console
});
loadGlobalSearch().then(results => {
  for (const [section, key, kind, slug] of cases) {
    const company = entities.find(entity => entity.slug === slug);
    const raw = json('data/' + section + '.json')[key].find(item => slugOf(item) === slug);
    const matches = results.filter(item => item.t && (item.t === company.name || item.t === raw.name));
    assert.ok(matches.some(i => i.s === 'companies'), slug + ' is in Global Search companies');
    const category = { accessories: 'components', machinery: 'labs', laboratories: 'labs' }[section];
    if (category) assert.ok(matches.some(i => i.s === category), slug + ' is in its Global Search category');
    for (const hit of matches) assert.equal(hit.href, company.profile_url, slug + ' Global Search points to the published profile');
  }
  const previous = results.find(item => item.s === 'labs' && String(item.t).includes('KEMA'));
  assert.equal(previous.href, 'laboratories.html', 'legacy card fallback is unchanged');
  console.log('LATAM DIRECTORY QUALITY OK: nine sourced profiles across six countries and five directories.');
}).catch(err => {
  console.error(err);
  process.exitCode = 1;
});
