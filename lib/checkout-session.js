/* Checkout Session fields for the email gate.
 * Payment Links cannot set cancel_url. The session uses the price already
 * on that link. Promo codes stay off. Verified, Featured, and
 * Featured + Verified cancel to the TransformerPath page the buyer left,
 * or to https://transformerpath.com/pricing/ when that page is not ours.
 */
'use strict';

const { PAYMENT_LINKS, PRODUCTS } = require('./paid-listings');
const { codeOf, cleanSlug } = require('./checkout-gate');

const ORIGIN = 'https://transformerpath.com';
const FALLBACK_CANCEL = ORIGIN + '/pricing/';
const RETURN_PRODUCTS = {
  verified_manufacturer: true,
  featured_listing: true,
  featured_verified: true
};

function modeFor(product) {
  const spec = PRODUCTS[product];
  if (spec && spec.mode) return spec.mode;
  return 'payment';
}

function safeReturnUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 500) return '';
  if (/[\s\\]/.test(raw) || raw.indexOf('\0') !== -1) return '';
  if (raw.indexOf('//') === 0) return '';
  let url;
  try {
    url = new URL(raw, ORIGIN);
  } catch (e) {
    return '';
  }
  if (url.protocol !== 'https:') return '';
  if (url.username || url.password) return '';
  if (url.hostname !== 'transformerpath.com') return '';
  if (url.port) return '';
  if (!url.pathname || url.pathname.charAt(0) !== '/') return '';
  if (url.pathname === '/checkout' || url.pathname.indexOf('/checkout/') === 0) return '';
  return url.origin + url.pathname + url.search + url.hash;
}

function cancelUrl(product, from) {
  if (!RETURN_PRODUCTS[product]) return FALLBACK_CANCEL;
  return safeReturnUrl(from) || FALLBACK_CANCEL;
}

function referenceFor(product, slug, eventId) {
  if (product === 'featured_event' || product === 'featured_exhibitor') return eventId || '';
  return slug || '';
}

/* Builds the old Payment Link URL. Buyers are not sent here. Those sessions
 * keep customer_email null and cancel_url at https://stripe.com. */
function paymentLinkFallback(product, opts) {
  opts = opts || {};
  const spec = PAYMENT_LINKS[product];
  if (!spec || !spec.url) return '';
  const params = new URLSearchParams();
  const ref = referenceFor(product, cleanSlug(opts.slug), cleanSlug(opts.event));
  if (ref) params.set('client_reference_id', ref);
  const email = String(opts.email || '').trim();
  if (email) params.set('prefilled_email', email);
  const qs = params.toString();
  if (!qs) return spec.url;
  const join = spec.url.indexOf('?') === -1 ? '?' : '&';
  return spec.url + join + qs;
}

function withoutFragment(value) {
  const raw = String(value || '');
  const hash = raw.indexOf('#');
  return hash === -1 ? raw : raw.slice(0, hash);
}

function sessionFields(opts) {
  opts = opts || {};
  const spec = PAYMENT_LINKS[opts.product];
  if (!spec || !spec.successPath || !opts.priceId) return null;
  const email = String(opts.email || '').trim();
  if (!email) return null;
  const form = new URLSearchParams();
  form.set('mode', modeFor(opts.product));
  form.set('customer_email', email);
  form.set('success_url', withoutFragment(ORIGIN + spec.successPath));
  form.set('cancel_url', withoutFragment(cancelUrl(opts.product, opts.from)));
  form.set('line_items[0][price]', opts.priceId);
  form.set('line_items[0][quantity]', '1');
  form.set('allow_promotion_codes', 'false');
  form.set('automatic_tax[enabled]', opts.automaticTax === true ? 'true' : 'false');
  if (opts.billingAddressCollection === 'auto' || opts.billingAddressCollection === 'required') {
    form.set('billing_address_collection', opts.billingAddressCollection);
  }
  const slug = cleanSlug(opts.slug);
  const eventId = cleanSlug(opts.event);
  const component = cleanSlug(opts.component);
  const ref = referenceFor(opts.product, slug, eventId);
  if (ref) form.set('client_reference_id', ref);
  const meta = opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : {};
  Object.keys(meta).forEach(function (key) {
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) return;
    const value = meta[key];
    if (value == null || typeof value === 'object') return;
    form.set('metadata[' + key + ']', String(value).slice(0, 500));
  });
  form.set('metadata[product]', opts.product);
  if (slug && opts.product !== 'featured_event' && opts.product !== 'featured_exhibitor') {
    form.set('metadata[company_slug]', slug);
  }
  if (eventId) form.set('metadata[event_id]', eventId);
  if (component) form.set('metadata[component]', component);
  return form;
}

function priceIdOf(item) {
  if (!item) return '';
  const price = item.price;
  if (typeof price === 'string') return price;
  if (price && typeof price.id === 'string') return price.id;
  return '';
}

