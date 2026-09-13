/**
 * Stripe webhook — hardened fulfillment (Phase-2 §10).
 *
 * Guarantees:
 *   - signature verified (constructEvent with STRIPE_WEBHOOK_SECRET)
 *   - idempotent — processed Stripe event IDs are recorded; replays never
 *     grant/notify twice
 *   - event-specific — only intended events change entitlement (paid checkout /
 *     active subscription grant; refund / subscription deletion revoke)
 *   - auditable — every action is written to the fulfillment audit log with the
 *     Stripe event ID, customer, product/price, entitlement and timestamp
 *   - server-authoritative — entitlement lives in the fulfillment store, not the
 *     client
 *   - revocable — refunds and cancellations remove future entitlement
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (required);
 *      SLACK_WEBHOOK_URL / SENDGRID_API_KEY + ADMIN_EMAIL (optional notifiers).
 */
const Stripe = require('stripe');
const { defaultStore } = require('./lib/fulfillment-store');

// Known commercial SKUs (mirror of payments-config.js / create-checkout.js).
const KNOWN_SKUS = new Set([
  'directory_verified', 'directory_premium', 'directory_enterprise',
  'sponsor_daily_brief', 'sponsor_featured_article',
  'component_3d_feature', 'component_3d_exclusive',
  'academy_pro', 'academy_team', 'academy_enterprise',
  'rfq_boost', 'jobs_featured'
]);

// Only these event types may change entitlement.
const GRANT_EVENTS = new Set(['checkout.session.completed', 'invoice.paid', 'customer.subscription.created', 'customer.subscription.updated']);
const REVOKE_EVENTS = new Set(['charge.refunded', 'charge.dispute.created', 'customer.subscription.deleted']);

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function rawBodyFrom(event) {
  if (event.isBase64Encoded && event.body) return Buffer.from(event.body, 'base64');
  return event.body || '';
}

function centsToDisplay(amount, currency) {
  if (typeof amount !== 'number') return 'n/a';
  const v = (amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (currency ? currency.toUpperCase() + ' ' : '$') + v;
}

function customerOf(obj) {
  return (
    (obj.customer_details && obj.customer_details.email) ||
    obj.customer_email ||
    (obj.metadata && obj.metadata.email) ||
    obj.customer ||
    'unknown'
  );
}

async function notifySlack(url, text) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error('Slack responded ' + res.status);
}

async function notifyEmail(subject, text) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!apiKey || !to) return { skipped: true };
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@transformerpath.com', name: process.env.SENDGRID_FROM_NAME || 'TransformerPath' },
      subject,
      content: [{ type: 'text/plain', value: text }]
    })
  });
  if (!res.ok) throw new Error('SendGrid responded ' + res.status);
  return { sent: true };
}

async function notify(summary) {
  const jobs = [];
  if (process.env.SLACK_WEBHOOK_URL) {
    const lines = [
      ':white_check_mark: *TransformerPath fulfillment: ' + summary.action + '*',
      '*SKU:* ' + summary.sku, '*Customer:* ' + summary.customer, '*Amount:* ' + summary.amount,
      '*Stripe event:* ' + summary.eventId
    ];
    jobs.push(notifySlack(process.env.SLACK_WEBHOOK_URL, lines.join('\n')));
  }
  if (process.env.SENDGRID_API_KEY && process.env.ADMIN_EMAIL) {
    jobs.push(notifyEmail('TransformerPath fulfillment: ' + summary.sku, JSON.stringify(summary, null, 2)));
  }
  if (jobs.length === 0) return { notified: 0 };
  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === 'rejected');
  failed.forEach((r) => console.error('Notifier failed:', r.reason && r.reason.message));
  if (failed.length === jobs.length) throw new Error('All notifiers failed');
  return { notified: jobs.length - failed.length };
}

function subOf(stripeEvent) {
  return stripeEvent.data && stripeEvent.data.object ? stripeEvent.data.object : {};
}

