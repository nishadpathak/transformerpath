#!/usr/bin/env node
/* Landing pages for sourced cooling class, MVA floor and country.
 * A page is written only when at least three manufacturers match.
 * Run: node scripts/build-spec-landings.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const spec = require('../lib/sourced-spec-fields');
const schema = require('../lib/seo-schema');

const ROOT = path.join(__dirname, '..');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync(path.join(ROOT, '_partials/header.html'), 'utf8').trim());
const FOOT = abs(fs.readFileSync(path.join(ROOT, '_partials/footer.html'), 'utf8').trim());

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function coolingRow(company, code) {
  return (company.cooling || []).filter(function (row) { return row.code === code; })[0];
}

function evidence(company, page) {
  const cool = coolingRow(company, page.cooling);
  const parts = [];
  if (cool) {
    parts.push(esc(page.cooling) + '. <q>' + esc(cool.quote) + '</q> <a href="' + esc(cool.source_url) + '" target="_blank" rel="noopener">source</a> <span style="color:var(--muted)">checked ' + esc(cool.checked_at) + '</span>');
  }
  if (company.max_mva && company.max_mva.quote) {
    parts.push(esc(company.max_mva.value) + ' MVA. <q>' + esc(company.max_mva.quote) + '</q> <a href="' + esc(company.max_mva.source_url) + '" target="_blank" rel="noopener">source</a>');
  }
  return parts.join('<br>');
}

function pageHtml(page) {
  const canonical = 'https://transformerpath.com' + page.urlPath;
  const rows = page.companies.map(function (c) {
    return '<li class="mk-row"><a href="/manufacturers/' + esc(c.slug) + '/">' + esc(c.name) + '</a> <span class="city">' + esc(c.country || '') + '</span><div class="quote">' + evidence(c, page) + '</div></li>';
  }).join('');
  const graph = schema.graph([
    schema.itemListNode(canonical, page.h1, page.companies.map(function (c) {
      return { name: c.name, url: 'https://transformerpath.com/manufacturers/' + c.slug + '/', country: c.country || '' };
    }))
  ]);
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(page.title) + '</title>\n' +
    '<meta name="description" content="' + esc(page.description) + '">\n' +
    '<link rel="canonical" href="' + canonical + '">\n' +
    '<meta name="robots" content="index,follow">\n' +
    '<link rel="stylesheet" href="/style.css?v=13"><link rel="stylesheet" href="/tp-nav.css?v=13">\n' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">\n' +
    '<script type="application/ld+json">' + JSON.stringify(graph) + '</script>\n' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.9rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);line-height:1.6}.c-wrap .mk-row{padding:12px 0;border-bottom:1px solid var(--border)}.c-wrap .city{color:var(--muted);font-size:.85rem}.c-wrap .quote{color:var(--text);font-size:.88rem;margin-top:4px}</style>\n' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap">\n' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="/manufacturers.html" style="color:var(--accent)">Manufacturers</a> › <a href="/manufacturers/specs/" style="color:var(--accent)">Specs</a> › ' + esc(page.h1) + '</nav>\n' +
    '<h1>' + esc(page.h1) + '</h1>\n<p class="lead">' + esc(page.description) + '</p>\n<ol>' + rows + '</ol>\n' +
    '<p><a class="btn btn-outline btn-sm" href="/correct-company.html" data-track="manufacturer_correction_started">Suggest a correction →</a></p>\n' +
    '</main>\n' + FOOT + '\n</body>\n</html>\n';
}

function indexHtml(pages) {
  const copy = spec.indexCopy();
  const links = pages.map(function (page) {
    return '<li><a href="' + esc(page.urlPath) + '">' + esc(page.h1) + '</a> <span class="city">' + page.companies.length + ' sourced makers</span></li>';
  }).join('');
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(copy.title) + '</title>\n' +
    '<meta name="description" content="' + esc(copy.description) + '">\n' +
    '<link rel="canonical" href="https://transformerpath.com/manufacturers/specs/">\n' +
    '<meta name="robots" content="index,follow">\n' +
    '<link rel="stylesheet" href="/style.css?v=13"><link rel="stylesheet" href="/tp-nav.css?v=13">\n' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">\n' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.9rem;color:var(--ink)}.c-wrap .lead,.c-wrap .city{color:var(--muted)}.c-wrap li{padding:8px 0}</style>\n' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap">\n' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="/manufacturers.html" style="color:var(--accent)">Manufacturers</a> › Specs</nav>\n' +
    '<h1>' + esc(copy.h1) + '</h1>\n' +
    '<p class="lead">' + esc(copy.description) + '</p>\n' +
    '<ul>' + links + '</ul>\n' +
    '<p><a class="btn btn-outline btn-sm" href="/correct-company.html" data-track="manufacturer_correction_started">Suggest a correction →</a></p>\n' +
    '</main>\n' + FOOT + '\n</body>\n</html>\n';
}

function main() {
  const doc = spec.load(ROOT);
  const errors = spec.validate(doc);
  if (errors.length) {
    console.error('sourced spec fields invalid:');
    errors.forEach(function (err) { console.error('  ' + err); });
    process.exit(1);
  }
  const pages = spec.landings(doc);
  const dir = path.join(ROOT, 'manufacturers', 'specs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), indexHtml(pages));
  pages.forEach(function (page) {
    const folder = path.join(dir, page.slug);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'index.html'), pageHtml(page));
    console.log('wrote', page.path, page.companies.length);
  });
  console.log('spec landings', pages.length);
}

if (require.main === module) main();
module.exports = main;