function safeStripeCode(value) {
  const code = String(value || '');
  return /^[a-z0-9_]{1,64}$/.test(code) ? code : '';
}

async function stripeGet(path, secret, fetchImpl, step) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch('https://api.stripe.com' + path, {
    headers: { Authorization: 'Bearer ' + secret }
  });
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  if (!res.ok) {
    const err = new Error('stripe');
    err.status = res.status;
    err.step = step || 'stripe';
    err.code = safeStripeCode(body && body.error && body.error.code);
    throw err;
  }
  return body;
}

async function listPaymentLinks(secret, fetchImpl) {
  const out = [];
  let startingAfter = '';
  for (let page = 0; page < 5; page++) {
    const path = '/v1/payment_links?limit=100' + (startingAfter ? '&starting_after=' + encodeURIComponent(startingAfter) : '');
    const body = await stripeGet(path, secret, fetchImpl, 'payment_links');
    const rows = body && Array.isArray(body.data) ? body.data : [];
    rows.forEach(function (row) { out.push(row); });
    if (!body || body.has_more !== true || !rows.length) break;
    startingAfter = rows[rows.length - 1].id;
    if (!startingAfter) break;
  }
  return out;
}

async function linkForProduct(product, secret, fetchImpl) {
  const spec = PAYMENT_LINKS[product];
  const code = spec && codeOf(spec.url);
  if (!code) return null;
  const links = await listPaymentLinks(secret, fetchImpl);
  for (let i = 0; i < links.length; i++) {
    if (codeOf(links[i] && links[i].url) === code) return links[i];
  }
  return null;
}

async function priceFromPaymentLink(product, secret, fetchImpl) {
  const link = await linkForProduct(product, secret, fetchImpl);
  if (!link || !link.id) return null;
  const items = await stripeGet('/v1/payment_links/' + encodeURIComponent(link.id) + '/line_items?limit=5', secret, fetchImpl, 'line_items');
  const row = items && Array.isArray(items.data) ? items.data[0] : null;
  const priceId = priceIdOf(row);
  if (!priceId) return null;
  const tax = link.automatic_tax && link.automatic_tax.enabled === true;
  const billing = link.billing_address_collection === 'auto' || link.billing_address_collection === 'required'
    ? link.billing_address_collection
    : (tax ? 'required' : '');
  return {
    priceId: priceId,
    automaticTax: tax,
    billingAddressCollection: billing,
    metadata: link.metadata || {}
  };
}

/* Used when the Payment Link list is forbidden. The active price on the
 * product already attached to that link is the same price. Every live
 * TransformerPath Payment Link has automatic tax on and billing address
 * collection set to auto, so a recovered session keeps those settings.
 * More than one active price is refused so a different price cannot be chosen. */
async function priceFromCatalog(product, secret, fetchImpl) {
  const spec = PAYMENT_LINKS[product];
  const envName = PRODUCTS[product] && PRODUCTS[product].priceEnv;
  const fromEnv = envName ? String(process.env[envName] || '').trim() : '';
  if (/^price_[A-Za-z0-9]+$/.test(fromEnv)) {
    return { priceId: fromEnv, automaticTax: true, billingAddressCollection: 'auto', metadata: {} };
  }
  const productId = spec && spec.productId;
  if (!productId) return null;
  const body = await stripeGet('/v1/prices?active=true&limit=5&product=' + encodeURIComponent(productId), secret, fetchImpl, 'prices');
  const rows = body && Array.isArray(body.data) ? body.data : [];
  const ids = [];
  rows.forEach(function (row) {
    if (row && row.active !== false && typeof row.id === 'string' && /^price_[A-Za-z0-9]+$/.test(row.id)) ids.push(row.id);
  });
  if (ids.length !== 1) return null;
  return { priceId: ids[0], automaticTax: true, billingAddressCollection: 'auto', metadata: {} };
}

async function priceForProduct(product, secret, fetchImpl) {
  try {
    const fromLink = await priceFromPaymentLink(product, secret, fetchImpl);
    if (fromLink) return fromLink;
  } catch (err) {
    const fromCatalog = await priceFromCatalog(product, secret, fetchImpl).catch(function () { return null; });
    if (fromCatalog) return fromCatalog;
    throw err;
  }
  return priceFromCatalog(product, secret, fetchImpl);
}

module.exports = {
  FALLBACK_CANCEL: FALLBACK_CANCEL,
  RETURN_PRODUCTS: RETURN_PRODUCTS,
  safeReturnUrl: safeReturnUrl,
  cancelUrl: cancelUrl,
  paymentLinkFallback: paymentLinkFallback,
  sessionFields: sessionFields,
  priceForProduct: priceForProduct,
  priceIdOf: priceIdOf
};
