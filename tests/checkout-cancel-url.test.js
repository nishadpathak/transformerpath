/* Cancel URL for Verified, Featured, and Featured + Verified.
 * Run: node tests/checkout-cancel-url.test.js
 */
'use strict';

const assert = require('assert');
const session = require('../lib/checkout-session');

const profile = 'https://transformerpath.com/manufacturers/ormazabal/';
const pricing = 'https://transformerpath.com/pricing/';

assert.strictEqual(session.cancelUrl('verified_manufacturer', profile), profile);
assert.strictEqual(session.cancelUrl('featured_listing', profile), profile);
assert.strictEqual(session.cancelUrl('featured_verified', 'https://transformerpath.com/manufacturers/spain.html'), 'https://transformerpath.com/manufacturers/spain.html');
assert.strictEqual(session.cancelUrl('verified_manufacturer', '/manufacturers/bhel/'), 'https://transformerpath.com/manufacturers/bhel/');
assert.strictEqual(session.cancelUrl('verified_manufacturer', ''), pricing);
assert.strictEqual(session.cancelUrl('verified_manufacturer', 'https://transformerpath.com/checkout/?product=verified_manufacturer'), pricing);
assert.strictEqual(session.cancelUrl('learning', profile), pricing);
assert.strictEqual(session.cancelUrl('featured_event', profile), pricing);

[
  'https://evil.com/manufacturers/ormazabal/',
  'https://transformerpath.com.evil.com/',
  'https://evil.com/https://transformerpath.com/',
  '//evil.com',
  'https://user@transformerpath.com/',
  'https://user:pass@transformerpath.com/manufacturers/ormazabal/',
  'http://transformerpath.com/manufacturers/ormazabal/',
  'javascript:alert(1)',
  'https://transformerpath.com\\@evil.com/',
  'https://phishing.com/?next=https://transformerpath.com/',
  'https://www.transformerpath.com/manufacturers/ormazabal/',
  'https://transformerpath.com:444/manufacturers/ormazabal/'
].forEach(function (bad) {
  assert.strictEqual(session.cancelUrl('verified_manufacturer', bad), pricing, bad);
});

const fields = session.sessionFields({
  product: 'verified_manufacturer',
  email: 'buyer@example.com',
  priceId: 'price_existing_verified',
  slug: 'ormazabal',
  from: profile,
  automaticTax: true,
  billingAddressCollection: 'required',
  metadata: { source: 'payment_link' }
});
const body = fields.toString();
assert.ok(body.indexOf('line_items%5B0%5D%5Bprice%5D=price_existing_verified') !== -1);
assert.ok(body.indexOf('line_items%5B0%5D%5Bquantity%5D=1') !== -1);
assert.ok(body.indexOf('customer_email=buyer%40example.com') !== -1);
assert.ok(body.indexOf('client_reference_id=ormazabal') !== -1);
assert.ok(body.indexOf('metadata%5Bproduct%5D=verified_manufacturer') !== -1);
assert.ok(body.indexOf('metadata%5Bcompany_slug%5D=ormazabal') !== -1);
assert.ok(body.indexOf('automatic_tax%5Benabled%5D=true') !== -1);
assert.ok(body.indexOf('allow_promotion_codes=false') !== -1);
assert.ok(body.indexOf('prefilled_promo_code') === -1);
assert.ok(body.indexOf('cancel_url=' + encodeURIComponent(profile)) !== -1);
assert.ok(body.indexOf('success_url=' + encodeURIComponent('https://transformerpath.com/claim-profile.html?paid=verified_manufacturer&session_id={CHECKOUT_SESSION_ID}')) !== -1);
assert.ok(body.indexOf('%23claimForm') === -1);

const featured = session.sessionFields({
  product: 'featured_listing',
  email: 'buyer@example.com',
  priceId: 'price_existing_featured',
  slug: 'ormazabal',
  from: 'https://evil.example/steal',
  automaticTax: false
});
assert.strictEqual(featured.get('cancel_url'), pricing);
assert.strictEqual(featured.get('allow_promotion_codes'), 'false');
assert.strictEqual(featured.get('line_items[0][quantity]'), '1');

const away = session.sessionFields({
  product: 'learning',
  email: 'buyer@example.com',
  priceId: 'price_existing_learning',
  from: profile
});
assert.strictEqual(away.get('cancel_url'), pricing);

const paid = require('../lib/paid-listings');
const cont = require('../functions/checkout-continue');

(async function () {
  const saved = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  let called = false;
  global.fetch = function () { called = true; throw new Error('stripe must not be called'); };
  const missing = await cont.handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ product: 'verified_manufacturer', email: 'buyer@example.com', slug: 'ormazabal', from: profile })
  });
  const missingBody = JSON.parse(missing.body);
  assert.strictEqual(missing.statusCode, 200);
  assert.strictEqual(called, false);
  assert.strictEqual(missingBody.payment_link, true);
  assert.strictEqual(missingBody.fallback_reason, 'missing_key');
  assert.strictEqual(
    missingBody.url,
    paid.PAYMENT_LINKS.verified_manufacturer.url + '?client_reference_id=ormazabal&prefilled_email=' + encodeURIComponent('buyer@example.com')
  );

  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_not_a_real_key';
  let posted = '';
  global.fetch = async function (url, opts) {
    const u = String(url);
    if (u.indexOf('/v1/payment_links?') !== -1) {
      return { ok: true, json: async function () {
        return {
          data: [{
            id: 'plink_verified',
            url: paid.PAYMENT_LINKS.verified_manufacturer.url,
            automatic_tax: { enabled: true },
            billing_address_collection: 'required',
            metadata: { kept: 'yes' }
          }],
          has_more: false
        };
      } };
    }
    if (u.indexOf('/line_items') !== -1) {
      return { ok: true, json: async function () { return { data: [{ price: { id: 'price_live_verified' } }] }; } };
    }
    posted = opts.body;
    return { ok: true, json: async function () { return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }; } };
  };
  const opened = await cont.handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ product: 'verified_manufacturer', email: 'buyer@example.com', slug: 'ormazabal', from: profile })
  });
  const openedBody = JSON.parse(opened.body);
  const sent = new URLSearchParams(posted);
  assert.strictEqual(opened.statusCode, 200);
  assert.strictEqual(openedBody.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  assert.ok(openedBody.url.indexOf('buy.stripe.com') === -1);
  assert.strictEqual(sent.get('line_items[0][price]'), 'price_live_verified');
  assert.strictEqual(sent.get('line_items[0][quantity]'), '1');
  assert.strictEqual(sent.get('allow_promotion_codes'), 'false');
  assert.strictEqual(sent.get('automatic_tax[enabled]'), 'true');
  assert.strictEqual(sent.get('customer_email'), 'buyer@example.com');
  assert.strictEqual(sent.get('client_reference_id'), 'ormazabal');
  assert.strictEqual(sent.get('metadata[product]'), 'verified_manufacturer');
  assert.strictEqual(sent.get('metadata[company_slug]'), 'ormazabal');
  assert.strictEqual(sent.get('metadata[kept]'), 'yes');
  assert.strictEqual(sent.get('cancel_url'), profile);
  assert.ok(!sent.has('prefilled_promo_code'));
  if (saved === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = saved;
  console.log('checkout cancel url: PASS');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
