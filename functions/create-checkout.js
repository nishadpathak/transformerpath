/* POST /.netlify/functions/create-checkout
 *
 * Account-first Stripe Checkout:
 *   CREATE ACCOUNT → USER → CHOOSE PLAN → STRIPE SESSION → WEBHOOK
 *   → PURCHASE → ENTITLEMENT → MY TRANSFORMERPATH
 *
 * Requires a Supabase Bearer token. Browser Payment Links remain a fallback
 * on pricing.html when this function is unconfigured.
 *
 * Body: { plan: "learning" | "professional" | "team" }
 * Env: STRIPE_SECRET_KEY, SITE_URL (optional; Netlify URL / DEPLOY_PRIME_URL used)
 */
'use strict';
const { isConfigured, client } = require('./lib/supabase-server');
const model = require('./lib/account-model');

const SK = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';

function respond(code, obj) {
  return {
    statusCode: code,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(obj),
  };
}

function originFrom(event) {
  const h = event.headers || {};
  const fromHeader = h.origin || h.Origin || (h['x-forwarded-proto'] && h.host
    ? (h['x-forwarded-proto'] + '://' + (h['x-forwarded-host'] || h.host))
    : '');
  const env = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || '';
  const raw = String(fromHeader || env || 'https://transformerpath.com').replace(/\/$/, '');
  if (!/^https?:\/\//i.test(raw)) return 'https://transformerpath.com';
  return raw;
}

function bearer(event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  if (h.toLowerCase().indexOf('bearer ') === 0) return h.slice(7).trim();
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(204, {});
  if (event.httpMethod === 'GET') {
    return respond(200, {
      configured: Boolean(SK && isConfigured()),
      plans: ['learning', 'professional', 'team'],
      flow: 'CREATE ACCOUNT → USER → CHOOSE PLAN → STRIPE → WEBHOOK → PURCHASE → ENTITLEMENT → MY TRANSFORMERPATH',
    });
  }
  if (event.httpMethod !== 'POST') return respond(405, { error: 'method not allowed' });
  if (!SK) return respond(200, { ok: false, configured: false, reason: 'stripe_not_configured' });
  if (!isConfigured()) return respond(200, { ok: false, configured: false, reason: 'supabase_not_configured' });

  const token = bearer(event);
  const supabase = client();
  const { data: authData, error: authErr } = await supabase.auth.getUser(token || '');
  const user = authData && authData.user;
  if (authErr || !user) return respond(401, { ok: false, error: 'sign_in_required' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return respond(400, { error: 'invalid json' }); }
  const plan = model.normalizePlan(body.plan || body.product || 'learning');
  if (!plan) return respond(400, { error: 'unknown plan' });

  const origin = originFrom(event);
  const success = origin + '/workspace.html?session_id={CHECKOUT_SESSION_ID}&view=account';
  const cancel = origin + '/pricing.html?cancelled=1';

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', success);
  params.set('cancel_url', cancel);
  params.set('client_reference_id', user.id);
  params.set('customer_email', user.email || '');
  params.set('metadata[user_id]', user.id);
  params.set('metadata[plan]', plan.product);
  params.set('metadata[product]', plan.product);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(plan.price_cents));
  params.set('line_items[0][price_data][product_data][name]', 'TransformerPath ' + plan.label);
  params.set('line_items[0][price_data][product_data][description]',
    plan.product === 'team'
      ? 'Team plan — organization entitlement, up to 10 seats, 12 months. Each person signs in with their own account.'
      : plan.label + ' plan — account entitlement, 12 months. Sign in on any device.');

  try {
    const res = await fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + SK,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await res.json();
    if (!res.ok || !session.url) {
      return respond(200, { ok: false, reason: 'stripe_error', detail: session && session.error && session.error.message });
    }
    return respond(200, {
      ok: true,
      url: session.url,
      session_id: session.id,
      plan: plan.product,
      user_id: user.id,
    });
  } catch (e) {
    return respond(200, { ok: false, reason: 'error', detail: String(e && e.message) });
  }
};
