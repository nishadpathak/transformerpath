/* Email gate. Saves a checkout lead, then opens a Stripe Checkout Session
 * for the price already on the Payment Link. The buyer is sent only to that
 * session, which carries customer_email and a TransformerPath cancel_url.
 * When Stripe refuses POST /v1/checkout/sessions, payment still opens on the
 * existing Payment Link with prefilled_email and client_reference_id.
 * Promo codes are off. No new price, product, or coupon is created.
 *
 * Env: STRIPE_SECRET_KEY. A lead row also needs SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY. When those are unset the
 * session email is still required before payment opens.
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
  if (typeof exports._leadInsertForTests === 'function') {
    const out = await exports._leadInsertForTests(row);
    if (!out || out.saved !== true) throw new Error('checkout_leads insert failed');
    return { saved: true, configured: true };
  }
  if (!isConfigured()) return { saved: false, configured: false };
  const supabase = client();
  const { error } = await supabase.from('checkout_leads').insert({
    email: row.email,
    listing_slug: row.listing_slug,
    product_name: row.product_name,
    price_id: row.price_id,
    page_path: row.page_path
  });
  if (error) throw new Error('checkout_leads insert failed');
  return { saved: true, configured: true };
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
  let session = null;
  try { session = await res.json(); } catch (e) { session = null; }
  if (!res.ok || !session || !session.url) {
    const err = new Error('stripe');
    err.status = res.status;
    err.step = 'session';
    const code = session && session.error && session.error.code;
    if (typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code)) err.code = code;
    throw err;
  }
  return { url: session.url, priceId: price.priceId };
}

function buyerMessage(kind) {
  if (kind === 'lead') return 'We could not save your email, so payment did not start. Try again, or email hello@transformerpath.com.';
  return 'Checkout could not be opened, so payment did not start. Try again, or email hello@transformerpath.com.';
}

function safeToken(value) {
  const s = String(value || '');
  return /^[a-z0-9_]{1,64}$/.test(s) ? s : '';
}

function sessionUrlOk(url) {
  try {
    const parsed = new URL(String(url || ''));
    return parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com';
  } catch (e) {
    return false;
  }
}

function failure(event, statusCode, error, extra) {
  extra = extra || {};
  const payload = {
    error: error,
    saved: extra.saved === true,
    payment_link: false,
    message: extra.message
  };
  if (extra.missing) payload.missing = extra.missing;
  if (extra.stripe_code) payload.stripe_code = extra.stripe_code;
  if (extra.step) payload.step = extra.step;
  if (!wantsJson(event)) {
    return {
      statusCode: statusCode,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      },
      body: '<!doctype html><meta charset="utf-8"><title>Checkout</title><p>' + payload.message + '</p><p><a href="/pricing.html">Back to pricing</a></p>'
    };
  }
  return json(statusCode, payload);
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

  const row = emailGate.leadRow({
    email: email,
    listingSlug: slug || eventId || component,
    productName: product,
    priceId: '',
    pagePath: '/checkout/?product=' + product
  });
  let lead;
  try {
    lead = await insertLead(row);
  } catch (e) {
    console.warn('checkout lead save failed');
    return failure(event, 502, 'lead_not_saved', { saved: false, message: buyerMessage('lead') });
  }

  let opened;
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
    const step = safeToken(err && (err.missing ? 'config' : (err.step || (err.message === 'price' ? 'price' : ''))));
    const stripeCode = safeToken(err && (err.missing ? 'missing_key' : err.code));
    const status = err && err.status ? String(err.status) : '';
    console.warn('checkout session failed step=' + (step || 'unknown') + ' status=' + (status || 'none') + ' code=' + (stripeCode || 'none'));
    if (err && err.missing) {
      return failure(event, 503, 'not_configured', {
        saved: !!(lead && lead.saved),
        message: buyerMessage('stripe'),
        missing: err.missing
      });
    }
    if (err && err.step === 'session') {
      const fallbackUrl = checkoutSession.paymentLinkFallback(product, {
        email: email,
        slug: slug,
        event: eventId
      });
      if (fallbackUrl.indexOf('https://buy.stripe.com/') === 0) {
        const reason = status === '403' ? 'stripe_403' : (stripeCode === 'more_permissions_required' ? 'more_permissions_required' : (status ? 'stripe_' + status : 'stripe_error'));
        console.warn('checkout session skipped; using Payment Link; reason=' + reason);
        if (wantsJson(event)) {
          return json(200, {
            url: fallbackUrl,
            saved: !!(lead && lead.saved),
            payment_link: true,
            fallback_reason: reason
          });
        }
        return {
          statusCode: 302,
          headers: { Location: fallbackUrl, 'cache-control': 'no-store' },
          body: ''
        };
      }
    }
    const extra = { saved: !!(lead && lead.saved), message: buyerMessage('stripe') };
    if (stripeCode) extra.stripe_code = stripeCode;
    if (step) extra.step = step;
    return failure(event, 502, 'checkout_failed', extra);
  }

  if (!opened || !sessionUrlOk(opened.url)) {
    console.warn('checkout session failed step=session status=none code=bad_url');
    return failure(event, 502, 'checkout_failed', { saved: !!(lead && lead.saved), message: buyerMessage('stripe') });
  }

  if (wantsJson(event)) {
    return json(200, { url: opened.url, saved: !!(lead && lead.saved), payment_link: false });
  }
  return {
    statusCode: 302,
    headers: { Location: opened.url, 'cache-control': 'no-store' },
    body: ''
  };
};

exports._openSessionForTests = openSession;
