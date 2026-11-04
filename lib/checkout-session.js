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

/* Used only when a Checkout Session cannot be opened. The stored Payment
 * Link is unchanged. Promo codes are not added here. */
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

async function stripeGet(path, secret, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch('https://api.stripe.com' + path, {
    headers: { Authorization: 'Bearer ' + secret }
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error('stripe');
    err.status = res.status;
    throw err;
  }
  return body;
}

async function listPaymentLinks(secret, fetchImpl) {
  const out = [];
  let startingAfter = '';
  for (let page = 0; page < 5; page++) {
    const path = '/v1/payment_links?limit=100' + (startingAfter ? '&starting_after=' + encodeURIComponent(startingAfter) : '');
    const body = await stripeGet(path, secret, fetchImpl);
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

async function priceForProduct(product, secret, fetchImpl) {
  const link = await linkForProduct(product, secret, fetchImpl);
  if (!link || !link.id) return null;
  const items = await stripeGet('/v1/payment_links/' + encodeURIComponent(link.id) + '/line_items?limit=5', secret, fetchImpl);
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
