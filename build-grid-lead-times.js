#!/usr/bin/env node
/* build-grid-lead-times.js — /lead-times/ class and region summary.
 *
 * Cells come from lib/grid-lead-times.js. A cell without a figure is a dash.
 * Run: node build-grid-lead-times.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const copy = require('./lib/buyer-page-copy');
const grid = require('./lib/grid-lead-times');

copy.assertWindows();

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
const REL = 'lead-times/index.html';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STYLES = [
  '.c-wrap{max-width:1100px;margin:0 auto;padding:32px 16px 80px}',
  '.c-wrap h1{font-size:1.8rem;color:var(--ink);line-height:1.25}',
  '.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:32px}',
  '.c-wrap p,.c-wrap li{color:var(--text);line-height:1.7}',
  '.c-wrap .lead{color:var(--muted);font-size:1.05rem}',
  '.c-wrap a{color:var(--accent)}',
  '.crumbs{font-size:.8rem;color:var(--muted);margin-bottom:12px}',
  '.src{font-size:.86rem}',
  '.fig{margin:0 0 12px}',
  '.fig p{margin:0 0 4px}',
  '.tbl{overflow-x:auto}',
  '.c-wrap table{width:100%;border-collapse:collapse;font-size:.92rem}',
  '.c-wrap th,.c-wrap td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--border)}',
  '.c-wrap th{color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.03em}',
  '.lt-pay{border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:28px}',
  '.sc-cta{display:inline-block;text-align:center;min-height:44px}',
  '@media (max-width:720px){',
  '.c-wrap{padding:24px 14px 72px}',
  '.c-wrap h1{font-size:1.45rem}',
  '.sc-table thead{display:none}',
  '.sc-table tr{display:block;border:1px solid var(--border);border-radius:10px;margin:0 0 12px;padding:8px 4px}',
  '.sc-table td{display:block;border:0;padding:6px 8px;overflow-wrap:anywhere}',
  '.sc-table td::before{content:attr(data-label);display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px}',
  '.sc-cta{display:block;width:100%}',
  '}'
].join('');

function figureHtml(row) {
  return '<div class="fig">' +
    '<p>' + esc(row.text) + '</p>' +
    '<p class="src"><a href="' + esc(row.sourceUrl) + '" target="_blank" rel="noopener">' + esc(row.sourceLabel) + '</a> ' +
    '<time datetime="' + esc(row.asOfIso) + '">(' + esc(row.asOf) + ')</time></p>' +
    '</div>';
}

function cellHtml(cell) {
  const sourced = cell.sourced ? '1' : '0';
  const body = cell.sourced ? cell.figures.map(figureHtml).join('') : '—';
  return '<td data-label="' + esc(cell.regionLabel) + '" data-sourced="' + sourced + '" data-class="' + esc(cell.classId) + '" data-region="' + esc(cell.regionId) + '">' + body + '</td>';
}

function tableHtml() {
  const head = '<tr><th>Class</th>' + grid.REGIONS.map(function (region) {
    return '<th>' + esc(region.label) + '</th>';
  }).join('') + '</tr>';
  const body = grid.CLASSES.map(function (klass) {
    const cells = grid.REGIONS.map(function (region) {
      return cellHtml(grid.cells().filter(function (cell) {
        return cell.classId === klass.id && cell.regionId === region.id;
      })[0]);
    }).join('');
    return '<tr><td data-label="Class">' + esc(klass.label) + '</td>' + cells + '</tr>';
  }).join('');
  return '<div class="tbl"><table class="sc-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
}

function main() {
  const tally = grid.counts();
  return '<nav class="crumbs"><a href="/manufacturers.html">Manufacturers</a> · <a href="/buy-early/">Buy early</a> · <a href="/spare-capacity/">Mid-tier makers</a> · Lead times</nav>' +
    '<h1>Grid lead-time tracker</h1>' +
    '<p class="lead">Free public summary of typical lead times by transformer class and by region. Each figure is copied from the linked source, with that source\'s as-of date. TransformerPath adds no lead-time number of its own.</p>' +
    '<p>' + tally.sourced + ' of ' + tally.cells + ' cells have a sourced figure. The other ' + tally.dashed + ' are a dash: no public source in this set states a duration for that class and region. Ordering ahead is covered in the <a href="/buy-early/">free buying guide</a>. Makers outside the largest groups are on the <a href="/spare-capacity/">mid-tier list</a>. Row-level records already on file are on the <a href="/factory-capacity/">factory capacity tracker</a>.</p>' +
    '<!--tp-ad-slot-->' +
    '<h2>Typical lead times</h2>' +
    tableHtml() +
    '<h2>Figures not placed in a cell</h2>' +
    '<ul>' +
    '<li>Wood Mackenzie, 2 April 2024, states an all-transformer average of about 120 weeks in 2024, from about 50 weeks in 2021. That sentence is not limited to one of the three classes. The same article\'s 80 to 210 week range for large substation power and generator step-up units is in the table.</li>' +
    '<li>Wood Mackenzie, 15 October 2025, states a 128-week average for power transformers in the quarter it calls Q2. The article does not say whether that average is medium power or large power. The same article\'s generator step-up figures are in the United States large-power cell.</li>' +
    '<li>CWIEME Berlin, 17 March 2026, says distribution lead times peaked above 100 weeks in 2023 and have since eased. It does not state the eased figure or a region.</li>' +
    '<li>Medium power has no duration in these sources. Middle East, Africa, Latin America, and Oceania have no duration for any of the three classes in these sources.</li>' +
    '</ul>' +
    '<h2>Paid detail</h2>' +
    '<div class="lt-pay">' +
    '<p>The table above is the whole free summary. A dash stays a dash: this page does not keep a second figure behind a checkout. A manufacturer confirms its own profile with the existing Get Verified checkout at $499 one-time. Identity and contact details checked. Not a product certification. That is the Verified Manufacturer link already used on the <a href="/spare-capacity/">mid-tier list</a>.</p>' +
    '<p><a class="btn btn-amber sc-cta" href="' + esc(grid.PAY_HREF) + '" data-verified-manufacturer-pay="1" data-track="supplier_verify_started">Get Verified $499 one-time</a></p>' +
    '<p class="src">After payment, the return path is the <a href="/claim-profile.html?paid=verified_manufacturer#claimForm">claim form</a>. Questions about a listing go to <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a>.</p>' +
    '</div>';
}

function pageShell(mainHtml) {
  const title = copy.TITLES[REL];
  const description = copy.DESCRIPTIONS[REL];
  const canon = 'https://transformerpath.com/lead-times/';
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(description) + '">' +
    '<link rel="canonical" href="' + canon + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' +
    '<meta property="og:url" content="' + canon + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">' +
    '<meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">' +
    '<link rel="stylesheet" href="/style.css?v=14"><link rel="stylesheet" href="/tp-nav.css?v=14">' +
    '<style>' + STYLES + '</style>' +
    '<script src="/consent.js" defer></script>' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" class="c-wrap">' + mainHtml + '</main>\n' +
    FOOT + '\n<script src="/analytics.js" defer></script>\n</body>\n</html>\n';
}

const file = path.join(REL);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, pageShell(main()));
const tally = grid.counts();
console.log('lead-times/index.html wrote ' + tally.sourced + ' sourced cells and ' + tally.dashed + ' dashes');
