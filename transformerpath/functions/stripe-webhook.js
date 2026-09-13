/**
 * Stripe webhook — automatic fulfillment notifications.
 *
 * Receives Stripe events (configured in the Stripe Dashboard to POST to
 * /.netlify/functions/stripe-webhook), verifies the signature, and on a
 * completed checkout notifies the team with everything needed to fulfill the
 * order (SKU, company, contact, amount). Because the site has no database,
 * "fulfillment" here means an instant Slack message and/or email so a human
 * can set the directory badge / featured supplier described in MONETIZATION.md.
 *
 * Env:
 *   STRIPE_SECRET_KEY      required (sk_live_… or sk_test_…)
 *   STRIPE_WEBHOOK_SECRET  required (whsec_…) — from the Stripe Dashboard endpoint
 *   SLACK_WEBHOOK_URL      optional — posts a fulfillment message to Slack
 *   SENDGRID_API_KEY       optional — emails a fulfillment message
 *   SENDGRID_FROM_EMAIL    optional (default noreply@transformerpath.com)
 *   SENDGRID_FROM_NAME     optional (default TransformerPath)
 *   ADMIN_EMAIL            optional — recipient of the fulfillment email
 */
const Stripe = require('stripe');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function rawBodyFrom(event) {
  if (event.isBase64Encoded && event.body) {
    return Buffer.from(event.body, 'base64');
  }
  return event.body || '';
}

function centsToDisplay(amount, currency) {
  if (typeof amount !== 'number') return 'n/a';
  const value = (amount / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return (currency ? currency.toUpperCase() + ' ' : '$') + value;
}

function summarize(session) {
  const md = session.metadata || {};
  const email =
    (session.customer_details && session.customer_details.email) ||
    session.customer_email ||
    md.email ||
    'unknown';
  return {
    sku: md.sku || 'unknown',
    product: md.product_name || md.sku || 'unknown',
    company: md.company || '',
    contact: md.contact_name || '',
    componentId: md.component_id || '',
    sourcePage: md.source_page || '',
    email,
    amount: centsToDisplay(session.amount_total, session.currency),
    sessionId: session.id
  };
}

async function notifySlack(url, s) {
  const lines = [
    ':white_check_mark: *New TransformerPath purchase*',
    '*Product:* ' + s.product + '  (`' + s.sku + '`)',
    '*Amount:* ' + s.amount,
    '*Email:* ' + s.email
  ];
  if (s.company) lines.push('*Company:* ' + s.company);
  if (s.contact) lines.push('*Contact:* ' + s.contact);
  if (s.componentId) lines.push('*Component:* ' + s.componentId);
  if (s.sourcePage) lines.push('*From page:* ' + s.sourcePage);
  lines.push('*Stripe session:* ' + s.sessionId);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: lines.join('\n') })
  });
  if (!res.ok) throw new Error('Slack responded ' + res.status);
}

async function notifyEmail(s) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!apiKey || !to) return { skipped: true };

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@transformerpath.com';
  const fromName = process.env.SENDGRID_FROM_NAME || 'TransformerPath';
  const text = [
    'New purchase to fulfill:',
    '',
    'Product: ' + s.product + ' (' + s.sku + ')',
    'Amount:  ' + s.amount,
    'Email:   ' + s.email,
    'Company: ' + (s.company || '—'),
    'Contact: ' + (s.contact || '—'),
    'Component: ' + (s.componentId || '—'),
    'From page: ' + (s.sourcePage || '—'),
    'Stripe session: ' + s.sessionId
  ].join('\n');

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject: 'TransformerPath purchase: ' + s.product,
      content: [{ type: 'text/plain', value: text }]
    })
  });
  if (!res.ok) throw new Error('SendGrid responded ' + res.status);
  return { sent: true };
}

async function fulfill(session) {
  const s = summarize(session);
  console.log('Fulfilling checkout', JSON.stringify(s));

  const jobs = [];
  if (process.env.SLACK_WEBHOOK_URL) {
    jobs.push(notifySlack(process.env.SLACK_WEBHOOK_URL, s));
  }
  if (process.env.SENDGRID_API_KEY && process.env.ADMIN_EMAIL) {
    jobs.push(notifyEmail(s));
  }

  if (jobs.length === 0) {
    console.warn(
      'No notifier configured (set SLACK_WEBHOOK_URL and/or SENDGRID_API_KEY + ADMIN_EMAIL).'
    );
    return { notified: 0, configured: 0 };
  }

  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === 'rejected');
  failed.forEach((r) => console.error('Notifier failed:', r.reason && r.reason.message));
  if (failed.length === jobs.length) {
    // Every configured notifier failed — signal Stripe to retry.
    throw new Error('All fulfillment notifiers failed');
  }
  return { notified: jobs.length - failed.length, configured: jobs.length };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return json(503, {
      error: 'Webhook not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.',
      code: 'stripe_webhook_not_configured'
    });
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

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const result = await fulfill(stripeEvent.data.object);
        return json(200, { received: true, type: stripeEvent.type, fulfillment: result });
      }
      default:
        console.log('Ignoring event type:', stripeEvent.type);
        return json(200, { received: true, type: stripeEvent.type, ignored: true });
    }
  } catch (err) {
    console.error('Fulfillment error:', err);
    return json(500, { error: err.message || 'Fulfillment failed', code: 'fulfillment_error' });
  }
};
