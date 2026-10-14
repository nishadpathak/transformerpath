/* tests/paid-listings.test.js
 *
 * Stripe test-mode fixtures only. No live charge. Session ids use the
 * cs_test_ prefix. Network calls to Stripe are not made.
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

function sign(payload, secret, ts) {
  const t = String(ts || Math.floor(Date.now() / 1000));
  const v1 = crypto.createHmac('sha256', secret).update(t + '.' + payload, 'utf8').digest('hex');
  return 't=' + t + ',v1=' + v1;
}

function memoryStore() {
  const events = new Map();
  const listings = new Map();
  const api = {
    paidWrites: 0,
    entitlementWrites: 0,
    listings: listings,
    events: events,
    eventProcessed: async function (id) { return events.has(id); },
    markProcessed: async function (id, type) { events.set(id, type); },
    writeEntitlement: async function () { api.entitlementWrites++; },
    writePaidListing: async function (row) {
      api.paidWrites++;
      listings.set(row.session_id, Object.assign({}, row));
    }
  };
  return api;
}

async function postWebhook(handler, secret, event) {
  const payload = JSON.stringify(event);
  return handler({
    httpMethod: 'POST',
    headers: { 'stripe-signature': sign(payload, secret) },
    body: payload
  });
}

async function main() {
  const savedFetch = global.fetch;
  const savedStripe = process.env.STRIPE_SECRET_KEY;
  const savedPriceM = process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER;
  const savedPriceE = process.env.STRIPE_PRICE_FEATURED_EVENT;
  const savedNotify = process.env.NOTIFY_TO;
  const savedResend = process.env.RESEND_API_KEY;

  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER;
  delete process.env.STRIPE_PRICE_FEATURED_EVENT;
  delete process.env.RESEND_API_KEY;

  global.fetch = function () { throw new Error('stripe must not be called'); };
  const checkout = require('../functions/create-checkout');

  let res = await checkout.handler({ httpMethod: 'GET' });
  check('create-checkout GET is 405', res.statusCode === 405);

  res = await checkout.handler({ httpMethod: 'OPTIONS' });
  check('create-checkout OPTIONS is 204', res.statusCode === 204);

  res = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      product: 'verified_manufacturer',
      company_slug: 'not-a-real-company-zzz',
      email: 'buyer@example.com'
    })
  });
  check('unknown slug is 400', res.statusCode === 400 && JSON.parse(res.body).error === 'unknown slug', res.body);

  res = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      product: 'featured_event',
      event_id: 'not-a-real-event-zzz',
      email: 'buyer@example.com'
    })
  });
  check('unknown event is 400', res.statusCode === 400, res.body);

  res = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      product: 'verified_manufacturer',
      company_slug: 'a-plus-power-solution',
      email: 'buyer@example.com'
    })
  });
  const unconfigured = JSON.parse(res.body);
  check('unconfigured checkout is 503', res.statusCode === 503 && unconfigured.configured === false, res.body);
  check('503 names missing env vars', Array.isArray(unconfigured.missing) && unconfigured.missing.indexOf('STRIPE_SECRET_KEY') >= 0);

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_secret';
  const wh = require('../functions/stripe-webhook');
  const store = memoryStore();
  wh._setPersistenceForTests(store);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  const bad = await wh.handler({
    httpMethod: 'POST',
    headers: { 'stripe-signature': 't=' + Math.floor(Date.now() / 1000) + ',v1=' + 'ab'.repeat(32) },
    body: '{}'
  });
  check('bad signature is 400', bad.statusCode === 400, bad.body);

  const ignored = await postWebhook(wh.handler, secret, {
    id: 'evt_ignore_1',
    type: 'payment_intent.created',
    data: { object: {} }
  });
  check('ignored event is 200', ignored.statusCode === 200 && JSON.parse(ignored.body).ignored === 'payment_intent.created', ignored.body);

  const sessionId = 'cs_test_fixture_verified_manufacturer';
  check('fixture session id is test mode', sessionId.indexOf('cs_test_') === 0);
  const paidEvent = {
    id: 'evt_paid_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        amount_total: 49900,
        currency: 'usd',
        livemode: false,
        customer_email: 'buyer@example.com',
        metadata: { product: 'verified_manufacturer', company_slug: 'a-plus-power-solution' }
      }
    }
  };
  const first = await postWebhook(wh.handler, secret, paidEvent);
  const row = store.listings.get(sessionId);
  check('completed test session writes paid_listings', first.statusCode === 200 && row && row.status === 'paid_pending_verification', first.body);
  check('row keeps amount, currency, livemode, email', row && row.amount === 49900 && row.currency === 'usd' && row.livemode === false && row.email === 'buyer@example.com' && row.company_slug === 'a-plus-power-solution');

  const replay = await postWebhook(wh.handler, secret, paidEvent);
  check('replayed event id is idempotent', replay.statusCode === 200 && JSON.parse(replay.body).idempotent === true && store.paidWrites === 1, replay.body);
  check('markProcessed receives the event type', store.events.get('evt_paid_1') === 'checkout.session.completed');

  const engineerMiss = await postWebhook(wh.handler, secret, {
    id: 'evt_eng_missing_user',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_engineer', metadata: { plan: 'learning' } } }
  });
  check('engineer checkout without user_id stays 400', engineerMiss.statusCode === 400, engineerMiss.body);

  const engineerHit = await postWebhook(wh.handler, secret, {
    id: 'evt_eng_user',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_engineer_user', metadata: { plan: 'learning', user_id: 'user_1' }, customer: 'cus_1' } }
  });
  check('engineer checkout with user_id still writes entitlement', engineerHit.statusCode === 200 && store.entitlementWrites === 1, engineerHit.body);
  check('engineer markProcessed receives event type', store.events.get('evt_eng_user') === 'checkout.session.completed');

  const paid = require('../lib/paid-listings');
  check('no badge while status is paid_pending_verification', paid.manufacturerBadgeHtml('a-plus-power-solution', { listings: [row] }) === '');

  const verifiedDoc = {
    listings: [Object.assign({}, row, {
      status: 'verified',
      reviewer: 'directory-review',
      reviewed_at: '2026-10-14T09:00:00Z',
      verification_evidence: 'Corporate domain email matched the directory website.'
    })]
  };
  const badge = paid.manufacturerBadgeHtml('a-plus-power-solution', verifiedDoc);
  check('verified row renders VERIFIED MANUFACTURER', badge.indexOf('>VERIFIED MANUFACTURER<') >= 0 && badge.indexOf('data-company-slug="a-plus-power-solution"') >= 0, badge);
  check('badge includes commerce neutrality', badge.indexOf('does NOT mean product certified') >= 0);

  const company = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8')).companies
    .find(function (c) { return c.slug === 'a-plus-power-solution'; });
  const copy = JSON.parse(JSON.stringify(company));
  const evidence = copy.evidence;
  const capability = JSON.stringify(copy.capability_evidence);
  const score = copy.completeness_score;
  const labels = JSON.stringify(copy.capability_labels);
  const featuredBefore = copy.featured;
  paid.applyVerifiedManufacturers([copy], verifiedDoc);
  check('directory tier and verified flag set', copy.listing_tier === 'verified' && copy.verified === true);
  check('capability and evidence unchanged', copy.evidence === evidence && JSON.stringify(copy.capability_evidence) === capability);
  check('ranking fields unchanged', copy.completeness_score === score && JSON.stringify(copy.capability_labels) === labels && copy.featured === featuredBefore);

  const featuredSession = 'cs_test_fixture_featured_event';
  check('featured fixture session id is test mode', featuredSession.indexOf('cs_test_') === 0);
  const pendingEvent = {
    listings: [{
      product: 'featured_event',
      event_id: 'middle-east-energy',
      status: 'paid_pending_verification',
      session_id: featuredSession,
      email: 'events@example.com',
      amount: 29900,
      currency: 'usd',
      livemode: false
    }]
  };
  check('no FEATURED label before review', paid.featuredEventHtml('middle-east-energy', pendingEvent) === '');
  const featuredDoc = {
    listings: [Object.assign({}, pendingEvent.listings[0], {
      status: 'verified',
      reviewer: 'directory-review',
      reviewed_at: '2026-10-14T09:30:00Z',
      verification_evidence: 'Organiser confirmation matched the event page.'
    })]
  };
  const featuredHtml = paid.featuredEventHtml('middle-east-energy', featuredDoc);
  check('reviewed event renders FEATURED', featuredHtml.indexOf('>FEATURED<') >= 0 && featuredHtml.indexOf('data-event-id="middle-east-energy"') >= 0, featuredHtml);
  check('event id is in the catalog', paid.knownEventId('middle-east-energy') === true);

  const gate = require('../check-paid-badges');
  const stray = '<span class="paid-badge" data-paid-badge="verified-manufacturer" data-company-slug="a-plus-power-solution">VERIFIED MANUFACTURER</span>';
  check('CI fails a badge without a verified row', gate.auditHtml('sample.html', stray, { listings: [] }).length === 1);
  check('CI passes a badge with a verified row', gate.auditHtml('sample.html', stray, verifiedDoc).length === 0);
  check('CI fails directory verified without a row', gate.auditDirectory([{ slug: 'a-plus-power-solution', listing_tier: 'verified', verified: true }], { listings: [] }).length === 1);

  const receipt = require('../functions/lib/paid-receipt');
  process.env.NOTIFY_TO = 'ops@example.com';
  const msgs = receipt.messages(row);
  check('buyer confirmation is addressed to the payer', msgs.buyer && msgs.buyer.to[0] === 'buyer@example.com');
  check('internal notice goes to NOTIFY_TO', msgs.internal && msgs.internal.to[0] === 'ops@example.com');
  check('receipt text does not contain a secret key', msgs.buyer.text.indexOf('sk_') < 0 && msgs.internal.text.indexOf('whsec_') < 0);

  const widget = paid.checkoutWidget({
    product: 'verified_manufacturer',
    companySlug: 'a-plus-power-solution',
    fallback: '../../claim-profile.html',
    button: 'Pay $499 — Get Verified'
  });
  check('claim checkout widget has the pay button', widget.indexOf('Pay $499 — Get Verified') >= 0);

  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return {
          id: sessionId,
          payment_status: 'paid',
          amount_total: 49900,
          livemode: false,
          metadata: { product: 'verified_manufacturer', company_slug: 'a-plus-power-solution' }
        };
      }
    };
  };
  const verify = require('../functions/verify-access');
  const listingAccess = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  })).body);
  check('manufacturer payment does not grant course access', listingAccess.valid === false && listingAccess.paid === true && listingAccess.listing === 'paid_pending_verification' && !listingAccess.entitlement_token, JSON.stringify(listingAccess));

  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return { id: 'cs_test_learn', payment_status: 'paid', amount_total: 19900, livemode: false, metadata: {} };
      }
    };
  };
  const learning = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: 'cs_test_learn' })
  })).body);
  check('engineer $199 payment still grants learner', learning.valid === true && learning.tier === 'learner' && !!learning.entitlement_token, JSON.stringify({ valid: learning.valid, tier: learning.tier, hasToken: !!learning.entitlement_token }));

  global.fetch = savedFetch;
  if (savedStripe === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = savedStripe;
  if (savedPriceM === undefined) delete process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER; else process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER = savedPriceM;
  if (savedPriceE === undefined) delete process.env.STRIPE_PRICE_FEATURED_EVENT; else process.env.STRIPE_PRICE_FEATURED_EVENT = savedPriceE;
  if (savedNotify === undefined) delete process.env.NOTIFY_TO; else process.env.NOTIFY_TO = savedNotify;
  if (savedResend === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = savedResend;

  console.log('\nPAID LISTINGS: ' + (fail ? 'FAIL' : 'PASS') + ' (' + pass + ' passed, ' + fail + ' failed)');
  console.log('TEST_MODE_SESSION ' + sessionId);
  console.log('TEST_MODE_SESSION ' + featuredSession);
  process.exit(fail ? 1 : 0);
}

main().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
