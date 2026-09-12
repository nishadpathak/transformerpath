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
    },
    directory_enterprise: {
      sku: 'directory_enterprise',
      name: 'Directory — Enterprise',
      description: 'Multi-plant profiles, SSO seats, API export, dedicated account manager — 12 months.',
      amountCents: 999900,
      currency: 'usd',
      displayPrice: '$9,999',
      displayPeriod: '/year',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=directory_enterprise'
    },
    academy_pro: {
      sku: 'academy_pro',
      name: 'Academy Pro',
      description: 'Full design masterclass, calculator, certificate track — 12 months.',
      amountCents: 19900,
      currency: 'usd',
      displayPrice: '$199',
      displayPeriod: '/year',
      paymentLink: 'https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00',
      successPath: '/checkout-success.html?sku=academy_pro'
    },
    academy_team: {
      sku: 'academy_team',
      name: 'Academy Team',
      description: '10 seats, shared progress, corporate invoice — 12 months.',
      amountCents: 149900,
      currency: 'usd',
      displayPrice: '$1,499',
      displayPeriod: '/year',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=academy_team'
    },
    academy_enterprise: {
      sku: 'academy_enterprise',
      name: 'Academy Enterprise',
      description: 'Unlimited seats, SSO, LMS export, custom modules — annual contract.',
      amountCents: 1499900,
      currency: 'usd',
      displayPrice: '$14,999',
      displayPeriod: '/year',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=academy_enterprise'
    },
    rfq_boost: {
      sku: 'rfq_boost',
      name: 'RFQ Lead Access',
      description: 'Priority RFQ routing for your categories + weekly lead digest — 12 months.',
      amountCents: 299900,
      currency: 'usd',
      displayPrice: '$2,999',
      displayPeriod: '/year',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=rfq_boost'
    },
    jobs_featured: {
      sku: 'jobs_featured',
      name: 'Featured Job Listing',
      description: 'Pinned role on jobs board + intel newsletter mention — 30 days.',
      amountCents: 49900,
      currency: 'usd',
      displayPrice: '$499',
      displayPeriod: '/30 days',
      paymentLink: '',
      successPath: '/checkout-success.html?sku=jobs_featured'
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
