/* Verified Manufacturer, end to end, Stripe test fixtures only.
 * No live charge. Session ids use cs_test_. The test key is a fixture string.
 *
 *   node tests/verified-manufacturer-flow.test.js
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const paidLinks = require('../lib/paid-listings');

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  PASS  ' + name);
  else {
    failed++;
    console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''));
  }
}

function sign(payload, secret, ts) {
  const t = String(ts || Math.floor(Date.now() / 1000));
  const v1 = crypto.createHmac('sha256', secret).update(t + '.' + payload, 'utf8').digest('hex');
  return 't=' + t + ',v1=' + v1;
}

function memoryRows() {
  const rows = new Map();
  const entitlements = [];
  const api = {
    configured: true,
    rows: rows,
    entitlements: entitlements,
    listVerified: async function () {
      return Array.from(rows.values()).filter(function (row) { return row.product === 'verified_manufacturer'; });
    },
    getBySession: async function (id) { return rows.get(id) || null; },
    updateListing: async function (id, patch) {
      const row = rows.get(id);
      if (!row) return null;
      Object.assign(row, patch);
      return Object.assign({}, row);
    },
    upsertEntitlement: async function (row) {
      entitlements.push(Object.assign({}, row));
      return row;
    },
    forEmail: async function (email) {
      const want = String(email || '').toLowerCase();
      return Array.from(rows.values()).filter(function (row) {
        return String(row.email || '').toLowerCase() === want;
      });
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

function paidSession(id, extra) {
  return Object.assign({
    id: id,
    payment_status: 'paid',
    livemode: false,
    amount_total: 49900,
    currency: 'usd',
    customer_details: { email: 'buyer@example.com' },
    metadata: { product: 'verified_manufacturer', company_slug: 'example-works' },
    payment_link: { id: 'plink_test_verified', url: paidLinks.PAYMENT_LINKS.verified_manufacturer.url }
  }, extra || {});
}

async function main() {
  const flow = require('../lib/verified-flow');
  const paid = require('../lib/paid-listings');
  const mail = require('../functions/lib/verified-mail');
  const session = require('../functions/lib/session-cookie');

  console.log('source and price');
  check('payment link is the existing $499 link', flow.paymentLink() === paid.PAYMENT_LINKS.verified_manufacturer.url);
  check('stripe product is the existing verified product', flow.STRIPE_PRODUCT_ID === 'prod_VRGrajnpm0wWTo' && paid.PAYMENT_LINKS.verified_manufacturer.productId === flow.STRIPE_PRODUCT_ID);
  check('amount stays 49900 cents', flow.AMOUNT_CENTS === 49900 && paid.PAYMENT_LINKS.verified_manufacturer.amountCents === 49900);
  const lineItem = paid.listingProduct({
    line_items: { data: [{ price: { product: 'prod_VRGrajnpm0wWTo' } }] },
    metadata: {}
  });
  check('line item product id classifies verified manufacturer', lineItem === 'verified_manufacturer', lineItem);

  const entitleSrc = fs.readFileSync('functions/entitle.js', 'utf8');
  check('entitle does not write public.payments', entitleSrc.indexOf("from('payments')") < 0 && entitleSrc.indexOf('from("payments")') < 0);
  check('entitle upserts entitlements on user_id, product', entitleSrc.indexOf("onConflict: 'user_id,product'") >= 0 && entitleSrc.indexOf('email,product') < 0);

  console.log('payment success, duplicate webhook, bad signature, abandoned checkout');
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_secret';
  const wh = require('../functions/stripe-webhook');
  const events = new Map();
  const listings = new Map();
  let paidWrites = 0;
  let statusWrites = 0;
  wh._setPersistenceForTests({
    eventProcessed: async function (id) { return events.has(id); },
    markProcessed: async function (id, type) { events.set(id, type); },
    writeEntitlement: async function () { throw new Error('listing must not grant a course entitlement'); },
    writePaidListing: async function (row) {
      paidWrites += 1;
      listings.set(row.session_id, Object.assign({}, row));
    },
    updatePaidListingStatus: async function (id, status) {
      statusWrites += 1;
      const row = listings.get(id);
      if (!row) throw new Error('missing row');
      row.status = status;
    }
  });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const bad = await wh.handler({
    httpMethod: 'POST',
    headers: { 'stripe-signature': 't=' + Math.floor(Date.now() / 1000) + ',v1=' + 'ab'.repeat(32) },
    body: '{}'
  });
  check('bad signature is 400', bad.statusCode === 400 && paidWrites === 0, bad.body);

  const sessionId = 'cs_test_verified_flow';
  const paidEvent = {
    id: 'evt_verified_paid',
    type: 'checkout.session.completed',
    data: { object: paidSession(sessionId) }
  };
  const first = await postWebhook(wh.handler, secret, paidEvent);
  const row = listings.get(sessionId);
  check('payment success stores paid_pending_verification', first.statusCode === 200 && row && row.status === 'paid_pending_verification' && row.amount === 49900 && row.livemode === false && row.email === 'buyer@example.com', first.body);
  check('pending payment does not show the badge', paid.manufacturerBadgeHtml('example-works', { listings: [row] }) === '');
  check('webhook event is recorded', events.get('evt_verified_paid') === 'checkout.session.completed');
  const replay = await postWebhook(wh.handler, secret, paidEvent);
  check('duplicate webhook is idempotent', replay.statusCode === 200 && JSON.parse(replay.body).idempotent === true && paidWrites === 1, replay.body);

  const abandoned = await postWebhook(wh.handler, secret, {
    id: 'evt_verified_abandoned',
    type: 'checkout.session.expired',
    data: { object: paidSession('cs_test_abandoned') }
  });
  check('abandoned checkout stores nothing', abandoned.statusCode === 200 && JSON.parse(abandoned.body).abandoned === true && !listings.get('cs_test_abandoned') && paidWrites === 1, abandoned.body);

  console.log('entitle.js uses paid_listings and entitlements');
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_not_a_real_key';
  const entitle = require('../functions/entitle.js');
  const entitleRows = memoryRows();
  let entitleDecisions = [];
  entitle._setStoreForTests({
    userIdForEmail: async function () { return null; },
    write: async function (decision) {
      entitleDecisions.push(decision);
      if (decision.kind === 'listing') entitleRows.rows.set(decision.listing.session_id, Object.assign({}, decision.listing));
      if (decision.kind === 'entitlement') entitleRows.entitlements.push(decision.entitlement);
      return { stored: true };
    }
  });
  global.fetch = async function (url) {
    const id = String(url).split('/checkout/sessions/')[1].split('?')[0];
    const table = {
      cs_test_entitle_paid: paidSession('cs_test_entitle_paid'),
      cs_test_entitle_unpaid: paidSession('cs_test_entitle_unpaid', { payment_status: 'unpaid' }),
      cs_test_entitle_live: paidSession('cs_test_entitle_live', { livemode: true }),
      cs_test_entitle_course: {
        id: 'cs_test_entitle_course',
        payment_status: 'paid',
        livemode: false,
        amount_total: 19900,
        currency: 'usd',
        customer_details: { email: 'learner@example.com' },
        metadata: { plan: 'learning' }
      }
    };
    const body = table[decodeURIComponent(id)];
    if (!body) return { ok: false, json: async function () { return { error: 'missing' }; } };
    return { ok: true, json: async function () { return body; } };
  };
  const entitled = await entitle.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_entitle_paid' }) });
  const entitledBody = JSON.parse(entitled.body);
  const entitledRow = entitleRows.rows.get('cs_test_entitle_paid');
  check('entitle stores the listing and not an entitlement', entitledBody.stored === true && entitledBody.listing === 'paid_pending_verification' && entitledRow && !entitledRow.email_column && entitleRows.entitlements.length === 0, entitled.body);
  check('entitle listing payload has no email column on an entitlement', entitleDecisions[0].kind === 'listing' && !entitleDecisions[0].entitlement);
  const unpaid = JSON.parse((await entitle.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_entitle_unpaid' }) })).body);
  check('unpaid session does not store a row', unpaid.paid === false && unpaid.stored === false && !entitleRows.rows.get('cs_test_entitle_unpaid'));
  const live = JSON.parse((await entitle.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_entitle_live' }) })).body);
  check('a test key rejects a live session', live.valid === false && live.reason === 'live_session_on_test_key' && !entitleRows.rows.get('cs_test_entitle_live'));
  entitle._setStoreForTests({
    userIdForEmail: async function (email) { return email === 'learner@example.com' ? '11111111-1111-4111-8111-111111111111' : null; },
    write: async function (decision) {
      entitleDecisions.push(decision);
      if (decision.entitlement) entitleRows.entitlements.push(decision.entitlement);
      return { stored: true };
    }
  });
  const course = JSON.parse((await entitle.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_entitle_course' }) })).body);
  const courseRow = entitleRows.entitlements[entitleRows.entitlements.length - 1];
  check('course entitlement uses user_id and has no email column', course.stored === true && course.product === 'learning' && courseRow && courseRow.user_id && !Object.prototype.hasOwnProperty.call(courseRow, 'email'), JSON.stringify(courseRow));
  entitle._setStoreForTests({
    userIdForEmail: async function () { return null; },
    write: async function () { throw new Error('no account must not write'); }
  });
  const noAccount = JSON.parse((await entitle.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_entitle_course' }) })).body);
  check('course without an account is not stored', noAccount.stored === false && noAccount.reason === 'account_required');
  entitle._setStoreForTests(null);

  console.log('claim, review, badge, refund, expiry');
  const store = memoryRows();
  store.rows.set(sessionId, Object.assign({}, row, { user_id: '11111111-1111-4111-8111-111111111111' }));
  const verifiedStore = require('../functions/lib/verified-store');
  verifiedStore.setForTests(store);
  const claim = require('../functions/verified-claim');
  const missingPayment = JSON.parse((await claim.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      session_id: 'cs_test_missing',
      company: 'Example Works',
      position: 'Sales desk',
      email: 'buyer@example.com',
      website: 'https://example.com',
      proof: 'Corporate domain and website checked for Example Works.',
      consent: true
    })
  })).body);
  check('claim without a payment row does not invent one', missingPayment.stored === false && missingPayment.reason === 'payment_required' && missingPayment.badge === false);
  const claimed = JSON.parse((await claim.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      company: 'Example Works',
      position: 'Sales desk',
      email: 'buyer@example.com',
      website: 'https://example.com',
      proof: 'Corporate domain and website checked for Example Works.',
      consent: true
    })
  })).body);
  check('identity and authorization attach to the payment', claimed.stored === true && claimed.badge === false && claimed.document_status === 'received' && store.rows.get(sessionId).document_status === 'received');
  check('claim does not show the badge', paid.manufacturerBadgeHtml('example-works', { listings: [store.rows.get(sessionId)] }) === '');

  process.env.VERIFIED_REVIEW_TOKEN = 'test-review-token-not-a-secret';
  const review = require('../functions/verified-review');
  const noToken = await review.handler({ httpMethod: 'GET', headers: {} });
  check('review without the token is 401', noToken.statusCode === 401);
  delete process.env.VERIFIED_REVIEW_TOKEN;
  const unconfiguredReview = await review.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer test-review-token-not-a-secret' } });
  check('review without the env token is 503', unconfiguredReview.statusCode === 503 && JSON.parse(unconfiguredReview.body).configured === false);
  process.env.VERIFIED_REVIEW_TOKEN = 'test-review-token-not-a-secret';
  const rejected = JSON.parse((await review.handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer test-review-token-not-a-secret' },
    body: JSON.stringify({
      action: 'reject',
      session_id: sessionId,
      verification_evidence: 'Authorization did not match the company domain.'
    })
  })).body);
  check('rejection stores rejected and hides the badge', rejected.stored === true && rejected.status === 'rejected' && rejected.badge === false);
  check('rejected row does not render the badge', paid.manufacturerBadgeHtml('example-works', { listings: [store.rows.get(sessionId)] }) === '');

  store.rows.get(sessionId).status = 'paid_pending_verification';
  const approved = JSON.parse((await review.handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer test-review-token-not-a-secret' },
    body: JSON.stringify({
      action: 'approve',
      session_id: sessionId,
      verification_evidence: 'Identity and contact checked against the company website.'
    })
  })).body);
  const approvedRow = store.rows.get(sessionId);
  check('approval grants the entitlement without an email column', approved.stored === true && approved.badge === true && store.entitlements.length === 1 && store.entitlements[0].status === 'active' && store.entitlements[0].product === 'verified_manufacturer' && !Object.prototype.hasOwnProperty.call(store.entitlements[0], 'email'));
  check('approved badge uses the reviewed publish row', paid.manufacturerBadgeHtml('example-works', { listings: [approved.publish_row] }).indexOf('VERIFIED MANUFACTURER') >= 0);
  check('badge copy does not claim a product certification', paid.manufacturerBadgeHtml('example-works', { listings: [approved.publish_row] }).toLowerCase().indexOf('not mean product certified') >= 0);
  const later = Date.parse(approvedRow.expires_at) + 1000;
  check('expiry removes the badge', flow.termEnded(approvedRow, later) && paid.manufacturerBadgeHtml('example-works', { listings: [Object.assign({}, approvedRow, { reviewed_at: '2024-01-01T00:00:00.000Z', expires_at: '2025-01-01T00:00:00.000Z' })] }) === '');

  const refundEvent = {
    id: 'evt_verified_refund',
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test_refund',
        metadata: { product: 'verified_manufacturer', session_id: sessionId },
        receipt_email: 'buyer@example.com'
      }
    }
  };
  const refunded = await postWebhook(wh.handler, secret, refundEvent);
  check('refund marks the listing refunded', refunded.statusCode === 200 && JSON.parse(refunded.body).refunded === true && listings.get(sessionId).status === 'refunded' && statusWrites === 1, refunded.body);
  check('refunded listing does not show the badge', paid.manufacturerBadgeHtml('example-works', { listings: [listings.get(sessionId)] }) === '');
  const refundReplay = await postWebhook(wh.handler, secret, refundEvent);
  check('duplicate refund webhook is idempotent', JSON.parse(refundReplay.body).idempotent === true && statusWrites === 1);
  const refundedEntitlement = flow.markRefunded(approvedRow).entitlement;
  check('refund entitlement is refunded and has no email column', refundedEntitlement.status === 'refunded' && !Object.prototype.hasOwnProperty.call(refundedEntitlement, 'email'));

  console.log('emails');
  ['confirmation', 'approval', 'rejection', 'expiry', 'renewal', 'refund'].forEach(function (kind) {
    const built = mail.build(kind, approvedRow);
    const text = (built.buyer && built.buyer.text) || '';
    check(kind + ' names the one-time 12-month term', text.indexOf('$499 one-time payment · covers 12 months') >= 0 && text.indexOf('no auto-renewal') >= 0, text.slice(0, 180));
    check(kind + ' says identity and contact checked, not a product certification', text.indexOf(flow.CHECKED) >= 0);
    check(kind + ' uses the brand contact', text.indexOf('hello@transformerpath.com') >= 0);
    if (kind === 'expiry' || kind === 'renewal') {
      check(kind + ' repeats the existing payment link', text.indexOf(paid.PAYMENT_LINKS.verified_manufacturer.url) >= 0);
    }
  });
  delete process.env.RESEND_API_KEY;
  const skipped = await mail.sendKind('approval', approvedRow, function () { throw new Error('must not send'); });
  check('unset mail provider does not send', skipped.sent === false && skipped.reason === 'not_configured' && skipped.retry === false);
  process.env.RESEND_API_KEY = 're_test_fixture_not_a_real_key';
  let posted = 0;
  const sent = await mail.sendKind('renewal', approvedRow, async function (url) {
    posted += 1;
    check('mail posts to the existing Resend endpoint', url === 'https://api.resend.com/emails');
    return { ok: true, status: 200 };
  });
  check('configured mail sends buyer and internal notices', sent.sent === true && posted === 2);
  delete process.env.RESEND_API_KEY;

  const renewalRow = Object.assign({}, approvedRow, {
    session_id: 'cs_test_renewal',
    status: 'verified',
    expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    renewal_reminder_sent_at: null,
    expiry_notice_sent_at: null
  });
  const expiredRow = Object.assign({}, approvedRow, {
    session_id: 'cs_test_expired_row',
    status: 'verified',
    expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    renewal_reminder_sent_at: null,
    expiry_notice_sent_at: null,
    user_id: '11111111-1111-4111-8111-111111111111'
  });
  const due = flow.remindersDue([renewalRow, expiredRow], Date.now());
  check('renewal reminder is due inside 30 days and expiry is due after the term', due.renewal.length === 1 && due.expiry.length === 1);
  store.rows.set('cs_test_renewal', renewalRow);
  store.rows.set('cs_test_expired_row', expiredRow);
  const reminders = require('../functions/verified-reminders');
  const reminderRun = JSON.parse((await reminders.handler({})).body);
  check('reminders skip sending when the provider is unset', reminderRun.skipped === true && reminderRun.reason === 'not_configured' && !store.rows.get('cs_test_expired_row').expiry_notice_sent_at);
  process.env.RESEND_API_KEY = 're_test_fixture_not_a_real_key';
  global.fetch = async function () { return { ok: true, status: 200 }; };
  const reminderSent = JSON.parse((await reminders.handler({})).body);
  check('expiry reminder marks the row expired', reminderSent.sent === 2 && store.rows.get('cs_test_expired_row').status === 'expired' && store.rows.get('cs_test_renewal').renewal_reminder_sent_at);
  delete process.env.RESEND_API_KEY;
  const second = flow.remindersDue([store.rows.get('cs_test_renewal'), store.rows.get('cs_test_expired_row')], Date.now());
  check('a stamped reminder is not due again', second.renewal.length === 0 && second.expiry.length === 0);

  console.log('dashboards');
  const dashboard = require('../functions/verified-dashboard');
  const anonymous = await dashboard.handler({ httpMethod: 'GET', headers: {} });
  check('dashboard without a session is 401', anonymous.statusCode === 401 && JSON.parse(anonymous.body).signedIn === false);
  dashboard._setViewerForTests(async function () { return { email: 'buyer@example.com', source: 'session' }; });
  dashboard._setExtrasForTests(function () { return { rfqs: [], enquiries: [{ company: 'Example Works', document_status: 'checked', session_id: sessionId }] }; });
  store.rows.get(sessionId).email = 'buyer@example.com';
  store.rows.set('cs_test_other', Object.assign({}, approvedRow, { session_id: 'cs_test_other', email: 'other@example.com', status: 'verified' }));
  const dash = await dashboard.handler({ httpMethod: 'GET', headers: {} });
  const dashBody = JSON.parse(dash.body);
  check('dashboard is noindex and limited to the signed-in email', dash.statusCode === 200 && dash.headers['x-robots-tag'].indexOf('noindex') >= 0 && dashBody.listings.length >= 1 && dashBody.listings.every(function (item) { return item.session_id !== 'cs_test_other'; }) && dashBody.analytics.profile_views == null, dash.body);
  check('dashboard states the term and the check', dashBody.price === flow.PRICE_LINE && dashBody.auto_renewal === false && dashBody.wording === flow.CHECKED);
  dashboard._setViewerForTests(null);

  const revenue = require('../functions/verified-revenue');
  delete process.env.VERIFIED_REVIEW_TOKEN;
  const revenueOff = await revenue.handler({ httpMethod: 'GET', headers: {} });
  check('revenue without the token env is 503', revenueOff.statusCode === 503);
  process.env.VERIFIED_REVIEW_TOKEN = 'test-review-token-not-a-secret';
  const revenueDenied = await revenue.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer wrong-token-not-the-review-token' } });
  check('revenue rejects a bad token', revenueDenied.statusCode === 401);
  const revenueOk = await revenue.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer test-review-token-not-a-secret' } });
  check('revenue summary has amounts and no buyer email', revenueOk.statusCode === 200 && revenueOk.headers['x-robots-tag'].indexOf('noindex') >= 0 && revenueOk.body.indexOf('buyer@example.com') < 0 && JSON.parse(revenueOk.body).amount_cents && JSON.parse(revenueOk.body).counts);

  const pages = {
    'manufacturer-dashboard.html': fs.readFileSync('manufacturer-dashboard.html', 'utf8'),
    'admin/verified-review.html': fs.readFileSync('admin/verified-review.html', 'utf8'),
    'admin/verified-revenue.html': fs.readFileSync('admin/verified-revenue.html', 'utf8'),
    'claim-profile.html': fs.readFileSync('claim-profile.html', 'utf8')
  };
  check('customer dashboard is noindex', pages['manufacturer-dashboard.html'].indexOf('noindex, nofollow') >= 0);
  check('review and revenue pages are noindex', pages['admin/verified-review.html'].indexOf('noindex, nofollow') >= 0 && pages['admin/verified-revenue.html'].indexOf('noindex, nofollow') >= 0);
  check('pages do not embed the review token', pages['admin/verified-review.html'].indexOf('test-review-token') < 0 && pages['admin/verified-revenue.html'].indexOf('VERIFIED_REVIEW_TOKEN =') < 0);
  Object.keys(pages).forEach(function (file) {
    check(file + ' keeps the checked wording', pages[file].indexOf('identity and contact checked, not a product certification') >= 0 || pages[file].indexOf('Identity and contact checked, not a product certification') >= 0);
    check(file + ' does not place the company in Dubai or the UAE', !/\bDubai\b|\bUAE\b|United Arab Emirates/.test(pages[file]));
  });
  check('claim page still uses the payment link and the neutral banner', pages['claim-profile.html'].indexOf('href="' + flow.paymentLink() + '"') >= 0 && pages['claim-profile.html'].indexOf('If you completed payment, submit the form below; we confirm payment before review.') >= 0);

  const cookieSecret = 'session-secret-for-unit-test';
  const cookie = session.signSession({ sub: 'abc123', email: 'buyer@example.com', name: '' }, cookieSecret, Date.now());
  const seen = dashboard._sessionViewerForTests({ headers: { cookie: 'tp_session=' + cookie } }, { SESSION_SECRET: cookieSecret }, Date.now());
  check('dashboard reuses the existing session cookie', seen && seen.email === 'buyer@example.com' && seen.source === 'session');

  console.log('migration and rls');
  const migration = fs.readFileSync('supabase/migrations/20261021120000_verified_manufacturer_review.sql', 'utf8');
  check('migration allows expired and does not delete rows', /status in \(/.test(migration) && migration.indexOf("'expired'") >= 0 && !/delete from/i.test(migration) && !/drop table/i.test(migration));
  check('migration select policy matches the jwt email', /paid_listings_select_own/.test(migration) && /auth\.jwt\(\) ->> 'email'/.test(migration) && !/for insert/.test(migration) && !/for update/.test(migration) && !/for delete/.test(migration));
  const proposal = fs.readFileSync('docs/csp-enforce-proposal.md', 'utf8');
  const toml = fs.readFileSync('netlify.toml', 'utf8');
  check('csp enforce header was not replaced', toml.indexOf('Content-Security-Policy = "default-src \'self\' https:') >= 0 && toml.indexOf('Content-Security-Policy-Report-Only') >= 0);
  check('csp proposal does not switch enforce on', /Enforce mode is not changed/.test(proposal) && /no collected CSP violation reports/.test(proposal));

  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    $$;
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261016150000_payments_tables.sql', 'utf8'));
  await db.exec(migration);
  await db.exec(migration);
  await db.query(
    `insert into public.paid_listings (session_id, product, email, amount, currency, livemode, status)
     values ('cs_test_owner', 'verified_manufacturer', 'buyer@example.com', 49900, 'usd', false, 'paid_pending_verification'),
            ('cs_test_stranger', 'verified_manufacturer', 'other@example.com', 49900, 'usd', false, 'verified')`
  );
  await db.query(
    `insert into public.paid_listings (session_id, product, email, status)
     values ('cs_test_expired', 'verified_manufacturer', 'buyer@example.com', 'expired')`
  );
  let badStatus = false;
  try {
    await db.query(`insert into public.paid_listings (session_id, product, status) values ('cs_test_bad', 'verified_manufacturer', 'nope')`);
  } catch (err) {
    badStatus = /check|violates/i.test(String(err && err.message));
  }
  check('expired is allowed and an unknown status is not', badStatus);

  async function asEmail(email, fn) {
    return db.transaction(async function (tx) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ email: email })]);
      await tx.exec('set local role authenticated');
      return fn(tx);
    });
  }
  const own = await asEmail('buyer@example.com', function (tx) {
    return tx.query('select session_id from public.paid_listings order by session_id');
  });
  check('authenticated user reads only rows for that email', own.rows.length === 2 && own.rows.every(function (item) { return item.session_id !== 'cs_test_stranger'; }), JSON.stringify(own.rows));
  let cannotWrite = false;
  try {
    await asEmail('buyer@example.com', function (tx) {
      return tx.query(`update public.paid_listings set status = 'verified' where session_id = 'cs_test_owner'`);
    });
  } catch (err) {
    cannotWrite = /permission denied|row-level security/i.test(String(err && err.message));
  }
  check('authenticated user cannot update a paid listing', cannotWrite);
  let anonDenied = false;
  try {
    await db.transaction(async function (tx) {
      await tx.exec('set local role anon');
      return tx.query('select session_id from public.paid_listings');
    });
  } catch (err) {
    anonDenied = /permission denied|row-level security/i.test(String(err && err.message));
  }
  check('anon cannot read paid listings', anonDenied);

  verifiedStore.setForTests(null);
  wh._setPersistenceForTests(null);
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.VERIFIED_REVIEW_TOKEN;

  if (failed) {
    console.error('\nverified manufacturer flow: ' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nverified manufacturer flow: PASS');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
