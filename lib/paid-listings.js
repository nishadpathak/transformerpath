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

// The only pay URLs. Featured Event ($299) and Verified Manufacturer ($499)
// live in this one object. Pages read the url fields. Stripe Dashboard
// after-payment redirects use the successPath fields.
const PAYMENT_LINKS = {
  featured_event: {
    url: 'https://buy.stripe.com/00w6oA2lO8tvdwkaXwfYY04',
    amountCents: 29900,
    successPath: '/events.html?paid=featured_event&session_id={CHECKOUT_SESSION_ID}#submit-event',
    linkEnv: 'STRIPE_PAYMENT_LINK_FEATURED_EVENT',
    returnQuery: 'paid=featured_event'
  },
  verified_manufacturer: {
    url: 'https://buy.stripe.com/4gMbIU7G8bFHak8d5EfYY05',
    amountCents: 49900,
    successPath: '/claim-profile.html?paid=verified_manufacturer&session_id={CHECKOUT_SESSION_ID}#claimForm',
    linkEnv: 'STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER',
    returnQuery: 'paid=verified_manufacturer'
  }
};

const FEATURED_EVENT_PAYMENT_LINK = PAYMENT_LINKS.featured_event.url;
const FEATURED_EVENT_AMOUNT_CENTS = PAYMENT_LINKS.featured_event.amountCents;
const FEATURED_EVENT_SUCCESS_PATH = PAYMENT_LINKS.featured_event.successPath;
const VERIFIED_MANUFACTURER_PAYMENT_LINK = PAYMENT_LINKS.verified_manufacturer.url;
const VERIFIED_MANUFACTURER_AMOUNT_CENTS = PAYMENT_LINKS.verified_manufacturer.amountCents;
const VERIFIED_MANUFACTURER_SUCCESS_PATH = PAYMENT_LINKS.verified_manufacturer.successPath;

function paymentLinkCode(url) {
  const match = String(url || '').match(/buy\.stripe\.com\/([A-Za-z0-9]+)/);
  return match ? match[1] : '';
}

function companySlugFromReference(value) {
  const ref = String(value || '').trim();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ref)) return ref;
  return null;
}

/* A Checkout Session is one of these Payment Links when metadata names the
 * product, when the after-payment URL is that product's form, when the
 * buy.stripe.com code appears on the session, or when Stripe marks a Payment
 * Link for that amount. Engineer links are $199 / $599 / $1,999 and carry
 * plan or user_id, so they do not match. When the plink env is set, only
 * that id matches on amount.
 */
function isPaymentLinkCheckout(session, product) {
  const spec = PAYMENT_LINKS[product];
  if (!session || typeof session !== 'object' || !spec) return false;
  const meta = session.metadata || {};
  if (meta.product === product) return true;
  if (meta.product || meta.plan || meta.user_id || meta.tier) return false;

  const currency = session.currency ? String(session.currency).toLowerCase() : '';
  const amountOk = session.amount_total === spec.amountCents && (currency === '' || currency === 'usd');
  const success = String(session.success_url || '');
  if (success.indexOf(spec.returnQuery) !== -1 && (session.amount_total == null || amountOk)) return true;

  const paymentLink = session.payment_link == null ? '' : String(session.payment_link);
  const code = paymentLinkCode(spec.url);
  const haystack = [
    paymentLink,
    success,
    String(session.cancel_url || ''),
    String(session.client_reference_id || ''),
    String(session.url || '')
  ].join('\n');
  if (code && haystack.indexOf(code) !== -1) return true;

  const configured = String(process.env[spec.linkEnv] || '').trim();
  if (configured) return paymentLink === configured;
  return amountOk && !!paymentLink;
}

function isFeaturedEventCheckout(session) {
  return isPaymentLinkCheckout(session, 'featured_event');
}

function isVerifiedManufacturerCheckout(session) {
  return isPaymentLinkCheckout(session, 'verified_manufacturer');
}

