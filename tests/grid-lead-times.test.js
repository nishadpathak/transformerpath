#!/usr/bin/env node
/* /lead-times/ is a prerendered class-by-region summary.
 * A cell is sourced only when the grid module has a public figure.
 */
'use strict';
const fs = require('fs');
const grid = require('../lib/grid-lead-times');
const copy = require('../lib/buyer-page-copy');
const paid = require('../lib/paid-listings');
const inject = require('../adsense-inject');
const { fitWindow } = require('../lib/seo-fit');
const catalog = require('../lib/seo-catalog');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

copy.assertWindows();
const html = fs.readFileSync('lead-times/index.html', 'utf8');
const tally = grid.counts();
const cells = html.match(/<td data-label="[^"]+" data-sourced="[01]"[\s\S]*?<\/td>/g) || [];
const sourced = cells.filter(function (cell) { return /data-sourced="1"/.test(cell); });
const dashed = cells.filter(function (cell) { return /data-sourced="0"/.test(cell); });
const stripe = paid.VERIFIED_MANUFACTURER_PAYMENT_LINK;

console.log('=== GRID LEAD TIMES ===');
check('cell count matches the grid', cells.length === tally.cells, cells.length + ' vs ' + tally.cells);
check('sourced cells match the grid', sourced.length === tally.sourced, sourced.length + ' vs ' + tally.sourced);
check('dashed cells match the grid', dashed.length === tally.dashed, dashed.length + ' vs ' + tally.dashed);
check('there is at least one sourced cell and one dash', tally.sourced > 0 && tally.dashed > 0);

sourced.forEach(function (cell) {
  check('sourced cell has a source link', /href="https?:\/\/[^"]+"/.test(cell));
  check('sourced cell has an as-of date', /<time datetime="(?:\d{4}-\d{2}-\d{2}|\d{4}-\d{2})">/.test(cell));
  check('sourced cell is not a dash', cell.indexOf('>—<') < 0 && cell.indexOf('>&#8212;<') < 0);
});
dashed.forEach(function (cell) {
  check('dashed cell is a dash', />—<\/td>/.test(cell));
  check('dashed cell has no source link', !/href="https?:/.test(cell));
});

grid.FIGURES.forEach(function (row) {
  check(row.asOf + ' is on the page', html.indexOf(row.asOf) >= 0);
  check(row.sourceUrl + ' is linked', html.indexOf(row.sourceUrl) >= 0);
});

check('title window', html.indexOf('<title>' + copy.TITLES['lead-times/index.html'] + '</title>') !== -1);
check('canonical is the directory', html.indexOf('href="https://transformerpath.com/lead-times/"') !== -1);
check('cross-links buy early', html.indexOf('href="/buy-early/"') !== -1);
check('cross-links spare capacity', html.indexOf('href="/spare-capacity/"') !== -1);
check('ad marker', html.indexOf('<!--tp-ad-slot-->') !== -1);
check('consent script', html.indexOf('/consent.js') !== -1);
check('verified checkout is the existing link', html.indexOf(stripe) !== -1);
check('no second stripe link', (html.match(/buy\.stripe\.com/g) || []).length === 1);
check('price copy is one-time', html.indexOf('Get Verified $499 one-time payment · covers 12 months') !== -1 && html.indexOf('with no auto-renewal') !== -1 && html.indexOf('$499/yr') < 0 && html.indexOf('Identity and contact details checked. Not a product certification.') !== -1);
check('price copy omits / year', html.toLowerCase().indexOf('/ year') < 0 && html.toLowerCase().indexOf('/year') < 0);
const mailtos = html.match(/mailto:[^"'\s>]+/g) || [];
check('every mailto is the site inbox', mailtos.length > 0 && mailtos.every(function (item) { return item === 'mailto:hello@transformerpath.com'; }), mailtos.join(','));
check('no Dubai or UAE on the page', !/\bDubai\b|\bUAE\b|United Arab Emirates/i.test(html));
check('table is in the HTML', html.indexOf('<table class="sc-table">') !== -1);
check('phone layout stacks rows', html.indexOf('.sc-table thead{display:none}') !== -1);

const nav = fs.readFileSync('index.html', 'utf8');
const bar = nav.slice(nav.indexOf('<nav class="tpnav"'), nav.indexOf('class="tpnav-more"'));
check('directory menu links the page', bar.indexOf('href="lead-times/"') !== -1 && bar.indexOf('>Lead times<') !== -1);

const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
check('sitemap lists the directory', sitemap.indexOf('https://transformerpath.com/lead-times/') !== -1);
check('sitemap does not keep the shadowed html URL', sitemap.indexOf('https://transformerpath.com/lead-times.html') < 0);
check('publish copies the directory', (function () {
  const src = fs.readFileSync('build-dist.js', 'utf8');
  const dirs = src.match(/const DIRS = \[([\s\S]*?)\];/);
  return !!(dirs && dirs[1].indexOf("'lead-times'") !== -1 && dirs[1].indexOf("'factory-capacity'") !== -1);
})());
check('old tracker file does not shadow the directory', !fs.existsSync('lead-times.html') && fs.existsSync('factory-capacity/index.html'));
check('old html URL redirects to the factory tracker', (function () {
  const toml = fs.readFileSync('netlify.toml', 'utf8');
  return toml.indexOf('from = "/lead-times.html"') !== -1 && toml.indexOf('to = "/factory-capacity/"') !== -1;
})());

check('lead-times is not an ad page', inject.wantsInContentSlot('lead-times/index.html') === false);
const stamped = inject.stampHtml(html, 'lead-times/index.html');
check('marker stays and no slot is stamped', stamped.indexOf('<!--tp-ad-slot-->') !== -1 && stamped.indexOf('data-tp-ad="in-content"') === -1 && stamped.indexOf(inject.cfg.LOADER) === -1);

const cat = catalog.create();
const source = fs.readFileSync('lead-times/index.html', 'utf8');
const draft = catalog.draft('lead-times/index.html', source, cat);
const title = fitWindow(draft.draftTitle, 50, 60, draft.padsTitle);
const description = fitWindow(draft.draftDesc, 140, 160, draft.padsDesc);
check('fitted title keeps every word', title === copy.TITLES['lead-times/index.html'], title);
check('fitted description keeps every word', description === copy.DESCRIPTIONS['lead-times/index.html'], description + ' (' + description.length + ')');

if (failed) {
  console.error('GRID LEAD TIMES FAILED (' + failed + ')');
  process.exit(1);
}
console.log('GRID LEAD TIMES PASS — ' + tally.sourced + ' sourced, ' + tally.dashed + ' dashed');
