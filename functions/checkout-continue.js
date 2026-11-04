/* Email gate for Stripe Payment Links.
 * POST { product, email, slug?, event?, component? }
 * Inserts checkout_leads when Supabase is configured, then sends the
 * buyer to the existing Payment Link. A failed insert still continues.
 * Does not create a price, product, coupon, or Payment Link.
 *
 * Browser JSON callers send Accept: application/json and get { url, saved }.
 * A plain form POST gets a 302.
 *
 * Env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.
 * The anon key is not read here. The browser reads SUPABASE_URL and
 * SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY from supabase-config.js.
 */
'use strict';

const { isConfigured, client } = require('./lib/supabase-server');
const gate = require('../lib/checkout-gate');
const emailGate = require('../checkout-email');

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
  if (!gate.gateQuery({ product: product })) return json(400, { error: 'unknown product' });
  if (!emailGate.validEmail(email)) return json(400, { error: 'email required' });

  const url = gate.paymentUrl(product, { slug: slug, event: eventId, email: email });
  if (!url) return json(400, { error: 'unknown product' });

  const row = emailGate.leadRow({
    email: email,
    listingSlug: slug || eventId || component,
    productName: product,
    priceId: gate.codeOf(url),
    pagePath: '/checkout/?product=' + product
  });
  let saved = false;
  try { saved = await insertLead(row); }
  catch (e) { saved = false; }

  if (wantsJson(event)) return json(200, { url: url, saved: saved });
  return {
    statusCode: 302,
    headers: { Location: url, 'cache-control': 'no-store' },
    body: ''
  };
};
