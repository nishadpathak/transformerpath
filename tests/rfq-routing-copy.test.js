#!/usr/bin/env node
/* Every public commercial surface says RFQ routing is coming soon, with no promised RFQ count. */
'use strict';
const fs = require('fs');
const assert = require('assert');

const pages = [
  'vendors.html',
  'verified.html',
  'directory.html',
  'claim-profile.html',
  'list-company.html',
  'pricing.html',
  'markets.html',
  'methodology.html'
];

pages.forEach(function (file) {
  const html = fs.readFileSync(file, 'utf8');
  assert(html.indexOf('RFQ routing is coming soon') >= 0, file + ' states RFQ routing is coming soon');
  assert(html.indexOf('pre-qualified RFQ') < 0, file + ' does not promise pre-qualified RFQs');
  assert(html.indexOf('receive routed inquiries') < 0, file + ' does not promise routed inquiries');
  assert(!/\b\d+\s+pre-qualified\b/i.test(html), file + ' does not promise an RFQ count');
});

const verified = fs.readFileSync('verified.html', 'utf8');
const paid = require('../lib/paid-listings');
assert(verified.indexOf(paid.PAYMENT_LINKS.verified_manufacturer.url) >= 0, 'stripe link unchanged');
assert(verified.indexOf('$499') >= 0 && verified.indexOf('$199') >= 0, 'existing prices unchanged');
assert(verified.indexOf('data-feature="logo_brochure_upload" data-delivery="built"') >= 0, 'media feature is built');
assert(verified.indexOf('data-feature="rfq_eligibility" data-delivery="coming_soon"') >= 0, 'rfq feature stays coming soon');

const products = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
const logo = products.feature_delivery.filter(function (f) { return f.id === 'logo_brochure_upload'; })[0];
const rfq = products.feature_delivery.filter(function (f) { return f.id === 'rfq_eligibility'; })[0];
assert(logo.delivery === 'built', 'catalogue media is built');
assert(rfq.delivery === 'coming_soon', 'rfq eligibility stays coming soon');
assert(products.b2b_supplier.verified.price === 499, 'verified price unchanged');

console.log('rfq routing copy tests passed');
