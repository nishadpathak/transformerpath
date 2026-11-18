#!/usr/bin/env node
/* Product tender pages exist only for official notices, carry SEO tags,
 * and link the partner CTA without marking an internal URL as sponsored.
 */
'use strict';

const fs = require('fs');
const { groupOfficial, CATALOG } = require('../lib/tender-products');
const { TENDER_PARTNER_URL } = require('../lib/tender-partner');
const { tenderSourceDay } = require('../lib/sitemap-dates');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders || [];
const groups = groupOfficial(tenders);
const slugs = CATALOG.map(function (product) { return product.slug; }).filter(function (slug) { return groups[slug]; });
const index = fs.readFileSync('tenders/products.html', 'utf8');
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');

check('product index exists', index.indexOf('data-product-index="1"') >= 0);
check('product index has the alert CTA', index.indexOf('data-tender-cta="1"') >= 0 && index.indexOf('Get full global transformer tender alerts') >= 0);
check('product index links the configured partner URL', index.indexOf('href="' + TENDER_PARTNER_URL + '"') >= 0);
check('internal partner link is not sponsored', TENDER_PARTNER_URL.charAt(0) === '/' && index.indexOf('rel="sponsored') === -1);
check('product index does not name an aggregator', /tendersontime/i.test(index) === false);
check('at least one product page', slugs.length >= 1, String(slugs.length));

CATALOG.forEach(function (product) {
  const file = 'tenders/product/' + product.slug + '/index.html';
  const expected = !!groups[product.slug];
  check(product.slug + (expected ? ' page exists' : ' page is absent'), fs.existsSync(file) === expected);
});

slugs.forEach(function (slug) {
  const html = fs.readFileSync('tenders/product/' + slug + '/index.html', 'utf8');
  const canonical = 'https://transformerpath.com/tenders/product/' + slug + '/';
  check(slug + ' canonical', html.indexOf('href="' + canonical + '"') >= 0);
  check(slug + ' description', /<meta name="description" content="[^"]{40,}"/.test(html));
  check(slug + ' item list', html.indexOf('"@type":"ItemList"') >= 0 && html.indexOf('JobPosting') === -1);
  check(slug + ' CTA', html.indexOf('data-tender-cta="1"') >= 0);
  check(slug + ' intro', html.indexOf(groups[slug].product.intro) >= 0);
  groups[slug].tenders.forEach(function (tender) {
    check(tender.tender_id + ' is on ' + slug, html.indexOf('data-tender-id="' + tender.tender_id + '"') >= 0);
    if (tender.status === 'CLOSED') {
      const token = 'data-tender-id="' + tender.tender_id + '"';
      const start = html.indexOf(token);
      const next = html.indexOf('data-tender-id="', start + token.length);
      const row = html.slice(start, next < 0 ? undefined : next);
      check(tender.tender_id + ' is marked expired', row.indexOf('data-expired="1"') >= 0 && row.indexOf('Expired') >= 0);
    }
  });
  let day = '';
  groups[slug].tenders.forEach(function (tender) {
    const next = tenderSourceDay(tender) || '';
    if (next > day) day = next;
  });
  if (day) check(slug + ' is in the sitemap', sitemap.indexOf('<loc>' + canonical + '</loc><lastmod>' + day + '</lastmod>') >= 0, day);
});

check('products index is in the sitemap', sitemap.indexOf('<loc>https://transformerpath.com/tenders/products.html</loc>') >= 0);
check('empty cable page is not generated when unused', !groups.cables === !fs.existsSync('tenders/product/cables/index.html'));

if (failed) {
  console.error('TENDER PRODUCT PAGES FAILED (' + failed + ')');
  process.exit(1);
}
console.log('TENDER PRODUCT PAGES OK');
