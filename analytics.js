/* ═══ TransformerPath analytics loader ═══════════════════════════════════════
   To activate, paste ONE id below and redeploy. No other page edits needed.

   Option A (recommended): Plausible — set PLAUSIBLE_DOMAIN = "transformerpath.com"
       Cookieless and aggregate-only. Needs NO consent banner and matches what
       privacy.html already promises ("privacy-friendly and aggregated").
   Option B: Google Analytics 4 — set GA4_ID = "G-XXXXXXXXXX"
       Free, but sets cookies and profiles individuals. Requires a consent
       banner for EU/UK visitors AND a rewrite of privacy.html before use.

   Conversion events below fire through whichever provider is active, so the
   tracking works the same either way — and stays silent when neither is set.
   ═════════════════════════════════════════════════════════════════════════ */
var PLAUSIBLE_DOMAIN = "";
var GA4_ID = "G-98Q0V62L72";

(function () {
  'use strict';

  var provider = null;

  if (PLAUSIBLE_DOMAIN) {
    var s = document.createElement('script');
    s.defer = true;
    s.setAttribute('data-domain', PLAUSIBLE_DOMAIN);
    s.src = 'https://plausible.io/js/script.manual.js';
    document.head.appendChild(s);
    window.plausible = window.plausible || function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
    window.plausible('pageview');
    provider = 'plausible';
  } else if (GA4_ID) {
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
    provider = 'ga4';
  }

  /* One call signature for both providers. Silent when neither is configured,
     so nothing breaks and no errors appear before an id is pasted in. */
  function track(name, props) {
    props = props || {};
    try {
      if (provider === 'plausible') {
        window.plausible(name, { props: props });
      } else if (provider === 'ga4') {
        window.gtag('event', name, props);
      }
    } catch (e) { /* analytics must never break the page */ }
  }
  window.TP_TRACK = track;

  var TIER_VALUE = { learner: 199, professional: 599, enterprise: 1999 };

  document.addEventListener('DOMContentLoaded', function () {

    /* ── Purchase ──────────────────────────────────────────────────────────
       Stripe redirects back to pricing.html?unlocked=<tier> after payment,
       which is the only signal a static site gets that money changed hands.
       Read it before course-gate.js strips the query string. */
    var tier = new URLSearchParams(location.search).get('unlocked');
    if (tier) {
      track('purchase', { tier: tier, value: TIER_VALUE[tier] || 0, currency: 'USD' });
    }

    /* ── Checkout start ───────────────────────────────────────────────────
       Anchors whose href points at a Stripe Payment Link. Captures intent
       even when the payment is later abandoned, which is the number you need
       to judge whether ad traffic is converting or just bouncing. */
    document.querySelectorAll('a[href*="buy.stripe.com"]').forEach(function (a) {
      a.addEventListener('click', function () {
        var id = (a.id || '').replace(/^cta/, '').toLowerCase();
        track('checkout_start', { tier: id || 'unknown', value: TIER_VALUE[id] || 0 });
      });
    });

    /* ── Lead ─────────────────────────────────────────────────────────────
       Every Netlify form on the site, identified by its own name so you can
       tell a manufacturer enquiry from a newsletter signup. */
    document.querySelectorAll('form[data-netlify="true"]').forEach(function (f) {
      f.addEventListener('submit', function () {
        track('lead', { form: f.getAttribute('name') || 'unnamed' });
      });
    });

    /* ── Gated-content hit ────────────────────────────────────────────────
       Someone reached a paid page without access. High-intent, and the
       clearest measure of whether the paywall is the thing losing the sale. */
    if (document.body.innerText.indexOf('Premium learning content') > -1) {
      track('paywall_view', { page: location.pathname.replace(/^\//, '') });
    }
  });
})();
