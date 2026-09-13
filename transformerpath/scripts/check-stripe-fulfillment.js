#!/usr/bin/env node
/**
 * GATE: Stripe fulfillment hardening (Phase-2 §10, §11).
 *
 * Exercises the webhook end-to-end with an in-memory store and real signed
 * payloads, asserting: signature verification, idempotency (no double grant /
 * double notify on replay), event-specificity (only paid/known events grant;
 * unpaid / unknown-sku / unrelated events do not), auditability, revocation on
 * refund and subscription cancellation, and server-authoritative entitlement.
 */
const Stripe = require('stripe');
const { makeMemoryStore } = require('../functions/lib/fulfillment-store');
const { createHandler } = require('../functions/stripe-webhook');

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_local';
delete process.env.SLACK_WEBHOOK_URL;
delete process.env.SENDGRID_API_KEY;

const stripe = Stripe('sk_test_dummy');
function sign(payload) {
  return stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
}
function evt(obj) {
  const payload = JSON.stringify(obj);
  return { httpMethod: 'POST', headers: { 'stripe-signature': sign(payload) }, body: payload };
}
function badEvt(obj) {
  return { httpMethod: 'POST', headers: { 'stripe-signature': 't=1,v1=bad' }, body: JSON.stringify(obj) };
}

let notifyCount = 0;
const store = makeMemoryStore();
const handler = createHandler({ store, notify: async () => { notifyCount++; return { notified: 1 }; } });

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

async function main() {
  // 1) Successful paid purchase → grant + notify once.
  let r = await handler(evt({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 149900, currency: 'usd', customer_details: { email: 'buyer@x' }, metadata: { sku: 'directory_premium' } } } }));
  let b = JSON.parse(r.body);
  check('paid purchase → 200 granted', r.statusCode === 200 && b.granted === true, r.statusCode + ' ' + r.body);
  check('entitlement active', (store.getEntitlement('buyer@x', 'directory_premium') || {}).status === 'active');
  check('notified once', notifyCount === 1, 'count=' + notifyCount);
  const grantedAt = (store.getEntitlement('buyer@x', 'directory_premium') || {}).grantedAt;

  // 2) Duplicate event (same id) → idempotent, no second grant/notify.
  r = await handler(evt({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 149900, currency: 'usd', customer_details: { email: 'buyer@x' }, metadata: { sku: 'directory_premium' } } } }));
  b = JSON.parse(r.body);
  check('duplicate → 200 duplicate', r.statusCode === 200 && b.duplicate === true);
  check('duplicate did not re-notify', notifyCount === 1, 'count=' + notifyCount);
  check('duplicate did not re-grant (grantedAt unchanged)', (store.getEntitlement('buyer@x', 'directory_premium') || {}).grantedAt === grantedAt);

  // 3) Unpaid checkout → no entitlement.
  r = await handler(evt({ id: 'evt_2', type: 'checkout.session.completed', data: { object: { id: 'cs_2', payment_status: 'unpaid', customer_details: { email: 'u2@x' }, metadata: { sku: 'directory_verified' } } } }));
  b = JSON.parse(r.body);
  check('unpaid → granted:false', r.statusCode === 200 && b.granted === false, r.body);
  check('unpaid → no entitlement', store.getEntitlement('u2@x', 'directory_verified') === null);

  // 4) Failed payment (unrelated event) → ignored, no entitlement.
  r = await handler(evt({ id: 'evt_3', type: 'payment_intent.payment_failed', data: { object: { id: 'pi_3', metadata: { sku: 'directory_premium' } } } }));
  b = JSON.parse(r.body);
  check('failed payment → ignored', r.statusCode === 200 && b.ignored === true);

  // 5) Wrong / unknown product SKU on a paid checkout → not granted.
  r = await handler(evt({ id: 'evt_4', type: 'checkout.session.completed', data: { object: { id: 'cs_4', payment_status: 'paid', customer_details: { email: 'u4@x' }, metadata: { sku: 'totally_bogus_sku' } } } }));
  b = JSON.parse(r.body);
  check('unknown sku → granted:false unrecognized', r.statusCode === 200 && b.reason === 'unrecognized_sku', r.body);
  check('unknown sku → no entitlement', store.getEntitlement('u4@x', 'totally_bogus_sku') === null);

  // 6) Refund → revoke the granted entitlement.
  r = await handler(evt({ id: 'evt_5', type: 'charge.refunded', data: { object: { id: 'ch_5', metadata: { sku: 'directory_premium', email: 'buyer@x' } } } }));
  check('refund → 200', r.statusCode === 200);
  check('refund → entitlement revoked', (store.getEntitlement('buyer@x', 'directory_premium') || {}).status === 'revoked');

  // 7) Subscription grant then cancellation → revoke.
  await handler(evt({ id: 'evt_6', type: 'checkout.session.completed', data: { object: { id: 'cs_6', payment_status: 'paid', customer_details: { email: 'sub@x' }, metadata: { sku: 'academy_pro' } } } }));
  check('subscription grant active', (store.getEntitlement('sub@x', 'academy_pro') || {}).status === 'active');
  r = await handler(evt({ id: 'evt_7', type: 'customer.subscription.deleted', data: { object: { id: 'sub_7', metadata: { sku: 'academy_pro', email: 'sub@x' } } } }));
  check('cancellation → revoked', (store.getEntitlement('sub@x', 'academy_pro') || {}).status === 'revoked');

  // 8) Invalid signature → 400, not processed, no entitlement.
  r = await handler(badEvt({ id: 'evt_8', type: 'checkout.session.completed', data: { object: { id: 'cs_8', payment_status: 'paid', customer_details: { email: 'hacker@x' }, metadata: { sku: 'directory_premium' } } } }));
  b = JSON.parse(r.body);
  check('invalid signature → 400', r.statusCode === 400 && b.code === 'signature_verification_failed');
  check('invalid signature → no entitlement', store.getEntitlement('hacker@x', 'directory_premium') === null);

  // Auditability: every processed event left an audit trail.
  const audit = store.dump().auditLog;
  check('audit log populated', audit.length >= 6, 'entries=' + audit.length);

  console.log('\nSTRIPE FULFILLMENT GATE: ' + (fail ? 'FAIL' : 'OK') + ' (' + pass + ' passed, ' + fail + ' failed)');
  process.exit(fail ? 1 : 0);
}

main();
