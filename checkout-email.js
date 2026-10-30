/* Email gate for Stripe Payment Links on pricing and claim pages.
 * Appends prefilled_email and leaves client_reference_id as it was.
 * A failed lead insert still lets checkout continue.
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

  function openCheckout(anchor, url, popup) {
    if (popup && !popup.closed) {
      try {
        popup.location.href = url;
        try { popup.opener = null; } catch (e) {}
        return url;
      } catch (e) {}
    }
    var blank = anchor && anchor.getAttribute && anchor.getAttribute('target') === '_blank';
    if (blank && typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener');
      return url;
    }
    if (typeof window !== 'undefined' && window.location) {
      if (typeof window.location.assign === 'function') window.location.assign(url);
      else window.location.href = url;
    }
    return url;
  }

  function reserveBlank(anchor) {
    if (!anchor || !anchor.getAttribute || anchor.getAttribute('target') !== '_blank') return null;
    if (typeof window === 'undefined' || !window.open) return null;
    try { return window.open('about:blank', '_blank'); } catch (e) { return null; }
  }

  function startAnchor(anchor, input, event) {
    if (event && event.preventDefault) event.preventDefault();
    var email = input ? String(input.value || '').trim() : '';
    if (!validEmail(email)) {
      if (input && input.reportValidity) input.reportValidity();
      return Promise.resolve('');
    }
    var href = anchor.getAttribute ? (anchor.getAttribute('href') || anchor.href || '') : '';
    var url = withPrefilledEmail(href, email);
    var row = leadRow({
      email: email,
      listingSlug: listingSlug(anchor, href),
      productName: productName(anchor),
      priceId: priceIdFromUrl(url),
      pagePath: pagePath()
    });
    var pending = rememberLead(row);
    if (pending && typeof pending.then === 'function') {
      var popup = reserveBlank(anchor);
      var leave = function () { return openCheckout(anchor, url, popup); };
      return pending.then(leave, leave);
    }
    return Promise.resolve(openCheckout(anchor, url, null));
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
    startAnchor: startAnchor
  };
});