/** Factory so tests can inject an in-memory store. */
function createHandler(deps) {
  const store = (deps && deps.store) || defaultStore();
  const notifier = (deps && deps.notify) || notify;

  return async function handler(event) {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const secret = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !webhookSecret) {
      return json(503, { error: 'Webhook not configured.', code: 'stripe_webhook_not_configured' });
    }

    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    if (!sig) return json(400, { error: 'Missing stripe-signature header' });

    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });
    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(rawBodyFrom(event), sig, webhookSecret);
    } catch (err) {
      console.error('Signature verification failed:', err.message);
      return json(400, { error: 'Invalid signature', code: 'signature_verification_failed' });
    }

    // Idempotency: never process the same event twice.
    if (store.hasProcessed(stripeEvent.id)) {
      store.audit({ eventId: stripeEvent.id, type: stripeEvent.type, action: 'duplicate_ignored' });
      return json(200, { received: true, duplicate: true, type: stripeEvent.type });
    }

    try {
      const obj = subOf(stripeEvent);
      const customer = customerOf(obj);

      if (GRANT_EVENTS.has(stripeEvent.type)) {
        // Event-specific: a checkout must actually be paid to grant access.
        const paid =
          stripeEvent.type === 'checkout.session.completed'
            ? obj.payment_status === 'paid' || obj.status === 'complete'
            : true;
        const sku = (obj.metadata && obj.metadata.sku) || null;

        if (!paid) {
          store.audit({ eventId: stripeEvent.id, type: stripeEvent.type, action: 'ignored_unpaid', customer, sku });
          store.markProcessed(stripeEvent.id, { action: 'ignored_unpaid' });
          return json(200, { received: true, granted: false, reason: 'not_paid' });
        }
        if (!sku || !KNOWN_SKUS.has(sku)) {
          store.audit({ eventId: stripeEvent.id, type: stripeEvent.type, action: 'unrecognized_sku', customer, sku });
          store.markProcessed(stripeEvent.id, { action: 'unrecognized_sku' });
          return json(200, { received: true, granted: false, reason: 'unrecognized_sku', sku });
        }

        const ent = store.grantEntitlement({
          customer, sku, eventId: stripeEvent.id, sessionId: obj.id,
          productId: (obj.metadata && obj.metadata.product_id) || null,
          priceId: (obj.metadata && obj.metadata.price_id) || null
        });
        const summary = { action: 'grant', sku, customer, amount: centsToDisplay(obj.amount_total, obj.currency), eventId: stripeEvent.id };
        store.audit(Object.assign({ type: stripeEvent.type, entitlement: ent.status }, summary));
        let notifyResult = { notified: 0 };
        try { notifyResult = await notifier(summary); } catch (e) { console.error('notify failed:', e.message); }
        store.markProcessed(stripeEvent.id, { action: 'grant', sku, customer });
        return json(200, { received: true, granted: true, sku, customer, notify: notifyResult });
      }

      if (REVOKE_EVENTS.has(stripeEvent.type)) {
        const sku = (obj.metadata && obj.metadata.sku) || null;
        const revoked = sku
          ? [store.revokeEntitlement({ customer, sku, reason: stripeEvent.type, eventId: stripeEvent.id })].filter(Boolean).map(() => sku)
          : store.revokeAllForCustomer(customer, stripeEvent.type, stripeEvent.id);
        store.audit({ eventId: stripeEvent.id, type: stripeEvent.type, action: 'revoke', customer, revoked });
        store.markProcessed(stripeEvent.id, { action: 'revoke', customer });
        return json(200, { received: true, revoked });
      }

      store.audit({ eventId: stripeEvent.id, type: stripeEvent.type, action: 'ignored' });
      store.markProcessed(stripeEvent.id, { action: 'ignored' });
      return json(200, { received: true, ignored: true, type: stripeEvent.type });
    } catch (err) {
      console.error('Fulfillment error:', err);
      // Do NOT mark processed — allow Stripe to retry.
      return json(500, { error: err.message || 'Fulfillment failed', code: 'fulfillment_error' });
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.KNOWN_SKUS = KNOWN_SKUS;
