/* Builds a client-side, unsent email draft. No network calls or storage. */
(function () {
  'use strict';
  var form = document.getElementById('tp-shortlist-pilot-form');
  if (!form) return;
  var panel = document.getElementById('shortlist-draft');
  var text = document.getElementById('shortlist-text');
  var mail = document.getElementById('shortlist-mail');
  var status = document.getElementById('shortlist-status');
  function read(name) {
    return String(form.elements.namedItem(name).value || '').trim();
  }
  form.addEventListener('input', function () {
    if (panel.hidden) return;
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
    text.value = body;
    mail.href = 'mailto:hello@transformerpath.com?subject=' +
      encodeURIComponent('Supplier shortlist pilot request') + '&body=' + encodeURIComponent(body);
    panel.hidden = false;
    status.textContent = 'Draft ready. Nothing has been sent.';
    text.focus();
  });
  document.getElementById('shortlist-fields').disabled = false;
}());
