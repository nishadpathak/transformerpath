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
var GA4_ID = "G-98Q0V62L72";       // Google Analytics 4 — set (leave "" to disable)
var ADS_AW_ID = "";                // Google Ads conversion ID, e.g. "AW-123456789" (optional)
var LINKEDIN_INSIGHT_ID = "";      // LinkedIn Insight Tag partner ID (optional)
var META_PIXEL_ID = "";            // Meta Pixel ID, e.g. "1234567890" (optional)

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

  /* ── Optional ad/platform tags (drop-in IDs, silent when blank) ─────────
     Google Ads: enable "Enhanced conversions" in Google Ads and, if you wish,
     also load the conversion linker so on-site events can be attributed.
     LinkedIn Insight Tag partner ID, and the Meta Pixel. Each is only loaded
     when its ID is set — paste the values from the respective dashboards. */
  try {
    if (ADS_AW_ID) {
      window.gtag = window.gtag || function () { (window.dataLayer = window.dataLayer || []).push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', ADS_AW_ID);
    }
    if (LINKEDIN_INSIGHT_ID) {
      var l = document.createElement('script'); l.async = true;
      l.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
      document.head.appendChild(l);
      window._li = window._li || [];
      window._li.push(['set', 'track', 'insight']);
      window._li.push(['enable', 'clickstream']);
      setTimeout(function () { (function (n) { if (!window._li._init) { window._li._init = 1; if (n && n.queue) n.queue.push(function () { window._li.retargetAds = window._li.retargetAds || []; var q = [['set', 'route'], ['set', 'track', 'insight']]; var d = n.queue[0].call; }); } })(window.LI); }, 0);
    }
    if (META_PIXEL_ID) {
      !(function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', META_PIXEL_ID); window.fbq('track', 'PageView');
    }
  } catch (e) { /* ad tags must never break the page */ }

  /* ── Traffic / UTM attribution ──────────────────────────────────────────
     Captured once from the landing URL and merged into every event, so Google
     Ads (via GA4 linked conversions), LinkedIn and Meta can attribute a lead
     or order to the exact campaign. Persisted so a visitor who shops around
     keeps their original source. */
  var TRAFFIC = (function () {
    var t = {};
    try {
      var q = new URLSearchParams(location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'fbclid', 'li_fat_id']
        .forEach(function (k) { var v = q.get(k); if (v) t[k] = v; });
    } catch (e) {}
    try {
      var saved = JSON.parse(sessionStorage.getItem('tp_traffic') || '{}');
      Object.keys(saved).forEach(function (k) { if (!t[k]) t[k] = saved[k]; });
      sessionStorage.setItem('tp_traffic', JSON.stringify(t));
    } catch (e) {}
    return t;
  })();
  window.TP_TRAFFIC = TRAFFIC;

  /* One call signature for both providers. Silent when neither is configured,
     so nothing breaks and no errors appear before an id is pasted in. */
  function track(name, props) {
    props = props || {};
    try {
      // Merge UTM/traffic into every event (explicit props win) so conversions
      // carry the campaign for GA4/Google Ads/LinkedIn/Meta attribution.
      var p = {};
      Object.keys(TRAFFIC).forEach(function (k) { p[k] = TRAFFIC[k]; });
      Object.keys(props).forEach(function (k) { p[k] = props[k]; });
      if (provider === 'plausible') {
        window.plausible(name, { props: p });
      } else if (provider === 'ga4') {
        window.gtag('event', name, p);
      } else if (window.fbq) {
        window.fbq('trackCustom', name, p);
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

  /* ── LinkedIn — professional share + follow ─────────────────────────────
     No SDK, no cookies, no API key. Any element marked [data-linkedin-share]
     opens LinkedIn's official share composer (popup) prefilled for the page;
     [data-linkedin-follow] opens the TransformerPath company page. It reads
     the page's Open Graph tags so every link prefills correctly on any page,
     and injects its own lightweight button styles so it needs no stylesheet
     edits. Fires a conversion event through whichever analytics is active. */
  window.TP_FOLLOW_URL = 'https://www.linkedin.com/company/transformerpath';
  (function () {
    function meta(name) {
      var el = document.querySelector('meta[property="' + name + '"]') ||
               document.querySelector('meta[name="' + name + '"]');
      return el ? (el.getAttribute('content') || '') : '';
    }
    function currentUrl() { return location.href.split('#')[0]; }
    var IN_GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.1 2.5 2.5 0 0 1 0-5.1zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2 3.77-2 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.5c0-1.31-.02-3-1.83-3-1.83 0-2.11 1.43-2.11 2.9V21h-4z"/></svg>';

    function openShare(el) {
      var url = el.getAttribute('data-url') || currentUrl();
      // Open LinkedIn's official share composer in a NEW TAB (not a popup window).
      var href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
      var win = window.open(href, '_blank', 'noopener');
      if (win) win.opener = null;
      track('social_share', { network: 'linkedin', page: url.replace(/^https?:\/\//, '') });
    }
    function openFollow() {
      window.open(window.TP_FOLLOW_URL, '_blank', 'noopener');
      track('social_follow', { network: 'linkedin' });
    }
    function ensureStyles() {
      if (document.getElementById('tp-li-styles')) return;
      var st = document.createElement('style');
      st.id = 'tp-li-styles';
      st.textContent =
        '.tp-li-btn{display:inline-flex;align-items:center;gap:6px;font-family:inherit;font-weight:700;font-size:.82rem;' +
        'text-decoration:none;cursor:pointer;border:0;border-radius:999px;padding:8px 14px;line-height:1;' +
        'color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.16);transition:transform .12s ease,opacity .12s ease}' +
        '.tp-li-btn:hover{transform:translateY(-1px);opacity:.94}' +
        '.tp-li-btn svg{width:15px;height:15px;fill:currentColor;flex:none}' +
        '.tp-li-follow{background:#0a66c2}' +
        '.tp-li-share{background:#1b6fb3}' +
        '.tp-li-share-inline{margin-left:8px;font-size:.78rem;font-weight:600;color:#1b6fb3;text-decoration:none;cursor:pointer;white-space:nowrap}' +
        '.tp-li-share-inline:hover{text-decoration:underline}';
      document.head.appendChild(st);
    }
    function mount() {
      ensureStyles();
      document.querySelectorAll('[data-linkedin-follow]').forEach(function (b) {
        b.classList.add('tp-li-btn', 'tp-li-follow');
      });
      document.querySelectorAll('[data-linkedin-share]').forEach(function (b) {
        b.classList.add('tp-li-btn', 'tp-li-share');
      });
    }
    mount();

    // Delegated so it works for anything added later, and so the buttons need
    // no inline onclick. Capture phase avoids needing the class pre-applied.
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-linkedin-share],[data-linkedin-follow]') : null;
      if (!t) return;
      e.preventDefault();
      if (t.hasAttribute('data-linkedin-share')) openShare(t);
      else openFollow();
    }, true);

    window.TPShare = openShare;
    window.TPFollow = openFollow;
  })();

  /* ── Commercial events (GA4 conversion funnel) ────────────────────────
     One convention for the whole site: any element with [data-track="<event>"]
     fires a commercial event on click; any form with [data-track-form="<event>"]
     fires on submit. Extra context travels in data-track-* attributes (e.g.
     data-track-plan="Verified", data-track-country="UAE", data-track-manufacturer=...).
     Delegated, so it works on any element on any page — including generated SEO
     pages — with no per-page script. The full funnel:

     account_created · newsletter_signup · pricing_view · learning_checkout_started
     learning_purchase · book_view · book_purchase · supplier_claim_started
     supplier_claim_submitted · verified_checkout_started · verified_purchase
     rfq_started · rfq_submitted · event_feature_inquiry · exhibitor_feature_inquiry
     webinar_inquiry · sponsor_inquiry */
  window.TP_EVENT = function (name, params) { track(name, params || {}); };
  (function () {
    function paramsFrom(el) {
      var p = {};
      if (!el || !el.getAttributeNames) return p;
      el.getAttributeNames().forEach(function (a) {
        if (a.indexOf('data-track-') === 0) p[a.slice(11)] = el.getAttribute(a);
      });
      return p;
    }
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-track]') : null;
      if (!el) return;
      var name = el.getAttribute('data-track');
      if (name) track(name, paramsFrom(el));
    }, true);
    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f || !f.getAttribute || !f.getAttribute('data-track-form')) return;
      track(f.getAttribute('data-track-form'), paramsFrom(f));
    }, true);
    // Page-view events: cheap path-based firing, no per-page config needed.
    var path = (location.pathname || '').replace(/^\//, '').replace(/\//g, '_');
    if (/^pricing(_|$)/.test(path)) track('pricing_view', { plan: 'all' });
    if (/^books(_|$)/.test(path)) track('book_view', { book: 'series' });
    if (/^verified(_|$)/.test(path)) track('verified_view', {});
  })();
})();
