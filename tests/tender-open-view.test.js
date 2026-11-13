#!/usr/bin/env node
/* Transformer Tenders: open view, pipeline view, intake rows, closed pages. */
'use strict';
const fs = require('fs');
const { isOfficialProcurementUrl, isAggregatorUrl } = require('../lib/tender-sources');
const { validateNotice } = require('../lib/tender-notices');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const doc = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8'));
const tenders = doc.tenders || [];
const html = fs.readFileSync('tenders.html', 'utf8');
const notices = JSON.parse(fs.readFileSync('data/tender-notices.json', 'utf8')).notices;

check('the index is Transformer Tenders', html.indexOf('>Tenders</span></h1>') !== -1 && html.indexOf('Tender Watch') === -1);
check('disclaimer and data-as-of sit on the index', html.indexOf('class="t-disclaimer"') !== -1 && html.indexOf('data as of ') !== -1);
check('open bids is the default view', html.indexOf('id="viewOpen"') !== -1 && /id="viewOpen"[^>]*aria-pressed="true"/.test(html));
check('pipeline view is present and hidden', html.indexOf('id="pipelineView" hidden') !== -1);
check('filters are category, country, keyword, and confirmed scope',
  html.indexOf('id="categoryFilter"') !== -1 && html.indexOf('id="countryFilter"') !== -1 &&
  html.indexOf('id="keywordFilter"') !== -1 && html.indexOf('id="scopeFilter"') !== -1);
check('the index carries an ItemList and no JobPosting', html.indexOf('"@type":"ItemList"') !== -1 && html.indexOf('JobPosting') === -1);

const open = tenders.filter(function (t) { return t.status === 'OPEN' || t.status === 'CLOSING_SOON'; });
check('every open row has an official URL', open.every(function (t) { return isOfficialProcurementUrl(t.official_procurement_url); }));
open.forEach(function (t) {
  check(t.tender_id + ' is in the open view', html.indexOf('id="openView"') !== -1 && html.slice(html.indexOf('id="openView"'), html.indexOf('id="pipelineView"')).indexOf(t.title) !== -1);
});
tenders.filter(function (t) { return t.status === 'CLOSED'; }).forEach(function (t) {
  const slug = String(t.title || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const page = 'tenders/' + slug + '/index.html';
  check(slug + ' is not in the open index', html.slice(html.indexOf('id="openView"'), html.indexOf('id="pipelineView"')).indexOf(t.title) === -1);
  if (!fs.existsSync(page)) { check(slug + ' page exists', false); return; }
  const entity = fs.readFileSync(page, 'utf8');
  check(slug + ' is noindex', /noindex/i.test(entity));
  check(slug + ' has a Closed banner', entity.indexOf('class="closed-banner"') !== -1);
  check(slug + ' is not a JobPosting', entity.indexOf('JobPosting') === -1);
  check(slug + ' is a WebPage', entity.indexOf('"@type":"WebPage"') !== -1);
});

notices.forEach(function (notice) {
  check(notice.official_reference + ' intake is valid', validateNotice(notice).length === 0, validateNotice(notice).join(','));
  const row = tenders.find(function (t) { return t.official_reference === notice.official_reference || t.procurement_id === notice.official_reference; });
  check(notice.official_reference + ' is published', !!row);
  if (!row) return;
  check(notice.official_reference + ' keeps the close instant', row.close_at === notice.close_at);
  check(notice.official_reference + ' is open', row.status === 'OPEN' || row.status === 'CLOSING_SOON', row.status);
  check(notice.official_reference + ' source is official', isOfficialProcurementUrl(row.official_procurement_url) && !isAggregatorUrl(row.official_procurement_url));
  const slug = String(row.title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const page = fs.readFileSync('tenders/' + slug + '/index.html', 'utf8');
  check(notice.official_reference + ' page shows both zones', page.indexOf('Asia/Kolkata') !== -1 && page.indexOf('Asia/Dubai') !== -1);
  check(notice.official_reference + ' page links the official URL', page.indexOf(notice.official_source_url) !== -1);
  check(notice.official_reference + ' page is indexable', /noindex/i.test(page) === false);
});

check('no aggregator is the listed source', tenders.every(function (t) {
  return !isAggregatorUrl(t.official_procurement_url) && !(t.source_urls || []).some(isAggregatorUrl);
}));
check('the builder recomputes status from the intake', fs.readFileSync('build-tenders.js', 'utf8').indexOf('finalizeRecord') !== -1);
check('the daily rebuild names the tender merge', fs.readFileSync('functions/daily-rebuild.js', 'utf8').indexOf('build-tenders.js') !== -1);

if (failed) {
  console.error('TENDER OPEN VIEW FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — tender open view');
