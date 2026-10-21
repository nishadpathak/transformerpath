/* Supplier Qualification Passport.
 *
 * The public page stays on "coming soon" unless supplier_passport is true.
 * The committed flag is false. The form does not show a price, a personal
 * name, or a public document URL. Verified claims are not set from this form.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.tpSupplierPassport = api;
  if (typeof document !== 'undefined' && document.getElementById && document.getElementById('supplier-passport')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.mount);
    else api.mount();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HTTP = /^https?:\/\/\S+$/i;
  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var FIELDS = [
    'registration',
    'factory',
    'certification',
    'test_facility',
    'product_range',
    'manufacturing_evidence',
    'export_market',
    'document'
  ];

  function pageState(flags) {
    var on = !!(flags && flags.supplier_passport === true);
    return { form: on, soon: !on };
  }

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function guaranteesStock(text) {
    return /\bin stock\b|\bready to ship\b|\bguaranteed\b|\bavailable immediately\b/i.test(String(text || ''));
  }

  function readForm(input) {
    var src = input || {};
    var errors = [];
    var slug = clean(src.company_slug).toLowerCase();
    if (!SLUG.test(slug)) errors.push('company_slug');
    var legal = clean(src.legal_name);
    if (!legal) errors.push('legal_name');
    if (/do_not_contact/i.test(JSON.stringify(src))) errors.push('private outreach');
    if (/(?:\$|€|£)\s?\d/.test(JSON.stringify(src))) errors.push('price');
    var evidence = clean(src.manufacturing_evidence_url);
    if (evidence && !HTTP.test(evidence)) errors.push('manufacturing_evidence_url');
    var documentRef = clean(src.document_ref);
    if (documentRef && HTTP.test(documentRef)) errors.push('document is public');
    var claims = [];
    function add(field, value, source, expires) {
      var shown = clean(value);
      if (!shown) return;
      if (FIELDS.indexOf(field) < 0) errors.push('field');
      if (guaranteesStock(shown)) errors.push('stock wording');
      var url = clean(source);
      if (!HTTP.test(url)) errors.push(field + ' source');
      var expiry = clean(expires);
      if (expiry && !DATE.test(expiry)) errors.push(field + ' expiry');
      claims.push({
        field_key: field,
        value_text: shown,
        source_url: url,
        expires_on: expiry || null,
        verification_status: 'company-declared'
      });
    }
    add('registration', src.registration_number, src.registration_source_url, '');
    add('factory', [clean(src.factory_city), clean(src.factory_country)].filter(Boolean).join(', '), src.factory_source_url, '');
    add('certification', src.certification, src.certification_source_url, src.certification_expires);
    add('test_facility', src.test_facility, src.test_facility_source_url, '');
    add('product_range', src.product_range, src.product_range_source_url, '');
    add('manufacturing_evidence', src.manufacturing_evidence, evidence, src.document_expires);
    var buyer = clean(src.buyer_account);
    if (buyer && !UUID.test(buyer)) errors.push('buyer_account');
    return {
      ok: errors.length === 0,
      errors: errors,
      passport: {
        company_slug: slug,
        legal_name: legal,
        registration_number: clean(src.registration_number),
        registration_country: clean(src.registration_country),
        factory_city: clean(src.factory_city),
        factory_country: clean(src.factory_country),
        manufacturing_evidence_url: evidence
      },
      claims: claims,
      document: documentRef ? {
        label: clean(src.document_label) || 'Document',
        storage_path: documentRef,
        expires_on: DATE.test(clean(src.document_expires)) ? clean(src.document_expires) : null,
        visibility: 'private'
      } : null,
      buyer_account: buyer || ''
    };
  }

  function mount() {
    var root = document.getElementById('supplier-passport');
    if (!root) return;
    var soon = document.getElementById('passport-soon');
    var form = document.getElementById('passport-form');
    var note = document.getElementById('passport-note');
    fetch('/data/feature-flags.json').then(function (res) {
      if (!res.ok) throw new Error('flags');
      return res.json();
    }).then(function (flags) {
      var state = pageState(flags);
      if (!state.form || !form) return;
      if (soon) soon.hidden = true;
      form.hidden = false;
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!pageState(flags).form) return;
        var data = {};
        Array.prototype.forEach.call(form.elements, function (el) {
          if (!el.name) return;
          data[el.name] = el.value;
        });
        var draft = readForm(data);
        if (!draft.ok) {
          if (note) note.textContent = 'Check the company, the source links, and the document reference. A verified claim is not changed from this form.';
          return;
        }
        draft.claims.forEach(function (claim) {
          if (claim.verification_status === 'verified') claim.verification_status = 'company-declared';
        });
        if (note) note.textContent = 'Signed-in suppliers can store this on their account. A change to a verified claim waits for admin review. Questions: hello@transformerpath.com.';
        if (window.TP && typeof window.TP.saveSupplierPassport === 'function') {
          window.TP.saveSupplierPassport(draft);
        }
      });
    }).catch(function () { /* coming soon stays */ });
  }

  return {
    FIELDS: FIELDS,
    pageState: pageState,
    readForm: readForm,
    guaranteesStock: guaranteesStock,
    mount: mount
  };
});
