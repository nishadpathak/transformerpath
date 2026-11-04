/* Email gate. Saves a checkout lead, then opens a Stripe Checkout Session
 * for the price already on the Payment Link. Payment Links cannot set
 * cancel_url. Verified, Featured, and Featured + Verified cancel to the
 * TransformerPath page the buyer came from, or to /pricing/ otherwise.
 * Promo codes are off. No new price, product, or coupon is created.
 *
 * Env: STRIPE_SECRET_KEY. Supabase is optional for the lead row
 * (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY).
 */
'use strict';

const { isConfigured, client } = require('./lib/supabase-server');
const gate = require('../lib/checkout-gate');
const emailGate = require('../checkout-email');
const checkoutSession = require('../lib/checkout-session');

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, accept',
      'access-control-allow-methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function header(event, name) {
  const headers = event && event.headers ? event.headers : {};
  const want = name.toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === want) return String(headers[keys[i]] || '');
  }
  return '';
}

function parseBody(event) {
  const raw = event && event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : String(event && event.body || '');
  const type = header(event, 'content-type');
  if (type.indexOf('application/json') !== -1) {
    try { return JSON.parse(raw || '{}'); }
    catch (e) { return {}; }
  }
  const params = new URLSearchParams(raw);
  const out = {};
  params.forEach(function (value, key) { out[key] = value; });
  return out;
}

function wantsJson(event) {
  const accept = header(event, 'accept');
  const type = header(event, 'content-type');
  return accept.indexOf('application/json') !== -1 || type.indexOf('application/json') !== -1;
}

async function insertLead(row) {
  if (!isConfigured()) return false;
  const supabase = client();
  const { error } = await supabase.from('checkout_leads').insert({
    email: row.email,
    listing_slug: row.listing_slug,
    product_name: row.product_name,
    price_id: row.price_id,
    page_path: row.page_path
  });
  if (error) throw new Error('checkout_leads insert failed');
  return true;
}

function stripeSecret() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

async function openSession(opts) {
  const secret = stripeSecret();
  if (!secret) {
    const err = new Error('missing');
    err.missing = ['STRIPE_SECRET_KEY'];
    throw err;
  }
  const price = await checkoutSession.priceForProduct(opts.product, secret, opts.fetchImpl);
  if (!price) {
    const err = new Error('price');
    throw err;
  }
  const form = checkoutSession.sessionFields({
    product: opts.product,
    email: opts.email,
    priceId: price.priceId,
    slug: opts.slug,
    event: opts.eventId,
    component: opts.component,
    from: opts.from,
    automaticTax: price.automaticTax,
    billingAddressCollection: price.billingAddressCollection,
    metadata: price.metadata
  });
  if (!form) {
    const err = new Error('fields');
    throw err;
  }
  const res = await (opts.fetchImpl || fetch)(STRIPE_API, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + secret,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  const session = await res.json();
  if (!res.ok || !session || !session.url) {
    const err = new Error('stripe');
    err.status = res.status;
    throw err;
  }
  return { url: session.url, priceId: price.priceId };
}

exports.handler = async function (event) {
  if (!event || event.httpMethod === 'OPTIONS') return json(204, {});
  if (!event || event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const body = parseBody(event);
  const query = event.queryStringParameters || {};
  const product = String(body.product || query.product || '').trim();
  const email = String(body.email || query.email || '').trim();
  const slug = gate.cleanSlug(body.slug || query.slug);
  const eventId = gate.cleanSlug(body.event || query.event);
  const component = gate.cleanSlug(body.component || query.component);
  const from = String(body.from || query.from || '').trim();
  if (!gate.gateQuery({ product: product })) return json(400, { error: 'unknown product' });
  if (!emailGate.validEmail(email)) return json(400, { error: 'email required' });

  let opened;
  let usedPaymentLink = false;
  let fallbackReason = '';
  try {
    opened = await openSession({
      product: product,
      email: email,
      slug: slug,
      eventId: eventId,
      component: component,
      from: from
    });
  } catch (err) {
    const fallback = checkoutSession.paymentLinkFallback(product, {
      slug: slug,
      event: eventId,
      email: email
    });
    if (!fallback) return json(502, { error: 'checkout_failed' });
    opened = { url: fallback, priceId: gate.codeOf(fallback) };
    usedPaymentLink = true;
    if (err && err.missing) fallbackReason = 'missing_key';
    else if (err && err.message === 'price') fallbackReason = 'no_price';
    else if (err && err.status) fallbackReason = 'stripe_' + err.status;
    else fallbackReason = 'stripe_error';
    console.warn('checkout session skipped; using Payment Link; reason=' + fallbackReason);
  }

  const row = emailGate.leadRow({
    email: email,
    listingSlug: slug || eventId || component,
    productName: product,
    priceId: opened.priceId,
    pagePath: '/checkout/?product=' + product
  });
  let saved = false;
  try { saved = await insertLead(row); }
  catch (e) { saved = false; }

  if (wantsJson(event)) {
    const payload = { url: opened.url, saved: saved, payment_link: usedPaymentLink };
    if (fallbackReason) payload.fallback_reason = fallbackReason;
    return json(200, payload);
  }
  return {
    statusCode: 302,
    headers: { Location: opened.url, 'cache-control': 'no-store' },
    body: ''
  };
};

exports._openSessionForTests = openSession;
