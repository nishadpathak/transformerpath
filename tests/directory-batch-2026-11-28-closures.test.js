#!/usr/bin/env node
/* 28 Nov 2026: six unclaimed listings, four closed companies removed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const banned = /transformer-magazine\.com|merit-media\.com|\bDubai\b|United Arab Emirates|\bUAE\b/i;

const added = [
  ['Leeds Transformer Co. Ltd', 'manufacturers/leeds-transformer-co-ltd/index.html', 'Leeds-based UK manufacturer of bespoke transformers'],
  ['Transformadores Gedelsa, S.A.', 'manufacturers/transformadores-gedelsa-s-a/index.html', 'Spanish transformer manufacturer in Salamanca'],
  ['Durelec Transformateurs', 'services/durelec-transformateurs/index.html', 'French maintenance company in Villeurbanne'],
  ['Transformatory Polska sp. z o.o.', 'services/transformatory-polska-sp-z-o-o/index.html', 'Poznań-based company selling new and used power'],
  ['ZRT Transformatory sp. z o.o.', 'services/zrt-transformatory-sp-z-o-o/index.html', 'Polish company repairing and selling oil-filled'],
  ['YG Trafo Montaj Test Bakım Mühendislik Hizmetleri Sanayi ve Ticaret Ltd. Şti.', 'services/yg-trafo-montaj-test-bakim-muhendislik-hizmetleri-sanayi-ve-ticaret-ltd-sti/index.html', 'Bursa-based Turkish engineering company founded in 1997']
];
const sitemap = read('sitemap.xml');
const listingsHub = read('manufacturer-listings.html');
const servicesHub = read('services.html');
for (const [name, rel, blurb] of added) {
  const html = read(rel);
  assert.equal(html.includes(blurb), true, name);
  assert.equal(/content="index,follow"/.test(html), true, name + ' indexable');
  assert.equal(html.includes('Unclaimed directory listing'), true, name + ' unclaimed');
  assert.equal(/tp-prov-tick/.test(html), false, name + ' has no verified tick');
  assert.equal(banned.test(html), false, name);
  const url = 'https://transformerpath.com/' + rel.replace(/index\.html$/, '');
  assert.equal(sitemap.includes(url), true, url);
}
assert.equal(listingsHub.includes('/manufacturers/leeds-transformer-co-ltd/'), true);
assert.equal(listingsHub.includes('/manufacturers/transformadores-gedelsa-s-a/'), true);
assert.equal(servicesHub.includes('durelec-transformateurs'), true);

const closed = [
  '/manufacturers/ismet-gmbh/',
  '/manufacturers/alkargo-transformadores/',
  '/manufacturers/elteco-a-s-transformer-systems/',
  '/accessories/gumasol/'
];
const toml = read('netlify.toml');
for (const from of closed) {
  assert.equal(fs.existsSync(path.join(root, from.slice(1), 'index.html')), false, from + ' page removed');
  const block = toml.split('[[redirects]]').find(part => part.includes('from = "' + from + '"'));
  assert.ok(block, from + ' redirect');
  assert.equal(/status = 301/.test(block), true);
  const target = from.startsWith('/accessories/') ? '/accessories.html' : '/manufacturer-listings.html';
  assert.equal(block.includes('to = "' + target + '"'), true, from);
  assert.equal(sitemap.includes('https://transformerpath.com' + from), false, from + ' sitemap');
}
assert.equal(read('data/manufacturers.json').includes('Ismet GmbH'), false);
assert.equal(read('data/manufacturers.json').includes('Alkargo Transformadores'), false);
assert.equal(read('data/accessories.json').includes('"slug": "gumasol"'), false);

console.log('DIRECTORY CLOSURES 2026-11-28 OK');
