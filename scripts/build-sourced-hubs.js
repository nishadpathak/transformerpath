#!/usr/bin/env node
/* Landing pages for sourced product types and voltage classes.
 * A page is written only when at least five makers qualify.
 * Run: node scripts/build-sourced-hubs.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const specs = require('../lib/manufacturer-specs');
const schema = require('../lib/seo-schema');
const claimListing = require('../lib/claim-listing');

const ROOT = path.join(__dirname, '..');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync(path.join(ROOT, '_partials/header.html'), 'utf8').trim());
const FOOT = abs(fs.readFileSync(path.join(ROOT, '_partials/footer.html'), 'utf8').trim());

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function evidence(company, hubSlug) {
  if (hubSlug === '400-kv' && company.max_voltage_kv) {
    const v = company.max_voltage_kv;
    return esc(v.value) + ' kV' + (v.scope ? ' (' + esc(v.scope) + ')' : '') + '. <q>' + esc(v.quote) + '</q> <a href="' + esc(v.source_url) + '" target="_blank" rel="noopener">source</a>';
  }
  const code = hubSlug === 'distribution-transformers' ? 'DT' : hubSlug === 'dry-type-transformers' ? 'DRY' : 'PT';
  const product = (company.products || []).find(function (p) { return p.code === code; });
  if (!product) return '';
  return '<q>' + esc(product.quote) + '</q> <a href="' + esc(product.source_url) + '" target="_blank" rel="noopener">source</a>';
}

function listEntries(companies) {
  return companies.map(function (c) {
    return {
      name: c.name,
      url: 'https://transformerpath.com/manufacturers/' + c.slug + '/',
      country: c.country || ''
    };
  });
}

function page(hub) {
  const canonical = 'https://transformerpath.com' + hub.urlPath;
  const rows = hub.companies.map(function (c) {
    return '<li class="mk-row"><a href="/manufacturers/' + esc(c.slug) + '/">' + esc(c.name) + '</a> <span class="city">' + esc(c.country || '') + '</span><div class="quote">' + evidence(c, hub.slug) + '</div></li>';
  }).join('');
  const graph = schema.graph([
    schema.itemListNode(canonical, hub.h1, listEntries(hub.companies))
  ]);
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(hub.title) + '</title>\n' +
    '<meta name="description" content="' + esc(hub.lead) + '">\n' +
    '<link rel="canonical" href="' + canonical + '">\n' +
    '<meta name="robots" content="index,follow">\n' +
    '<link rel="stylesheet" href="/style.css?v=13"><link rel="stylesheet" href="/tp-nav.css?v=13">\n' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">\n' +
    '<script type="application/ld+json">' + JSON.stringify(graph) + '</script>\n' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.9rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);line-height:1.6}.c-wrap .mk-row{padding:12px 0;border-bottom:1px solid var(--border)}.c-wrap .city{color:var(--muted);font-size:.85rem}.c-wrap .quote{color:var(--text);font-size:.88rem;margin-top:4px}</style>\n' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap">\n' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="/manufacturers.html" style="color:var(--accent)">Manufacturers</a> › <a href="/manufacturers/sourced/" style="color:var(--accent)">Sourced</a> › ' + esc(hub.h1) + '</nav>\n' +
    '<h1>' + esc(hub.h1) + '</h1>\n<p class="lead">' + esc(hub.lead) + '</p>\n<ol>' + rows + '</ol>\n' +
    '<p><a class="btn btn-outline btn-sm" href="/correct-company.html" data-track="manufacturer_correction_started">Suggest a correction →</a></p>\n' +
    '</main>\n' + FOOT + '\n</body>\n</html>\n';
}

function indexPage(hubList) {
  const links = hubList.map(function (h) {
    return '<li><a href="' + esc(h.urlPath) + '">' + esc(h.h1) + '</a> <span class="city">' + h.companies.length + ' sourced makers</span></li>';
  }).join('');
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>Sourced manufacturer group directory | TransformerPath</title>\n' +
    '<meta name="description" content="Sourced manufacturer groups are published when at least five profiles have a public page for that product or voltage. Profiles without a quoted source are left off.">\n' +
    '<link rel="canonical" href="https://transformerpath.com/manufacturers/sourced/">\n' +
    '<meta name="robots" content="index,follow">\n' +
    '<link rel="stylesheet" href="/style.css?v=13"><link rel="stylesheet" href="/tp-nav.css?v=13">\n' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">\n' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.9rem;color:var(--ink)}.c-wrap .lead,.c-wrap .city{color:var(--muted)}.c-wrap li{padding:8px 0}</style>\n' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap">\n' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="/manufacturers.html" style="color:var(--accent)">Manufacturers</a> › Sourced</nav>\n' +
    '<h1>Sourced manufacturer groups</h1>\n' +
    '<p class="lead">A group is published when at least five manufacturers have a public page that states the qualification. Profiles without that source are not added to fill the list.</p>\n' +
    '<ul>' + links + '</ul>\n' +
    '<p><a class="btn btn-outline btn-sm" href="/correct-company.html" data-track="manufacturer_correction_started">Suggest a correction →</a></p>\n' +
    '</main>\n' + FOOT + '\n</body>\n</html>\n';
}

function main() {
  const doc = specs.load(ROOT);
  const hubList = specs.hubs(doc);
  const dir = path.join(ROOT, 'manufacturers', 'sourced');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), indexPage(hubList));
  const kept = {};
  hubList.forEach(function (h) {
    const folder = path.join(dir, h.slug);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'index.html'), page(h));
    kept[h.slug] = true;
    console.log('wrote', h.path, h.companies.length);
  });
  claimListing.stripStaleHubClaim(dir, 'sourced', kept);
  console.log('sourced hubs', hubList.length);
}

if (require.main === module) main();
module.exports = main;
