/* TransformerPath — form lead notification helper.
   Include with <script src="form-notify.js" defer></script> on any page with an
   enquiry form, then call window.TP_NOTIFY(formEl) from the submit handler.
   It posts the form's fields (as JSON) to /.netlify/functions/notify, which
   emails the owner when RESEND_API_KEY is configured. It never blocks or
   replaces the primary form submission (Netlify Forms). */
(function () {
  function collect(form) {
    var out = {};
    try {
      new FormData(form).forEach(function (v, k) {
        // Multi-value fields (checkboxes with the same name) become arrays.
        if (Object.prototype.hasOwnProperty.call(out, k)) {
          out[k] = Array.isArray(out[k]) ? out[k] : [out[k]];
          out[k].push(v);
        } else {
          out[k] = v;
        }
      });
    } catch (e) {}
    return out;
  }
  window.TP_NOTIFY = function (form) {
    try {
      return fetch('/.netlify/functions/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collect(form)),
      }).catch(function () {});
    } catch (e) { /* never break the form */ }
  };
})();
