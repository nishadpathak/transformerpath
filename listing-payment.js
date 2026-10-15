/* Listing return banners. A session_id in the URL is not payment.
   This asks /.netlify/functions/confirm-listing-payment and only then
   may replace the neutral sentence with "Payment received".
   It does not publish a badge. */
(function () {
  var NEUTRAL = 'If you completed payment, submit the form below; we confirm payment before review.';

  function confirm(opts) {
    var params = new URLSearchParams(location.search);
    if (params.get('paid') !== opts.product) return;
    var note = document.getElementById(opts.noteId);
    var session = params.get('session_id') || '';
    var hidden = opts.sessionFieldId ? document.getElementById(opts.sessionFieldId) : null;
    if (hidden) hidden.value = session;
    if (note) {
      note.style.display = 'block';
      note.textContent = NEUTRAL;
    }
    if (opts.scrollId) {
      var box = document.getElementById(opts.scrollId);
      if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (!session || session.indexOf('{') !== -1) return;
    fetch('/.netlify/functions/confirm-listing-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session, product: opts.product })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!note) return;
      if (res && res.configured === true && res.paid === true && res.product === opts.product) {
        note.textContent = opts.paidText;
      } else {
        note.textContent = NEUTRAL;
      }
    }).catch(function () {
      if (note) note.textContent = NEUTRAL;
    });
  }

  window.tpListingPayment = { neutral: NEUTRAL, confirm: confirm };
})();
