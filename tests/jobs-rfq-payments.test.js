/* Jobs and RFQ Payment Links stay classified, and the public buy buttons
 * stay off unless TP_JOBS_RFQ_PAYMENTS is turned on. No live charge.
 * The committed flag file stays false.
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  PASS  ' + name);
  else { failed++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

const paid = require('../lib/paid-listings');
const flags = require('../lib/feature-flags');
const commerceFlags = require('../functions/commerce-flags');
const checkout = require('../functions/create-checkout');
const confirm = require('../functions/confirm-listing-payment');
const receipt = require('../functions/lib/paid-receipt');

const CODES = [
  'aFa14g5y01138c0c1AfYY08',
  '4gM5kw4tW5hjdwk5DcfYY09',
  '3cI7sE9Og6lndwk0iSfYY0a',
  '00w3co1hKeRT3VK5DcfYY0b',
  '8x28wIgcEh01boc2r0fYY0c',
  'bJeeV66C4cJL9g4d5EfYY0d'
];

const saved = process.env.TP_JOBS_RFQ_PAYMENTS;
delete process.env.TP_JOBS_RFQ_PAYMENTS;

const file = JSON.parse(fs.readFileSync('data/feature-flags.json', 'utf8'));
check('committed flag is off', file.jobs_rfq_payments === false);
check('unset env follows the file flag', flags.jobsRfqPaymentsEnabled() === false);
process.env.TP_JOBS_RFQ_PAYMENTS = '1';
check('env 1 turns payments on', flags.jobsRfqPaymentsEnabled() === true);
process.env.TP_JOBS_RFQ_PAYMENTS = 'true';
check('env true turns payments on', flags.jobsRfqPaymentsEnabled() === true);
process.env.TP_JOBS_RFQ_PAYMENTS = 'on';
check('env on turns payments on', flags.jobsRfqPaymentsEnabled() === true);
process.env.TP_JOBS_RFQ_PAYMENTS = '0';
check('env 0 forces payments off', flags.jobsRfqPaymentsEnabled() === false);
process.env.TP_JOBS_RFQ_PAYMENTS = 'false';
check('env false forces payments off', flags.jobsRfqPaymentsEnabled() === false);
process.env.TP_JOBS_RFQ_PAYMENTS = 'off';
check('env off forces payments off', flags.jobsRfqPaymentsEnabled() === false);
process.env.TP_JOBS_RFQ_PAYMENTS = 'maybe';
check('unknown env value stays off', flags.jobsRfqPaymentsEnabled() === false);
delete process.env.TP_JOBS_RFQ_PAYMENTS;

['jobs.html', 'rfq.html', 'supplier-inbox.html', 'pricing.html', 'jobs-rfq-pay.js'].forEach(function (fileName) {
  const text = fs.readFileSync(fileName, 'utf8');
  CODES.forEach(function (code) {
    check(fileName + ' has no ' + code, text.indexOf(code) === -1);
  });
  check(fileName + ' has no plink id', text.indexOf('plink_1UQh') === -1);
});
check('button script does not embed a Stripe URL', fs.readFileSync('jobs-rfq-pay.js', 'utf8').indexOf('buy.stripe.com') === -1);
check('jobs heading stays free until the flag paints it', fs.readFileSync('jobs.html', 'utf8').indexOf('Hiring? Post a Job — Free') !== -1);
check('flag-on heading is only in the button script', fs.readFileSync('jobs-rfq-pay.js', 'utf8').indexOf('Submit a vacancy') !== -1);

const products = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
const commerce = JSON.parse(fs.readFileSync('data/commerce.json', 'utf8'));
const charged = 'Verified-level profile, the RFQ inbox, and four qualified leads.';
const supplier = commerce.sections.filter(function (s) { return s.id === 'manufacturers'; })[0].products.filter(function (p) { return p.id === 'supplier_pro'; })[0];
check('charged Supplier Pro outcome is the delivered set', products.b2b_supplier.supplier_pro.outcome === charged && supplier.outcome === charged);
check('Supplier Pro price status stays TARGET', products.b2b_supplier.supplier_pro.price_status === 'TARGET');
check('pricing card no longer sells the full operating suite', fs.readFileSync('pricing.html', 'utf8').indexOf('Complete commercial operating workspace') === -1 && fs.readFileSync('pricing.html', 'utf8').indexOf(charged) !== -1);

['job_standard', 'job_featured', 'job_bundle_5', 'rfq_lead', 'rfq_lead_pro', 'supplier_pro'].forEach(function (id) {
  const spec = paid.PAYMENT_LINKS[id];
  check(id + ' success path keeps the session placeholder', spec.successPath.indexOf('{CHECKOUT_SESSION_ID}') !== -1 && spec.successPath.indexOf('paid=' + id) !== -1);
  check(id + ' amount is the launch price', typeof spec.amountCents === 'number' && spec.amountCents > 0);
});
check('job returns land on jobs.html', paid.PAYMENT_LINKS.job_standard.successPath.indexOf('/jobs.html') === 0 && paid.checkoutCancelPath('job_featured') === '/jobs.html#post');
check('RFQ returns land on rfq.html', paid.PAYMENT_LINKS.rfq_lead.successPath.indexOf('/rfq.html') === 0 && paid.PAYMENT_LINKS.supplier_pro.successPath.indexOf('/rfq.html') === 0 && paid.checkoutCancelPath('supplier_pro') === '/rfq.html');
check('Supplier Pro checkout is a subscription', paid.PRODUCTS.supplier_pro.mode === 'subscription' && paid.PRODUCTS.job_standard.mode === 'payment');
check('Supplier Pro link stays at the launch amount', paid.PAYMENT_LINKS.supplier_pro.amountCents === 149900);
check('stored Supplier Pro URL has no promo', paid.PAYMENT_LINKS.supplier_pro.url.indexOf('FOUNDING30') === -1);
check('button href adds FOUNDING30', paid.paymentButtonHref('supplier_pro') === paid.PAYMENT_LINKS.supplier_pro.url + '?prefilled_promo_code=FOUNDING30');
check('other button hrefs stay the stored URL', paid.paymentButtonHref('job_standard') === paid.PAYMENT_LINKS.job_standard.url);

check('pro return is not the standard lead', paid.listingProduct({
  success_url: 'https://transformerpath.com/rfq.html?paid=rfq_lead_pro&session_id={CHECKOUT_SESSION_ID}',
  metadata: {}
}) === 'rfq_lead_pro');
check('fake job plink stays unclassified', paid.listingProduct({ amount_total: 19900, currency: 'usd', payment_link: 'plink_job_standard', metadata: {} }) === null);
check('fake featured job plink is not Featured Event', paid.isFeaturedEventCheckout({ amount_total: 29900, currency: 'usd', payment_link: 'plink_job_featured', metadata: {} }) === false);
check('real job featured plink is the job product', paid.listingProduct({
  amount_total: 29900,
  currency: 'usd',
  payment_link: paid.PAYMENT_LINKS.job_featured.plinkId,
  metadata: {}
}) === 'job_featured');
check('real job standard plink is not Learning', paid.listingProduct({
  amount_total: 19900,
  currency: 'usd',
  payment_link: paid.PAYMENT_LINKS.job_standard.plinkId,
  metadata: {}
}) === 'job_standard');
process.env.STRIPE_PAYMENT_LINK_JOB_FEATURED = 'plink_override_only';
check('env plink overrides the committed id', paid.listingProduct({ payment_link: 'plink_override_only', metadata: {} }) === 'job_featured');
check('committed id does not match while env is set', paid.listingProduct({ payment_link: paid.PAYMENT_LINKS.job_featured.plinkId, metadata: {} }) === null);
delete process.env.STRIPE_PAYMENT_LINK_JOB_FEATURED;

(async function () {
  delete process.env.TP_JOBS_RFQ_PAYMENTS;
  const off = await commerceFlags.handler({});
  const offBody = JSON.parse(off.body);
  check('flag function is off by default', off.statusCode === 200 && offBody.jobs_rfq_payments === false && !offBody.groups);
  check('off response has no Stripe URL', off.body.indexOf('buy.stripe.com') === -1 && off.body.indexOf('plink_') === -1);

  process.env.TP_JOBS_RFQ_PAYMENTS = '1';
  const on = await commerceFlags.handler({});
  const onBody = JSON.parse(on.body);
  check('flag function returns the six buttons', on.statusCode === 200 && onBody.groups.jobs.length === 3 && onBody.groups.rfq.length === 2 && onBody.groups.supplier.length === 1);
  check('on response still hides plink ids', on.body.indexOf('plink_') === -1);
  check('supplier button carries the promo', onBody.groups.supplier[0].href.indexOf('prefilled_promo_code=FOUNDING30') !== -1);
  delete process.env.TP_JOBS_RFQ_PAYMENTS;

  let called = false;
  global.fetch = function () { called = true; throw new Error('stripe must not be called'); };
  delete process.env.STRIPE_SECRET_KEY;
  const blocked = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ product: 'job_standard', email: 'buyer@example.com' })
  });
  check('checkout refuses a job while the flag is off', blocked.statusCode === 403 && JSON.parse(blocked.body).enabled === false && called === false, blocked.body);

  process.env.TP_JOBS_RFQ_PAYMENTS = '1';
  const unpriced = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ product: 'supplier_pro', email: 'buyer@example.com' })
  });
  check('checkout does not call Stripe without a price env', unpriced.statusCode === 503 && called === false, unpriced.body);
  delete process.env.TP_JOBS_RFQ_PAYMENTS;

  const pending = await confirm.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ product: 'job_standard', session_id: 'cs_test_job' })
  });
  const pendingBody = JSON.parse(pending.body);
  check('confirm without a secret is not paid', pending.statusCode === 200 && pendingBody.configured === false && pendingBody.paid === false && called === false, pending.body);
  const badProduct = await confirm.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ product: 'learning', session_id: 'cs_test_job' })
  });
  check('confirm rejects a course product', badProduct.statusCode === 400);

  const note = receipt.messages({
    product: 'job_standard',
    session_id: 'cs_test_job',
    email: 'buyer@example.com',
    amount: 19900,
    currency: 'usd',
    livemode: false
  });
  check('receipt does not publish the vacancy', note.buyer.text.indexOf('does not publish') !== -1 && note.buyer.text.indexOf('paid, pending verification') !== -1);

  delete process.env.RESEND_API_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_jobs_rfq_unit';
  const Module = require('module');
  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === '@supabase/supabase-js') return { createClient: function () { return {}; } };
    return origRequire.apply(this, arguments);
  };
  const wh = require('../functions/stripe-webhook');
  Module.prototype.require = origRequire;
  const events = new Map();
  const listings = new Map();
  wh._setPersistenceForTests({
    eventProcessed: async function (id) { return events.has(id); },
    markProcessed: async function (id, type) { events.set(id, type); },
    writeEntitlement: async function () { throw new Error('job payment must not write an entitlement'); },
    writePaidListing: async function (row) { listings.set(row.session_id, row); }
  });
  const payload = JSON.stringify({
    id: 'evt_job_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_job_standard',
        amount_total: 19900,
        currency: 'usd',
        livemode: false,
        customer_email: 'jobs@example.com',
        metadata: {},
        payment_link: paid.PAYMENT_LINKS.job_standard.plinkId
      }
    }
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(ts + '.' + payload, 'utf8').digest('hex');
  const posted = await wh.handler({
    httpMethod: 'POST',
    headers: { 'stripe-signature': 't=' + ts + ',v1=' + sig },
    body: payload
  });
  const row = listings.get('cs_test_job_standard');
  check('webhook stores the job as pending verification', posted.statusCode === 200 && row && row.product === 'job_standard' && row.status === 'paid_pending_verification', posted.body);
  delete process.env.STRIPE_WEBHOOK_SECRET;

  if (saved == null) delete process.env.TP_JOBS_RFQ_PAYMENTS;
  else process.env.TP_JOBS_RFQ_PAYMENTS = saved;

  if (failed) {
    console.error('\njobs-rfq payments: ' + failed + ' failed');
    process.exit(1);
  }
  console.log('\njobs-rfq payments: PASS');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
