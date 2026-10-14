#!/usr/bin/env node
/* CI gate: a VERIFIED MANUFACTURER or FEATURED paid badge may appear only
 * when data/paid-listings.json has a reviewed row with status verified.
 * listing_tier "verified" / verified true on the directory index has the
 * same requirement.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const paid = require('./lib/paid-listings');

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (ent.name.startsWith('.')) return;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  });
}

function htmlFiles(root) {
  const files = [];
  fs.readdirSync(root).forEach(function (name) {
    if (name.endsWith('.html')) files.push(path.join(root, name));
  });
  ['manufacturers', 'events'].forEach(function (dir) { walk(path.join(root, dir), files); });
  return files;
}

function attr(tag, name) {
  const re = new RegExp(name + '="([^"]*)"');
  const m = tag.match(re);
  return m ? m[1] : '';
}

function auditHtml(file, html, doc) {
  const violations = [];
  const re = /<[^>]*data-paid-badge="(verified-manufacturer|featured-event)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const kind = m[1];
    if (kind === 'verified-manufacturer') {
      const slug = attr(tag, 'data-company-slug');
      if (!paid.isVerifiedManufacturer(slug, doc)) {
        violations.push(file + ': VERIFIED MANUFACTURER badge without a verified paid row (' + (slug || 'missing slug') + ')');
      }
    } else {
      const eventId = attr(tag, 'data-event-id');
      if (!paid.isFeaturedEvent(eventId, doc)) {
        violations.push(file + ': FEATURED badge without a verified paid row (' + (eventId || 'missing event') + ')');
      }
    }
  }
  if (html.indexOf('>VERIFIED MANUFACTURER<') >= 0 && html.indexOf('data-paid-badge="verified-manufacturer"') < 0) {
    violations.push(file + ': VERIFIED MANUFACTURER text without a paid-badge marker');
  }
  return violations;
}

function auditDirectory(companies, doc) {
  const violations = [];
  (companies || []).forEach(function (company) {
    if (!company) return;
    const marked = company.listing_tier === 'verified' || company.verified === true;
    if (marked && !paid.isVerifiedManufacturer(company.slug, doc)) {
      violations.push('directory-index: ' + (company.slug || company.name) + ' is verified without a verified paid row');
    }
  });
  return violations;
}

function auditTree(root, doc, companies) {
  const violations = [];
  htmlFiles(root).forEach(function (file) {
    let html;
    try { html = fs.readFileSync(file, 'utf8'); }
    catch (e) { return; }
    auditHtml(file, html, doc).forEach(function (v) { violations.push(v); });
  });
  auditDirectory(companies, doc).forEach(function (v) { violations.push(v); });
  return violations;
}

function main() {
  const doc = paid.load();
  let companies = [];
  try {
    companies = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8')).companies || [];
  } catch (e) {
    console.error('check-paid-badges: directory index unreadable');
    process.exit(1);
  }
  const violations = auditTree('.', doc, companies);
  if (violations.length) {
    console.error('PAID BADGE GATE FAIL (' + violations.length + ')');
    violations.slice(0, 40).forEach(function (v) { console.error('  ' + v); });
    process.exit(1);
  }
  console.log('PAID BADGE GATE PASS');
}

module.exports = { auditHtml: auditHtml, auditDirectory: auditDirectory, auditTree: auditTree, htmlFiles: htmlFiles };

if (require.main === module) main();
