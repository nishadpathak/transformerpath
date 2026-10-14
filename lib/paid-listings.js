#!/usr/bin/env node
/* lib/paid-listings.js — reviewed commercial listings.
 *
 * Stripe writes paid_pending_verification in Supabase. This file is the
 * admin-reviewed source (data/paid-listings.json). A badge is rendered only
 * when status is "verified" and the row names a reviewer, a review time, and
 * verification evidence.
 *
 * Applying a verified manufacturer sets listing_tier and verified only.
 * Capability, evidence, and ranking fields are left unchanged.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PRODUCTS = {
  verified_manufacturer: { priceEnv: 'STRIPE_PRICE_VERIFIED_MANUFACTURER', ref: 'company_slug' },
  featured_event: { priceEnv: 'STRIPE_PRICE_FEATURED_EVENT', ref: 'event_id' }
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function candidateRoots() {
  const roots = [];
  if (typeof __dirname !== 'undefined') {
    roots.push(path.resolve(__dirname, '..'));
    roots.push(path.resolve(__dirname, '../..'));
  }
  if (process.cwd()) roots.push(process.cwd());
  roots.push('/var/task');
  return roots;
}

function resolveData(name) {
  const roots = candidateRoots();
  for (let i = 0; i < roots.length; i++) {
    const p = path.join(roots[i], 'data', name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readJson(name) {
  const p = resolveData(name);
  if (!p) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

let catalogCache = null;

function loadCatalog() {
  if (catalogCache) return catalogCache;
  const slugs = new Set();
  const directory = readJson('directory-index.json');
  const companies = directory && Array.isArray(directory.companies) ? directory.companies : [];
  companies.forEach(function (c) { if (c && c.slug) slugs.add(String(c.slug).toLowerCase()); });
  const companySlugs = readJson('company-slugs.json');
  if (Array.isArray(companySlugs)) {
    companySlugs.forEach(function (c) { if (c && c.slug) slugs.add(String(c.slug).toLowerCase()); });
  }

  const events = new Set();
  function addEvent(id) {
    const s = String(id || '').trim().toLowerCase();
    if (s) events.add(s);
  }
  const canonical = readJson('events-canonical.json');
  const editions = canonical && Array.isArray(canonical.canonical_editions) ? canonical.canonical_editions : [];
  editions.forEach(function (ev) {
    if (!ev) return;
    addEvent(ev.slug);
    addEvent(ev.seriesSlug);
    addEvent(ev.seriesKey);
    if (ev.href) addEvent(String(ev.href).replace(/^\/events\//, '').replace(/\/$/, ''));
  });
  const calendar = readJson('events.json');
  if (Array.isArray(calendar)) {
    calendar.forEach(function (ev) { if (ev && ev.n) addEvent(slugify(ev.n)); });
  }
  catalogCache = { slugs: slugs, events: events, companies: companies };
  return catalogCache;
}

function clearCatalogCache() { catalogCache = null; }

function knownCompanySlug(slug) {
  if (!slug) return false;
  return loadCatalog().slugs.has(String(slug).trim().toLowerCase());
}

function knownEventId(id) {
  if (!id) return false;
  return loadCatalog().events.has(String(id).trim().toLowerCase());
}

function emptyDoc() {
  return { listings: [] };
}

function load(filePath) {
  try {
    const raw = filePath
      ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
      : (readJson('paid-listings.json') || emptyDoc());
    if (!raw || !Array.isArray(raw.listings)) return emptyDoc();
    return raw;
  } catch (e) {
    return emptyDoc();
  }
}

function reviewed(row) {
  if (!row || row.status !== 'verified') return false;
  if (!row.reviewer || !row.reviewed_at || !row.verification_evidence) return false;
  if (!PRODUCTS[row.product]) return false;
  return true;
}

function isVerifiedManufacturer(slug, doc) {
  const want = String(slug || '').trim().toLowerCase();
  if (!want) return false;
  return (doc && doc.listings ? doc.listings : []).some(function (row) {
    return reviewed(row) && row.product === 'verified_manufacturer'
      && String(row.company_slug || '').trim().toLowerCase() === want;
  });
}

function isFeaturedEvent(eventId, doc) {
  const want = String(eventId || '').trim().toLowerCase();
  if (!want) return false;
  return (doc && doc.listings ? doc.listings : []).some(function (row) {
    return reviewed(row) && row.product === 'featured_event'
      && String(row.event_id || '').trim().toLowerCase() === want;
  });
}

function neutralityFor(product) {
  const commerce = readJson('commerce.json');
  const sections = commerce && commerce.sections ? commerce.sections : [];
  const wantId = product === 'verified_manufacturer' ? 'verified' : product;
  for (let i = 0; i < sections.length; i++) {
    const products = sections[i].products || [];
    for (let j = 0; j < products.length; j++) {
      if (products[j].id === wantId && products[j].neutrality) return products[j].neutrality;
    }
  }
  if (product === 'verified_manufacturer') {
    return 'VERIFIED MANUFACTURER means the organization/contact/profile completed TransformerPath\'s defined verification process. It does NOT mean product certified, quality certified, approved supplier, or technically superior.';
  }
  return 'FEATURED is promotional placement, clearly labelled. It is not an editorial recommendation.';
}

function manufacturerBadgeHtml(slug, doc) {
  if (!isVerifiedManufacturer(slug, doc)) return '';
  return '<p class="paid-badge-wrap"><span class="paid-badge" data-paid-badge="verified-manufacturer" data-company-slug="'
    + esc(slug) + '">VERIFIED MANUFACTURER</span> <span class="paid-badge-note">'
    + esc(neutralityFor('verified_manufacturer')) + '</span></p>';
}

function featuredEventHtml(eventId, doc) {
  if (!isFeaturedEvent(eventId, doc)) return '';
  return '<p class="paid-badge-wrap"><span class="paid-badge" data-paid-badge="featured-event" data-event-id="'
    + esc(eventId) + '">FEATURED</span> <span class="paid-badge-note">'
    + esc(neutralityFor('featured_event')) + '</span></p>';
}

function checkoutWidget(o) {
  o = o || {};
  const attrs = [
    'class="paid-checkout"',
    'data-product="' + esc(o.product) + '"',
    'data-fallback="' + esc(o.fallback || '') + '"'
  ];
  if (o.companySlug) attrs.push('data-company-slug="' + esc(o.companySlug) + '"');
  if (o.eventId) attrs.push('data-event-id="' + esc(o.eventId) + '"');
  if (o.emailFrom) attrs.push('data-email-from="' + esc(o.emailFrom) + '"');
  if (o.slugFrom) attrs.push('data-slug-from="' + esc(o.slugFrom) + '"');
  let inputs = '';
  const field = 'width:100%;max-width:320px;margin:0 8px 8px 0;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)';
  if (o.askSlug) inputs += '<input class="paid-checkout-slug" type="text" placeholder="Directory slug" aria-label="Directory slug" style="' + field + '">';
  if (o.askEvent) inputs += '<input class="paid-checkout-event" type="text" placeholder="Event id" aria-label="Event id" style="' + field + '">';
  if (o.askEmail !== false) inputs += '<input class="paid-checkout-email" type="email" placeholder="Work email" aria-label="Work email" style="' + field + '">';
  return '<div ' + attrs.join(' ') + ' style="margin-top:12px">' + inputs
    + '<button type="button" class="btn btn-amber btn-sm paid-checkout-btn">' + esc(o.button) + '</button></div>';
}

function applyVerifiedManufacturers(companies, doc) {
  if (!Array.isArray(companies)) return 0;
  let changed = 0;
  companies.forEach(function (company) {
    if (!company || !company.slug) return;
    if (!isVerifiedManufacturer(company.slug, doc)) return;
    if (company.listing_tier === 'verified' && company.verified === true) return;
    const before = JSON.parse(JSON.stringify(company));
    company.listing_tier = 'verified';
    company.verified = true;
    Object.keys(before).forEach(function (key) {
      if (key === 'listing_tier' || key === 'verified') return;
      if (JSON.stringify(before[key]) !== JSON.stringify(company[key])) {
        throw new Error('paid listing changed ' + key + ' on ' + company.slug);
      }
    });
    Object.keys(company).forEach(function (key) {
      if (key === 'listing_tier' || key === 'verified') return;
      if (!Object.prototype.hasOwnProperty.call(before, key)) {
        throw new Error('paid listing added ' + key + ' on ' + company.slug);
      }
    });
    changed++;
  });
  return changed;
}

module.exports = {
  PRODUCTS: PRODUCTS,
  esc: esc,
  slugify: slugify,
  loadCatalog: loadCatalog,
  clearCatalogCache: clearCatalogCache,
  knownCompanySlug: knownCompanySlug,
  knownEventId: knownEventId,
  load: load,
  reviewed: reviewed,
  isVerifiedManufacturer: isVerifiedManufacturer,
  isFeaturedEvent: isFeaturedEvent,
  neutralityFor: neutralityFor,
  manufacturerBadgeHtml: manufacturerBadgeHtml,
  featuredEventHtml: featuredEventHtml,
  checkoutWidget: checkoutWidget,
  applyVerifiedManufacturers: applyVerifiedManufacturers
};
