/* Netlify function: Stripe Checkout for Verified Manufacturer ($499),
 * Featured Event ($299), and Featured Exhibitor ($399). POST only.
 * GET returns 405. OPTIONS is CORS.
 *
 * Body: { product: "verified_manufacturer"|"featured_event"|"featured_exhibitor", company_slug?, event_id?, email }
 *
 * Env (names only — never commit values):
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_VERIFIED_MANUFACTURER
 *   STRIPE_PRICE_FEATURED_EVENT
 *   STRIPE_PRICE_FEATURED_EXHIBITOR
 *   SITE_URL   optional; defaults to https://transformerpath.com
 *
 * Missing Stripe env returns 503 { configured: false }. The button then uses
 * the existing email or form path. No charge is created in that case.
 */
'use strict';
const paid = require('../lib/paid-listings');

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function siteOrigin() {
  return (process.env.SITE_URL || 'https://transformerpath.com').trim().replace(/\/$/, '');
}

function missingConfig(product) {
  const missing = [];
  const secret = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) missing.push('STRIPE_SECRET_KEY');
  const priceEnv = paid.PRODUCTS[product] && paid.PRODUCTS[product].priceEnv;
  if (priceEnv && !(process.env[priceEnv] || '').trim()) missing.push(priceEnv);
  return missing;
}

exports.handler = async function (event) {
  if (!event || event.httpMethod === 'OPTIONS') return json(204, {});
  if (!event || event.httpMethod === 'GET') return json(405, { error: 'method not allowed' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'invalid json' }); }

  const product = String(body.product || '').trim();
  const spec = paid.PRODUCTS[product];
  if (!spec) return json(400, { error: 'unknown product' });

  const email = String(body.email || '').trim();
  if (!validEmail(email)) return json(400, { error: 'email required' });

  const companySlug = String(body.company_slug || '').trim();
  const eventId = String(body.event_id || '').trim();

  if (product === 'verified_manufacturer') {
    if (!companySlug) return json(400, { error: 'company_slug required' });
    if (!paid.knownCompanySlug(companySlug)) return json(400, { error: 'unknown slug' });
  }
  if (product === 'featured_event' || product === 'featured_exhibitor') {
    if (!eventId) return json(400, { error: 'event_id required' });
    if (!paid.knownEventId(eventId)) return json(400, { error: 'unknown event' });
  }

  const missing = missingConfig(product);
  if (missing.length) return json(503, { configured: false, missing: missing });

  const secret = process.env.STRIPE_SECRET_KEY.trim();
  const price = process.env[spec.priceEnv].trim();
  const origin = siteOrigin();
  const linkSpec = paid.PAYMENT_LINKS[product];
  const success = origin + linkSpec.successPath;
  const cancel = product === 'featured_exhibitor'
    ? origin + '/sponsor.html#contact'
    : product === 'featured_event'
      ? origin + '/events.html#submit-event'
      : origin + '/claim-profile.html#claimForm';

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('customer_email', email);
  form.set('success_url', success);
  form.set('cancel_url', cancel);
  form.set('line_items[0][price]', price);
  form.set('line_items[0][quantity]', '1');
  form.set('metadata[product]', product);
  if (companySlug) form.set('metadata[company_slug]', companySlug);
  if (eventId) form.set('metadata[event_id]', eventId);

  let res;
  try {
    res = await fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secret,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });
  } catch (e) {
    console.error('create-checkout network error');
    return json(502, { error: 'checkout_failed' });
  }

  let session;
  try { session = await res.json(); }
  catch (e) { session = null; }
  if (!res.ok || !session || !session.url || !session.id) {
    console.error('create-checkout stripe status', res.status);
    return json(502, { error: 'checkout_failed' });
  }

  return json(200, {
    configured: true,
    url: session.url,
    id: session.id,
    livemode: session.livemode === true
  });
};
