/* Netlify function: Stripe Checkout for Verified Manufacturer ($499 one-time),
 * Featured Event ($299), Featured Exhibitor ($399), Hosted Webinar ($1,500),
 * and the jobs / RFQ products. POST only. GET returns 405. OPTIONS is CORS.
 *
 * Job and RFQ products stay closed unless TP_JOBS_RFQ_PAYMENTS is on (or the
 * file flag jobs_rfq_payments is true). Public pages use Payment Links, not
 * this function, and those buttons use the same switch.
 *
 * Body: { product, company_slug?, event_id?, email }
 * product is a key of lib/paid-listings PRODUCTS, including the six job and RFQ products.
 *
 * Env (names only — never commit values):
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_VERIFIED_MANUFACTURER
 *   STRIPE_PRICE_FEATURED_EVENT
 *   STRIPE_PRICE_FEATURED_EXHIBITOR
 *   STRIPE_PRICE_HOSTED_WEBINAR
 *   STRIPE_PRICE_JOB_STANDARD
 *   STRIPE_PRICE_JOB_FEATURED
 *   STRIPE_PRICE_JOB_BUNDLE_5
 *   STRIPE_PRICE_RFQ_LEAD
 *   STRIPE_PRICE_RFQ_LEAD_PRO
 *   STRIPE_PRICE_SUPPLIER_PRO
 *   TP_JOBS_RFQ_PAYMENTS   1/true/on enables job and RFQ checkout
 *   SITE_URL   optional; defaults to https://transformerpath.com
 *
 * Missing Stripe env returns 503 { configured: false }. The button then uses
 * the existing email or form path. No charge is created in that case.
 */
'use strict';
const paid = require('../lib/paid-listings');
const { jobsRfqPaymentsEnabled } = require('../lib/feature-flags');

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
  if (paid.JOBS_RFQ_GROUPS && (paid.JOBS_RFQ_GROUPS.jobs.indexOf(product) !== -1 || paid.JOBS_RFQ_GROUPS.rfq.indexOf(product) !== -1 || paid.JOBS_RFQ_GROUPS.supplier.indexOf(product) !== -1)) {
    if (!jobsRfqPaymentsEnabled()) return json(403, { configured: false, enabled: false, error: 'payments_disabled' });
  }

  const email = String(body.email || '').trim();
  if (!validEmail(email)) return json(400, { error: 'email required' });

  const companySlug = String(body.company_slug || '').trim();
  const eventId = String(body.event_id || '').trim();
  const component = paid.normalizeComponent(body.component);

  if (product === 'verified_manufacturer') {
    if (!companySlug) return json(400, { error: 'company_slug required' });
    if (!paid.knownCompanySlug(companySlug)) return json(400, { error: 'unknown slug' });
  }
  if (product === 'featured_event' || product === 'featured_exhibitor') {
    if (!eventId) return json(400, { error: 'event_id required' });
    if (!paid.knownEventId(eventId)) return json(400, { error: 'unknown event' });
  }
  if (product === 'component_sponsor' && !component) return json(400, { error: 'component required' });

  const missing = missingConfig(product);
  if (missing.length) return json(503, { configured: false, missing: missing });

  const secret = process.env.STRIPE_SECRET_KEY.trim();
  const price = process.env[spec.priceEnv].trim();
  const origin = siteOrigin();
  const linkSpec = paid.PAYMENT_LINKS[product];
  const success = origin + linkSpec.successPath;
  const cancel = origin + paid.checkoutCancelPath(product);

  const form = new URLSearchParams();
  form.set('mode', spec.mode || 'payment');
  form.set('customer_email', email);
  form.set('success_url', success);
  form.set('cancel_url', cancel);
  form.set('line_items[0][price]', price);
  form.set('line_items[0][quantity]', '1');
  form.set('metadata[product]', product);
  if (companySlug) form.set('metadata[company_slug]', companySlug);
  if (eventId) form.set('metadata[event_id]', eventId);
  if (component) form.set('metadata[component]', component);

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
