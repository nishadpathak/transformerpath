/* Jobs and RFQ buy buttons. The page HTML does not contain the Payment
 * Link URLs. This script asks the flag function and inserts anchors only
 * when jobs_rfq_payments is true. A query string is not proof of payment. */
(function () {
  var PAID_TEXT = {
    job_standard: 'Payment received. The vacancy stays in review until a reviewer records the apply URL, the capture date, and the verification date. Payment does not publish the opening.',
    job_featured: 'Payment received. Featured placement stays in review. FEATURED is a labelled pin, not an editorial recommendation, and it does not include a newsletter mention. Payment does not publish the opening.',
    job_bundle_5: 'Payment received. The five vacancies stay in review until each one has a specific apply URL, a capture date, and a verification date. Payment does not publish an opening.',
    rfq_lead: 'Payment received. Buyer contact stays hidden until this lead is marked paid and is still qualified. Payment does not qualify a lead.',
    rfq_lead_pro: 'Payment received. Buyer contact stays hidden until this lead is marked paid and is still qualified. Payment does not qualify a lead.',
    supplier_pro: 'Payment received. Supplier Pro stays pending verification. The inbox still counts only the included leads on file. Payment does not release a buyer contact.'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function confirmReturn() {
    if (!window.tpListingPayment) return;
    var paid = '';
    try { paid = new URLSearchParams(location.search).get('paid') || ''; }
    catch (e) { paid = ''; }
    if (!PAID_TEXT[paid]) return;
    var scroll = document.getElementById('post') ? 'post' : '';
    window.tpListingPayment.confirm({
      product: paid,
      noteId: 'listingPayNote',
      scrollId: scroll,
      paidText: PAID_TEXT[paid]
    });
  }

  function paint(doc) {
    if (!doc || doc.jobs_rfq_payments !== true || !doc.groups) return;
    var mounts = document.querySelectorAll('[data-jobs-rfq-pay]');
    mounts.forEach(function (el) {
      var name = el.getAttribute('data-jobs-rfq-pay');
      var buttons = doc.groups[name] || [];
      if (!buttons.length) return;
      el.innerHTML = buttons.map(function (button) {
        return '<a class="btn btn-amber btn-sm" href="' + esc(button.href) + '" data-jobs-rfq-product="' + esc(button.product) + '">' + esc(button.label) + '</a>';
      }).join(' ');
      el.hidden = false;
    });
    if (doc.groups.jobs && doc.groups.jobs.length) {
      var heading = document.getElementById('jobPostHeading');
      if (heading) heading.textContent = 'Submit a vacancy';
    }
  }

  confirmReturn();
  var mounts = document.querySelectorAll('[data-jobs-rfq-pay]');
  if (!mounts.length) return;
  fetch('/.netlify/functions/commerce-flags', { headers: { accept: 'application/json' } })
    .then(function (res) { return res.json(); })
    .then(paint)
    .catch(function () {});
})();
