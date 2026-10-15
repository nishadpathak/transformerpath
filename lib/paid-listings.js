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
  featured_event: { priceEnv: 'STRIPE_PRICE_FEATURED_EVENT', ref: 'event_id' },
  featured_exhibitor: { priceEnv: 'STRIPE_PRICE_FEATURED_EXHIBITOR', ref: 'event_id' },
  hosted_webinar: { priceEnv: 'STRIPE_PRICE_HOSTED_WEBINAR', ref: null }
};

// The only pay URLs. Listing products and the three engineer Payment Links
// live in this one object. Pages read the url fields. Stripe Dashboard
// after-payment redirects use the successPath fields. Course sessions are
// classified in lib/course-payment.js by plink id, metadata, or the
// buy.stripe.com code — never by amountCents. listingProduct ignores the
// engineer keys, so a Learning checkout cannot become a listing.
const PAYMENT_LINKS = {
  featured_event: {
    url: 'https://buy.stripe.com/00w6oA2lO8tvdwkaXwfYY04',
    amountCents: 29900,
    successPath: '/events.html?paid=featured_event&session_id={CHECKOUT_SESSION_ID}#submit-event',
    linkEnv: 'STRIPE_PAYMENT_LINK_FEATURED_EVENT',
    returnQuery: 'paid=featured_event'
  },
  featured_exhibitor: {
    url: 'https://buy.stripe.com/dRm9AM5y06ln1NC9TsfYY06',
    amountCents: 39900,
    successPath: '/sponsor.html?paid=featured_exhibitor&session_id={CHECKOUT_SESSION_ID}#contact',
    linkEnv: 'STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR',
    returnQuery: 'paid=featured_exhibitor'
  },
  hosted_webinar: {
    url: 'https://buy.stripe.com/14A3co8Kc6ln77Wc1AfYY07',
    amountCents: 150000,
    successPath: '/sponsor.html?paid=hosted_webinar&session_id={CHECKOUT_SESSION_ID}#contact',
    linkEnv: 'STRIPE_PAYMENT_LINK_HOSTED_WEBINAR',
    returnQuery: 'paid=hosted_webinar'
  },
  verified_manufacturer: {
    url: 'https://buy.stripe.com/4gMbIU7G8bFHak8d5EfYY05',
    amountCents: 49900,
    successPath: '/claim-profile.html?paid=verified_manufacturer&session_id={CHECKOUT_SESSION_ID}#claimForm',
    linkEnv: 'STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER',
    returnQuery: 'paid=verified_manufacturer'
  },
  learning: {
    url: 'https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p',
    amountCents: 19900,
    plinkId: 'plink_1UQhha2YHcFlJstOHjvZv5V0',
    product: 'learning',
    plan: 'Learning',
    tier: 'learner',
    successPath: '/pricing.html?session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_LEARNING'
  },
  engineering_pro: {
    url: 'https://buy.stripe.com/fZu00c3pScJL1NC3v4fYY01',
    amountCents: 59900,
    product: 'professional',
    plan: 'Engineering Pro',
    tier: 'professional',
    successPath: '/pricing.html?session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_PROFESSIONAL'
  },
  engineering_team: {
    url: 'https://buy.stripe.com/aFacMY6C4aBD2RG2r0fYY02',
    amountCents: 199900,
    product: 'team',
    plan: 'Engineering Team',
    tier: 'enterprise',
    successPath: '/pricing.html?session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_TEAM'
  }
};

const FEATURED_EVENT_PAYMENT_LINK = PAYMENT_LINKS.featured_event.url;
const FEATURED_EVENT_AMOUNT_CENTS = PAYMENT_LINKS.featured_event.amountCents;
const FEATURED_EVENT_SUCCESS_PATH = PAYMENT_LINKS.featured_event.successPath;
const FEATURED_EXHIBITOR_PAYMENT_LINK = PAYMENT_LINKS.featured_exhibitor.url;
const FEATURED_EXHIBITOR_AMOUNT_CENTS = PAYMENT_LINKS.featured_exhibitor.amountCents;
const FEATURED_EXHIBITOR_SUCCESS_PATH = PAYMENT_LINKS.featured_exhibitor.successPath;
const HOSTED_WEBINAR_PAYMENT_LINK = PAYMENT_LINKS.hosted_webinar.url;
const HOSTED_WEBINAR_AMOUNT_CENTS = PAYMENT_LINKS.hosted_webinar.amountCents;
const HOSTED_WEBINAR_SUCCESS_PATH = PAYMENT_LINKS.hosted_webinar.successPath;
const VERIFIED_MANUFACTURER_PAYMENT_LINK = PAYMENT_LINKS.verified_manufacturer.url;
const VERIFIED_MANUFACTURER_AMOUNT_CENTS = PAYMENT_LINKS.verified_manufacturer.amountCents;
const VERIFIED_MANUFACTURER_SUCCESS_PATH = PAYMENT_LINKS.verified_manufacturer.successPath;

