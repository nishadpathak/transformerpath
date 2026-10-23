/* Netlify function: link a paid Stripe Checkout Session to the existing
 * Supabase tables. The browser is never trusted to grant access.
 *
 * Listing products, including Verified Manufacturer, upsert public.paid_listings
 * on session_id with status paid_pending_verification. They do not grant a
 * course entitlement and they do not publish a badge.
 *
 * Course products upsert public.entitlements on (user_id, product) using the
 * columns from supabase/migrations/20261016150000_payments_tables.sql.
 * There is no public.payments table and no entitlements.email column.
 * A course with no profiles.id is not stored.
 *
 * Env: STRIPE_SECRET_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY
 * (SUPABASE_SECRET_KEY is accepted by functions/lib/supabase-server.js).
 */
'use strict';

const { isConfigured, client } = require('./lib/supabase-server');
const { classifyCourse } = require('../lib/course-payment');
const { listingProduct } = require('../lib/paid-listings');
const flow = require('../lib/verified-flow');

const STRIPE_API = 'https://api.stripe.com/v1';

let storeOverride = null;

function secret() {
  return (process.env.STRIPE_SECRET_KEY || '').trim();
}

function ready() {
  return Boolean(secret() && (storeOverride || isConfigured()));
}

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  };
}

function listingPayload(row) {
  const payload = {};
  flow.LISTING_COLUMNS.forEach(function (key) {
    payload[key] = row[key] == null ? null : row[key];
  });
  return payload;
}

async function defaultStore(decision) {
  const supabase = client();
  if (decision.kind === 'listing') {
    const { error } = await supabase
      .from('paid_listings')
      .upsert(listingPayload(decision.listing), { onConflict: 'session_id' });
    if (error) {
      const err = new Error('paid_listings upsert failed');
      err.code = 'write_failed';
      throw err;
    }
    return { stored: true };
  }
  if (decision.kind === 'entitlement') {
    const row = decision.entitlement;
    const { error } = await supabase.from('entitlements').upsert({
      user_id: row.user_id,
      product: row.product,
      plan: row.plan,
      access_start: row.access_start,
      access_end: row.access_end,
      status: row.status
    }, { onConflict: 'user_id,product' });
    if (error) {
      const err = new Error('entitlements upsert failed');
      err.code = 'write_failed';
      throw err;
    }
    return { stored: true };
  }
  return { stored: false };
}

function decide(session, userId) {
  const listing = listingProduct(session);
  if (listing) {
    const row = flow.listingRowFromSession(session);
    row.product = listing;
    return { kind: 'listing', listing: row, entitlement: null };
  }
  const course = classifyCourse(session);
  if (!course) return { kind: 'unclassified' };
  if (!userId) return { kind: 'account_required', course: course };
  return {
    kind: 'entitlement',
    entitlement: flow.courseEntitlement(course, userId),
    listing: null
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const reason = !secret() ? 'STRIPE_SECRET_KEY not set' : !isConfigured() ? 'SUPABASE not configured' : 'ok';
    return json(200, { configured: Boolean(secret() && isConfigured()), reason: reason });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!ready()) {
    return json(200, { valid: false, configured: false, reason: 'not_configured' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid JSON' }); }
  const sessionId = (body.session_id || '').trim();
  if (!sessionId || sessionId.indexOf('{') !== -1) {
    return json(400, { error: 'session_id required' });
  }

  try {
    const res = await fetch(STRIPE_API + '/checkout/sessions/' + encodeURIComponent(sessionId) + '?expand[]=payment_link', {
      headers: { Authorization: 'Bearer ' + secret() }
    });
    const session = await res.json();
    if (!res.ok) return json(200, { valid: false, reason: 'stripe_error' });
    if (session.livemode === true && secret().indexOf('sk_test_') === 0) {
      return json(200, { valid: false, reason: 'live_session_on_test_key' });
    }
    if (session.payment_status !== 'paid') {
      return json(200, { valid: false, paid: false, payment_status: session.payment_status || null, stored: false });
    }

    const email = flow.emailOf(
      (session.customer_details && session.customer_details.email) || session.customer_email
    );
    let userId = null;
    if (email && !storeOverride) {
      const { data: prof } = await client().from('profiles').select('id').eq('email', email).maybeSingle();
      userId = prof ? prof.id : null;
    } else if (storeOverride && storeOverride.userIdForEmail) {
      userId = await storeOverride.userIdForEmail(email);
    }

    const decision = decide(session, userId);
    if (decision.kind === 'unclassified') {
      return json(200, { valid: false, paid: true, reason: 'unclassified', stored: false });
    }
    if (decision.kind === 'account_required') {
      return json(200, {
        valid: true,
        paid: true,
        stored: false,
        reason: 'account_required',
        product: decision.course.product,
        plan: decision.course.plan
      });
    }

    const writer = storeOverride && storeOverride.write ? storeOverride.write : defaultStore;
    const written = await writer(decision);
    const listing = decision.listing;
    const entitlement = decision.entitlement;
    return json(200, {
      valid: true,
      paid: true,
      stored: written.stored !== false,
      product: listing ? listing.product : entitlement.product,
      plan: listing ? listing.product : entitlement.plan,
      listing: listing ? listing.status : null,
      access_start: entitlement ? entitlement.access_start : null,
      access_end: entitlement ? entitlement.access_end : null,
      user_id: entitlement ? entitlement.user_id : null
    });
  } catch (e) {
    return json(200, { valid: false, reason: 'error' });
  }
};

exports._setStoreForTests = function (store) { storeOverride = store; };
exports._decideForTests = decide;
