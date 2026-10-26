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
  verified_manufacturer: { priceEnv: 'STRIPE_PRICE_VERIFIED_MANUFACTURER', ref: 'company_slug', mode: 'payment' },
  featured_event: { priceEnv: 'STRIPE_PRICE_FEATURED_EVENT', ref: 'event_id', mode: 'payment' },
  featured_exhibitor: { priceEnv: 'STRIPE_PRICE_FEATURED_EXHIBITOR', ref: 'event_id', mode: 'payment' },
  job_standard: { priceEnv: 'STRIPE_PRICE_JOB_STANDARD', ref: null, mode: 'payment' },
  job_featured: { priceEnv: 'STRIPE_PRICE_JOB_FEATURED', ref: null, mode: 'payment' },
  job_bundle_5: { priceEnv: 'STRIPE_PRICE_JOB_BUNDLE_5', ref: null, mode: 'payment' },
  rfq_lead: { priceEnv: 'STRIPE_PRICE_RFQ_LEAD', ref: null, mode: 'payment' },
  rfq_lead_pro: { priceEnv: 'STRIPE_PRICE_RFQ_LEAD_PRO', ref: null, mode: 'payment' },
  supplier_pro: { priceEnv: 'STRIPE_PRICE_SUPPLIER_PRO', ref: null, mode: 'subscription' },
  featured_listing: { priceEnv: 'STRIPE_PRICE_FEATURED_LISTING', ref: null, mode: 'payment' },
  featured_verified: { priceEnv: 'STRIPE_PRICE_FEATURED_VERIFIED', ref: null, mode: 'payment' },
  component_sponsor: { priceEnv: 'STRIPE_PRICE_COMPONENT_SPONSOR', ref: 'component', mode: 'subscription' },
  dga_report: { priceEnv: 'STRIPE_PRICE_DGA_REPORT', ref: null, mode: 'payment' },
  report_template: { priceEnv: 'STRIPE_PRICE_REPORT_TEMPLATE', ref: null, mode: 'payment' },
  template_bundle: { priceEnv: 'STRIPE_PRICE_TEMPLATE_BUNDLE', ref: null, mode: 'payment' },
  commissioning_job_post: { priceEnv: 'STRIPE_PRICE_COMMISSIONING_JOB_POST', ref: null, mode: 'payment' },
  buyer_guide_us_eu: { priceEnv: 'STRIPE_PRICE_BUYER_GUIDE_US_EU', ref: null, mode: 'payment' }
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
  verified_manufacturer: {
    url: 'https://buy.stripe.com/4gMbIU7G8bFHak8d5EfYY05',
    productId: 'prod_VRGrajnpm0wWTo',
    amountCents: 49900,
    successPath: '/claim-profile.html?paid=verified_manufacturer&session_id={CHECKOUT_SESSION_ID}#claimForm',
    linkEnv: 'STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER',
    returnQuery: 'paid=verified_manufacturer'
  },
  // Launch prices. These links stay at $199 / $299 while live openings are
  // under 10, and Supplier Pro stays at $1,499 until a qualified lead has
  // been delivered. The raised prices are not wired here.
  job_standard: {
    url: 'https://buy.stripe.com/aFa14g5y01138c0c1AfYY08',
    plinkId: 'plink_1UQhNK2YHcFlJstOzn2NY5nZ',
    amountCents: 19900,
    successPath: '/jobs.html?paid=job_standard&session_id={CHECKOUT_SESSION_ID}#post',
    linkEnv: 'STRIPE_PAYMENT_LINK_JOB_STANDARD',
    returnQuery: 'paid=job_standard',
    group: 'jobs',
    label: 'Post a job — $199 / 30 days'
  },
  job_featured: {
    url: 'https://buy.stripe.com/4gM5kw4tW5hjdwk5DcfYY09',
    plinkId: 'plink_1UQhNM2YHcFlJstOdH1qqPeB',
    amountCents: 29900,
    successPath: '/jobs.html?paid=job_featured&session_id={CHECKOUT_SESSION_ID}#post',
    linkEnv: 'STRIPE_PAYMENT_LINK_JOB_FEATURED',
    returnQuery: 'paid=job_featured',
    group: 'jobs',
    label: 'Feature a job — $299 / 30 days'
  },
  job_bundle_5: {
    url: 'https://buy.stripe.com/3cI7sE9Og6lndwk0iSfYY0a',
    plinkId: 'plink_1UQhNP2YHcFlJstOwlgmID7a',
    amountCents: 79900,
    successPath: '/jobs.html?paid=job_bundle_5&session_id={CHECKOUT_SESSION_ID}#post',
    linkEnv: 'STRIPE_PAYMENT_LINK_JOB_BUNDLE_5',
    returnQuery: 'paid=job_bundle_5',
    group: 'jobs',
    label: '5-post bundle — $799'
  },
  rfq_lead: {
    url: 'https://buy.stripe.com/00w3co1hKeRT3VK5DcfYY0b',
    plinkId: 'plink_1UQhNR2YHcFlJstOY5Mtg4JZ',
    amountCents: 24900,
    successPath: '/rfq.html?paid=rfq_lead&session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_RFQ_LEAD',
    returnQuery: 'paid=rfq_lead',
    group: 'rfq',
    label: 'Unlock one lead — $249'
  },
  rfq_lead_pro: {
    url: 'https://buy.stripe.com/8x28wIgcEh01boc2r0fYY0c',
    plinkId: 'plink_1UQhNT2YHcFlJstOFCYAzAem',
    amountCents: 14900,
    successPath: '/rfq.html?paid=rfq_lead_pro&session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_RFQ_LEAD_PRO',
    returnQuery: 'paid=rfq_lead_pro',
    group: 'rfq',
    label: 'Extra lead for Supplier Pro — $149'
  },
  supplier_pro: {
    url: 'https://buy.stripe.com/bJeeV66C4cJL9g4d5EfYY0d',
    plinkId: 'plink_1UQhNW2YHcFlJstOrDDsmgwk',
    amountCents: 149900,
    successPath: '/rfq.html?paid=supplier_pro&session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_SUPPLIER_PRO',
    returnQuery: 'paid=supplier_pro',
    group: 'supplier',
    label: 'Supplier Pro — $1,499 / year',
    promoCode: 'FOUNDING30'
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
  },
  // Directory featured slots. successPath is shared, so returnQuery is omitted
  // and the session is classified by metadata.product or the Payment Link code.
  featured_listing: {
    url: 'https://buy.stripe.com/fZu4gsaSkbFHfEsghQfYY0P',
    amountCents: 29900,
    cadence: 'year',
    label: 'Featured Listing',
    priceLabel: '$299/yr plus tax',
    successPath: '/claim?session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_FEATURED_LISTING'
  },
  featured_verified: {
    url: 'https://buy.stripe.com/14AbIU0dG6lnbocghQfYY0Q',
    amountCents: 69900,
    cadence: 'year',
    label: 'Featured + Verified',
    priceLabel: '$699/yr plus tax',
    successPath: '/claim?session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_FEATURED_VERIFIED'
  },
  component_sponsor: {
    url: 'https://buy.stripe.com/bJedR2gcE257eAofdMfYY0R',
    amountCents: 19900,
    cadence: 'month',
    label: 'Component Sponsor',
    priceLabel: '$199/mo plus tax',
    successPath: '/claim?session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_COMPONENT_SPONSOR'
  },
  dga_report: {
    url: 'https://buy.stripe.com/bJe7sE4tWh01ak8c1AfYY0V',
    amountCents: 1900,
    label: '$19 PDF report',
    successPath: '/data/download?product=dga_report&session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_DGA_REPORT',
    returnQuery: 'product=dga_report'
  },
  report_template: {
    url: 'https://buy.stripe.com/eVqeV67G839beAo7LkfYY0S',
    amountCents: 4900,
    label: '$49 template',
    successPath: '/data/download?product=report_template&session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_REPORT_TEMPLATE',
    returnQuery: 'product=report_template'
  },
  template_bundle: {
    url: 'https://buy.stripe.com/aFa00ce4w4dffEsfdMfYY0T',
    amountCents: 14900,
    label: '$149 bundle',
    successPath: '/data/download?product=template_bundle&session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_TEMPLATE_BUNDLE',
    returnQuery: 'product=template_bundle'
  },
  commissioning_job_post: {
    url: 'https://buy.stripe.com/4gMeV62lO9xz9g4fdMfYY0U',
    amountCents: 19900,
    label: 'Post a job, $199',
    successPath: '/claim?product=commissioning_job_post&session_id={CHECKOUT_SESSION_ID}',
    linkEnv: 'STRIPE_PAYMENT_LINK_COMMISSIONING_JOB_POST',
    returnQuery: 'product=commissioning_job_post'
  },
  buyer_guide_us_eu: {
    url: 'https://buy.stripe.com/4gM7sE4tW7pr0Jy3v4fYY0W',
    productId: 'prod_VTSUM0j8YyVSuG',
    amountCents: 1900,
    label: '$19 buyer guide',
    successPath: '/data/download?session_id={CHECKOUT_SESSION_ID}&product=buyer_guide_us_eu',
    linkEnv: 'STRIPE_PAYMENT_LINK_BUYER_GUIDE_US_EU',
    returnQuery: 'product=buyer_guide_us_eu'
  }
};