function paymentLinkCode(url) {
  const match = String(url || '').match(/buy\.stripe\.com\/([A-Za-z0-9]+)/);
  return match ? match[1] : '';
}

/* payment_link is a plink_ id, or the expanded Payment Link object. */
function paymentLinkParts(session) {
  const link = session && session.payment_link;
  if (link && typeof link === 'object') {
    return {
      id: link.id == null ? '' : String(link.id),
      url: link.url == null ? '' : String(link.url)
    };
  }
  return { id: link == null ? '' : String(link), url: '' };
}

function companySlugFromReference(value) {
  const ref = String(value || '').trim();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ref)) return ref;
  return null;
}

/* A Checkout Session is one of these Payment Links only when metadata names
 * the product, when the after-payment URL carries that product's return
 * query, when the buy.stripe.com code appears on the session or on an
 * expanded Payment Link url, or when payment_link equals the configured
 * plink_ id. The charged amount is never the classifier: a $299 job post
 * must not become Featured Event.
 */
function isPaymentLinkCheckout(session, product) {
  const spec = PAYMENT_LINKS[product];
  if (!session || typeof session !== 'object' || !spec) return false;
  const meta = session.metadata || {};
  if (meta.product === product) return true;
  if (meta.product || meta.plan || meta.user_id || meta.tier) return false;

  const success = String(session.success_url || '');
  if (spec.returnQuery && success.indexOf(spec.returnQuery) !== -1) return true;

  const link = paymentLinkParts(session);
  const code = paymentLinkCode(spec.url);
  const haystack = [
    link.id,
    link.url,
    success,
    String(session.cancel_url || ''),
    String(session.client_reference_id || ''),
    String(session.url || '')
  ].join('\n');
  if (code && haystack.indexOf(code) !== -1) return true;

  const configured = String(process.env[spec.linkEnv] || '').trim();
  return !!(configured && link.id === configured);
}

function isFeaturedEventCheckout(session) {
  return isPaymentLinkCheckout(session, 'featured_event');
}

function isVerifiedManufacturerCheckout(session) {
  return isPaymentLinkCheckout(session, 'verified_manufacturer');
}

function isFeaturedExhibitorCheckout(session) {
  return isPaymentLinkCheckout(session, 'featured_exhibitor');
}

function isHostedWebinarCheckout(session) {
  return isPaymentLinkCheckout(session, 'hosted_webinar');
}