function listingProduct(session) {
  const product = session && session.metadata && session.metadata.product;
  if (product === 'verified_manufacturer' || product === 'featured_event') return product;
  if (isVerifiedManufacturerCheckout(session)) return 'verified_manufacturer';
  if (isFeaturedEventCheckout(session)) return 'featured_event';
  return null;
}

function featuredEventPayHtml(o) {
  o = o || {};
  const cls = o.className || 'btn btn-amber btn-sm';
  let attrs = 'class="' + esc(cls) + '" href="' + esc(FEATURED_EVENT_PAYMENT_LINK) + '" data-featured-event-pay="1"';
  if (o.style) attrs += ' style="' + esc(o.style) + '"';
  if (o.eventId) attrs += ' data-track="event_feature_inquiry" data-track-event="' + esc(o.eventId) + '"';
  else attrs += ' data-track="event_feature_inquiry" data-track-plan="Featured Event"';
  const label = esc(o.label || 'Feature this event — $299');
  let note = '';
  if (o.note !== false) {
    const formHref = esc(o.formHref || 'events.html#submit-event');
    note = '<p class="paid-after-note" style="color:var(--muted);font-size:.8rem;margin:8px 0 12px">After payment, submit the event name, URL, and dates on the <a href="'
      + formHref + '" style="color:var(--accent)">events list</a>. The FEATURED label is shown only after review.</p>';
  }
  return '<a ' + attrs + '>' + label + '</a>' + note;
}

function verifiedManufacturerPayHtml(o) {
  o = o || {};
  const cls = o.className || 'btn btn-amber btn-sm';
  let href = VERIFIED_MANUFACTURER_PAYMENT_LINK;
  const slug = companySlugFromReference(o.companySlug);
  if (slug) href += '?client_reference_id=' + encodeURIComponent(slug);
  let attrs = 'class="' + esc(cls) + '" href="' + esc(href) + '" data-verified-manufacturer-pay="1"';
  if (o.style) attrs += ' style="' + esc(o.style) + '"';
  if (o.trackName) attrs += ' data-track="supplier_verify_started" data-track-manufacturer="' + esc(o.trackName) + '"';
  const label = esc(o.label || 'Pay $499 — Get Verified');
  let note = '';
  if (o.note !== false) {
    const formHref = esc(o.formHref || 'claim-profile.html?paid=verified_manufacturer#claimForm');
    note = '<p class="paid-after-note" style="color:var(--muted);font-size:.8rem;margin:8px 0 0">After payment, submit your company details on the <a href="'
      + formHref + '" style="color:var(--accent)">claim form</a>. The VERIFIED MANUFACTURER badge appears only after review.</p>';
  }
  return '<a ' + attrs + '>' + label + '</a>' + note;
}

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
  PAYMENT_LINKS: PAYMENT_LINKS,
  FEATURED_EVENT_PAYMENT_LINK: FEATURED_EVENT_PAYMENT_LINK,
  FEATURED_EVENT_AMOUNT_CENTS: FEATURED_EVENT_AMOUNT_CENTS,
  FEATURED_EVENT_SUCCESS_PATH: FEATURED_EVENT_SUCCESS_PATH,
  VERIFIED_MANUFACTURER_PAYMENT_LINK: VERIFIED_MANUFACTURER_PAYMENT_LINK,
  VERIFIED_MANUFACTURER_AMOUNT_CENTS: VERIFIED_MANUFACTURER_AMOUNT_CENTS,
  VERIFIED_MANUFACTURER_SUCCESS_PATH: VERIFIED_MANUFACTURER_SUCCESS_PATH,
  isFeaturedEventCheckout: isFeaturedEventCheckout,
  isVerifiedManufacturerCheckout: isVerifiedManufacturerCheckout,
  listingProduct: listingProduct,
  companySlugFromReference: companySlugFromReference,
  featuredEventPayHtml: featuredEventPayHtml,
  verifiedManufacturerPayHtml: verifiedManufacturerPayHtml,
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
