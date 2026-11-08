'use strict';

const assert = require('assert');
const paid = require('../lib/paid-listings');
const csv = require('../lib/csv-pay');
const checkout = require('../lib/checkout-session');
const snapshot = require('./fixtures/stripe-payment-links.json');
const live = new Map(snapshot.links.map(row => [row.url, row]));
let checked = 0;

Object.entries(paid.PAYMENT_LINKS).forEach(([product, spec]) => {
  const row = live.get(spec.url);
  assert.ok(row, product + ': missing active live Payment Link');
  assert.strictEqual(spec.amountCents, row.amountCents, product + ': price');
  assert.strictEqual(row.currency, 'usd', product + ': currency');
  if (spec.plinkId) assert.strictEqual(spec.plinkId, row.id, product + ': id');
  const form = checkout.sessionFields({ product, email: 'buyer@example.com', priceId: 'price_fixture' });
  assert.strictEqual(form.get('mode'), row.mode, product + ': billing mode');
  assert.strictEqual(new URL(form.get('success_url')).hostname, 'transformerpath.com');
  checked++;
});

Object.entries(csv.LINKS).forEach(([product, spec]) => {
  const row = live.get(spec.url);
  assert.ok(row, product + ': missing active live Payment Link');
  assert.strictEqual(spec.amountUsd * 100, row.amountCents, product + ': price');
  assert.strictEqual(row.mode, 'payment', product + ': billing mode');
  checked++;
});

(async function () {
  let calls = 0;
  await assert.rejects(checkout.priceForProduct('verified_manufacturer', 'fixture', async () => {
    calls++;
    return { ok: true, json: async () => ({ data: [{ id: 'plink_inactive', active: false, url: paid.PAYMENT_LINKS.verified_manufacturer.url }], has_more: false }) };
  }), error => error.code === 'payment_link_inactive');
  assert.strictEqual(calls, 1, 'inactive link must not fall through to catalog price');
  console.log('payment links: ' + checked + ' live catalog matches; billing modes and inactive-link rejection PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
