/* TransformerPath analytics. Production measurement is consent-gated.
   Only an existing configured provider receives events. Never put form data,
   private query parameters, or an unverified purchase into telemetry. */
var PLAUSIBLE_DOMAIN = "";
var GA4_ID = "G-98Q0V62L72";       // Google Analytics 4 — set (leave "" to disable)
var ADS_AW_ID = "";                // Google Ads conversion ID, e.g. "AW-123456789" (optional)
var LINKEDIN_INSIGHT_ID = "";      // LinkedIn Insight Tag partner ID (optional)
var META_PIXEL_ID = "";            // Meta Pixel ID, e.g. "1234567890" (optional)

(function () {
  'use strict';

  // Run-once guard: even if a page includes analytics.js more than once (or a
  // template adds it after a hand-authored page already did), only the first
  // inclusion initialises — so the tag never double-loads and GA4 never
  // double-fires page_view on the same document.
  if (window.__TP_ANALYTICS__) return;
  window.__TP_ANALYTICS__ = true;

  var provider = null;
  // Production-domain guard + consent gate. The Google tag must only load and
  // fire on the CANONICAL transformerpath.com host (not www, so a www->canonical
  // redirect records a single page_view), and only after the visitor has
  // accepted cookies. This keeps www / transformerpath.polsia.io / the Netlify
  // hostname / deploy previews / localhost / staging from contaminating
  // production GA4, and respects the site consent implementation (consent.js
  // gates AdSense; we gate GA4 on the SAME choice so no non-essential
  // measurement cookie is set until the visitor opts in).
  var PROD_HOST = /^transformerpath\.com$/i.test(location.hostname);
  function consentOk() {
    try { return localStorage.getItem('tp-cookie-consent') === 'accepted'; } catch (e) { return false; }
  }

  var pageDimensionsSent = false;
  var disabledKey = 'ga-disable-' + GA4_ID;

  function cleanPath(path) {
    path = path || '/';
    // An address, checkout token or query is not a report dimension.
    if (!/^\/(?:[a-z0-9._-]+\/)*[a-z0-9._-]*$/i.test(path)) return '/';
    if (/^\/(?:checkout|account|activate|claim)(?:[\/.]|$)/i.test(path)) {
      return '/' + path.split(/[\/.]/)[1] + '/';
    }
    if (/^\/pricing(?:\/|\.html)?$/.test(path)) return '/pricing.html';
    return path;
  }

  function baseLocation() { return location.origin + cleanPath(location.pathname); }

  function cleanReferrer() {
    try {
      var ref = new URL(document.referrer);
      if (!/^https?:$/.test(ref.protocol)) return '';
      // Keep search/referral attribution, not the referring visitor's query.
      return ref.origin + (ref.origin === location.origin ? cleanPath(ref.pathname) : '/');
    } catch (e) { return ''; }
  }

  function startGa4() {
    if (!GA4_ID || !PROD_HOST || !consentOk()) return;
    window[disabledKey] = false;
    if (provider === 'ga4' || document.querySelector('script[data-tp-ga4]')) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    var config = {
      page_location: baseLocation(),
      page_referrer: cleanReferrer(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    };
    // Use GA4's campaign fields, not arbitrary URL properties on every event.
    var q = new URLSearchParams(location.search);
    [['utm_source', 'campaign_source'], ['utm_medium', 'campaign_medium'],
     ['utm_campaign', 'campaign_name'], ['utm_content', 'campaign_content']].forEach(function (pair) {
      var value = q.get(pair[0]) || '';
      if (/^[a-z][a-z0-9_ -]{0,79}$/i.test(value) && !/\d{6}/.test(value)) config[pair[1]] = value;
    });
    window.gtag('config', GA4_ID, config);
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    g.setAttribute('data-tp-ga4', '1');
    document.head.appendChild(g);
    provider = 'ga4';
  }

  function syncConsent() {
    if (GA4_ID) window[disabledKey] = !PROD_HOST || !consentOk();
    if (PLAUSIBLE_DOMAIN) {
      if (!PROD_HOST || !consentOk() || provider) return;
      var s = document.createElement('script');
      s.defer = true;
      s.setAttribute('data-domain', PLAUSIBLE_DOMAIN);
      s.src = 'https://plausible.io/js/script.manual.js';
      document.head.appendChild(s);
      window.plausible = window.plausible || function () {
        (window.plausible.q = window.plausible.q || []).push(arguments);
      };
      window.plausible('pageview', { u: baseLocation() });
      provider = 'plausible';
    } else {
      startGa4();
    }
    if (provider && consentOk()) trackPageDimensions();
  }

  /* ── Optional ad/platform tags (drop-in IDs, silent when blank) ─────────
     Google Ads: enable "Enhanced conversions" in Google Ads and, if you wish,
     also load the conversion linker so on-site events can be attributed.
     LinkedIn Insight Tag partner ID, and the Meta Pixel. Each is only loaded
     each currently disabled; separate authorization is needed to enable ads. */
  try {
    if (PROD_HOST && consentOk() && ADS_AW_ID) {
      window.gtag = window.gtag || function () { (window.dataLayer = window.dataLayer || []).push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', ADS_AW_ID);
    }
    if (PROD_HOST && consentOk() && LINKEDIN_INSIGHT_ID) {
      var l = document.createElement('script'); l.async = true;
      l.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
      document.head.appendChild(l);
      window._li = window._li || [];
      window._li.push(['set', 'track', 'insight']);
      window._li.push(['enable', 'clickstream']);
      setTimeout(function () { (function (n) { if (!window._li._init) { window._li._init = 1; if (n && n.queue) n.queue.push(function () { window._li.retargetAds = window._li.retargetAds || []; var q = [['set', 'route'], ['set', 'track', 'insight']]; var d = n.queue[0].call; }); } })(window.LI); }, 0);
    }
    if (PROD_HOST && consentOk() && META_PIXEL_ID) {
      !(function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', META_PIXEL_ID); window.fbq('track', 'PageView');
    }
  } catch (e) { /* ad tags must never break the page */ }

  // Only controlled product dimensions, never form data, dynamic URLs,
  // source parameters, personal identifiers, or checkout reference IDs.
  var DIMENSIONS = ('form tier plan country manufacturer category context book partner source kind region preset presets ' +
    'network paid used score reason pages cooldown_days outcome engaged checked currency value mode ' +
    'loadPercent faultType avr tap t1InService stageId stageName').split(' ');
  function track(name, props) {
    if (!PROD_HOST || !consentOk() || !/^[a-z][a-z0-9_]{0,39}$/.test(name || '')) return;
    // Client-side URL parameters, links and DOM events never prove a sale.
    if (/(^|_)purchase$/.test(name)) return;
    try {
      var p = {};
      DIMENSIONS.forEach(function (key) {
        var value = (props || {})[key];
        if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) p[key] = value;
        if (typeof value === 'string' && /^[\p{L}\p{N} _.,()+&–-]{1,95}$/u.test(value) &&
            !/\d[ .-]?(?:\d[ .-]?){6}/.test(value) && !/www\.|\.(?:com|org|net|io)\b/i.test(value)) p[key] = value;
      });
      // Affiliate sub-IDs are public placement slugs, never visitor IDs.
      // Keep the existing report breakdown for this event only.
      if (name === 'affiliate_click' && props) {
        if (/^(?:event|trip)_[a-z][a-z0-9_]{1,80}_(?:hotel|flight|insurance|esim)$/.test(props.sub_id || '') &&
            !/\d{5}/.test(props.sub_id)) p.sub_id = props.sub_id;
        if (/^(?:hotel|flight|insurance|esim)$/.test(props.placement || '')) p.placement = props.placement;
      }
      if (provider === 'plausible') {
        window.plausible(name, { props: p, u: baseLocation() });
      } else if (provider === 'ga4') {
        window.gtag('event', name, p);
      }
    } catch (e) { /* analytics must never break the page */ }
  }
  window.TP_TRACK = track;

  var TIER_VALUE = { learner: 199, professional: 599, enterprise: 1999 };

  document.addEventListener('DOMContentLoaded', function () {

    // A return URL is useful funnel context but not a verified purchase.
    var tier = new URLSearchParams(location.search).get('unlocked');
    if (cleanPath(location.pathname) === '/pricing.html' && Object.prototype.hasOwnProperty.call(TIER_VALUE, tier)) {
      track('checkout_return', { tier: tier });
    }

    /* ── Checkout start ───────────────────────────────────────────────────
       Anchors whose href points at a Stripe Payment Link. Captures intent
       even when the payment is later abandoned, which is the number you need
       to judge whether ad traffic is converting or just bouncing. */
    // Existing prices on the claim-listing buttons. Not a new price list.
    var PAY_PLAN_VALUE = { verified_manufacturer: 499, featured_listing: 299, featured_verified: 699 };
    document.querySelectorAll('a[href*="buy.stripe.com"], a[href*="/checkout/"], [data-pay-plan]').forEach(function (a) {
      a.addEventListener('click', function () {
        var plan = a.getAttribute ? (a.getAttribute('data-pay-plan') || '') : '';
        var id = plan || (a.id || '').replace(/^cta/, '').toLowerCase();
        var value = plan ? (PAY_PLAN_VALUE[plan] || 0) : (TIER_VALUE[id] || 0);
        var props = { tier: id || 'unknown', value: value };
        if (plan) props.plan = plan;
        track('checkout_start', props);
      });
    });

    /* ── Lead ─────────────────────────────────────────────────────────────
       Every Netlify form on the site, identified by its own name so you can
       distinguish attempts without counting them as confirmed leads. */
    document.querySelectorAll('form[data-netlify="true"]').forEach(function (f) {
      f.addEventListener('submit', function () {
        if (!f.hasAttribute('data-track-form')) track('form_submit_attempt', { form: f.getAttribute('name') || 'unnamed' });
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

     DOM interactions are intent events only. RFQ storage calls TP_EVENT
     after server success to report rfq_submitted; Stripe revenue and any other
     confirmed conversions require an authoritative integration, not a click. */
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
      var eventName = f.getAttribute('data-track-form');
      if (eventName === 'rfq_submitted') eventName = 'rfq_submit_attempt';
      if (eventName === 'newsletter_signup') eventName = 'newsletter_submit_attempt';
      if (!/(?:^|_)submitted$/.test(eventName)) track(eventName, paramsFrom(f));
    }, true);
  })();

  function trackPageDimensions() {
    if (pageDimensionsSent) return;
    pageDimensionsSent = true;
    var path = cleanPath(location.pathname);
    if (path === '/pricing.html') track('pricing_view', { plan: 'all' });
    if (/^\/books(?:\/|\.html|$)/.test(path)) track('book_view', { book: 'series' });
    if (/^\/verified(?:\/|\.html|$)/.test(path)) track('verified_view', {});
    var profile = /^\/manufacturers\/([a-z0-9_-]+)\/?$/.exec(path);
    if (profile) track('manufacturer_view', { manufacturer: profile[1] });
  }

  window.addEventListener('tp-consent-changed', syncConsent);
  window.addEventListener('storage', function (event) {
    if (!event.key || event.key === 'tp-cookie-consent') syncConsent();
  });
  syncConsent();
})();
