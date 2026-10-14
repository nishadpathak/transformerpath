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
function planFromAmount(cents) {
  if (cents === 19900) return 'learning';
  if (cents === 59900) return 'professional';
  if (cents === 199900) return 'team';
  return null;
}
function planFromCheckout(session) {
  if (session.metadata && (session.metadata.plan || session.metadata.product)) {
    const raw = String(session.metadata.plan || session.metadata.product).toLowerCase();
    if (raw === 'learner' || raw === 'learning') return 'learning';
    if (raw === 'professional') return 'professional';
    if (raw === 'team' || raw === 'enterprise') return 'team';
    return raw;
  }
  const cents = typeof session.amount_total === 'number' ? session.amount_total : null;
  if (cents != null) return planFromAmount(cents);
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

function verifySignature(payload, signatureHeader, secret, tolerance = 300) {
  if (!signatureHeader || typeof signatureHeader !== 'string') throw new Error('no signature header');
  const items = signatureHeader.split(',');
  let timestamp = null;
  const signatures = [];

  for (const item of items) {
    const parts = item.trim().split('=');
    if (parts[0] === 't') timestamp = parts[1];
    else if (parts[0] === 'v1') signatures.push(parts[1]);
  }

  if (!timestamp || !signatures.length) {
    throw new Error('missing timestamp or v1 signature');
  }

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) throw new Error('invalid timestamp');

  // Replay attack tolerance check (default 5 minutes = 300s)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) {
    throw new Error('timestamp outside tolerance');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  const matches = signatures.some(sig => {
    try {
      const givenBuf = Buffer.from(sig, 'hex');
      return givenBuf.length === expectedBuf.length && crypto.timingSafeEqual(givenBuf, expectedBuf);
    } catch (e) {
      return false;
    }
  });

  if (!matches) throw new Error('signature mismatch');
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

  if (!entitlement || (!entitlement.user_id && !entitlement.email)) {
    await markProcessed(ev.id);
    return respond(200, { received: true, skipped: 'no identity' });
  }
  await writeEntitlement(entitlement);
  await markProcessed(ev.id);
  return respond(200, { received: true });
}

// ── Event → entitlement mapping (server-side, verified data only) ───────────
function fromCheckout(session) {
  const plan = planFromCheckout(session);
  const meta = session.metadata || {};
  const userId = meta.user_id || session.client_reference_id || null;
  const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
  const starts = isoNow();
  const ends = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  return {
    user_id: userId,
    email: email,
    plan_id: plan, status: 'ACTIVE',
    starts_at: starts, expires_at: ends,
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
  const model = require('./lib/account-model');
  const plan = model.normalizePlan(e.plan_id) || model.normalizePlan('learning');
  let orgId = null;
  if (plan.product === 'team' && e.user_id) {
    try {
      const { data: existing } = await supabase.from('organization_members').select('org_id').eq('user_id', e.user_id).limit(1);
      if (existing && existing[0]) {
        orgId = existing[0].org_id;
        await supabase.from('organizations').update({ max_members: 10 }).eq('id', orgId);
      } else {
        const { data: org } = await supabase.from('organizations').insert({
          name: 'Team', kind: 'company', max_members: 10,
        }).select('id').maybeSingle();
        orgId = org && org.id;
        if (orgId) {
          await supabase.from('organization_members').upsert({
            user_id: e.user_id, org_id: orgId, org_role: 'owner',
          }, { onConflict: 'user_id,org_id' });
          await supabase.from('memberships').upsert({
            user_id: e.user_id, org_id: orgId, org_role: 'owner',
          }, { onConflict: 'user_id,org_id' });
        }
      }
    } catch (oe) { /* org tables may not exist until APPLY_SQL */ }
  }
  const row = {
    user_id: e.user_id || null,
    org_id: orgId,
    email: e.email || null,
    product: plan.product,
    plan: plan.label,
    plan_key: plan.product,
    access_start: e.starts_at || isoNow(),
    access_end: e.expires_at || null,
    expires_at: e.expires_at || null,
    status: e.status ? String(e.status).toLowerCase() : 'active'
  };
  const conflict = e.user_id ? 'user_id,product' : (e.email ? 'email,product' : undefined);
  try {
    if (conflict) await supabase.from('entitlements').upsert(row, { onConflict: conflict });
    else await supabase.from('entitlements').insert(row);
  } catch (ue) {
    try { await supabase.from('entitlements').insert(row); } catch (ie) { console.warn('entitlement write', ie.message); }
  }
  try {
    if (e.stripe_checkout_session_id) {
      await supabase.from('purchases').upsert({
        stripe_session_id: e.stripe_checkout_session_id,
        user_id: e.user_id || null,
        org_id: orgId,
        email: e.email || null,
        product: plan.product,
        plan: plan.label,
        status: 'paid',
      }, { onConflict: 'stripe_session_id' });
    }
  } catch (pe) { /* purchases table may not exist yet */ }
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
