#!/usr/bin/env node
/* build-tender-products.js — one page per product that has an official notice.
 *
 * Run after build-tenders.js. A product with no official notice is not
 * generated. Closed notices stay on the page and are marked expired.
 */
'use strict';

const fs = require('fs');
const { CATALOG, groupOfficial } = require('./lib/tender-products');
const { slugify } = require('./lib/tender-countries');
const partner = require('./lib/tender-partner');
const tenderSitemap = require('./lib/tender-sitemap');
const { tenderSourceDay } = require('./lib/sitemap-dates');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateLabel(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!match) return '';
  return Number(match[3]) + ' ' + MONTHS[Number(match[2]) - 1] + ' ' + match[1];
}

function fitDesc(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= 160) return s;
  const cut = s.slice(0, 157);
  const sp = cut.lastIndexOf(' ');
  return (sp > 120 ? cut.slice(0, sp) : cut).trim() + '...';
}

const ORDER = { OPEN: 0, CLOSING_SOON: 1, EXPECTED: 2, EVALUATION: 3, PROCUREMENT_PLAN: 4, FRAMEWORK: 5, MOU: 6, AWARDED: 7, CLOSED: 8, UNKNOWN: 9, UNDATED: 9 };
const STYLE = '.c-wrap{max-width:980px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:820px}.t-row{padding:12px 0;border-bottom:1px solid var(--border);font-size:.92rem}.t-row a{color:var(--accent);font-weight:700;text-decoration:none}.t-row a:hover{text-decoration:underline}.t-meta{color:var(--muted);font-size:.8rem;display:block;margin-top:3px}.tender-cta{background:rgba(245,166,35,.08);border:1px solid var(--accent);border-radius:12px;padding:16px 18px;margin:18px 0}.tender-cta-title{color:var(--text);font-weight:800;margin:0 0 6px}.st{display:inline-block;font-weight:700;font-size:.66rem;letter-spacing:.04em;padding:1px 8px;border-radius:8px;text-transform:uppercase}.st-open{background:#14351f;color:#4ade80}.st-expected{background:#2a2413;color:#e8c46a}.st-closing{background:#2a1a13;color:#fb923c}.st-eval{background:#12283f;color:#60a5fa}.st-awarded{background:#0f2a2a;color:#2dd4bf}.st-closed{background:#1d2330;color:#9fb0c4}.expired{background:#2a1a13;color:#fb923c}';
const ST = { OPEN: 'st-open', CLOSING_SOON: 'st-closing', EXPECTED: 'st-expected', EVALUATION: 'st-eval', AWARDED: 'st-awarded', CLOSED: 'st-closed', UNKNOWN: 'st-closed', PROCUREMENT_PLAN: 'st-expected', FRAMEWORK: 'st-expected', MOU: 'st-expected', UNDATED: 'st-expected' };

function shell(opts) {
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(opts.title) + '</title>' +
    '<meta name="description" content="' + esc(opts.description) + '">' +
    '<link rel="canonical" href="' + esc(opts.canonical) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(opts.title) + '"><meta property="og:description" content="' + esc(opts.description) + '"><meta property="og:url" content="' + esc(opts.canonical) + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    (opts.jsonLd || '') +
    '<link rel="icon" type="image/svg+xml" href="' + opts.icon + 'brand/favicon.svg"><link rel="stylesheet" href="' + opts.icon + 'style.css?v=14"><style>' + STYLE + '</style><link rel="stylesheet" href="' + opts.icon + 'tp-nav.css?v=14">' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap"' + (opts.attrs || '') + '>' +
    opts.body +
    '</main>\n' + FOOT + '\n<script src="' + opts.icon + 'analytics.js" defer></script>\n</body>\n</html>';
}

function indexJsonLd(slugs, groups) {
  const node = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Transformer tenders by product',
    url: 'https://transformerpath.com/tenders/products.html',
    numberOfItems: slugs.length,
    itemListElement: slugs.map(function (slug, i) {
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: groups[slug].product.label,
        url: 'https://transformerpath.com/tenders/product/' + slug + '/'
      };
    })
  };
  return '<script type="application/ld+json">' + JSON.stringify(node).replace(/</g, '\\u003c') + '</script>';
}

function jsonLd(name, url, tenders) {
  const node = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: name,
    url: url,
    numberOfItems: tenders.length,
    itemListElement: tenders.map(function (tender, i) {
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: tender.title,
        url: 'https://transformerpath.com/tenders/' + slugify(tender.title) + '/'
      };
    })
  };
  return '<script type="application/ld+json">' + JSON.stringify(node).replace(/</g, '\\u003c') + '</script>';
}

function rowHtml(tender) {
  const expired = tender.status === 'CLOSED';
  const buyer = tender.buyer || tender.utility || '';
  const buyerCountry = tender.buyer_country || tender.country || '';
  const when = dateLabel(tender.deadline);
  const source = tender.source || '';
  const official = tender.official_procurement_url || '';
  const bits = [];
  if (buyer) bits.push('Buyer ' + buyer);
  if (buyerCountry) bits.push('Buyer country ' + buyerCountry);
  if (when) bits.push('Deadline ' + when);
  if (source) bits.push(source);
  return '<div class="t-row" data-product-row="1" data-tender-id="' + esc(tender.tender_id) + '" data-expired="' + (expired ? '1' : '0') + '">' +
    '<a href="/tenders/' + esc(slugify(tender.title)) + '/">' + esc(tender.title) + '</a> ' +
    '<span class="st ' + (ST[tender.status] || 'st-closed') + '">' + esc(tender.statusLabel || tender.status || '') + '</span>' +
    (expired ? ' <span class="st expired">Expired</span>' : '') +
    '<span class="t-meta">' + esc(bits.join(' · ')) + '</span>' +
    (official ? '<a class="t-notice" href="' + esc(official) + '" target="_blank" rel="noopener" data-track="tender_notice_opened" data-track-placement="product">Official notice</a>' : '') +
    '</div>';
}

