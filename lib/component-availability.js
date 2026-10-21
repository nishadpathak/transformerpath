/* Component availability listings.
 *
 * A row is a supplier statement with a source. It is not a stock guarantee.
 * The public page shows rows only when the component_availability flag is on.
 * The committed flag is off, and the committed list is empty.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.tpComponentAvailability = api;
  if (typeof document !== 'undefined' && document.getElementById && document.getElementById('component-availability')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.mount);
    else api.mount();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var HTTP = /^https?:\/\/\S+$/i;
  var DASH = '—';
  var STATUSES = ['verified', 'company-declared', 'unverified'];
  var AVAILABILITY = ['stated', 'limited', 'unspecified'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function guaranteesStock(text) {
    var s = String(text || '');
    if (/\bin stock\b/i.test(s)) return true;
    if (/\bready to ship\b/i.test(s)) return true;
    if (/\bavailable immediately\b/i.test(s)) return true;
    if (/\bex-?stock\b/i.test(s)) return true;
    if (/\bguaranteed\b/i.test(s)) return true;
    if (/\bguarantee(?:s|d)?\b/i.test(s) && !/\bnot a stock guarantee\b/i.test(s) && !/\bdoes not guarantee\b/i.test(s)) return true;
    return false;
  }

  function availabilityCopy(code) {
    if (code === 'stated') return 'The supplier states a quantity it expects to be able to dispatch. This is not a stock guarantee.';
    if (code === 'limited') return 'The supplier states a limited quantity. This is not a stock guarantee.';
    return DASH;
  }

  function badge(status) {
    if (status === 'verified') return 'Verified fact';
    if (status === 'company-declared') return 'Company-declared';
    return '';
  }

  function elinListing(slug) {
    return /\belin\b/i.test(String(slug || '')) || /elin-insulation/i.test(String(slug || ''));
  }

  function problems(row) {
    var errors = [];
    if (!row || typeof row !== 'object') return ['missing'];
    ['category', 'specs', 'unit', 'dispatch_country'].forEach(function (key) {
      if (row[key] && guaranteesStock(row[key])) errors.push(key + ' guarantees stock');
    });
    if (/do_not_contact/i.test(JSON.stringify(row))) errors.push('private outreach');
    if (row.price != null || row.amount != null || /(?:\$|€|£)\s?\d/.test(JSON.stringify(row))) errors.push('price');
    if (!row.category) errors.push('category');
    if (AVAILABILITY.indexOf(row.availability) < 0) errors.push('availability');
    if (row.quantity != null && !(Number(row.quantity) >= 0)) errors.push('quantity');
    if (row.moq != null && !(Number(row.moq) >= 0)) errors.push('moq');
    if (!row.unit) errors.push('unit');
    if (!row.dispatch_country) errors.push('dispatch_country');
    if (!DATE.test(row.earliest_shipment || '')) errors.push('earliest_shipment');
    if (!DATE.test(row.last_confirmed || '')) errors.push('last_confirmed');
    if (!HTTP.test(row.source_url || '')) errors.push('source_url');
    if (STATUSES.indexOf(row.verification_status) < 0 || row.verification_status === 'unverified') errors.push('verification_status');
    if (elinListing(row.company_slug) && row.verification_status === 'verified') errors.push('elin verified');
    return errors;
  }

  function publicRows(doc) {
    return ((doc && doc.listings) || []).filter(function (row) { return problems(row).length === 0; });
  }

  function filterListings(listings, query) {
    var q = query || {};
    return (listings || []).filter(function (row) {
      if (problems(row).length) return false;
      if (q.category && row.category !== q.category) return false;
      if (q.dispatch_country && row.dispatch_country !== q.dispatch_country) return false;
      if (q.verification_status && row.verification_status !== q.verification_status) return false;
      if (q.availability && row.availability !== q.availability) return false;
      if (q.moq_max != null && q.moq_max !== '' && !(Number(row.moq) <= Number(q.moq_max))) return false;
      if (q.earliest_by && String(row.earliest_shipment) > String(q.earliest_by)) return false;
      if (q.spec) {
        var hay = (row.category + ' ' + row.specs + ' ' + (row.unit || '')).toLowerCase();
        if (hay.indexOf(String(q.spec).toLowerCase()) < 0) return false;
      }
      return true;
    });
  }

  function renderListing(row) {
    function cell(label, value) {
      var shown = value == null || value === '' ? DASH : value;
      return '<div><b>' + esc(label) + '</b> ' + esc(shown) + '</div>';
    }
    return '<article class="availability-card" data-availability="1" data-evidence="' + esc(row.verification_status) + '">' +
      cell('Category', row.category) +
      cell('Specs', row.specs || DASH) +
      cell('Availability', availabilityCopy(row.availability)) +
      cell('Quantity', row.quantity == null ? DASH : String(row.quantity)) +
      cell('Unit', row.unit) +
      cell('Dispatch country', row.dispatch_country) +
      cell('Earliest shipment', row.earliest_shipment) +
      cell('Minimum order', row.moq == null ? DASH : String(row.moq)) +
      cell('Evidence', badge(row.verification_status)) +
      '<div><b>Source</b> <a href="' + esc(row.source_url) + '" target="_blank" rel="noopener">source</a></div>' +
      cell('Last confirmed', row.last_confirmed) +
      '</article>';
  }

  function renderBoard(listings) {
    var rows = filterListings(listings, {});
    if (!rows.length) return '<p data-availability-empty="1">No availability listing is on file. An empty field is —. A listing is not a stock guarantee.</p>';
    return rows.map(renderListing).join('');
  }

  function flagOn(doc, key) {
    return !!(doc && doc[key] === true);
  }

  function mount() {
    var root = document.getElementById('component-availability');
    if (!root) return;
    var soon = document.getElementById('availability-soon');
    var tools = document.getElementById('availability-filters');
    var board = document.getElementById('availability-board');
    fetch('/data/feature-flags.json').then(function (res) {
      if (!res.ok) throw new Error('flags');
      return res.json();
    }).then(function (flags) {
      if (!flagOn(flags, 'component_availability')) return;
      return fetch('/data/component-availability.json').then(function (res) {
        if (!res.ok) throw new Error('listings');
        return res.json();
      }).then(function (doc) {
        if (soon) soon.hidden = true;
        if (tools) tools.hidden = false;
        var listings = publicRows(doc);
        function paint() {
          var query = {
            category: val('availability-category'),
            dispatch_country: val('availability-dispatch'),
            verification_status: val('availability-evidence'),
            spec: val('availability-spec'),
            moq_max: val('availability-moq')
          };
          var matched = filterListings(listings, query);
          if (board) board.innerHTML = matched.length ? matched.map(renderListing).join('') : '<p>No listing matches these filters. An empty field is —. A listing is not a stock guarantee.</p>';
        }
        function val(id) {
          var node = document.getElementById(id);
          return node ? node.value : '';
        }
        if (tools) tools.addEventListener('input', paint);
        if (tools) tools.addEventListener('change', paint);
        paint();
        var form = document.getElementById('component-listing-form');
        if (form) {
          form.hidden = false;
          form.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!flagOn(flags, 'component_availability')) return;
            var data = {};
            Array.prototype.forEach.call(form.elements, function (el) {
              if (el.name) data[el.name] = el.value;
            });
            data.verification_status = 'company-declared';
            data.published = false;
            var row = {
              company_slug: data.company_slug,
              category: data.category,
              specs: data.specs,
              availability: data.availability || 'stated',
              quantity: data.quantity,
              unit: data.unit,
              dispatch_country: data.dispatch_country,
              earliest_shipment: data.earliest_shipment,
              moq: data.moq,
              verification_status: 'company-declared',
              last_confirmed: data.last_confirmed,
              source_url: data.source_url
            };
            if (problems(row).length) {
              var formNote = document.getElementById('component-listing-note');
              if (formNote) formNote.textContent = 'A listing needs a source, a confirmation date, and wording that does not guarantee stock.';
              return;
            }
            if (window.TP && typeof window.TP.saveComponentAvailability === 'function') {
              window.TP.saveComponentAvailability(row);
            }
            var formNoteOk = document.getElementById('component-listing-note');
            if (formNoteOk) formNoteOk.textContent = 'The listing stays on the signed-in account until it is reviewed. It is not a stock guarantee.';
          });
        }
      });
    }).catch(function () { /* flag off or unreadable: the coming-soon copy stays */ });
  }

  return {
    DASH: DASH,
    guaranteesStock: guaranteesStock,
    availabilityCopy: availabilityCopy,
    problems: problems,
    publicRows: publicRows,
    filterListings: filterListings,
    renderListing: renderListing,
    renderBoard: renderBoard,
    flagOn: flagOn,
    elinListing: elinListing,
    mount: mount
  };
});
