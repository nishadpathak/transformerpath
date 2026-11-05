/* Email gate helpers. A raw buy.stripe.com link is not opened: Payment Link
 * sessions leave customer_email empty. Checkout goes through checkout-continue.
 * A Checkout Session is preferred. When Stripe refuses that call, the
 * returned Payment Link is opened so the buyer can still pay.
 * The public anon key is read from window.TP_SUPABASE and is never logged.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.tpCheckoutEmail = api;
  if (typeof document !== 'undefined' && document && document.querySelectorAll) {
    var run = function () { api.mount(document); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  var CSS = '.tp-checkout-email{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%;margin:0 0 8px}'
    + '.tp-checkout-email input[type=email]{flex:1 1 160px;min-width:0;width:auto;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font:inherit}'
    + '.tp-checkout-email .btn,.tp-checkout-email .cta,.tp-checkout-email a,.tp-checkout-email button{flex:1 1 180px}';

  var FAILURE = 'Checkout could not be opened, so payment did not start. Try again, or email hello@transformerpath.com.';

  function isCheckoutSessionUrl(url) {
    try {
      var parsed = new URL(String(url || ''), 'https://transformerpath.com');
      return parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com';
    } catch (e) {
      return false;
    }
  }

  function isPaymentLinkUrl(url) {
    try {
      var parsed = new URL(String(url || ''), 'https://transformerpath.com');
      return parsed.protocol === 'https:' && parsed.hostname === 'buy.stripe.com';
    } catch (e) {
      return false;
    }
  }

  function continueCheckout(body, fetchImpl) {
    var doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) return Promise.resolve({ ok: false, url: '', saved: false, message: FAILURE });
    return doFetch('/.netlify/functions/checkout-continue', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().then(function (payload) {
        return { httpOk: !!(res && res.ok), body: payload || {} };
      }, function () {
        return { httpOk: false, body: {} };
      });
    }, function () {
      return { httpOk: false, body: {} };
    }).then(function (res) {
      var url = res.body && res.body.url;
      var paymentLink = !!(res.body && res.body.payment_link);
      var session = res.httpOk && url && !paymentLink && isCheckoutSessionUrl(url);
      var fallback = res.httpOk && url && paymentLink && isPaymentLinkUrl(url);
      return {
        ok: !!(session || fallback),
        url: (session || fallback) ? url : '',
        payment_link: fallback,
        saved: !!(res.body && res.body.saved),
        message: (res.body && res.body.message) || FAILURE
      };
    });
  }

  function validEmail(email) {
    var s = String(email || '').trim();
    if (!s || s.length > 160) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function withPrefilledEmail(url, email) {
    var raw = String(url || '');
    var hash = '';
    var hashAt = raw.indexOf('#');
    if (hashAt >= 0) {
      hash = raw.slice(hashAt);
      raw = raw.slice(0, hashAt);
    }
    raw = raw.replace(/([?&])prefilled_email=[^&]*/g, '$1');
    raw = raw.replace(/[?&]$/, '').replace(/\?&/g, '?').replace(/&&/g, '&');
    var sep = raw.indexOf('?') >= 0 ? '&' : '?';
    return raw + sep + 'prefilled_email=' + encodeURIComponent(String(email || '').trim()) + hash;
  }

  function priceIdFromUrl(url) {
    var match = String(url || '').match(/buy\.stripe\.com\/([^/?#]+)/);
    return match ? match[1] : '';
  }

  function listingSlug(el, url) {
    var slug = '';
    if (el && el.getAttribute) {
      slug = el.getAttribute('data-pay-slug') || el.getAttribute('data-checkout-slug') || '';
    }
    if (slug) return String(slug).trim();
    var match = String(url || '').match(/[?&]client_reference_id=([^&#]+)/);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); }
    catch (e) { return match[1]; }
  }

  function productName(el) {
    if (!el || !el.getAttribute) return '';
    var named = el.getAttribute('data-checkout-product') || el.getAttribute('data-track-plan') || el.getAttribute('data-pay-plan') || '';
    if (named) return String(named).trim();
    return String(el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function pagePath() {
    try {
      if (typeof location !== 'undefined' && location && location.pathname) return String(location.pathname);
    } catch (e) {}
    return '';
  }

  function leadRow(opts) {
    opts = opts || {};
    function text(value) {
      var s = String(value == null ? '' : value).trim();
      return s || null;
    }
    return {
      email: String(opts.email || '').trim(),
      listing_slug: text(opts.listingSlug),
      product_name: text(opts.productName),
      price_id: text(opts.priceId),
      page_path: text(opts.pagePath),
      created_at: opts.createdAt || new Date().toISOString()
    };
  }

  function readConfig() {
    var cfg = typeof window !== 'undefined' ? window.TP_SUPABASE : null;
    if (!cfg || !cfg.url || !cfg.anon) return null;
    return cfg;
  }

  function insertLead(row, cfg, fetchImpl) {
    var doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) return Promise.resolve({ ok: false, skipped: true });
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (!ctrl) return;
      try { ctrl.abort(); } catch (e) {}
    }, 2500);
    var opts = {
      method: 'POST',
      headers: {
        apikey: cfg.anon,
        Authorization: 'Bearer ' + cfg.anon,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(row)
    };
    if (ctrl) opts.signal = ctrl.signal;
    return doFetch(String(cfg.url).replace(/\/$/, '') + '/rest/v1/checkout_leads', opts).then(function (res) {
      clearTimeout(timer);
      return { ok: !!(res && res.ok) };
    }, function () {
      clearTimeout(timer);
      return { ok: false };
    });
  }

  function saveLead(row, deps) {
    deps = deps || {};
    var cfg = deps.config || readConfig();
    if (!cfg || !cfg.url || !cfg.anon) return { ok: false, skipped: true };
    return insertLead(row, cfg, deps.fetch);
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      if (typeof document === 'undefined' || !document.createElement) {
        resolve(false);
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      var parent = document.head || document.documentElement;
      if (!parent || !parent.appendChild) {
        resolve(false);
        return;
      }
      parent.appendChild(s);
    });
  }

  function rememberLead(row) {
    if (readConfig()) return insertLead(row, readConfig());
    if (typeof window !== 'undefined' && window.TP_SUPABASE) return { ok: false, skipped: true };
    if (typeof document === 'undefined' || !document.createElement) return { ok: false, skipped: true };
    return loadScript('/supabase-config.js').then(function () {
      var cfg = readConfig();
      if (!cfg) return { ok: false, skipped: true };
      return insertLead(row, cfg);
    }, function () {
      return { ok: false, skipped: true };
    });
  }

  function ensureStyle(doc) {
    if (!doc || !doc.getElementById || !doc.createElement || !doc.head || !doc.head.appendChild) return;
    if (doc.getElementById('tp-checkout-email-style')) return;
    var style = doc.createElement('style');
    style.id = 'tp-checkout-email-style';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  function ensureInput(doc, control) {
    var wrap = control.closest ? control.closest('.tp-checkout-email') : null;
    if (wrap && wrap.querySelector) {
      var found = wrap.querySelector('input[type="email"][data-checkout-email]');
      if (found) return found;
    }
    if (!doc.createElement || !control.parentNode || !control.parentNode.insertBefore) return null;
    wrap = doc.createElement('div');
    wrap.className = 'tp-checkout-email';
    var input = doc.createElement('input');
    input.type = 'email';
    input.required = true;
    input.setAttribute('maxlength', '160');
    input.setAttribute('autocomplete', 'email');
    input.setAttribute('inputmode', 'email');
    input.setAttribute('placeholder', 'Email');
    input.setAttribute('aria-label', 'Email');
    input.setAttribute('data-checkout-email', '1');
    wrap.querySelector = function () { return input; };
    control.parentNode.insertBefore(wrap, control);
    if (wrap.appendChild) {
      wrap.appendChild(input);
      wrap.appendChild(control);
    }
    if (!control.closest) control.closest = function () { return wrap; };
    return input;
  }

  function startAnchor(anchor, input, event) {
    if (event && event.preventDefault) event.preventDefault();
    var email = input ? String(input.value || '').trim() : '';
    if (!validEmail(email)) {
      if (input && input.reportValidity) input.reportValidity();
      return Promise.resolve('');
    }
    var href = anchor.getAttribute ? (anchor.getAttribute('href') || anchor.href || '') : '';
    var row = leadRow({
      email: email,
      listingSlug: listingSlug(anchor, href),
      productName: productName(anchor),
      priceId: priceIdFromUrl(href),
      pagePath: pagePath()
    });
    var pending = rememberLead(row);
    function afterLead() {
      if (String(href).indexOf('buy.stripe.com') === -1) return '';
      if (input && input.setCustomValidity) input.setCustomValidity(FAILURE);
      return '';
    }
    if (pending && typeof pending.then === 'function') return pending.then(afterLead, afterLead);
    return Promise.resolve(afterLead());
  }

  function bindEnter(input) {
    if (!input || !input.addEventListener || input.getAttribute('data-checkout-enter') === '1') return;
    input.setAttribute('data-checkout-enter', '1');
    input.addEventListener('keydown', function (event) {
      if (!event || (event.key !== 'Enter' && event.keyCode !== 13)) return;
      if (event.preventDefault) event.preventDefault();
      var wrap = input.parentNode;
      var control = wrap && wrap.querySelector ? wrap.querySelector('[data-pay-plan], a[href*="buy.stripe.com"]') : null;
      if (control && control.click) control.click();
    });
  }

  function mount(doc) {
    if (!doc || !doc.querySelectorAll) return;
    ensureStyle(doc);
    var anchors = doc.querySelectorAll('a[href*="buy.stripe.com"]');
    Array.prototype.forEach.call(anchors, function (anchor) {
      if (!anchor || !anchor.getAttribute || anchor.getAttribute('data-checkout-email-bound') === '1') return;
      anchor.setAttribute('data-checkout-email-bound', '1');
      var input = ensureInput(doc, anchor);
      if (anchor.addEventListener) {
        anchor.addEventListener('click', function (event) { startAnchor(anchor, input, event); });
      }
      bindEnter(input);
    });
    var fields = doc.querySelectorAll('input[data-checkout-email]');
    Array.prototype.forEach.call(fields, bindEnter);
  }

  return {
    validEmail: validEmail,
    withPrefilledEmail: withPrefilledEmail,
    priceIdFromUrl: priceIdFromUrl,
    listingSlug: listingSlug,
    productName: productName,
    leadRow: leadRow,
    saveLead: saveLead,
    rememberLead: rememberLead,
    mount: mount,
    startAnchor: startAnchor,
    isCheckoutSessionUrl: isCheckoutSessionUrl,
    isPaymentLinkUrl: isPaymentLinkUrl,
    continueCheckout: continueCheckout,
    FAILURE: FAILURE
  };
});