function listingProduct(session) {
  const product = session && session.metadata && session.metadata.product;
  if (product === 'verified_manufacturer' || product === 'featured_event' || product === 'featured_exhibitor' || product === 'hosted_webinar') return product;
  if (isVerifiedManufacturerCheckout(session)) return 'verified_manufacturer';
  if (isFeaturedEventCheckout(session)) return 'featured_event';
  if (isFeaturedExhibitorCheckout(session)) return 'featured_exhibitor';
  if (isHostedWebinarCheckout(session)) return 'hosted_webinar';
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

function featuredExhibitorPayHtml(o) {
  o = o || {};
  const cls = o.className || 'btn btn-amber';
  let attrs = 'class="' + esc(cls) + '" href="' + esc(FEATURED_EXHIBITOR_PAYMENT_LINK) + '" data-featured-exhibitor-pay="1"';
  if (o.style) attrs += ' style="' + esc(o.style) + '"';
  if (o.eventId) attrs += ' data-track="exhibitor_feature_inquiry" data-track-event="' + esc(o.eventId) + '"';
  else attrs += ' data-track="exhibitor_feature_inquiry" data-track-plan="Featured Exhibitor"';
  const label = esc(o.label || 'Feature your exhibitor — $399');
  let note = '';
  if (o.note !== false) {
    const formHref = esc(o.formHref || 'sponsor.html#contact');
    note = '<p class="paid-after-note" style="color:var(--muted);font-size:.8rem;margin:8px 0 12px">After payment, submit your company and the event on the <a href="'
      + formHref + '" style="color:var(--accent)">exhibitor form</a>. The FEATURED label is shown only after review.</p>';
  }
  return '<a ' + attrs + '>' + label + '</a>' + note;
}

function hostedWebinarPayHtml(o) {
  o = o || {};
  const cls = o.className || 'btn btn-amber btn-sm';
  let attrs = 'class="' + esc(cls) + '" href="' + esc(HOSTED_WEBINAR_PAYMENT_LINK) + '" data-hosted-webinar-pay="1"';
  if (o.style) attrs += ' style="' + esc(o.style) + '"';
  attrs += ' data-track="webinar_inquiry" data-track-plan="Hosted Webinar"';
  const label = esc(o.label || 'Host a webinar — $1,500');
  let note = '';
  if (o.note !== false) {
    const formHref = esc(o.formHref || 'sponsor.html#contact');
    note = '<p class="paid-after-note" style="color:var(--muted);font-size:.8rem;margin:8px 0 12px">After payment, submit the webinar topic, date, and company on the <a href="'
      + formHref + '" style="color:var(--accent)">sponsor form</a>. The session is scheduled only after review.</p>';
  }
  return '<a ' + attrs + '>' + label + '</a>' + note;
}

function verifiedManufacturerPayHref(companySlug) {
  const slug = companySlugFromReference(companySlug);
  if (!slug) return '';
  return VERIFIED_MANUFACTURER_PAYMENT_LINK + '?client_reference_id=' + encodeURIComponent(slug);
}

function verifiedManufacturerPayHtml(o) {
  o = o || {};
  const cls = o.className || 'btn btn-amber btn-sm';
  const href = verifiedManufacturerPayHref(o.companySlug) || VERIFIED_MANUFACTURER_PAYMENT_LINK;
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

/* Top-of-profile and directory-row pair. Both hrefs are the $499 Payment Link
 * with client_reference_id set to the maker slug. Omitted once the profile
 * has earned the reviewed VERIFIED MANUFACTURER badge. */
function verifiedManufacturerCtasHtml(o) {
  o = o || {};
  if (o.earned) return '';
  const href = verifiedManufacturerPayHref(o.companySlug);
  if (!href) return '';
  const track = o.trackName ? ' data-track="supplier_verify_started" data-track-manufacturer="' + esc(o.trackName) + '"' : '';
  const wrapStyle = o.compact
    ? 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:100%;min-width:0'
    : 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0 0;max-width:100%;min-width:0';
  function anchor(kind, label, cls) {
    return '<a class="' + esc(cls) + '" href="' + esc(href) + '" data-mfr-verify-cta="' + kind + '" data-verified-manufacturer-pay="1"' + track + '>' + esc(label) + '</a>';
  }
  return '<div class="mfr-verify-ctas" style="' + wrapStyle + '">'
    + anchor('claim', 'Claim this profile', 'btn btn-outline btn-sm mfr-verify-cta')
    + anchor('get-verified', 'Get verified', 'btn btn-amber btn-sm mfr-verify-cta')
    + '</div>';
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
    addEvent(ev.id);
    addEvent(ev.slug);
    addEvent(ev.seriesSlug);
    addEvent(ev.series_slug);
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
  FEATURED_EXHIBITOR_PAYMENT_LINK: FEATURED_EXHIBITOR_PAYMENT_LINK,
  FEATURED_EXHIBITOR_AMOUNT_CENTS: FEATURED_EXHIBITOR_AMOUNT_CENTS,
  FEATURED_EXHIBITOR_SUCCESS_PATH: FEATURED_EXHIBITOR_SUCCESS_PATH,
  HOSTED_WEBINAR_PAYMENT_LINK: HOSTED_WEBINAR_PAYMENT_LINK,
  HOSTED_WEBINAR_AMOUNT_CENTS: HOSTED_WEBINAR_AMOUNT_CENTS,
  HOSTED_WEBINAR_SUCCESS_PATH: HOSTED_WEBINAR_SUCCESS_PATH,
  VERIFIED_MANUFACTURER_PAYMENT_LINK: VERIFIED_MANUFACTURER_PAYMENT_LINK,
  VERIFIED_MANUFACTURER_AMOUNT_CENTS: VERIFIED_MANUFACTURER_AMOUNT_CENTS,
  VERIFIED_MANUFACTURER_SUCCESS_PATH: VERIFIED_MANUFACTURER_SUCCESS_PATH,
  isFeaturedEventCheckout: isFeaturedEventCheckout,
  isFeaturedExhibitorCheckout: isFeaturedExhibitorCheckout,
  isHostedWebinarCheckout: isHostedWebinarCheckout,
  isVerifiedManufacturerCheckout: isVerifiedManufacturerCheckout,
  listingProduct: listingProduct,
  companySlugFromReference: companySlugFromReference,
  featuredEventPayHtml: featuredEventPayHtml,
  featuredExhibitorPayHtml: featuredExhibitorPayHtml,
  hostedWebinarPayHtml: hostedWebinarPayHtml,
  verifiedManufacturerPayHref: verifiedManufacturerPayHref,
  verifiedManufacturerPayHtml: verifiedManufacturerPayHtml,
  verifiedManufacturerCtasHtml: verifiedManufacturerCtasHtml,
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
