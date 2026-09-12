/**
 * Shared checkout helper for directory upgrades + sponsorship SKUs.
 * Depends on payments-config.js (window.TP_PAYMENTS).
 */
(function (root) {
  function product(sku) {
    var catalog = root.TP_PAYMENTS;
    if (!catalog) throw new Error('TP_PAYMENTS missing — load payments-config.js first');
    var p = catalog.get(sku);
    if (!p) throw new Error('Unknown SKU: ' + sku);
    return p;
  }

  function invoiceMailto(sku, extra) {
    var p = product(sku);
    var catalog = root.TP_PAYMENTS;
    var subject = encodeURIComponent('Pay / invoice: ' + p.name);
    var body = encodeURIComponent(
      [
        'I would like to purchase:',
        '',
        p.name + ' — ' + p.displayPrice + p.displayPeriod,
        p.description,
        '',
        extra || '',
        '',
        'Company:',
        'Contact name:',
        'Email:',
        'Preferred payment: card link / invoice (USD or AED)',
        ''
      ].join('\n')
    );
    return 'mailto:' + catalog.supportEmail + '?subject=' + subject + '&body=' + body;
  }

  /**
   * Start checkout for a SKU.
   * opts: { company, email, name, openInNewTab, allowInvoiceFallback }
   */
  function startCheckout(sku, opts) {
    opts = opts || {};
    var p = product(sku);

    // 1) Static Payment Link
    if (p.paymentLink) {
      var url = p.paymentLink;
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      if (opts.email) url += sep + 'prefilled_email=' + encodeURIComponent(opts.email);
      if (opts.openInNewTab === false) location.href = url;
      else root.open(url, '_blank', 'noopener');
      return Promise.resolve({ method: 'payment_link', url: url });
    }

    // 2) Netlify Stripe Checkout Session
    var origin = location.origin;
    var payload = {
      sku: sku,
      successUrl: origin + p.successPath + '&session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: location.href.split('#')[0] + (location.href.indexOf('?') >= 0 ? '&' : '?') + 'checkout=cancelled',
      customerEmail: opts.email || undefined,
      metadata: {
        company: opts.company || '',
        contact_name: opts.name || '',
        source_page: location.pathname
      }
    };

    return fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            throw Object.assign(new Error(data.error || 'Checkout failed'), {
              data: data,
              status: res.status
            });
          }
          return data;
        });
      })
      .then(function (data) {
        if (data.url) {
          location.href = data.url;
          return { method: 'checkout_session', url: data.url };
        }
        throw new Error('No checkout URL returned');
      })
      .catch(function (err) {
        var needsConfig =
          (err && err.status === 503) ||
          (err && err.data && err.data.code === 'stripe_not_configured');
        if (needsConfig && opts.allowInvoiceFallback !== false) {
          location.href = invoiceMailto(sku, opts.company ? 'Company: ' + opts.company : '');
          return { method: 'invoice_mailto' };
        }
        throw err;
      });
  }

  function bindPayButtons(selector) {
    var nodes = document.querySelectorAll(selector || '[data-tp-pay]');
    Array.prototype.forEach.call(nodes, function (btn) {
      if (btn._tpPayBound) return;
      btn._tpPayBound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var sku = btn.getAttribute('data-tp-pay');
        if (!sku) return;
        var label = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Redirecting…';
        startCheckout(sku, {
          email: btn.getAttribute('data-email') || undefined,
          company: btn.getAttribute('data-company') || undefined,
          name: btn.getAttribute('data-name') || undefined,
          openInNewTab: btn.getAttribute('data-new-tab') === 'true'
        }).catch(function (err) {
          console.error(err);
          alert(
            (err && err.message) ||
              'Checkout unavailable. Email hello@transformerpath.com to pay by invoice.'
          );
          btn.disabled = false;
          btn.textContent = label;
        });
      });
    });
  }

  root.TPCheckout = {
    product: product,
    startCheckout: startCheckout,
    invoiceMailto: invoiceMailto,
    bindPayButtons: bindPayButtons
  };
})(typeof window !== 'undefined' ? window : globalThis);
