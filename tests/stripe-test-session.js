/* Optional Stripe test-mode Checkout Session.
 *
 * Creates a session only when STRIPE_SECRET_KEY starts with sk_test_ and the
 * price id for the requested product is set. Refuses sk_live_. Does not
 * confirm or capture a payment. Prints the session id only.
 *
 *   node tests/stripe-test-session.js verified_manufacturer
 *   node tests/stripe-test-session.js featured_event
 *   node tests/stripe-test-session.js featured_exhibitor
 */
'use strict';
const paid = require('../lib/paid-listings');

const product = process.argv[2] || 'verified_manufacturer';
const secret = (process.env.STRIPE_SECRET_KEY || '').trim();

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

async function main() {
  if (!paid.PRODUCTS[product]) {
    out({ ok: false, reason: 'unknown product' });
    process.exit(1);
  }
  if (!secret) {
    out({ ok: false, skipped: true, reason: 'STRIPE_SECRET_KEY not set' });
    process.exit(0);
  }
  if (secret.indexOf('sk_live_') === 0) {
    out({ ok: false, reason: 'refusing live key' });
    process.exit(1);
  }
  if (secret.indexOf('sk_test_') !== 0) {
    out({ ok: false, skipped: true, reason: 'key is not a test key' });
    process.exit(0);
  }
  const priceEnv = paid.PRODUCTS[product].priceEnv;
  const price = (process.env[priceEnv] || '').trim();
  if (!price) {
    out({ ok: false, skipped: true, reason: priceEnv + ' not set' });
    process.exit(0);
  }

  const origin = (process.env.SITE_URL || 'https://transformerpath.com').replace(/\/$/, '');
  const successPath = paid.PAYMENT_LINKS[product].successPath;
  const cancelPath = product === 'featured_exhibitor'
    ? '/sponsor.html#contact'
    : product === 'featured_event' ? '/events.html#submit-event' : '/claim-profile.html#claimForm';
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('customer_email', 'payments-ready-test@example.com');
  form.set('success_url', origin + successPath);
  form.set('cancel_url', origin + cancelPath);
  form.set('line_items[0][price]', price);
  form.set('line_items[0][quantity]', '1');
  form.set('metadata[product]', product);
  if (product === 'verified_manufacturer') form.set('metadata[company_slug]', 'a-plus-power-solution');
  if (product === 'featured_event' || product === 'featured_exhibitor') form.set('metadata[event_id]', 'middle-east-energy');

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + secret,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  const session = await res.json().catch(function () { return {}; });
  if (!res.ok || !session.id) {
    out({ ok: false, reason: 'stripe_error', status: res.status });
    process.exit(1);
  }
  if (String(session.id).indexOf('cs_test_') !== 0 || session.livemode === true) {
    out({ ok: false, reason: 'not a test session' });
    process.exit(1);
  }
  out({ ok: true, id: session.id, livemode: false, product: product });
}

main().catch(function () {
  out({ ok: false, reason: 'error' });
  process.exit(1);
});
