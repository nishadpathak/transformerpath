/* Checkout continue: a valid email is attached to a Checkout Session.
 * When Stripe refuses the session, the existing Payment Link still opens.
 * A failed lead save does not. Run: node tests/checkout-continue.test.js
 */
'use strict';

const assert = require('assert');
const cont = require('../functions/checkout-continue');
const email = require('../checkout-email');
const paid = require('../lib/paid-listings');

const profile = 'https://transformerpath.com/manufacturers/ormazabal/';

function post(body, headers) {
  return cont.handler({
    httpMethod: 'POST',
    headers: headers || { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  });
}

function buyer() {
  return { product: 'verified_manufacturer', email: 'buyer@example.com', slug: 'ormazabal', from: profile };
}

(async function () {
  const savedKey = process.env.STRIPE_SECRET_KEY;
  const savedFetch = global.fetch;
  delete process.env.STRIPE_SECRET_KEY;
  delete cont._leadInsertForTests;

  let calls = 0;
  global.fetch = function () { calls += 1; throw new Error('stripe must not be called'); };
  cont._leadInsertForTests = async function () { throw new Error('checkout_leads insert failed'); };
  const leadFailed = await post(buyer());
  const leadBody = JSON.parse(leadFailed.body);
  assert.strictEqual(leadFailed.statusCode, 502);
  assert.strictEqual(calls, 0);
  assert.strictEqual(leadBody.error, 'lead_not_saved');
  assert.strictEqual(leadBody.saved, false);
  assert.strictEqual(leadBody.payment_link, false);
  assert.strictEqual(leadBody.url, undefined);
  assert.ok(leadBody.message.indexOf('could not save your email') !== -1);
  assert.ok(JSON.stringify(leadBody).indexOf('buy.stripe.com') === -1);
  delete cont._leadInsertForTests;

  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_not_a_real_key';
  let posted = '';
  global.fetch = async function (url, opts) {
    const u = String(url);
    calls += 1;
    if (u.indexOf('/v1/payment_links') !== -1) {
      return { ok: false, status: 403, json: async function () { return { error: { code: 'more_permissions_required' } }; } };
    }
    if (u.indexOf('/v1/prices?') !== -1) {
      assert.ok(u.indexOf('product=' + paid.PAYMENT_LINKS.verified_manufacturer.productId) !== -1);
      return { ok: true, json: async function () { return { data: [{ id: 'price_1TestVerified', active: true }] }; } };
    }
    posted = opts && opts.body;
    return { ok: true, status: 200, json: async function () { return { id: 'cs_test_recover', url: 'https://checkout.stripe.com/c/pay/cs_test_recover' }; } };
  };
  const recovered = await post(buyer());
  const recoveredBody = JSON.parse(recovered.body);
  const sent = new URLSearchParams(posted);
  assert.strictEqual(recovered.statusCode, 200);
  assert.strictEqual(recoveredBody.url, 'https://checkout.stripe.com/c/pay/cs_test_recover');
  assert.strictEqual(recoveredBody.payment_link, false);
  assert.strictEqual(sent.get('customer_email'), 'buyer@example.com');
  assert.strictEqual(sent.get('line_items[0][price]'), 'price_1TestVerified');
  assert.strictEqual(sent.get('line_items[0][quantity]'), '1');
  assert.strictEqual(sent.get('cancel_url'), profile);
  assert.ok(sent.get('cancel_url') !== 'https://stripe.com');
  assert.strictEqual(sent.get('client_reference_id'), 'ormazabal');
  assert.strictEqual(sent.get('metadata[product]'), 'verified_manufacturer');
  assert.strictEqual(sent.get('automatic_tax[enabled]'), 'true');
  assert.ok(JSON.stringify(recoveredBody).indexOf('buy.stripe.com') === -1);

  global.fetch = async function (url) {
    const u = String(url);
    if (u.indexOf('/v1/checkout/sessions') !== -1) {
      return { ok: false, status: 403, json: async function () { return { error: { code: 'more_permissions_required' } }; } };
    }
    if (u.indexOf('/v1/payment_links?') !== -1) {
      return { ok: true, json: async function () {
        return { data: [{ id: 'plink_verified', url: paid.PAYMENT_LINKS.verified_manufacturer.url, automatic_tax: { enabled: true }, billing_address_collection: 'auto', metadata: {} }], has_more: false };
      } };
    }
    if (u.indexOf('/line_items') !== -1) {
      return { ok: true, json: async function () { return { data: [{ price: 'price_live_verified' }] }; } };
    }
    return { ok: false, status: 403, json: async function () { return { error: { code: 'more_permissions_required' } }; } };
  };
  const sessionForbidden = await post(buyer());
  const forbiddenBody = JSON.parse(sessionForbidden.body);
  const forbiddenUrl = new URL(forbiddenBody.url);
  assert.strictEqual(sessionForbidden.statusCode, 200);
  assert.strictEqual(forbiddenBody.payment_link, true);
  assert.strictEqual(forbiddenBody.fallback_reason, 'stripe_403');
  assert.strictEqual(forbiddenBody.error, undefined);
  assert.strictEqual(forbiddenUrl.hostname, 'buy.stripe.com');
  assert.strictEqual(forbiddenUrl.searchParams.get('prefilled_email'), 'buyer@example.com');
  assert.strictEqual(forbiddenUrl.searchParams.get('client_reference_id'), 'ormazabal');
  assert.ok(forbiddenUrl.searchParams.get('prefilled_promo_code') == null);

  global.fetch = async function () {
    return { ok: true, status: 200, json: async function () { return { id: 'cs_bad', url: paid.PAYMENT_LINKS.verified_manufacturer.url + '?prefilled_email=buyer%40example.com' }; } };
  };
  const bareLink = await post(buyer());
  const bareBody = JSON.parse(bareLink.body);
  assert.strictEqual(bareLink.statusCode, 502);
  assert.strictEqual(bareBody.url, undefined);
  assert.strictEqual(bareBody.payment_link, false);

  const htmlFail = await cont.handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'product=verified_manufacturer&email=' + encodeURIComponent('buyer@example.com') + '&slug=ormazabal&from=' + encodeURIComponent(profile)
  });
  assert.strictEqual(htmlFail.statusCode, 502);
  assert.ok(!htmlFail.headers.Location);
  assert.ok(htmlFail.body.indexOf('payment did not start') !== -1);
  assert.ok(htmlFail.body.indexOf('buy.stripe.com') === -1);

  let clientPosted = '';
  const followed = await email.continueCheckout(buyer(), function (url, opts) {
    clientPosted = opts.body;
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({
          url: paid.PAYMENT_LINKS.verified_manufacturer.url + '?prefilled_email=buyer%40example.com',
          saved: false,
          payment_link: true,
          fallback_reason: 'stripe_403'
        });
      }
    });
  });
  assert.strictEqual(followed.ok, true);
  assert.strictEqual(followed.payment_link, true);
  assert.ok(followed.url.indexOf('https://buy.stripe.com/') === 0);
  assert.ok(clientPosted.indexOf('buyer@example.com') !== -1);
  const sessionFollow = await email.continueCheckout(buyer(), function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({ url: 'https://checkout.stripe.com/c/pay/cs_test_client', saved: true, payment_link: false });
      }
    });
  });
  assert.strictEqual(sessionFollow.ok, true);
  assert.strictEqual(sessionFollow.url, 'https://checkout.stripe.com/c/pay/cs_test_client');
  assert.strictEqual(email.isCheckoutSessionUrl('https://stripe.com'), false);
  assert.strictEqual(email.isCheckoutSessionUrl(paid.PAYMENT_LINKS.verified_manufacturer.url), false);

  const page = require('fs').readFileSync(require('path').join(__dirname, '..', 'checkout/index.html'), 'utf8');
  assert.ok(page.indexOf('continueCheckout') !== -1);
  assert.ok(page.indexOf('isCheckoutSessionUrl') !== -1);
  assert.ok(page.indexOf('isPaymentLinkUrl') !== -1);
  assert.ok(page.indexOf('Your email is saved with this plan before payment opens') === -1);
  assert.ok(page.indexOf('It is not saved as a TransformerPath lead') !== -1);
  assert.ok(page.indexOf('leadNotice(res.saved === true)') !== -1);
  assert.strictEqual(email.leadNotice(true).indexOf('not saved'), -1);
  assert.ok(email.leadNotice(false).indexOf('not saved as a TransformerPath lead') !== -1);
  assert.ok(email.leadNotice(undefined).indexOf('not saved as a TransformerPath lead') !== -1);
  assert.ok(page.indexOf('payment did not start') !== -1);
  assert.ok(page.indexOf("q.get('client_reference_id')") !== -1);

  if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedKey;
  if (savedFetch === undefined) delete global.fetch;
  else global.fetch = savedFetch;
  delete cont._leadInsertForTests;
  console.log('checkout continue: PASS');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
