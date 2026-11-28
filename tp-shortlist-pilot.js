/* Builds a client-side, unsent email draft. No network calls or storage. */
(function () {
  'use strict';
  var form = document.getElementById('tp-shortlist-pilot-form');
  if (!form) return;
  var panel = document.getElementById('shortlist-draft');
  var text = document.getElementById('shortlist-text');
  var copy = document.getElementById('shortlist-copy');
  var revision = 0;
  var mail = document.getElementById('shortlist-mail');
  var status = document.getElementById('shortlist-status');
  function read(name) {
    return String(form.elements.namedItem(name).value || '').trim();
  }
  form.addEventListener('input', function () {
    if (panel.hidden) return;
    revision++;
    panel.hidden = true;
    mail.href = 'mailto:hello@transformerpath.com';
    text.value = '';
    status.textContent = 'The request changed. Prepare a new draft before sending.';
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!read('part') || !read('market') || !read('spec')) {
      status.textContent = 'Enter an equipment name, a delivery market and technical requirements.';
      return;
    }
    var body = [
      'Please review this request for a TransformerPath supplier shortlist.', '',
      'Equipment or component: ' + read('part'),
      'Delivery market: ' + read('market'),
      'Technical requirements: ' + read('spec'),
      'Quantity and target date: ' + (read('quantity') || 'Not specified'), '',
      'Please confirm the scope, delivery time and price before starting.'
    ].join('\r\n');
    revision++;
    text.value = body;
    mail.href = 'mailto:hello@transformerpath.com?subject=' +
      encodeURIComponent('Supplier shortlist pilot request') + '&body=' + encodeURIComponent(body);
    panel.hidden = false;
    status.textContent = 'Draft ready. Nothing has been sent.';
    text.focus();
  });
  function selectForManualCopy() {
    text.focus();
    text.select();
    text.setSelectionRange(0, text.value.length);
    status.textContent = 'Request text selected. Use Copy on your device, then paste it into your email. Nothing has been sent.';
  }
  if (copy) copy.addEventListener('click', function () {
    if (panel.hidden || !text.value) return;
    var current = revision;
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      selectForManualCopy();
      return;
    }
    navigator.clipboard.writeText(text.value).then(function () {
      if (revision === current) status.textContent = 'Request text copied. Paste it into your email. Nothing has been sent.';
    }, function () {
      if (revision === current) selectForManualCopy();
    });
  });
  document.getElementById('shortlist-fields').disabled = false;
}());
