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
const { sendPaidReceipts } = require('./lib/paid-receipt');
const { sendKind } = require('./lib/verified-mail');
const paidListings = require('../lib/paid-listings');
const digitalProducts = require('../lib/digital-products');
const { listingProduct, companySlugFromReference, componentFromSession } = paidListings;

const PAID_LISTING_PRODUCTS = {
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
  component_sponsor: true
};

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

function paidListingProduct(session) {
  const product = listingProduct(session);
  if (PAID_LISTING_PRODUCTS[product]) return product;
  return null;
}

function digitalProduct(session) {
  const product = listingProduct(session);
  if (digitalProducts[product]) return product;
  return null;
}

function paidListingRow(session) {
  const meta = session.metadata || {};
  const product = paidListingProduct(session);
  let companySlug = meta.company_slug || null;
  if (!companySlug && product === 'verified_manufacturer') {
    companySlug = companySlugFromReference(session.client_reference_id);
  }
  return {
    session_id: session.id,
    product: product,
    company_slug: companySlug,
    event_id: meta.event_id || null,
    email: session.customer_email || (session.customer_details && session.customer_details.email) || null,
    amount: typeof session.amount_total === 'number' ? session.amount_total : null,
    currency: session.currency || null,
    livemode: session.livemode === true,
    status: 'paid_pending_verification',
    component: componentFromSession(session),
    created_at: isoNow()
  };
}

let persistenceOverride = null;
function persistence() {
  if (persistenceOverride) return persistenceOverride;
  return {
    eventProcessed: eventProcessed,
    markProcessed: markProcessed,
    writeEntitlement: writeEntitlement,
    writePaidListing: writePaidListing,
    updatePaidListingStatus: updatePaidListingStatus
  };
}

function listingRefundFromCharge(charge) {
  const meta = charge && charge.metadata ? charge.metadata : {};
  if (!PAID_LISTING_PRODUCTS[meta.product]) return null;
  const sessionId = String(meta.session_id || meta.checkout_session_id || '').trim();
  if (!sessionId) return null;
  const billing = charge.billing_details || {};
  return {
    session_id: sessionId,
    product: meta.product,
    email: charge.receipt_email || billing.email || meta.email || null,
    company_slug: meta.company_slug || null
  };
}

async function handle(ev) {
  const type = ev.type;
  const store = persistence();
  // Idempotency: processed-event store (Supabase `webhook_events` keyed by event.id).
  // If the event id is already recorded, return success without re-writing.
  if (await store.eventProcessed(ev.id)) return respond(200, { received: true, idempotent: true });

  if (type === 'checkout.session.expired') {
    try { await store.markProcessed(ev.id, type); } catch (markErr) { /* abandoned checkout has no row */ }
    return respond(200, { received: true, abandoned: true, stored: false });
  }

  if (type === 'charge.refunded') {
    const refund = listingRefundFromCharge(ev.data && ev.data.object);
    if (refund) {
      if (typeof store.updatePaidListingStatus !== 'function') {
        return respond(500, { error: 'paid listing not stored' });
      }
      try {
        await store.updatePaidListingStatus(refund.session_id, 'refunded');
      } catch (err) {
        console.warn('paid listing refund failed');
        return respond(500, { error: 'paid listing not stored' });
      }
      if (refund.product === 'verified_manufacturer') {
        const notice = await sendKind('refund', refund);
        if (notice && notice.retry) return respond(500, { error: 'receipt failed' });
      }
      await store.markProcessed(ev.id, type);
      return respond(200, { received: true, refunded: true });
    }
  }

  if (type === 'checkout.session.completed' && digitalProduct(ev.data && ev.data.object)) {
    const session = ev.data.object;
    const product = digitalProduct(session);
    console.log(JSON.stringify({
      msg: 'digital product received; supabase not required',
      event_id: ev.id,
      type: type,
      product: product,
      session_id: session.id
    }));
    try { await store.markProcessed(ev.id, type); } catch (markErr) { /* acknowledge either way */ }
    return respond(200, { received: true, digital_product: product, stored: false });
  }

  if (type === 'checkout.session.completed' && paidListingProduct(ev.data && ev.data.object)) {
    const row = paidListingRow(ev.data.object);
    try {
      await store.writePaidListing(row);
    } catch (err) {
      // These three products have no Supabase table ready. Log the paid event
      // and acknowledge it so Stripe does not retry a 500. Other products
      // still fail closed until the row is stored.
      if (paidListings.DEFERRED_LISTING_PRODUCTS[row.product] && err && err.code === 'not_configured') {
        console.log(JSON.stringify({
          msg: 'paid listing received; supabase not configured',
          event_id: ev.id,
          type: type,
          product: row.product,
          session_id: row.session_id,
          component: row.component || null,
          buyer_message: paidListings.LISTING_SETUP_MESSAGE
        }));
        try { await store.markProcessed(ev.id, type); } catch (markErr) { /* log already recorded the event */ }
        return respond(200, { received: true, paid_listing: true, stored: false });
      }
      console.warn('paid listing write failed');
      return respond(500, { error: 'paid listing not stored' });
    }
    const receipt = await sendPaidReceipts(row);
    if (receipt && receipt.retry) return respond(500, { error: 'receipt failed' });
    await store.markProcessed(ev.id, type);
    return respond(200, { received: true, paid_listing: true });
  }

  let entitlement;
  if (type === 'checkout.session.completed') entitlement = fromCheckout(ev.data.object);
  else if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') entitlement = fromSubscription(ev.data.object);
  else if (type === 'customer.subscription.deleted') entitlement = fromSubscription(ev.data.object, 'CANCELLED');
  else if (type === 'charge.refunded') entitlement = fromCharge(ev.data.object);
  else return respond(200, { received: true, ignored: type });

  if (!entitlement || !entitlement.user_id) return respond(400, { error: 'no linked user' });
  await store.writeEntitlement(entitlement);
  await store.markProcessed(ev.id, type);
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

async function writePaidListing(row) {
  if (!isConfigured()) {
    const err = new Error('paid_listings store not configured');
    err.code = 'not_configured';
    throw err;
  }
  const supabase = client();
  const payload = {
    session_id: row.session_id,
    product: row.product,
    company_slug: row.company_slug || null,
    event_id: row.event_id || null,
    email: row.email || null,
    amount: row.amount,
    currency: row.currency || null,
    livemode: row.livemode === true,
    status: row.status,
    component: row.component || null,
    created_at: row.created_at
  };
  const { error } = await supabase.from('paid_listings').upsert(payload, { onConflict: 'session_id' });
  if (error) throw new Error('paid_listings upsert failed');
}

async function updatePaidListingStatus(sessionId, status) {
  if (!isConfigured()) {
    const err = new Error('paid_listings store not configured');
    err.code = 'not_configured';
    throw err;
  }
  const supabase = client();
  const { error } = await supabase.from('paid_listings').update({ status: status }).eq('session_id', sessionId);
  if (error) throw new Error('paid_listings update failed');
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

exports._setPersistenceForTests = function (store) { persistenceOverride = store; };
exports._paidListingRow = paidListingRow;

function isoNow() { return new Date().toISOString(); }
function respond(code, obj) {
  return { statusCode: code, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) };
}
