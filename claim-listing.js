/* Free manufacturer claim form. Netlify stores the submission.
 * A work email on the listing website domain is marked domain_match.
 * Anything else, including a submit with JavaScript off, stays manual_review.
 * This file does not call Supabase and does not send mail.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.tpClaimListing = api;
  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.boot);
    else api.boot();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var CONFIRM = 'We review claims manually; corrected data appears once verified.';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cleanHost(host) {
    return String(host || '').trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  }

  function siteHost(website) {
    var raw = String(website || '').trim();
    if (!raw) return '';
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
    try {
      return cleanHost(new URL(raw).hostname);
    } catch (e) {
      return '';
    }
  }

  function emailDomain(email) {
    var s = String(email || '').trim().toLowerCase();
    var at = s.lastIndexOf('@');
    if (at < 1 || at !== s.indexOf('@') || at === s.length - 1) return '';
    var domain = cleanHost(s.slice(at + 1));
    if (!domain || domain.indexOf('..') !== -1) return '';
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return '';
    return domain;
  }

  function domainsMatch(email, website) {
    var left = emailDomain(email);
    var right = siteHost(website);
    if (!left || !right) return false;
    if (left === right) return true;
    if (left.length > right.length && left.endsWith('.' + right)) return true;
    if (right.length > left.length && right.endsWith('.' + left)) return true;
    return false;
  }

  function reviewFlag(email, website) {
    return domainsMatch(email, website) ? 'domain_match' : 'manual_review';
  }

  function href(slug) {
    var s = String(slug || '').trim().toLowerCase();
    if (!SLUG_RE.test(s)) return '/claim-listing/';
    return '/claim-listing/' + s + '/';
  }

  function payHref(base, slug) {
    var url = String(base || '').split('#')[0];
    url = url.replace(/([?&])client_reference_id=[^&]*/g, '$1').replace(/[?&]$/, '');
    var s = String(slug || '').trim().toLowerCase();
    if (!SLUG_RE.test(s)) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(s);
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

  function emailTools() {
    if (typeof window !== 'undefined' && window.tpCheckoutEmail && window.tpCheckoutEmail.withPrefilledEmail) return window.tpCheckoutEmail;
    if (typeof require === 'function') {
      try { return require('./checkout-email'); } catch (e) {}
    }
    return null;
  }

  var emailScriptPromise = null;

  function whenTools() {
    var tools = emailTools();
    if (tools && tools.withPrefilledEmail) return tools;
    if (typeof document === 'undefined' || !document.createElement) return tools;
    if (emailScriptPromise) return emailScriptPromise;
    emailScriptPromise = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = '/checkout-email.js';
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        resolve(emailTools());
      }
      script.onload = finish;
      script.onerror = finish;
      setTimeout(finish, 1500);
      var parent = document.head || document.documentElement;
      if (!parent || !parent.appendChild) finish();
      else parent.appendChild(script);
    });
    return emailScriptPromise;
  }

  function pagePath() {
    try {
      if (typeof location !== 'undefined' && location && location.pathname) return String(location.pathname);
    } catch (e) {}
    return '';
  }

  function fieldFor(btn) {
    var parent = btn && btn.parentNode;
    if (parent && parent.querySelector) return parent.querySelector('input[type="email"][data-checkout-email]');
    return null;
  }

  function ensureCheckoutFields() {
    if (typeof document === 'undefined' || !document.querySelectorAll || !document.createElement) return;
    if (document.head && document.createElement && document.getElementById && !document.getElementById('tp-checkout-email-style')) {
      var style = document.createElement('style');
      style.id = 'tp-checkout-email-style';
      style.textContent = '.tp-checkout-email{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%;margin:0 0 8px}.tp-checkout-email input[type=email]{flex:1 1 160px;min-width:0;width:auto;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font:inherit}.tp-checkout-email .btn,.tp-checkout-email button{flex:1 1 180px}';
      document.head.appendChild(style);
    }
    var nodes = document.querySelectorAll('[data-pay-plan]');
    Array.prototype.forEach.call(nodes, function (btn) {
      if (!btn || !btn.parentNode || !btn.parentNode.insertBefore) return;
      if (btn.getAttribute && btn.getAttribute('data-checkout-wrapped') === '1') return;
      var parent = btn.parentNode;
      if (parent.classList && parent.classList.contains('tp-checkout-email')) {
        if (btn.setAttribute) btn.setAttribute('data-checkout-wrapped', '1');
        return;
      }
      var wrap = document.createElement('div');
      wrap.className = 'tp-checkout-email';
      var input = document.createElement('input');
      input.type = 'email';
      input.required = true;
      input.setAttribute('maxlength', '160');
      input.setAttribute('autocomplete', 'email');
      input.setAttribute('inputmode', 'email');
      input.setAttribute('placeholder', 'Email');
      input.setAttribute('aria-label', 'Email');
      input.setAttribute('data-checkout-email', '1');
      parent.insertBefore(wrap, btn);
      wrap.appendChild(input);
      wrap.appendChild(btn);
      if (btn.setAttribute) btn.setAttribute('data-checkout-wrapped', '1');
    });
  }

  // Payment Link strings stay in lib/paid-listings.js. The browser reads
  // the copy written to /data/claim-pay-plans.json and navigates on click.
  var payMap = null;

  function primePayPlans(plans) {
    payMap = plans && typeof plans === 'object' ? plans : {};
    return payMap;
  }

  function ensurePlans() {
    if (payMap) return Promise.resolve(payMap);
    if (typeof fetch !== 'function') return Promise.resolve({});
    return fetch('/data/claim-pay-plans.json', { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .then(function (doc) {
        payMap = doc && doc.plans && typeof doc.plans === 'object' ? doc.plans : {};
        return payMap;
      })
      .catch(function () { payMap = {}; return payMap; });
  }

  function checkoutUrl(plan, slug, plans) {
    var map = plans || payMap || {};
    var base = map[plan];
    if (!base) return '';
    return payHref(base, slug);
  }

  function slugFor(btn) {
    var input = null;
    try { input = document.getElementById('claim-slug'); } catch (e) { input = null; }
    if (input && String(input.value || '').trim()) return input.value;
    return btn && btn.getAttribute ? (btn.getAttribute('data-pay-slug') || '') : '';
  }

  function go(url) {
    if (!url || typeof window === 'undefined' || !window.location) return url || '';
    if (typeof window.location.assign === 'function') window.location.assign(url);
    else window.location.href = url;
    return url;
  }

  function depart(plan, slug, email, input, plans, tools) {
    var check = (tools && tools.validEmail) || validEmail;
    var stamp = (tools && tools.withPrefilledEmail) || withPrefilledEmail;
    if (!check(email)) {
      if (input && typeof input.reportValidity === 'function') input.reportValidity();
      return Promise.resolve('');
    }
    var url = checkoutUrl(plan, slug, plans);
    if (!url) return Promise.resolve('');
    url = stamp(url, email);
    var row = {
      email: email,
      listingSlug: slug,
      productName: plan,
      priceId: tools && tools.priceIdFromUrl ? tools.priceIdFromUrl(url) : '',
      pagePath: pagePath()
    };
    var lead = tools && tools.leadRow ? tools.leadRow(row) : null;
    var save = tools && tools.rememberLead && lead ? tools.rememberLead(lead) : null;
    function leave() { return go(url); }
    if (save && typeof save.then === 'function') return save.then(leave, leave);
    return Promise.resolve(leave());
  }

  function onPayClick(e) {
    var btn = e && e.target && e.target.closest ? e.target.closest('[data-pay-plan]') : null;
    if (!btn) return Promise.resolve('');
    var plan = btn.getAttribute('data-pay-plan') || '';
    var slug = slugFor(btn);
    var input = fieldFor(btn);
    var email = input ? String(input.value || '').trim() : '';
    function afterPlans(plans) {
      var ready = whenTools();
      if (ready && typeof ready.then === 'function') {
        return ready.then(function (tools) { return depart(plan, slug, email, input, plans, tools); });
      }
      return depart(plan, slug, email, input, plans, ready);
    }
    if (payMap) return afterPlans(payMap);
    return ensurePlans().then(afterPlans);
  }

  function bindPayClicks() {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    var rootEl = document.documentElement;
    if (rootEl && rootEl.getAttribute && rootEl.getAttribute('data-pay-bound') === '1') return;
    if (rootEl && rootEl.setAttribute) rootEl.setAttribute('data-pay-bound', '1');
    document.addEventListener('click', onPayClick);
  }

  function linkHtml(slug) {
    return '<a class="btn btn-outline btn-sm claim-listing-link" href="' + esc(href(slug)) + '" data-claim-listing="1">Claim this listing</a>';
  }

  function boot() {
    ensureCheckoutFields();
    whenTools();
    bindPayClicks();
    var form = document.getElementById('claimListingForm');
    if (!form || form.getAttribute('data-claim-ready') === '1') return;
    form.setAttribute('data-claim-ready', '1');
    var slugInput = document.getElementById('claim-slug');
    var companyInput = document.getElementById('claim-company');
    var emailInput = document.getElementById('claim-email');
    var flagInput = form.querySelector('input[name="review_flag"]');
    var siteInput = form.querySelector('input[name="listing_website"]');
    var status = document.getElementById('claim-domain-status');
    var params;
    try { params = new URLSearchParams(window.location.search); }
    catch (e) { params = null; }
    var asked = params ? String(params.get('slug') || '').trim().toLowerCase() : '';
    if (asked && slugInput && !slugInput.value) slugInput.value = asked;
    var listing = { name: '', website: '' };

    function currentSlug() {
      return String(slugInput && slugInput.value || '').trim().toLowerCase();
    }

    function applyFlag() {
      var flag = reviewFlag(emailInput ? emailInput.value : '', listing.website);
      if (flagInput) flagInput.value = flag;
      if (siteInput) siteInput.value = listing.website || '';
      if (!status) return;
      if (!listing.website) {
        status.textContent = 'No listing website is on file for this slug. This claim is flagged for manual review.';
        return;
      }
      if (flag === 'domain_match') {
        status.textContent = 'Work email matches the listing website.';
        return;
      }
      status.textContent = 'Work email does not match the listing website. This claim is flagged for manual review.';
    }

    function stampPays(slug) {
      var clean = String(slug || '').trim().toLowerCase();
      if (!SLUG_RE.test(clean)) clean = '';
      var nodes = document.querySelectorAll
        ? document.querySelectorAll('[data-pay-plan]')
        : [];
      Array.prototype.forEach.call(nodes, function (pay) {
        if (pay && pay.setAttribute) pay.setAttribute('data-pay-slug', clean);
      });
    }

    function applyListing(row) {
      listing = row || { name: '', website: '' };
      if (companyInput && listing.name && !companyInput.value) companyInput.value = listing.name;
      stampPays(currentSlug());
      applyFlag();
    }

    function showMissing() {
      listing = { name: '', website: '' };
      if (slugInput) slugInput.value = '';
      if (flagInput) flagInput.value = 'manual_review';
      if (siteInput) siteInput.value = '';
      stampPays('');
      if (status) status.textContent = 'Listing not found';
    }

    form.addEventListener('submit', applyFlag);
    if (emailInput) emailInput.addEventListener('input', applyFlag);
    if (slugInput) {
      slugInput.addEventListener('input', function () { stampPays(currentSlug()); });
      slugInput.addEventListener('change', function () {
        stampPays(currentSlug());
        listing = { name: companyInput ? companyInput.value : '', website: '' };
        loadIndex();
      });
    }

    function loadIndex() {
      var slug = currentSlug();
      if (!slug) {
        applyListing({ name: '', website: '' });
        return;
      }
      fetch('/data/claim-listing-index.json', { credentials: 'same-origin' })
        .then(function (res) { return res.ok ? res.json() : {}; })
        .then(function (index) {
          var current = currentSlug();
          var row = index && index[current];
          if (current && (!row || typeof row !== 'object')) {
            showMissing();
            return;
          }
          applyListing(row && typeof row === 'object' ? row : { name: '', website: '' });
        })
        .catch(function () { applyListing({ name: '', website: '' }); });
    }

    loadIndex();
  }

  return {
    CONFIRM: CONFIRM,
    esc: esc,
    siteHost: siteHost,
    emailDomain: emailDomain,
    domainsMatch: domainsMatch,
    reviewFlag: reviewFlag,
    href: href,
    payHref: payHref,
    validEmail: validEmail,
    withPrefilledEmail: withPrefilledEmail,
    primePayPlans: primePayPlans,
    checkoutUrl: checkoutUrl,
    onPayClick: onPayClick,
    linkHtml: linkHtml,
    boot: boot
  };
});
