/**
 * Create a Stripe Checkout Session for directory / sponsorship SKUs.
 *
 * Env:
 *   STRIPE_SECRET_KEY  required (sk_live_… or sk_test_…)
 *
 * POST JSON: { sku, successUrl, cancelUrl, customerEmail?, metadata? }
 */
const Stripe = require('stripe');

const CATALOG = {
  directory_verified: {
    name: 'Directory — Verified',
    description: 'Verified badge, full profile, buyer enquiry button — 12 months.',
    amountCents: 49900,
    currency: 'usd',
    mode: 'payment'
  },
  directory_premium: {
    name: 'Directory — Premium',
    description: 'Pro Verified badge, top placement, logo, monthly briefing mention — 12 months.',
    amountCents: 149900,
    currency: 'usd',
    mode: 'payment'
  },
  sponsor_daily_brief: {
    name: 'Daily Brief Sponsor',
    description: '"Presented by" in the daily intel email + web briefing. One month.',
    amountCents: 250000,
    currency: 'usd',
    mode: 'payment'
  },
  sponsor_featured_article: {
    name: 'Featured Article',
    description: 'Sponsored technical article or case study — one placement.',
    amountCents: 120000,
    currency: 'usd',
    mode: 'payment'
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return json(503, {
      error:
        'Stripe is not configured yet. Set STRIPE_SECRET_KEY on Netlify, or paste Payment Links into payments-config.js.',
      code: 'stripe_not_configured'
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { sku, successUrl, cancelUrl, customerEmail, metadata } = payload;
  const product = CATALOG[sku];
  if (!product) return json(400, { error: 'Unknown SKU', sku });
  if (!successUrl || !cancelUrl) {
    return json(400, { error: 'successUrl and cancelUrl are required' });
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });

    const sessionParams = {
      mode: product.mode,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency,
            unit_amount: product.amountCents,
            product_data: {
              name: product.name,
              description: product.description,
              metadata: { sku }
            }
          }
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: Object.assign({ sku, product_name: product.name }, metadata || {}),
      payment_intent_data: {
        metadata: Object.assign({ sku }, metadata || {})
      }
    };

    if (customerEmail) sessionParams.customer_email = customerEmail;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return json(200, { id: session.id, url: session.url, sku });
  } catch (err) {
    console.error('create-checkout error:', err);
    return json(500, {
      error: err.message || 'Failed to create checkout session',
      code: 'stripe_error'
    });
  }
};
