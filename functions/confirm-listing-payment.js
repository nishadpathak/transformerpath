// Confirm a listing Checkout Session with Stripe before any page may say
// "payment received". A session_id in the query string is not proof.
//
// When STRIPE_SECRET_KEY is unset this returns configured:false and paid:false.
// It never writes a badge, never grants course access, and never treats the
// request body as a payment.

const STRIPE_API = 'https://api.stripe.com/v1';
const { listingProduct, componentFromSession } = require('../lib/paid-listings');

const PRODUCTS = {
  verified_manufacturer: true,
  featured_event: true,
  featured_exhibitor: true,
  hosted_webinar: true,
  job_standard: true,
  job_featured: true,
  job_bundle_5: true,
  rfq_lead: true,
  rfq_lead_pro: true,
  supplier_pro: true,
  featured_listing: true,
  featured_verified: true,
  component_sponsor: true,
  dga_report: true,
  report_template: true,
  template_bundle: true,
  commissioning_job_post: true
};

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

function readRequest(event) {
  let body = {};
  if (event && event.body) {
    try { body = JSON.parse(event.body); } catch (e) { body = {}; }
  }
  const q = (event && event.queryStringParameters) || {};
  return {
    sessionId: String((body && body.session_id) || q.session_id || '').trim(),
    product: String((body && body.product) || q.product || '').trim()
  };
}

exports.handler = async function (event) {
  const method = event && event.httpMethod;
  if (method !== 'GET' && method !== 'POST') {
    return json(405, { error: 'Method not allowed', configured: false, paid: false });
  }

  const secret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const req = readRequest(event);
  if (!PRODUCTS[req.product]) {
    return json(400, { configured: !!secret, paid: false, error: 'product required' });
  }
  if (!req.sessionId || req.sessionId.indexOf('{') !== -1) {
    return json(400, { configured: !!secret, paid: false, error: 'session_id required' });
  }
  if (!secret) {
    return json(200, { configured: false, paid: false, product: null });
  }

  try {
    const res = await fetch(STRIPE_API + '/checkout/sessions/' + encodeURIComponent(req.sessionId) + '?expand[]=payment_link&expand[]=line_items&expand[]=line_items.data.price.product', {
      headers: { Authorization: 'Bearer ' + secret }
    });
    const session = await res.json();
    if (!res.ok || !session || typeof session !== 'object') {
      return json(200, { configured: true, paid: false, product: null, reason: 'stripe_error' });
    }
    const listing = listingProduct(session);
    const paid = session.payment_status === 'paid' && listing === req.product;
    return json(200, {
      configured: true,
      paid: paid === true,
      product: listing || null,
      component: componentFromSession(session)
    });
  } catch (e) {
    return json(200, { configured: true, paid: false, product: null, reason: 'stripe_error' });
  }
};
