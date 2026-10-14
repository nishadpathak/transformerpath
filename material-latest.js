/* TransformerPath — shared material-prices loader.
 * Fills any [data-m="<commodity-id>"] element from data/materials-latest.json.
 * Commodity freshness is independent of Intel / census / build clocks. */
(function () {
  'use strict';
  if (!window.fetch) return;

  function fmtObs(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
    var d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function isHistorical(r) {
    var s = String(r.status || r.freshness_status || r.freshness_label || '').toLowerCase();
    return s === 'historical' || s === 'stale' || s === 'hist' || r.presentation === 'Historical market reference';
  }

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
      });
      document.querySelectorAll('[data-m-obs]').forEach(function (el) {
        var r = map[el.getAttribute('data-m-obs')];
        if (!r || !r.observation_date) return;
        var observed = fmtObs(r.observation_date);
        if (isHistorical(r)) {
          el.textContent = 'Historical market reference · Observed ' + observed;
          el.style.color = 'var(--muted, #9fb0c4)';
          el.setAttribute('title', 'Commodity observation is independent of Intel freshness and build time');
        } else if (r.status === 'stale') {
          el.textContent = 'Last verified ' + fmtObs(r.last_verified || r.observation_date);
          el.style.color = 'var(--warn, #b5651d)';
        } else {
          el.textContent = 'Observed ' + observed;
        }
      });
    })
    .catch(function () { /* keep authored fallback text */ });
})();
