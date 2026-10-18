#!/usr/bin/env node
/* /buy-early/ and /spare-capacity/ stay sourced, filterable, and inside the SEO windows. */
'use strict';
const fs = require('fs');
const { listMidTier } = require('../lib/mid-tier-list');
const copy = require('../lib/buyer-page-copy');
const paid = require('../lib/paid-listings');
const { fitWindow } = require('../lib/seo-fit');
const catalog = require('../lib/seo-catalog');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

copy.assertWindows();
const rows = listMidTier();
const noted = rows.filter(function (row) { return row.capacity; });
const buy = fs.readFileSync('buy-early/index.html', 'utf8');
const spare = fs.readFileSync('spare-capacity/index.html', 'utf8');
const stripe = paid.VERIFIED_MANUFACTURER_PAYMENT_LINK;

console.log('=== BUY EARLY AND SPARE CAPACITY ===');
check('seventeen mid-tier profiles', rows.length === 17, String(rows.length));
check('two sourced capacity notes', noted.length === 2, noted.map(function (r) { return r.slug; }).join(','));
check('notes are Virginia and SGB-SMIT', noted.map(function (r) { return r.slug; }).sort().join(',') === 'sgb-smit-group,virginia-transformer-corp');
rows.forEach(function (row) {
  check(row.slug + ' has region, country, and voltage', !!(row.region && row.country && row.kv != null), [row.region, row.country, row.kv].join('|'));
  check(row.slug + ' uses the existing verified checkout', row.payHref.indexOf(stripe) === 0 && row.payHref.indexOf('client_reference_id=' + row.slug) !== -1, row.payHref);
  if (!row.capacity) return;
  check(row.slug + ' capacity note has a dated public source', /^https:\/\//.test(row.capacity.source_url) && /^\d{4}-\d{2}-\d{2}$/.test(row.capacity.date));
  check(row.slug + ' capacity note does not claim spare capacity', !/spare capacity/i.test(row.capacity.text || ''));
});

check('buy-early title window', buy.indexOf('<title>' + copy.TITLES['buy-early/index.html'] + '</title>') !== -1);
check('spare-capacity title window', spare.indexOf('<title>' + copy.TITLES['spare-capacity/index.html'] + '</title>') !== -1);
check('buy-early canonical', buy.indexOf('href="https://transformerpath.com/buy-early/"') !== -1);
check('spare-capacity canonical', spare.indexOf('href="https://transformerpath.com/spare-capacity/"') !== -1);
check('buy-early links the list', buy.indexOf('href="/spare-capacity/"') !== -1);
check('spare-capacity links the guide', spare.indexOf('href="/buy-early/"') !== -1);
check('buy-early ad marker', buy.indexOf('<!--tp-ad-slot-->') !== -1);
check('spare-capacity ad marker', spare.indexOf('<!--tp-ad-slot-->') !== -1);
check('consent script on both pages', buy.indexOf('/consent.js') !== -1 && spare.indexOf('/consent.js') !== -1);
check('verified label is the existing price', (spare.match(/Get Verified \$499\/yr/g) || []).length === rows.length);
check('no invented spare-capacity claim', !/has spare capacity/i.test(buy + spare));
check('no Dubai or UAE in the new pages', !/\bDubai\b|\bUAE\b|United Arab Emirates/i.test(buy + spare));
['webinar', 'consulting', 'masterclass', 'book a call'].forEach(function (word) {
  check('pages omit ' + word, buy.toLowerCase().indexOf(word) < 0 && spare.toLowerCase().indexOf(word) < 0);
});

const italy = rows.filter(function (row) { return row.country === 'Italy'; });
const korea = rows.filter(function (row) { return row.country === 'South Korea'; });
const high = rows.filter(function (row) { return row.kv > 400; });
check('Italy has two makers', italy.length === 2, String(italy.length));
check('South Korea has two makers', korea.length === 2, String(korea.length));
check('rating data supports an above-400 band', high.length > 0, String(high.length));
check('filters exist', spare.indexOf('id="sc-region"') !== -1 && spare.indexOf('id="sc-country"') !== -1 && spare.indexOf('id="sc-rating"') !== -1);
check('empty capacity cells are a dash', (spare.match(/data-label="Capacity note">—/g) || []).length === rows.length - noted.length);

rows.forEach(function (row) {
  const profile = fs.readFileSync('manufacturers/' + row.slug + '/index.html', 'utf8');
  check(row.slug + ' profile cross-links both pages', profile.indexOf('data-tp-spare-capacity="1"') !== -1 && profile.indexOf('href="/spare-capacity/"') !== -1 && profile.indexOf('href="/buy-early/"') !== -1);
});

const nav = fs.readFileSync('index.html', 'utf8');
const bar = nav.slice(nav.indexOf('<nav class="tpnav"'), nav.indexOf('class="tpnav-more"'));
check('directory menu links both pages', bar.indexOf('href="buy-early/"') !== -1 && bar.indexOf('href="spare-capacity/"') !== -1);
check('pages are not an eighth primary label', ['>Buy early<', '>Mid-tier makers<'].every(function (label) {
  return bar.indexOf(label) !== -1;
}) && (bar.match(/>Intel<|>Directory<|>Projects<|>Tenders<|>Events<|>Learn<|>RFQ</g) || []).length === 7);

const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
check('sitemap lists both pages', sitemap.indexOf('https://transformerpath.com/buy-early/') !== -1 && sitemap.indexOf('https://transformerpath.com/spare-capacity/') !== -1);
check('no sibling html shadows the directory URLs', !fs.existsSync('buy-early.html') && !fs.existsSync('spare-capacity.html'));

const cat = catalog.create();
['buy-early/index.html', 'spare-capacity/index.html'].forEach(function (rel) {
  const source = fs.readFileSync(rel, 'utf8');
  const draft = catalog.draft(rel, source, cat);
  const title = fitWindow(draft.draftTitle, 50, 60, draft.padsTitle);
  const description = fitWindow(draft.draftDesc, 140, 160, draft.padsDesc);
  check(rel + ' fitted title keeps every word', title === copy.TITLES[rel], title);
  check(rel + ' fitted description keeps every word', description === copy.DESCRIPTIONS[rel], description + ' (' + description.length + ')');
});

if (failed) {
  console.error('BUY EARLY / SPARE CAPACITY FAILED (' + failed + ')');
  process.exit(1);
}
console.log('BUY EARLY / SPARE CAPACITY PASS');