/* Stripe custom field `component`. coresteel is the stored value; the label is Core steel. */
const COMPONENT_LABELS = {
  pressboard: 'Pressboard',
  coresteel: 'Core steel',
  copper: 'Copper',
  bushings: 'Bushings'
};

/* Supabase is not configured for these yet. The webhook logs them instead of returning 500. */
const DEFERRED_LISTING_PRODUCTS = {
  featured_listing: true,
  featured_verified: true,
  component_sponsor: true
};

const LISTING_SETUP_MESSAGE = "Payment received. We'll set up your listing within 2 business days via hello@transformerpath.com.";

const FEATURED_EVENT_PAYMENT_LINK = PAYMENT_LINKS.featured_event.url;
const FEATURED_EVENT_AMOUNT_CENTS = PAYMENT_LINKS.featured_event.amountCents;
const FEATURED_EVENT_SUCCESS_PATH = PAYMENT_LINKS.featured_event.successPath;
const FEATURED_EXHIBITOR_PAYMENT_LINK = PAYMENT_LINKS.featured_exhibitor.url;
const FEATURED_EXHIBITOR_AMOUNT_CENTS = PAYMENT_LINKS.featured_exhibitor.amountCents;
const FEATURED_EXHIBITOR_SUCCESS_PATH = PAYMENT_LINKS.featured_exhibitor.successPath;
const VERIFIED_MANUFACTURER_PAYMENT_LINK = PAYMENT_LINKS.verified_manufacturer.url;
const VERIFIED_MANUFACTURER_AMOUNT_CENTS = PAYMENT_LINKS.verified_manufacturer.amountCents;
const VERIFIED_MANUFACTURER_SUCCESS_PATH = PAYMENT_LINKS.verified_manufacturer.successPath;

