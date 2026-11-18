#!/usr/bin/env node
/* The tender index shows buyer, country, deadline date, product, source
 * and the official notice, and hides expired rows from the open list.
 */
'use strict';

const fs = require('fs');
const { validateNotice } = require('../lib/tender-notices');
const { isOfficialProcurementUrl, isAggregatorUrl } = require('../lib/tender-sources');
const { TENDER_PARTNER_URL } = require('../lib/tender-partner');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const html = fs.readFileSync('tenders.html', 'utf8');
const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders || [];
const notices = JSON.parse(fs.readFileSync('data/public-tender-notices.json', 'utf8')).notices;
const openSlice = html.slice(html.indexOf('id="openView"'), html.indexOf('id="pipelineView"'));
const expiredSlice = html.slice(html.indexOf('id="expiredView"'));

check('product and region filters exist', html.indexOf('id="productFilter"') >= 0 && html.indexOf('id="regionFilter"') >= 0);
check('expired view is hidden by default', /id="expiredView" hidden/.test(html));
check('alert CTA uses the partner constant', html.indexOf('data-tender-cta="1"') >= 0 && html.indexOf('href="' + TENDER_PARTNER_URL + '"') >= 0);
check('listing does not mark the internal CTA as sponsored', html.indexOf('rel="sponsored') === -1);
check('listing does not name an aggregator', /tendersontime/i.test(html) === false);
check('nav partial links tenders', fs.readFileSync('_partials/header.html', 'utf8').indexOf('tenders.html">Tenders') >= 0);

const counts = {};
notices.forEach(function (notice) {
  const errors = validateNotice(notice);
  check(notice.official_reference + ' is valid', errors.length === 0, errors.join(','));
  check(notice.official_reference + ' source is official', isOfficialProcurementUrl(notice.official_source_url) && !isAggregatorUrl(notice.official_source_url));
  const host = notice.official_source_url.indexOf('ted.europa.eu') >= 0 ? 'TED'
    : notice.official_source_url.indexOf('worldbank.org') >= 0 ? 'World Bank'
    : notice.official_source_url.indexOf('adb.org') >= 0 ? 'ADB'
    : notice.official_source_url.indexOf('afdb.org') >= 0 ? 'AfDB' : 'other';
  counts[host] = (counts[host] || 0) + 1;
  const row = tenders.find(function (tender) { return tender.official_reference === notice.official_reference; });
  check(notice.official_reference + ' is published', !!row);
  if (!row) return;
  check(notice.official_reference + ' keeps the close instant', row.close_at === notice.close_at);
  check(notice.official_reference + ' keeps the product', row.product === notice.product);
  const titleAt = html.indexOf(notice.title);
  check(notice.official_reference + ' title is on the index', titleAt >= 0);
  if (row.status === 'CLOSED') {
    check(notice.official_reference + ' is not in the open list', openSlice.indexOf(notice.title) === -1);
    check(notice.official_reference + ' is marked in the expired list', expiredSlice.indexOf(notice.title) >= 0 && expiredSlice.indexOf('data-expired="1"') >= 0);
  } else {
    const slice = openSlice;
    check(notice.official_reference + ' is in the open list', slice.indexOf(notice.title) >= 0);
    const start = slice.indexOf(notice.title);
    const rowHtml = slice.slice(Math.max(0, start - 400), start + 900);
    check(notice.official_reference + ' shows the buyer', rowHtml.indexOf('Buyer ' + notice.buyer) >= 0 || rowHtml.indexOf('Buyer ' + notice.buyer.replace(/&/g, '&amp;')) >= 0);
    check(notice.official_reference + ' shows the deadline date', /Deadline \d{1,2} [A-Z][a-z]{2} \d{4}/.test(rowHtml));
    check(notice.official_reference + ' links the official notice', rowHtml.indexOf(notice.official_source_url) >= 0);
  }
});

check('seed includes TED', (counts.TED || 0) >= 1, JSON.stringify(counts));
check('seed includes the World Bank', (counts['World Bank'] || 0) >= 1, JSON.stringify(counts));
console.log('  public notice counts ' + JSON.stringify(counts));

if (failed) {
  console.error('TENDER BOARD FAILED (' + failed + ')');
  process.exit(1);
}
console.log('TENDER BOARD OK');
