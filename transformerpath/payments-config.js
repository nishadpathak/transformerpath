/**
 * TransformerPath monetization catalog (directory + sponsorship SKUs).
 *
 * Checkout order (see payments.js):
 *   1. paymentLink — Stripe Payment Link URL (paste after creating in Dashboard)
 *   2. Netlify fn  — /.netlify/functions/create-checkout (needs STRIPE_SECRET_KEY)
 *   3. mailto      — invoice / bank-transfer fallback
 *
 * Existing Pro course Payment Link (reference):
 *   https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00
 */
(function (root) {
  var SUPPORT = 'hello@transformerpath.com';

  var PRODUCTS = {
    directory_verified: {
      sku: 'directory_verified',
      name: 'Directory — Verified',
      description: 'Verified badge, full profile, buyer enquiry button — 12 months.',
      amountCents: 49900,
      currency: 'usd',
      displayPrice: '$499',
      displayPeriod: '/year',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=directory_verified'
    },
    directory_premium: {
      sku: 'directory_premium',
      name: 'Directory — Premium',
      description: 'Pro Verified badge, top placement, logo, monthly briefing mention — 12 months.',
      amountCents: 149900,
      currency: 'usd',
      displayPrice: '$1,499',
      displayPeriod: '/year',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=directory_premium'
    },
    sponsor_daily_brief: {
      sku: 'sponsor_daily_brief',
      name: 'Daily Brief Sponsor',
      description: '"Presented by" in the daily intel email + web briefing. One slot / month, category-exclusive.',
      amountCents: 250000,
      currency: 'usd',
      displayPrice: '$2,500',
      displayPeriod: '/month',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=sponsor_daily_brief'
    },
    component_3d_feature: {
      sku: 'component_3d_feature',
      name: '3D Component Feature',
      description: 'Featured supplier on one component hotspot in the 3D explorer + components directory — 12 months.',
      amountCents: 99900,
      currency: 'usd',
      displayPrice: '$999',
      displayPeriod: '/year',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=component_3d_feature'
    },
    component_3d_exclusive: {
      sku: 'component_3d_exclusive',
      name: '3D Component Exclusive',
      description: 'Exclusive supplier sponsorship for one component in the 3D explorer (logo + CTA when part is selected) — 12 months.',
      amountCents: 249900,
      currency: 'usd',
      displayPrice: '$2,499',
      displayPeriod: '/year',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=component_3d_exclusive'
    },
    sponsor_featured_article: {
      sku: 'sponsor_featured_article',
      name: 'Featured Article',
      description: 'Sponsored technical article or case study in the briefing, archived on the site.',
      amountCents: 120000,
      currency: 'usd',
      displayPrice: '$1,200',
      displayPeriod: ' one-time',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=sponsor_featured_article'
    }
  };

  root.TP_PAYMENTS = {
    supportEmail: SUPPORT,
    products: PRODUCTS,
    get: function (sku) {
      return PRODUCTS[sku] || null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
