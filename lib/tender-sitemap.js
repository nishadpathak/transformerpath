/* Keep sitemap.xml aligned with tender entity pages.
 *
 * Closed pages are noindex and leave the sitemap. A new indexable tender
 * page is added with its notice date, not the build clock. Other URLs,
 * including country tender pages, are left as they are.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function entityLoc(slug) {
  return 'https://transformerpath.com/tenders/' + slug + '/';
}

function sync(file, entries) {
  let xml = fs.readFileSync(file, 'utf8');
  const byLoc = {};
  (entries || []).forEach(function (entry) {
    if (entry && entry.loc) byLoc[entry.loc] = entry;
  });
  xml = xml.replace(/[ \t]*<url><loc>([^<]+)<\/loc><lastmod>[^<]*<\/lastmod><\/url>\r?\n?/g, function (full, loc) {
    const match = String(loc).match(/^https:\/\/transformerpath\.com\/tenders\/([^/]+)\/$/);
    if (!match || match[1] === 'country') return full;
    const entry = byLoc[loc];
    if (!entry || !entry.indexable) return '';
    return full;
  });
  const additions = [];
  Object.keys(byLoc).forEach(function (loc) {
    const entry = byLoc[loc];
    if (!entry.indexable || !/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod || '')) return;
    if (xml.indexOf('<loc>' + loc + '</loc>') !== -1) return;
    additions.push('  <url><loc>' + loc + '</loc><lastmod>' + entry.lastmod + '</lastmod></url>');
  });
  if (additions.length) {
    xml = xml.replace('</urlset>', additions.join('\n') + '\n</urlset>');
  }
  fs.writeFileSync(file, xml);
  return additions.length;
}

function entryFor(tender, slugify, sourceDay) {
  const slug = slugify(tender.title);
  return {
    loc: entityLoc(slug),
    indexable: tender.status !== 'CLOSED' && fs.existsSync(path.join('tenders', slug, 'index.html')),
    lastmod: sourceDay(tender) || ''
  };
}

/* Replace or insert the listed locs. Other sitemap URLs stay put.
 * A product or products-index URL that is no longer indexable is removed. */
function syncListed(file, entries) {
  let xml = fs.readFileSync(file, 'utf8');
  const wanted = {};
  (entries || []).forEach(function (entry) {
    if (!entry || !entry.loc || !entry.indexable) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod || '')) return;
    wanted[entry.loc] = entry.lastmod;
  });
  xml = xml.replace(/[ \t]*<url><loc>([^<]+)<\/loc><lastmod>[^<]*<\/lastmod><\/url>\r?\n?/g, function (full, loc) {
    if (Object.prototype.hasOwnProperty.call(wanted, loc)) {
      const line = '  <url><loc>' + loc + '</loc><lastmod>' + wanted[loc] + '</lastmod></url>\n';
      delete wanted[loc];
      return line;
    }
    if (/^https:\/\/transformerpath\.com\/tenders\/product\//.test(loc) ||
        loc === 'https://transformerpath.com/tenders/products.html') return '';
    return full;
  });
  const additions = Object.keys(wanted).sort().map(function (loc) {
    return '  <url><loc>' + loc + '</loc><lastmod>' + wanted[loc] + '</lastmod></url>';
  });
  if (additions.length) xml = xml.replace('</urlset>', additions.join('\n') + '\n</urlset>');
  fs.writeFileSync(file, xml);
  return additions.length;
}

module.exports = { sync: sync, syncListed: syncListed, entryFor: entryFor, entityLoc: entityLoc };