/* paid=rfq_lead must not match paid=rfq_lead_pro. The value is a whole query param. */
function returnQueryMatches(success, returnQuery) {
  if (!returnQuery) return false;
  const escaped = String(returnQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?:\\?|&)' + escaped + '(?:&|#|$)').test(String(success || ''));
}

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
  if (returnQueryMatches(success, spec.returnQuery)) return true;

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

  const fromEnv = String(process.env[spec.linkEnv] || '').trim();
  const expected = fromEnv || String(spec.plinkId || '').trim();
  return !!(expected && link.id === expected);
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

/* Retired. The buy.stripe.com code stays recognizable so an old Payment Link
 * is not classified as a course. It is not in PAYMENT_LINKS and no page links it. */
const RETIRED_HOSTED_WEBINAR_CODE = '14A3co8Kc6ln77Wc1AfYY07';

function isHostedWebinarCheckout(session) {
  if (!session || typeof session !== 'object') return false;
  const meta = session.metadata || {};
  if (meta.product === 'hosted_webinar') return true;
  if (meta.product || meta.plan || meta.user_id || meta.tier) return false;
  const link = paymentLinkParts(session);
  const haystack = [
    link.id,
    link.url,
    String(session.success_url || ''),
    String(session.cancel_url || ''),
    String(session.client_reference_id || ''),
    String(session.url || '')
  ].join('\n');
  if (haystack.indexOf(RETIRED_HOSTED_WEBINAR_CODE) !== -1) return true;
  if (String(session.success_url || '').indexOf('paid=hosted_webinar') !== -1) return true;
  const configured = String(process.env.STRIPE_PAYMENT_LINK_HOSTED_WEBINAR || '').trim();
  return !!(configured && link.id === configured);
}

function configuredId(name) {
  return String(process.env[name] || '').trim();
}

function sessionLineItems(session) {
  if (!session || session.line_items == null) return [];
  const raw = session.line_items;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

/* Line items beat session metadata and the return URL. A paid Checkout for
 * verified_manufacturer, featured_event, or featured_exhibitor stays that
 * product even when metadata says learning. */
function listingFromLineItems(session) {
  const items = sessionLineItems(session);
  if (!items.length) return null;
  const ids = {};
  Object.keys(PRODUCTS).forEach(function (product) {
    const price = configuredId(PRODUCTS[product].priceEnv);
    if (price) ids[price] = product;
    const productId = configuredId('STRIPE_PRODUCT_' + product.toUpperCase());
    if (productId) ids[productId] = product;
  });
  const webinarPrice = configuredId('STRIPE_PRICE_HOSTED_WEBINAR');
  if (webinarPrice) ids[webinarPrice] = 'hosted_webinar';
  const webinarProduct = configuredId('STRIPE_PRODUCT_HOSTED_WEBINAR');
  if (webinarProduct) ids[webinarProduct] = 'hosted_webinar';
  Object.keys(PAYMENT_LINKS).forEach(function (product) {
    const fixed = PAYMENT_LINKS[product] && PAYMENT_LINKS[product].productId;
    if (fixed && PRODUCTS[product]) ids[fixed] = product;
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i] || {};
    const price = item.price && typeof item.price === 'object'
      ? item.price
      : { id: typeof item.price === 'string' ? item.price : '' };
    const product = price.product && typeof price.product === 'object'
      ? price.product
      : { id: typeof price.product === 'string' ? price.product : '' };
    const names = [
      price.metadata && price.metadata.product,
      product.metadata && product.metadata.product,
      item.metadata && item.metadata.product
    ];
    for (let n = 0; n < names.length; n++) {
      const name = String(names[n] || '').trim();
      if (PRODUCTS[name] || name === 'hosted_webinar') return name;
    }
    const keys = [price.id, product.id];
    for (let k = 0; k < keys.length; k++) {
      const id = String(keys[k] || '').trim();
      if (id && ids[id]) return ids[id];
    }
  }
  return null;
}

function listingProduct(session) {
  const fromItems = listingFromLineItems(session);
  if (fromItems) return fromItems;
  const product = session && session.metadata && session.metadata.product;
  if (product && PRODUCTS[product]) return product;
  if (product === 'hosted_webinar') return 'hosted_webinar';
  if (isVerifiedManufacturerCheckout(session)) return 'verified_manufacturer';
  if (isFeaturedEventCheckout(session)) return 'featured_event';
  if (isFeaturedExhibitorCheckout(session)) return 'featured_exhibitor';
  if (isHostedWebinarCheckout(session)) return 'hosted_webinar';
  if (isPaymentLinkCheckout(session, 'job_standard')) return 'job_standard';
  if (isPaymentLinkCheckout(session, 'job_featured')) return 'job_featured';
  if (isPaymentLinkCheckout(session, 'job_bundle_5')) return 'job_bundle_5';
  if (isPaymentLinkCheckout(session, 'rfq_lead')) return 'rfq_lead';
  if (isPaymentLinkCheckout(session, 'rfq_lead_pro')) return 'rfq_lead_pro';
  if (isPaymentLinkCheckout(session, 'supplier_pro')) return 'supplier_pro';
  if (isPaymentLinkCheckout(session, 'featured_listing')) return 'featured_listing';
  if (isPaymentLinkCheckout(session, 'featured_verified')) return 'featured_verified';
  if (isPaymentLinkCheckout(session, 'component_sponsor')) return 'component_sponsor';
  if (isPaymentLinkCheckout(session, 'dga_report')) return 'dga_report';
  if (isPaymentLinkCheckout(session, 'report_template')) return 'report_template';
  if (isPaymentLinkCheckout(session, 'template_bundle')) return 'template_bundle';
  if (isPaymentLinkCheckout(session, 'commissioning_job_post')) return 'commissioning_job_post';
  if (isPaymentLinkCheckout(session, 'buyer_guide_us_eu')) return 'buyer_guide_us_eu';
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
  const label = esc(o.label || 'Pay $499 one-time — Get Verified');
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
  if (row.product === 'verified_manufacturer' && require('./verified-flow').termEnded(row)) return false;
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

const IDENTITY_BADGE_TEXT = 'Identity & contact checked — not a product certification';
const IDENTITY_BADGE_HTML = 'Identity &amp; contact checked — not a product certification';

function identityBadgeHtml(extraAttrs) {
  const attrs = extraAttrs ? ' ' + extraAttrs : '';
  return '<span class="v-badge identity"' + attrs + '>' + IDENTITY_BADGE_HTML + '</span>';
}

function manufacturerBadgeHtml(slug, doc) {
  if (!isVerifiedManufacturer(slug, doc)) return '';
  return '<p class="paid-badge-wrap"><span class="paid-badge" data-paid-badge="verified-manufacturer" data-company-slug="'
    + esc(slug) + '" style="text-transform:none;letter-spacing:0;white-space:normal">' + IDENTITY_BADGE_HTML + '</span> <span class="paid-badge-note">'
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

function checkoutCancelPath(product) {
  if (product === 'hosted_webinar') return '/sponsor.html#hosted-webinar';
  if (product === 'featured_exhibitor') return '/sponsor.html#contact';
  if (product === 'featured_event') return '/events.html#submit-event';
  if (product === 'job_standard' || product === 'job_featured' || product === 'job_bundle_5') return '/jobs.html#post';
  if (product === 'rfq_lead' || product === 'rfq_lead_pro' || product === 'supplier_pro') return '/rfq.html';
  if (product === 'featured_listing' || product === 'featured_verified') return '/pricing.html#featured-listings';
  if (product === 'component_sponsor') return '/components.html';
  if (product === 'buyer_guide_us_eu') return '/guides/us-eu-grid-equipment/';
  return '/claim-profile.html#claimForm';
}

/* Promo is appended only on the public button. The stored URL stays the classifier. */
function paymentButtonHref(product) {
  const spec = PAYMENT_LINKS[product];
  if (!spec || !spec.url) return '';
  if (!spec.promoCode) return spec.url;
  const join = spec.url.indexOf('?') === -1 ? '?' : '&';
  return spec.url + join + 'prefilled_promo_code=' + encodeURIComponent(spec.promoCode);
}

const JOBS_RFQ_GROUPS = {
  jobs: ['job_standard', 'job_featured', 'job_bundle_5'],
  rfq: ['rfq_lead', 'rfq_lead_pro'],
  supplier: ['supplier_pro']
};

function normalizeComponent(value) {
  const raw = String(value || '').trim().toLowerCase();
  const key = raw.replace(/[\s_-]+/g, '');
  if (key === 'coresteel') return 'coresteel';
  if (COMPONENT_LABELS[key]) return key;
  return null;
}

function componentLabel(value) {
  const key = normalizeComponent(value);
  return key ? COMPONENT_LABELS[key] : '';
}

function componentFromSession(session) {
  if (!session || typeof session !== 'object') return null;
  const meta = session.metadata || {};
  const fromMeta = normalizeComponent(meta.component);
  if (fromMeta) return fromMeta;
  const fields = Array.isArray(session.custom_fields) ? session.custom_fields : [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i] || {};
    if (String(field.key || '').trim().toLowerCase() !== 'component') continue;
    const dropdown = field.dropdown && field.dropdown.value;
    const text = field.text && field.text.value;
    const numeric = field.numeric && field.numeric.value;
    const found = normalizeComponent(dropdown || text || numeric);
    if (found) return found;
  }
  return null;
}

function listingDisplayName(row) {
  return String(row && row.company_name || '').trim();
}

function reviewedFeaturedRows(doc, country) {
  const rows = doc && Array.isArray(doc.listings) ? doc.listings : [];
  const want = String(country || '').trim().toLowerCase();
  return rows.filter(function (row) {
    if (!reviewed(row)) return false;
    if (row.product !== 'featured_listing' && row.product !== 'featured_verified') return false;
    if (!listingDisplayName(row)) return false;
    if (!want) return true;
    const got = String(row.country || row.country_name || '').trim().toLowerCase();
    const slug = String(row.country_slug || '').trim().toLowerCase();
    return got === want || slug === slugify(want);
  });
}

function reviewedSponsor(doc, component) {
  const key = normalizeComponent(component);
  if (!key) return null;
  const rows = doc && Array.isArray(doc.listings) ? doc.listings : [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!reviewed(row) || row.product !== 'component_sponsor') continue;
    if (normalizeComponent(row.component) !== key) continue;
    if (!listingDisplayName(row)) continue;
    return row;
  }
  return null;
}

function companyLink(row) {
  const slug = companySlugFromReference(row && row.company_slug);
  const name = listingDisplayName(row);
  if (!name) return '';
  if (!slug) return '<b style="color:var(--ink)">' + esc(name) + '</b>';
  return '<a href="/manufacturers/' + esc(slug) + '/" style="color:var(--ink);font-weight:800">' + esc(name) + '</a>';
}

/* Honest featured slot. An empty directory shows "Your company here".
 * A company name is rendered only from a reviewed paid-listings row. */
function featuredListingSlotHtml(o) {
  o = o || {};
  const doc = o.doc || load();
  const scope = o.scope === 'country' ? 'country' : 'directory';
  const country = scope === 'country' ? String(o.country || '').trim() : '';
  const rows = reviewedFeaturedRows(doc, country);
  let body;
  if (!rows.length) {
    body = '<p class="tp-featured-placeholder" style="margin:0;font-size:1.05rem;font-weight:800;color:var(--ink)">Your company here</p>'
      + '<p style="color:var(--muted);font-size:.88rem;margin:6px 0 0">No company has bought this featured listing. The slot stays empty until a paid listing is reviewed. Featured is a paid placement, not a recommendation.</p>';
  } else {
    body = rows.map(function (row) {
      const tier = row.product === 'featured_verified' ? 'Featured + Verified' : 'Featured Listing';
      return '<p class="tp-featured-company" style="margin:0 0 6px"><span style="display:inline-block;background:var(--amber);color:var(--navy);font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px;margin-right:6px">Featured</span>'
        + companyLink(row) + ' <span style="color:var(--muted);font-size:.8rem">' + esc(tier) + '</span></p>';
    }).join('')
      + '<p style="color:var(--muted);font-size:.82rem;margin:8px 0 0">Featured is a paid placement, not a recommendation.</p>';
  }
  const listing = PAYMENT_LINKS.featured_listing;
  const verified = PAYMENT_LINKS.featured_verified;
  return '<section class="tp-featured-slot" data-featured-slot="' + esc(scope) + '"'
    + (country ? ' data-country="' + esc(country) + '"' : '')
    + ' aria-label="Featured" style="background:var(--card);border:1px solid var(--accent);border-radius:12px;padding:16px 18px;margin:16px 0">'
    + '<p style="margin:0 0 8px"><span style="display:inline-block;background:var(--amber);color:var(--navy);font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px">Featured</span></p>'
    + body
    + '<p style="margin:12px 0 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
    + '<a class="btn btn-amber btn-sm" href="' + esc(listing.url) + '" data-featured-listing-pay="1">Featured Listing — $299/yr plus tax</a>'
    + '<a class="btn btn-outline btn-sm" href="' + esc(verified.url) + '" data-featured-verified-pay="1">Featured + Verified — $699/yr plus tax</a>'
    + '<a href="/pricing.html#featured-listings" style="color:var(--accent);font-weight:700">Pricing</a>'
    + '</p></section>';
}

/* One empty sponsor block. The CTA is the live Component Sponsor Payment Link. */
function componentSponsorSectionHtml(o) {
  o = o || {};
  const key = normalizeComponent(o.component);
  if (!key) return '';
  const label = COMPONENT_LABELS[key];
  const doc = o.doc || load();
  const buyer = reviewedSponsor(doc, key);
  let body;
  if (buyer) {
    body = '<p class="tp-sponsor-name" style="margin:0;font-size:1.05rem">' + companyLink(buyer) + '</p>'
      + '<p style="color:var(--muted);font-size:.88rem;margin:6px 0 0">Sponsor for ' + esc(label) + '. This is a paid placement, not a recommendation.</p>';
  } else {
    body = '<p class="tp-sponsor-placeholder" style="margin:0;font-size:1.05rem;font-weight:800;color:var(--ink)">Your company here</p>'
      + '<p style="color:var(--muted);font-size:.88rem;margin:6px 0 0">This ' + esc(label) + ' section has no sponsor. The slot stays empty until a company pays and the listing is reviewed.</p>';
  }
  const pay = PAYMENT_LINKS.component_sponsor;
  return '<section class="tp-component-sponsor" data-component-sponsor="' + esc(key) + '" aria-label="' + esc(label) + ' sponsor" style="background:var(--card);border:1px dashed var(--accent);border-radius:12px;padding:16px 18px;margin:18px 0">'
    + '<h2 style="font-size:1.05rem;margin:0 0 8px;color:var(--ink)">Sponsor</h2>'
    + body
    + '<p style="margin:12px 0 0"><a class="btn btn-amber btn-sm" href="' + esc(pay.url) + '" data-component-sponsor-pay="' + esc(key) + '">Sponsor this section, $199/mo</a> <span style="color:var(--muted);font-size:.82rem">plus tax</span></p>'
    + '<p style="margin:8px 0 0"><a href="/pricing.html#component-sponsor" style="color:var(--accent);font-weight:700">Pricing</a></p>'
    + '</section>';
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
  VERIFIED_MANUFACTURER_PAYMENT_LINK: VERIFIED_MANUFACTURER_PAYMENT_LINK,
  VERIFIED_MANUFACTURER_AMOUNT_CENTS: VERIFIED_MANUFACTURER_AMOUNT_CENTS,
  VERIFIED_MANUFACTURER_SUCCESS_PATH: VERIFIED_MANUFACTURER_SUCCESS_PATH,
  isFeaturedEventCheckout: isFeaturedEventCheckout,
  isFeaturedExhibitorCheckout: isFeaturedExhibitorCheckout,
  isHostedWebinarCheckout: isHostedWebinarCheckout,
  isVerifiedManufacturerCheckout: isVerifiedManufacturerCheckout,
  listingProduct: listingProduct,
  listingFromLineItems: listingFromLineItems,
  checkoutCancelPath: checkoutCancelPath,
  paymentButtonHref: paymentButtonHref,
  JOBS_RFQ_GROUPS: JOBS_RFQ_GROUPS,
  returnQueryMatches: returnQueryMatches,
  companySlugFromReference: companySlugFromReference,
  featuredEventPayHtml: featuredEventPayHtml,
  featuredExhibitorPayHtml: featuredExhibitorPayHtml,
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
  IDENTITY_BADGE_TEXT: IDENTITY_BADGE_TEXT,
  IDENTITY_BADGE_HTML: IDENTITY_BADGE_HTML,
  identityBadgeHtml: identityBadgeHtml,
  manufacturerBadgeHtml: manufacturerBadgeHtml,
  featuredEventHtml: featuredEventHtml,
  checkoutWidget: checkoutWidget,
  applyVerifiedManufacturers: applyVerifiedManufacturers,
  COMPONENT_LABELS: COMPONENT_LABELS,
  DEFERRED_LISTING_PRODUCTS: DEFERRED_LISTING_PRODUCTS,
  LISTING_SETUP_MESSAGE: LISTING_SETUP_MESSAGE,
  normalizeComponent: normalizeComponent,
  componentLabel: componentLabel,
  componentFromSession: componentFromSession,
  featuredListingSlotHtml: featuredListingSlotHtml,
  componentSponsorSectionHtml: componentSponsorSectionHtml
};
