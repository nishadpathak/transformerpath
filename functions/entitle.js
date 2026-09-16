/* Netlify function: link a paid Stripe Checkout Session to a Supabase
 * entitlement. This is the machine side of "Stripe takes payment → Supabase
 * stores the entitlement". The browser is never trusted to grant access.
 *
 * Flow: after a successful Stripe Checkout, Stripe redirects the buyer to
 *   pricing.html?unlocked=<product>&session_id={CHECKOUT_SESSION_ID}
 * The front-end calls this function with session_id; it verifies the session
 * is genuinely paid (server-side, via STRIPE_SECRET_KEY), then writes a
 * payment + entitlement row through the service-role Supabase client.
 *
 * The buyer may not have a TransformerPath account yet (anonymous Stripe
 * checkout). The entitlement is therefore keyed by the Stripe customer email,
 * and linked to a user_id when that email later signs up.
 *
 * Env vars (Netlify): STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY
 * (see functions/lib/supabase-server.js).
 */
'use strict';
const { isConfigured, client } = require('./lib/supabase-server');

const STRIPE_API = 'https://api.stripe.com/v1';
const SK = (process.env.STRIPE_SECRET_KEY || '').trim();

// Amount charged (cents) -> product/plan. Mirrors the live Payment Links.
const AMOUNT_PRODUCT = {
  19900: { product: 'learning', plan: 'Learning' },
  59900: { product: 'professional', plan: 'Professional' },
  199900: { product: 'team', plan: 'Team' },
  49900: { product: 'verified_supplier', plan: 'Verified Supplier' },
  // Books (Volume 1 / Volume 2 digital, and the V1+V2 digital bundle).
  // Stripe session metadata (product/plan) is read first and is authoritative;
  // the amount map below is only a fallback when metadata is absent. V1 and V2
  // digital both cost $49 (4900), so they are distinguished via metadata.
  4900:  { product: 'book_v01', plan: 'Book Volume 1' },
  7900:  { product: 'book_bundle', plan: 'Book Volume 1 + 2' },
};

function derive(session) {
  if (session.metadata && session.metadata.product) {
    return { product: session.metadata.product, plan: session.metadata.plan || session.metadata.product };
  }
  if (typeof session.amount_total === 'number') {
    return AMOUNT_PRODUCT[session.amount_total] || { product: 'learning', plan: 'Learning' };
  }
  return { product: 'learning', plan: 'Learning' };
}

const iso = (d) => new Date(d).toISOString();

exports.handler = async (event) => {
  // GET: config status probe (the front-end disables checkout when unconfigured).
  if (event.httpMethod === 'GET') {
    const reason = !SK ? 'STRIPE_SECRET_KEY not set' : !isConfigured() ? 'SUPABASE not configured' : 'ok';
    return { statusCode: 200, body: JSON.stringify({ configured: Boolean(SK && isConfigured()), reason }) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!SK || !isConfigured()) {
    return { statusCode: 200, body: JSON.stringify({ valid: false, configured: false, reason: 'not_configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  const sessionId = (body.session_id || '').trim();
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'session_id required' }) };
  }

  try {
    const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${SK}` },
    });
    const session = await res.json();
    if (!res.ok) {
      return { statusCode: 200, body: JSON.stringify({ valid: false, reason: 'stripe_error' }) };
    }
    // Security boundary: only a genuinely paid session grants access.
    if (session.payment_status !== 'paid') {
      return { statusCode: 200, body: JSON.stringify({ valid: false, paid: false, payment_status: session.payment_status }) };
    }

    const { product, plan } = derive(session);
    const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
    const supabase = client();

    // Link to an existing account if the Stripe customer email already signed up.
    let userId = null;
    if (email) {
      const { data: prof } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
      userId = prof ? prof.id : null;
    }

    // Record the payment (one row per Stripe session).
    await supabase.from('payments').insert({
      stripe_session_id: sessionId, email: email, user_id: userId, product: product, plan: plan,
      amount: (typeof session.amount_total === 'number') ? session.amount_total : null,
      currency: session.currency || 'usd', status: 'paid',
    });

    const accessStart = new Date();
    const accessEnd = new Date(accessStart.getTime() + 365 * 24 * 3600 * 1000); // 12 months
    const entitlement = {
      email: email, user_id: userId, product: product, plan: plan,
      access_start: iso(accessStart), access_end: iso(accessEnd), status: 'active',
    };
    // One active entitlement per (email, product); updates if the buyer renews.
    const conflict = email ? 'email,product' : undefined;
    const write = conflict
      ? supabase.from('entitlements').upsert(entitlement, { onConflict: conflict }).select().maybeSingle()
      : supabase.from('entitlements').insert(entitlement).select().maybeSingle();
    const { error } = await write;

    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: true, paid: true, product: product, plan: plan,
        access_start: entitlement.access_start, access_end: entitlement.access_end,
        user_id: userId, email: email, stored: !error,
      }),
    };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ valid: false, reason: 'error', detail: String(e && e.message) }) };
  }
};
