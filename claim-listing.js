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

  function linkHtml(slug) {
    return '<a class="btn btn-outline btn-sm claim-listing-link" href="' + esc(href(slug)) + '" data-claim-listing="1">Claim this listing</a>';
  }

  function boot() {
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
      var nodes = document.querySelectorAll
        ? document.querySelectorAll('[data-verified-manufacturer-pay="1"],[data-featured-listing-pay="1"],[data-featured-verified-pay="1"]')
        : [];
      Array.prototype.forEach.call(nodes, function (pay) {
        pay.setAttribute('href', payHref(pay.getAttribute('href') || '', slug));
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
    if (slugInput) slugInput.addEventListener('change', function () {
      listing = { name: companyInput ? companyInput.value : '', website: '' };
      loadIndex();
    });

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
    linkHtml: linkHtml,
    boot: boot
  };
});
