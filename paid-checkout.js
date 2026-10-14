/* Shared Checkout button. POSTs to create-checkout. A 503 {configured:false}
 * or any failure follows data-fallback (mailto, form hash, or claim page).
 */
(function () {
  function slugify(s) {
    return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  function goFallback(root, reason) {
    var note = document.getElementById('paidCheckoutNote');
    if (note && reason) note.textContent = reason;
    var fallback = root.getAttribute('data-fallback') || '';
    if (!fallback) return;
    if (fallback.charAt(0) === '#') {
      var el = document.querySelector(fallback);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    window.location.href = fallback;
  }

  function fieldValue(root, selector, fromId) {
    var local = root.querySelector(selector);
    if (local && local.value && local.value.trim()) return local.value.trim();
    if (fromId) {
      var ext = document.getElementById(fromId);
      if (ext && ext.value && ext.value.trim()) return ext.value.trim();
    }
    return '';
  }

  function bind(root) {
    var btn = root.querySelector('.paid-checkout-btn');
    if (!btn || btn.getAttribute('data-bound') === '1') return;
    btn.setAttribute('data-bound', '1');
    btn.addEventListener('click', function () {
      var product = root.getAttribute('data-product');
      var email = fieldValue(root, '.paid-checkout-email', root.getAttribute('data-email-from'));
      var companySlug = root.getAttribute('data-company-slug') || '';
      var eventId = root.getAttribute('data-event-id') || '';
      var typedSlug = fieldValue(root, '.paid-checkout-slug', null);
      var typedEvent = fieldValue(root, '.paid-checkout-event', null);
      if (!companySlug && typedSlug) companySlug = typedSlug;
      if (!eventId && typedEvent) eventId = typedEvent;
      if (!companySlug && root.getAttribute('data-slug-from')) {
        var nameEl = document.getElementById(root.getAttribute('data-slug-from'));
        companySlug = slugify(nameEl && nameEl.value);
      }
      if (!email || (product === 'verified_manufacturer' && !companySlug) || (product === 'featured_event' && !eventId)) {
        goFallback(root, 'Add the company or event and a work email, or use the form below. Checkout needs both.');
        return;
      }
      var payload = { product: product, email: email };
      if (companySlug) payload.company_slug = companySlug;
      if (eventId) payload.event_id = eventId;
      btn.disabled = true;
      fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { status: r.status, data: data };
        });
      }).then(function (res) {
        if (res.data && res.data.url) {
          window.location.href = res.data.url;
          return;
        }
        btn.disabled = false;
        if (res.status === 503 || (res.data && res.data.configured === false)) {
          goFallback(root, 'Checkout is not configured yet. Use the form or email path.');
          return;
        }
        goFallback(root, 'Checkout could not start for that company or event. Use the form or email path.');
      }).catch(function () {
        btn.disabled = false;
        goFallback(root, 'Checkout is unavailable. Use the form or email path.');
      });
    });
  }

  function boot() {
    var nodes = document.querySelectorAll('.paid-checkout');
    for (var i = 0; i < nodes.length; i++) bind(nodes[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.tpPaidCheckoutBoot = boot;
})();
