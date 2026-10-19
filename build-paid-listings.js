#!/usr/bin/env node
/* Apply reviewed paid listings onto the directory index.
 * Sets listing_tier "verified" and verified true only. Does not rewrite the
 * file when nothing changed, and does not touch capability, evidence, or
 * ranking fields.
 */
'use strict';
const fs = require('fs');
const paid = require('./lib/paid-listings');

function upsertSlot(html, slot) {
  const re = /<section class="tp-featured-slot" data-featured-slot="(?:directory|country)"[\s\S]*?<\/section>/;
  if (re.test(html)) return html.replace(re, slot);
  return null;
}

function writeIfChanged(file, next) {
  const prev = fs.readFileSync(file, 'utf8');
  if (prev === next) return false;
  fs.writeFileSync(file, next);
  return true;
}

function refreshDirectorySlot(file) {
  const slot = paid.featuredListingSlotHtml({ scope: 'directory' });
  const html = fs.readFileSync(file, 'utf8');
  const replaced = upsertSlot(html, slot);
  if (replaced) return writeIfChanged(file, replaced);
  if (html.indexOf('<!--FEATURED:directory-->') !== -1) {
    return writeIfChanged(file, html.replace('<!--FEATURED:directory-->', slot));
  }
  const board = '<div id="board">';
  if (html.indexOf(board) !== -1 && html.indexOf('data-featured-slot="directory"') === -1) {
    return writeIfChanged(file, html.replace(board, slot + '\n' + board));
  }
  console.warn('paid listings: no featured slot anchor in ' + file);
  return false;
}

function refreshCountrySlots() {
  const rfq = '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:16px"><b style="color:var(--text)">Looking for a transformer supplier?</b>';
  let updated = 0;
  fs.readdirSync('manufacturers').forEach(function (name) {
    if (!name.endsWith('.html')) return;
    const file = 'manufacturers/' + name;
    const html = fs.readFileSync(file, 'utf8');
    const heading = html.match(/Transformer Manufacturers in ([^<]+)</);
    if (!heading) return;
    const country = heading[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
    const slot = paid.featuredListingSlotHtml({ scope: 'country', country: country });
    const replaced = upsertSlot(html, slot);
    if (replaced) {
      if (writeIfChanged(file, replaced)) updated++;
      return;
    }
    if (html.indexOf(rfq) === -1) {
      console.warn('paid listings: no country slot anchor in ' + file);
      return;
    }
    if (writeIfChanged(file, html.replace(rfq, slot + '\n' + rfq))) updated++;
  });
  return updated;
}

refreshDirectorySlot('directory.html');
refreshDirectorySlot('manufacturers.html');
const countrySlots = refreshCountrySlots();
console.log('featured listing slots refreshed; country pages touched:', countrySlots);

const indexPath = 'data/directory-index.json';
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const doc = paid.load();
const changed = paid.applyVerifiedManufacturers(index.companies || [], doc);
if (!changed) {
  console.log('paid listings: no verified manufacturer rows to apply');
  process.exit(0);
}
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log('paid listings applied to directory index:', changed);
