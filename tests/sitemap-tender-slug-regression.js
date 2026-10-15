#!/usr/bin/env node
/* Tender pages live at /tenders/<full title slug>/. The sitemap date is the
 * notice publication day, else the record's capture day. last_verified is the
 * build clock and does not date a page. An undated tender is left out. */
'use strict';
const fs = require('fs');
const dates = require('../lib/sitemap-dates');
const sitemap = require('../build-sitemap');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const longTitle = 'Augstsprieguma tikls tenders a rebuild of 110 kV substation No. 6 TEC-1';
const fullSlug = 'augstsprieguma-tikls-tenders-a-rebuild-of-110-kv-substation-no-6-tec-1';
const pages = dates.tenderPageDates([
  { title: 'Short tender', last_verified: '2026-10-15' },
  { title: longTitle, publication_date: '2026-10-15', last_verified: '2026-10-16' },
  { title: 'Undated tender', last_verified: '2026-10-15' },
  { title: 'Captured tender', captured_at: '2026-10-01', last_verified: '2026-10-16' },
  { title: 'Event tender', status_events: [{ type: 'published', date: '2026-09-30' }], last_verified: '2026-10-16' }
], {
  'Short tender': '2026-09-01'
});

check('a blame date is kept when the record has no source date', pages['tenders/short-tender/index.html'] === '2026-09-01');
check('publication date wins over last_verified and uses the full slug', pages['tenders/' + fullSlug + '/index.html'] === '2026-10-15');
check('new long tender is not stored under a 32-character slug', !pages['tenders/augstsprieguma-tikls-tenders-a-r/index.html']);
check('last_verified alone does not date a tender', !pages['tenders/undated-tender/index.html']);
check('capture date is used when the notice date is absent', pages['tenders/captured-tender/index.html'] === '2026-10-01');
check('a published status event is a source date', pages['tenders/event-tender/index.html'] === '2026-09-30');
check('dated tender is included', sitemap.rowDecision('tenders/x/index.html', '2026-10-15') === 'include');
check('undated tender is omitted', sitemap.rowDecision('tenders/x/index.html', null) === 'omit');
check('undated non-tender still fails the sitemap', sitemap.rowDecision('knowledge/x.html', null) === 'missing');

const filled = {};
dates.fillTenderSourceDates(filled, [
  { title: longTitle, publication_date: '2026-10-15' },
  { title: 'Already dated', publication_date: '2026-01-02' }
]);
filled['tenders/already-dated/index.html'] = '2026-08-01';
dates.fillTenderSourceDates(filled, [{ title: 'Already dated', publication_date: '2026-01-02' }]);
check('fill writes the publication day under the full slug', filled['tenders/' + fullSlug + '/index.html'] === '2026-10-15');
check('fill does not replace a date already on the page', filled['tenders/already-dated/index.html'] === '2026-08-01');

const NOTICES = [
  ['712707-2026', 'augstsprieguma-tikls-tenders-a-rebuild-of-110-kv-substation-no-6-tec-1'],
  ['711669-2026', 'distributie-energie-oltenia-tenders-123-kv-breaker-modules-for-a-110-kv-line-bay-and-a-transformer-bay'],
  ['713576-2026', 'mondragon-solar-project-tenders-floating-transformer-substations'],
  ['713886-2026', 'pse-tenders-110-220-400-kv-disconnectors-and-earthing-switches-stage-iv-a'],
  ['711561-2026', 'pse-tenders-expansion-of-the-400-110-kv-czarna-substation'],
  ['711752-2026', 'zdas-tenders-a-110-kv-switchyard-rebuild-with-two-110-22-6-3-kv-transformers']
];
const intel = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const items = [];
Object.keys(intel).forEach(function (k) {
  ((intel[k] && intel[k].items) || []).forEach(function (it) { items.push(it); });
});
function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}
NOTICES.forEach(function (pair) {
  const id = pair[0];
  const slug = pair[1];
  const it = items.filter(function (row) {
    return row && String(row.url || '').indexOf('/' + id) !== -1;
  })[0];
  check(id + ' record exists', !!it);
  if (!it) return;
  check(id + ' publication_date is the TED day 2026-10-15', it.publication_date === '2026-10-15');
  check(id + ' links to its own TED notice', it.url === 'https://ted.europa.eu/en/notice/-/detail/' + id);
  check(id + ' page slug matches the tender URL', slugify(it.title) === slug);
  const dated = dates.tenderPageDates([it], {});
  check(id + ' sitemap day is the notice publication day', dated['tenders/' + slug + '/index.html'] === '2026-10-15');
});

if (failed) {
  console.error('SITEMAP TENDER SLUG REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — sitemap tender slug regression');
