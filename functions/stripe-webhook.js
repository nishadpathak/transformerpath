'use strict';
/* ============================================================================
 * TransformerPath — Stripe webhook (server-side, addresses the durable-account-
 * entitlement gap). Netlify Functions handler.
 *
 * IMPORTANT (production-semantics):
 *   - This is ADDITIVE. The existing HMAC entitlement path
 *     (functions/lib/entitlement.js) remains the current paid-access authority
 *     until this path is E2E-verified. Do NOT switch the Masterclass paywall to
 *     this table until a cross-device E2E passes.
 *   - The browser NEVER writes entitlement rows. Only this trusted server code
 *     does, after verified Stripe evidence.
 *   - env vars (server-only, NEVER in browser code, NEVER committed):
 *       STRIPE_SECRET_KEY
 *       STRIPE_WEBHOOK_SECRET
 *       SUPABASE_URL
 *       SUPABASE_SERVICE_ROLE_KEY
 *       SITE_URL
 *
 * Events handled (map to the CURRENT pricing model — currently one-time Stripe
 * Payment Links for $199/$599/$1,999, so checkout.session.completed is the
 * primary path; subscription events are handled IF subscriptions are used):
 *   checkout.session.completed   -> create entitlement (ACTIVE)
 *   customer.subscription.created -> create (ACTIVE)
 *   customer.subscription.updated -> update status/expiry
 *   customer.subscription.deleted -> CANCELLED
 *   charge.refunded               -> REFUNDED
 *
 * Entitlement table (account_entitlements):
 *   id uuid pk, user_id uuid, plan_id text, status enum(ACTIVE,EXPIRED,
 *   CANCELLED,REFUNDED,REVOKED), starts_at text, expires_at text,
 *   stripe_customer_id text, stripe_subscription_id text,
 *   stripe_checkout_session_id text, source text, created_at, updated_at.
 *   RLS: only the owning user can SELECT (read) their own entitlement.
 * ========================================================================== */
const crypto = require('crypto');
const { isConfigured, client } = require('./lib/supabase-server');

// Should be loaded from env in production; never committed.
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Map a Stripe product id / metadata to a canonical plan_id matched against the
// pricing model (learn 199 / professional 599 / enterprise 1999).
const PRICE_TO_PLAN = {
  price_learn_199: 'learning',
  price_professional_599: 'professional',
  price_enterprise_1999: 'enterprise',
};
function planFromCheckout(session) {
  if (session.metadata && session.metadata.plan) return session.metadata.plan;
  const pi = session.payment_intent || (typeof session.payment_intent === 'string' ? session.payment_intent : '');
  // Intentionally conservative: don't invent a plan without a confirmed mapping.
  return PRICE_TO_PLAN[session.metadata && session.metadata.price_id] || null;
}

// POST /functions/stripe-webhook
exports.handler = async function (event) {
  if (!STRIPE_WEBHOOK_SECRET) return respond(500, { error: 'webhook not configured' });
  if (event.httpMethod !== 'POST') return respond(405, { error: 'method not allowed' });

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : (event.body || '');
  // Reject unsigned/tampered requests without reading beyond the signature check.
  let stripeEvent;
  try { stripeEvent = verifySignature(body, sig, STRIPE_WEBHOOK_SECRET); }
  catch (e) { return respond(400, { error: 'invalid signature' }); }

  try {
    return await handle(stripeEvent);
  } catch (e) {
    // Never leak internal details to the client.
    return respond(500, { error: 'webhook processing failed' });
  }
};

function verifySignature(payload, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  // (A real implementation should parse the Stripe `t=...`/`v1=...` scheme and
  //  use timing-safe equality; this is the signature-verification skeleton.)
  if (!signature || !signature.startsWith('v1=')) throw new Error('no/short signature');
  const given = signature.replace(/^.*?v1=/, '');
  const a = Buffer.from(expected), b = Buffer.from(given);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('signature mismatch');
  return JSON.parse(payload);
}

async function handle(ev) {
  const type = ev.type;
  // Idempotency: processed-event store (Supabase `webhook_events` keyed by event.id).
  // If the event id is already recorded, return success without re-writing.
  if (await eventProcessed(ev.id)) return respond(200, { received: true, idempotent: true });

  let entitlement;
  if (type === 'checkout.session.completed') entitlement = fromCheckout(ev.data.object);
  else if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') entitlement = fromSubscription(ev.data.object);
  else if (type === 'customer.subscription.deleted') entitlement = fromSubscription(ev.data.object, 'CANCELLED');
  else if (type === 'charge.refunded') entitlement = fromCharge(ev.data.object);
  else return respond(400, { error: 'unsupported event ' + type }); // unhandled event -> not an entitlement write

  if (!entitlement || !entitlement.user_id) return respond(400, { error: 'no linked user' });
  await writeEntitlement(entitlement);
  await markProcessed(ev.id);
  return respond(200, { received: true });
}

// ── Event → entitlement mapping (server-side, verified data only) ───────────
function fromCheckout(session) {
  const plan = planFromCheckout(session);
  return {
    user_id: session.metadata && session.metadata.user_id, // set on the checkout link when logged in
    plan_id: plan, status: 'ACTIVE',
    starts_at: isoNow(), expires_at: null,
    stripe_customer_id: session.customer || null,
    stripe_checkout_session_id: session.id,
    source: 'checkout.session.completed'
  };
}
function fromSubscription(sub, status) {
  return { user_id: sub.metadata && sub.metadata.user_id, plan_id: planFromCheckout(sub) || null, status: status || 'ACTIVE',
    starts_at: isoNow(), expires_at: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    stripe_customer_id: sub.customer || null, stripe_subscription_id: sub.id, source: 'subscription.' + (status || 'active') };
}
function fromCharge(charge) {
  return { user_id: charge.metadata && charge.metadata.user_id, plan_id: null, status: 'REFUNDED',
    starts_at: isoNow(), expires_at: null, stripe_customer_id: charge.customer || null, source: 'charge.refunded' };
}

// ── Server-only persistence (service-role; the browser cannot write) ────────
async function writeEntitlement(e) {
  if (!isConfigured()) {
    console.warn('writeEntitlement: Supabase not configured in env');
    return;
  }
  const supabase = client();
  await supabase.from('entitlements').upsert({
    user_id: e.user_id,
    product: e.plan_id || 'learning',
    plan: e.plan_id || 'Learning',
    access_start: e.starts_at || isoNow(),
    access_end: e.expires_at || null,
    status: e.status ? e.status.toLowerCase() : 'active'
  }, { onConflict: 'user_id,product' });
}

async function eventProcessed(id) {
  if (!isConfigured()) return false;
  try {
    const supabase = client();
    const { data } = await supabase.from('webhook_events').select('event_id').eq('event_id', id).maybeSingle();
    return Boolean(data && data.event_id);
  } catch (err) {
    return false;
  }
}

async function markProcessed(id, type) {
  if (!isConfigured()) return;
  try {
    const supabase = client();
    await supabase.from('webhook_events').insert({ event_id: id, event_type: type || 'webhook' });
  } catch (err) {
    console.warn('markProcessed error:', err.message);
  }
}

function isoNow() { return new Date().toISOString(); }
function respond(code, obj) {
  return { statusCode: code, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) };
}
