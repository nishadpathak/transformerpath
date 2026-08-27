/* TransformerPath — shared material-prices loader.
 * Fills any [data-m="<commodity-id>"] element from data/materials-latest.json,
 * which is the single source used by the homepage and Daily Intel. This keeps
 * market numbers in ONE place. Elements with data-m-type="num" get the bare
 * number (used inside the ticker); everything else gets the value_display. */
(function () {
  'use strict';
  if (!window.fetch) return;
  fetch('data/materials-latest.json')
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      var map = {}; (d.rows || []).forEach(function (r) { map[r.id] = r; });
      document.querySelectorAll('[data-m]').forEach(function (el) {
        var r = map[el.getAttribute('data-m')];
        if (!r) return;
        if (el.getAttribute('data-m-type') === 'num') {
          el.textContent = (typeof r.value === 'number') ? r.value.toLocaleString('en-US') : '';
        } else {
          el.textContent = r.value_display || '';
        }
        if (el.parentNode && el.parentNode.querySelector('[data-m-obs]') && r.observation_date) {
          // optionally show the observation date inline
        }
      });
      // Fill any [data-m-obs="<id>"] with that commodity's observation date.
      document.querySelectorAll('[data-m-obs]').forEach(function (el) {
        var r = map[el.getAttribute('data-m-obs')];
        if (r && r.observation_date) el.textContent = r.observation_date;
      });
    })
    .catch(function () { /* keep authored fallback text */ });
})();