function maxDay(tenders) {
  let day = '';
  tenders.forEach(function (tender) {
    const next = tenderSourceDay(tender) || '';
    if (next && next > day) day = next;
  });
  return day;
}

function build() {
  const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders || [];
  const groups = groupOfficial(tenders);
  const slugs = CATALOG.map(function (product) { return product.slug; }).filter(function (slug) { return groups[slug]; });
  fs.mkdirSync('tenders/product', { recursive: true });
  const sitemapEntries = [];
  slugs.forEach(function (slug) {
    const group = groups[slug];
    const product = group.product;
    const rows = group.tenders.slice().sort(function (a, b) {
      return (ORDER[a.status] - ORDER[b.status]) || String(a.deadline || '').localeCompare(String(b.deadline || '')) || String(a.title).localeCompare(String(b.title));
    });
    const open = rows.filter(function (tender) { return tender.status === 'OPEN' || tender.status === 'CLOSING_SOON'; }).length;
    const countries = [];
    rows.forEach(function (tender) {
      const name = tender.buyer_country || tender.country || '';
      if (name && countries.indexOf(name) < 0) countries.push(name);
    });
    const description = fitDesc(product.label + ' tenders from public procurement notices: ' + rows.length + ' notices, ' + open + ' still open' +
      (countries.length ? ', including ' + countries.slice(0, 4).join(', ') : '') + '. Each row links to the official notice.');
    const canonical = 'https://transformerpath.com/tenders/product/' + slug + '/';
    const body = '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="/tenders.html" style="color:var(--accent)">Tenders</a> · <a href="/tenders/products.html" style="color:var(--accent)">Products</a> · ' + esc(product.label) + '</nav>' +
      '<h1>' + esc(product.title) + '</h1>' +
      '<p class="lead">' + esc(product.intro) + '</p>' +
      '<p class="t-meta">' + rows.length + ' official notices · ' + open + ' open · <a href="/tenders.html?product=' + esc(slug) + '" style="color:var(--accent)">Filter this product on the tender list</a></p>' +
      partner.ctaHtml() +
      rows.map(rowHtml).join('');
    const html = shell({
      title: product.title + ' | TransformerPath',
      description: description,
      canonical: canonical,
      icon: '../../../',
      attrs: ' data-product="' + esc(slug) + '"',
      jsonLd: jsonLd(product.title, canonical, rows),
      body: body
    });
    fs.mkdirSync('tenders/product/' + slug, { recursive: true });
    fs.writeFileSync('tenders/product/' + slug + '/index.html', html);
    const day = maxDay(rows);
    if (day) sitemapEntries.push({ loc: canonical, indexable: true, lastmod: day });
  });
  fs.readdirSync('tenders/product', { withFileTypes: true }).forEach(function (entry) {
    if (entry.isDirectory() && slugs.indexOf(entry.name) < 0) fs.rmSync('tenders/product/' + entry.name, { recursive: true, force: true });
  });

  const indexRows = slugs.map(function (slug) {
    const group = groups[slug];
    const open = group.tenders.filter(function (tender) { return tender.status === 'OPEN' || tender.status === 'CLOSING_SOON'; }).length;
    return '<div class="t-row"><a href="/tenders/product/' + esc(slug) + '/">' + esc(group.product.label) + '</a>' +
      '<span class="t-meta">' + group.tenders.length + ' official notices · ' + open + ' open</span></div>';
  }).join('');
  const indexDesc = fitDesc('Transformer, substation and power-equipment tenders grouped by product. ' + slugs.length + ' product pages, each with at least one official public notice.');
  const indexCanonical = 'https://transformerpath.com/tenders/products.html';
  const indexHtml = shell({
    title: 'Transformer tenders by product | TransformerPath',
    description: indexDesc,
    canonical: indexCanonical,
    icon: '../',
    attrs: ' data-product-index="1"',
    jsonLd: indexJsonLd(slugs, groups),
    body: '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="/tenders.html" style="color:var(--accent)">Tenders</a> · Products</nav>' +
      '<h1>Transformer tenders by product</h1>' +
      '<p class="lead">Each product page lists official public notices for that equipment. A page is published only when at least one TED, World Bank, ADB, AfDB, or other allowlisted notice matches the product. Expired deadlines stay on the page and are marked.</p>' +
      partner.ctaHtml() +
      indexRows
  });
  fs.writeFileSync('tenders/products.html', indexHtml);
  let indexDay = '';
  sitemapEntries.forEach(function (entry) { if (entry.lastmod > indexDay) indexDay = entry.lastmod; });
  if (indexDay) sitemapEntries.push({ loc: indexCanonical, indexable: true, lastmod: indexDay });
  const added = tenderSitemap.syncListed('sitemap.xml', sitemapEntries);
  console.log('tender product pages wrote ' + slugs.length + ' products; sitemap links added ' + added);
}

if (require.main === module) build();
module.exports = { build: build };
