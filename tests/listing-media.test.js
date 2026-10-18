#!/usr/bin/env node
/* Logo, catalogue PDF and photo gallery for a reviewed Verified profile. */
'use strict';
const assert = require('assert');
const fs = require('fs');
const media = require('../lib/listing-media');

const reviewed = {
  status: 'verified',
  reviewer: 'directory desk',
  reviewed_at: '2026-10-18',
  verification_evidence: 'corporate domain confirmed'
};

const shown = media.collect('example-works', {
  profiles: [Object.assign({
    company_slug: 'example-works',
    logo_url: 'https://cdn.example.com/logo.png',
    catalogue_url: 'https://cdn.example.com/catalogue.pdf',
    photos: [
      { url: 'https://cdn.example.com/bay.jpg', alt: 'Assembly bay' },
      'https://cdn.example.com/core.webp'
    ]
  }, reviewed)]
});
const html = media.render(shown);
assert(html.indexOf('https://cdn.example.com/logo.png') >= 0, 'logo url');
assert(html.indexOf('https://cdn.example.com/catalogue.pdf') >= 0, 'catalogue pdf');
assert(html.indexOf('https://cdn.example.com/bay.jpg') >= 0, 'photo');
assert(html.indexOf('https://cdn.example.com/core.webp') >= 0, 'second photo');
assert(html.indexOf('at no extra charge') >= 0, 'no extra charge');
assert(html.indexOf('RFQ routing is coming soon') >= 0, 'rfq still coming soon');
assert(html.indexOf('data-listing-media="1"') >= 0, 'marker');

const partial = media.render(media.collect('example-works', {
  profiles: [Object.assign({
    company_slug: 'example-works',
    logo_url: 'https://cdn.example.com/logo.png',
    catalogue_url: 'http://cdn.example.com/catalogue.pdf',
    photos: ['javascript:alert(1)', 'https://cdn.example.com/note.txt']
  }, reviewed)]
}));
assert(partial.indexOf('https://cdn.example.com/logo.png') >= 0, 'valid logo kept');
assert(partial.indexOf('catalogue.pdf') < 0, 'non-https pdf dropped');
assert(partial.indexOf('javascript:') < 0, 'script url dropped');
assert(partial.indexOf('note.txt') < 0, 'non-image dropped');
assert(partial.indexOf('—') >= 0, 'missing media is an em dash');

assert(media.collect('example-works', {
  listings: [Object.assign({ product: 'verified_manufacturer', company_slug: 'example-works', logo_url: 'https://cdn.example.com/logo.png' }, { status: 'paid_pending_verification' })]
}) === null, 'unreviewed listing is not rendered');

assert(media.render(null) === '', 'absent media renders nothing');

['build-company-pages.js', 'company.html', 'claim-profile.html', 'list-company.html'].forEach(function (file) {
  const text = fs.readFileSync(file, 'utf8');
  assert(text.indexOf('logo_url') >= 0 || text.indexOf('listing-media') >= 0 || text.indexOf('listingMedia') >= 0, file + ' feeds profile media');
});

const built = fs.readFileSync('build-company-pages.js', 'utf8');
assert(built.indexOf('listingMediaHtml(slug)') >= 0, 'manufacturer profiles render media');
const claim = fs.readFileSync('claim-profile.html', 'utf8');
assert(claim.indexOf('name="catalogue_url"') >= 0 && claim.indexOf('name="photo_urls"') >= 0, 'claim form collects catalogue and photos');
const paid = require('../lib/paid-listings');
assert(claim.indexOf(paid.PAYMENT_LINKS.verified_manufacturer.url) >= 0, 'verified stripe link unchanged');

console.log('listing-media tests passed');
