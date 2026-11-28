#!/usr/bin/env node
/* 28 Nov 2026 directory batch. New companies are unclaimed listings.
 * Companies that already had a profile are not duplicated. CWIEME Berlin
 * 2027 stand numbers from this batch show on the existing profile.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const badges = require('../event-badges');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const added = [
  ['Anupam Transformers India Private Limited', 'manufacturers/anupam-transformers-india-private-limited/index.html', 'Sikar, Rajasthan manufacturer of power and distribution transformers from 16 kVA to 10 MVA'],
  ['Rajasthan Powergen Transformer Private Limited', 'manufacturers/rajasthan-powergen-transformer-private-limited/index.html', 'Manufacturer of power, distribution and specialty transformers based near Sanchore, Rajasthan'],
  ['Transdelta Transformers Private Limited', 'manufacturers/transdelta-transformers-private-limited/index.html', 'Aurangabad manufacturer of distribution and power transformers up to 3.15 MVA at 33 kV'],
  ['Capital Transformers Private Limited', 'manufacturers/capital-transformers-private-limited/index.html', 'Delhi manufacturer of power and distribution transformers']
];
const manifest = JSON.parse(read('data/directory-batch-manifest.json'));
const listings = JSON.parse(read('data/manufacturer-listings.json')).companies;
const hub = read('manufacturer-listings.html');
const sitemap = read('sitemap.xml');
const banned = /do_not_contact|never_contact|outreach_flags|\bDubai\b|United Arab Emirates|\bUAE\b|transformer-magazine\.com|merit-media\.com/i;

for (const [name, rel, blurb] of added) {
  const html = read(rel);
  const row = listings.find(item => item.name === name);
  assert.equal(row.directory_publish, true, name);
  assert.equal(html.includes(blurb), true, name + ' keeps the supplied description');
  assert.equal(/content="index,follow"/.test(html), true, name + ' is indexable');
  assert.equal(html.includes('Unclaimed directory listing'), true, name + ' stays an unclaimed listing');
  assert.equal(/Verified supplier|tp-prov-tick|listing_tier":"verified"/i.test(html), false, name + ' is not ticked verified');
  assert.equal(banned.test(html), false, name + ' public page is clean');
  assert.equal(hub.includes('/manufacturers/' + row.slug + '/'), true, name + ' is on the manufacturer listings index');
  assert.equal(manifest.pages[rel], '2026-11-28');
  assert.equal(sitemap.includes('https://transformerpath.com/manufacturers/' + row.slug + '/'), true, name + ' is in the sitemap');
}

assert.equal(read('machinery/broomfield-winding/index.html').includes('Stand 27G63'), true);
assert.equal(read('accessories/nynas-ab/index.html').includes('Stand 27F50'), true);
assert.equal(read('accessories/savita-oil-technologies-ltd-savsol/index.html').includes('Stand 27F61'), true);
assert.equal(read('laboratories/tecsystem/index.html').includes('Stand 27J30'), true);
assert.equal(sitemap.includes('https://transformerpath.com/machinery/broomfield-winding/'), true);

const nynas = badges.htmlFor({ slug: 'nynas-ab', name: 'Nynas AB' });
assert.equal(nynas.includes('Exhibiting at CWIEME Berlin'), true);
assert.equal(nynas.includes('Stand 27F50'), true);
assert.equal(nynas.includes('class="event-badge"'), true);

const accessories = read('accessories.html');
assert.equal(accessories.includes('href="/accessories/\'+slug+\'/"'), true);
assert.equal(accessories.includes('href="accessories/'), false);
assert.equal(read('machinery.html').includes('href="/machinery/broomfield-winding/"'), true);

assert.equal(listings.length, 12, 'four new manufacturer listings and the eight already on file');
assert.equal(listings.filter(row => /transformergrid\.com/.test(row.website || '')).length, 1);
assert.equal(listings.some(row => /kalpataruprojects\.com|felbermayr\.cc|epoxyhouse\.com/.test(row.website || '')), false);

console.log('DIRECTORY BATCH 2026-11-28 OK');
