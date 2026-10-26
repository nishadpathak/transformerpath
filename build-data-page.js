#!/usr/bin/env node
/* build-data-page.js — /data.html from the live directory, tenders, and awards.
 *
 * Row counts, columns, and the 10-row samples come from those files.
 * Payment Links are written to data/csv-pay-plans.json, not into hrefs.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const csv = require('./lib/csv-exports');
const pay = require('./lib/csv-pay');

const TERMS_SENTENCE = 'You may view and link to the Site, but may not copy, scrape or republish substantial content without written permission.';
const DIRECTORY_LICENCE = 'https://transformerpath.com/terms.html';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function read(rel) {
  return fs.readFileSync(path.join(csv.repoRoot(), rel), 'utf8');
}

function requireSentence(file, sentence, label) {
  if (read(file).indexOf(sentence) === -1) {
    throw new Error(label + ' is not in ' + file);
  }
}

function payControl(product) {
  const spec = pay.LINKS[product];
  return '<a class="btn btn-amber csv-pay" href="#' + esc(product) + '" rel="nofollow" data-csv-product="' + esc(product) + '">' + esc(spec.button) + '</a>';
}

function fieldList(columns) {
  return '<p class="csv-fields">Fields: ' + columns.map(function (col) {
    return '<code>' + esc(col) + '</code>';
  }).join(', ') + '.</p>';
}

function sampleTable(preview) {
  const shown = preview.rows.length;
  const head = preview.headers.map(function (header) {
    return '<th scope="col">' + esc(header) + '</th>';
  }).join('');
  const body = preview.rows.map(function (row) {
    const cells = preview.headers.map(function (header) {
      return '<td>' + esc(row[header]) + '</td>';
    }).join('');
    return '<tr>' + cells + '</tr>';
  }).join('');
  return '<div class="csv-sample" data-csv-preview="' + esc(preview.key) + '" data-preview-rows="' + shown + '">' +
    '<p>Free sample — ' + shown + ' of ' + preview.total.toLocaleString('en-US') + ' rows. The paid file is the full export.</p>' +
    '<div class="csv-wrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    '</div>';
}

function card(id, title, price, body, product) {
  return '<section class="csv-card" id="' + esc(id) + '">' +
    '<h2>' + esc(title) + '</h2>' +
    '<p class="csv-price">' + esc(price) + '</p>' +
    body +
    '<p class="csv-buy">' + payControl(product) + '</p>' +
    '</section>';
}

function render(model) {
  const header = read('_partials/header.html').trim();
  const footer = read('_partials/footer.html').trim();
  const directory = model.previews.directory;
  const tenders = model.previews.tenders;
  const awards = model.previews.awards;
  const directoryBody =
    '<p>' + esc(model.directoryScope) + '</p>' +
    '<p>Source date on the directory index: ' + esc(model.directoryGenerated) + '. ' + esc(model.evidenceNotes) + '</p>' +
    '<p>Rows in this file: ' + directory.total.toLocaleString('en-US') + '.</p>' +
    fieldList(directory.headers) +
    '<p>A row whose evidence, claim, or research status is INFERRED or unverified shows an em dash for <code>last_verified</code>.</p>' +
    sampleTable(directory);
  const tenderBody =
    '<p>' + esc(model.tenderComment) + '</p>' +
    '<p>Source date on the tender register: ' + esc(model.tenderUpdated) + '. Rows in this file: ' + tenders.total.toLocaleString('en-US') + '.</p>' +
    fieldList(tenders.headers) +
    '<p>A row whose status or transformer scope is INFERRED or unverified shows an em dash for <code>last_verified</code>.</p>' +
    sampleTable(tenders);
  const awardBody =
    '<p>' + esc(model.awardComment) + '</p>' +
    '<p>Source date on the award register: ' + esc(model.awardUpdated) + '. Rows in this file: ' + awards.total.toLocaleString('en-US') + '.</p>' +
    fieldList(awards.headers) +
    '<p>A row whose award status, transformer scope, claim, or confidence is INFERRED or unverified shows an em dash for <code>last_verified</code>.</p>' +
    sampleTable(awards);
  const bundleBody =
    '<p>The bundle is the three files on this page: the directory CSV (' + directory.total.toLocaleString('en-US') + ' rows), the tenders CSV (' + tenders.total.toLocaleString('en-US') + ' rows), and the awards CSV (' + awards.total.toLocaleString('en-US') + ' rows). It is not a fourth dataset.</p>';

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>Directory, tender, and award CSV downloads | TransformerPath</title>\n' +
    '<meta name="description" content="CSV exports of the TransformerPath directory, tender register, and award register. A free sample shows the first 10 rows of each published file.">\n' +
    '<link rel="canonical" href="https://transformerpath.com/data.html">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:site_name" content="TransformerPath">\n' +
    '<meta property="og:title" content="Directory, tender, and award CSV downloads | TransformerPath">\n' +
    '<meta property="og:description" content="CSV exports of the TransformerPath directory, tender register, and award register. A free sample shows the first 10 rows of each published file.">\n' +
    '<meta property="og:url" content="https://transformerpath.com/data.html">\n' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">\n' +
    '<link rel="stylesheet" href="style.css?v=14">\n' +
    '<link rel="stylesheet" href="tp-nav.css?v=14">\n' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg">\n' +
    '<link rel="manifest" href="manifest.webmanifest">\n' +
    '<meta name="theme-color" content="#0d1b2e">\n' +
    '<style>\n' +
    '.csv-page{max-width:1100px;margin:0 auto;padding:36px 20px 72px}\n' +
    '.csv-page h1{font-size:2rem;margin:0 0 12px}\n' +
    '.csv-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}\n' +
    '.csv-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px 18px 8px}\n' +
    '.csv-card h2{margin:0 0 6px;font-size:1.25rem}\n' +
    '.csv-price{font-size:1.6rem;font-weight:800;margin:0 0 10px}\n' +
    '.csv-fields{font-size:.88rem;line-height:1.55}\n' +
    '.csv-fields code,.csv-page code{font-size:.82rem}\n' +
    '.csv-buy{margin:14px 0}\n' +
    '.csv-pay{text-decoration:none;display:inline-block}\n' +
    '.csv-wrap{overflow-x:auto;margin:0 0 18px;border:1px solid var(--border);border-radius:12px}\n' +
    '.csv-wrap table{width:100%;border-collapse:collapse;font-size:.78rem}\n' +
    '.csv-wrap th,.csv-wrap td{border-bottom:1px solid var(--border);padding:6px 8px;text-align:left;white-space:nowrap}\n' +
    '.csv-wrap th{background:var(--navy);color:#fff}\n' +
    '@media (max-width:800px){.csv-grid{grid-template-columns:1fr}}\n' +
    '</style>\n</head>\n<body>\n' +
    header + '\n' +
    '<main id="main" class="csv-page">\n' +
    '<h1>Directory, tender, and award CSV downloads</h1>\n' +
    '<p>Three CSV exports of the registers on this site, plus a bundle of the same three files. Counts and samples below are taken from the directory index, the tender register, and the award register. The sample is the first 10 rows of each export.</p>\n' +
    '<noscript><p>The pay buttons run only after a click. With JavaScript off, email <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a>.</p></noscript>\n' +
    '<div class="csv-grid">\n' +
    card('csv_directory', 'Directory CSV', '$149', directoryBody, 'csv_directory') + '\n' +
    card('csv_tenders', 'Tenders CSV', '$99', tenderBody, 'csv_tenders') + '\n' +
    card('csv_awards', 'Awards CSV', '$49', awardBody, 'csv_awards') + '\n' +
    card('csv_bundle', 'Bundle', '$249', bundleBody, 'csv_bundle') + '\n' +
    '</div>\n' +
    '<h2>Licence</h2>\n' +
    '<p id="csv-licence">The public directory dataset record names <a href="' + DIRECTORY_LICENCE + '">' + DIRECTORY_LICENCE + '</a> as its licence. The Terms of Use say: ' + esc(TERMS_SENTENCE) + ' Each row of these CSV files also carries this licence line: ' + esc(csv.LICENCE) + '</p>\n' +
    '<h2>Delivery</h2>\n' +
    '<p>Checkout returns to <a href="/data/download">/data/download</a>. When the server can read the Stripe session, the file is sent only after the session is paid. The link lasts 15 minutes. When that check is not configured, the file is not attached. The page says: ' + esc(csv.EMAIL_INSTEAD) + '</p>\n' +
    '<p>Questions: <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a></p>\n' +
    '</main>\n' +
    footer + '\n' +
    '<script src="/data-checkout.js" defer></script>\n' +
    '</body>\n</html>\n';
}

function build() {
  requireSentence('terms.html', TERMS_SENTENCE, 'terms sentence');
  requireSentence('directory.html', '"license": "' + DIRECTORY_LICENCE + '"', 'directory dataset licence');
  const directory = JSON.parse(read('data/directory-index.json'));
  const tenders = JSON.parse(read('data/tenders.json'));
  const awards = JSON.parse(read('data/awards.json'));
  function sourceDay(value) {
    const day = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
  }
  const when = [sourceDay(directory.generated), sourceDay(tenders.updated), sourceDay(awards.updated)].filter(Boolean).sort().pop();
  const manifest = csv.writeExports(csv.defaultExportDir(), when);
  const previews = {};
  csv.loadPreviews(csv.defaultExportDir()).forEach(function (preview) {
    previews[preview.key] = preview;
  });
  if (previews.directory.total !== (directory.companies || []).length) {
    throw new Error('directory preview count drifted');
  }
  if (previews.tenders.total !== (tenders.tenders || []).length) {
    throw new Error('tender preview count drifted');
  }
  if (previews.awards.total !== (awards.awards || []).length) {
    throw new Error('award preview count drifted');
  }
  const model = {
    previews: previews,
    directoryScope: manifest.directory_scope,
    directoryGenerated: String(directory.generated || '').slice(0, 10),
    tenderUpdated: String(tenders.updated || ''),
    awardUpdated: String(awards.updated || ''),
    tenderComment: tenders.$comment || '',
    awardComment: awards.$comment || '',
    evidenceNotes: directory.evidence_notes || ''
  };
  if (!model.tenderComment || !model.awardComment || !model.directoryScope) {
    throw new Error('a source description is missing');
  }
  const html = render(model);
  if (html.indexOf('buy.stripe.com') !== -1) throw new Error('sales page embedded a Payment Link');
  fs.writeFileSync(path.join(csv.repoRoot(), 'data.html'), html);
  const plansPath = path.join(csv.repoRoot(), 'data', 'csv-pay-plans.json');
  fs.writeFileSync(plansPath, JSON.stringify(pay.plansDocument(), null, 2) + '\n');
  console.log('data page: directory ' + previews.directory.total +
    ', tenders ' + previews.tenders.total +
    ', awards ' + previews.awards.total);
}

if (require.main === module) build();

module.exports = { build: build, TERMS_SENTENCE: TERMS_SENTENCE, DIRECTORY_LICENCE: DIRECTORY_LICENCE };
