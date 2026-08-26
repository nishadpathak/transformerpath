/* TransformerPath — central site counters loader.
 * Fills any [data-stat="<key>"] element from data/site-stats.json, so counters
 * are driven by ONE source of truth and never drift. Graceful: on error it
 * leaves however the page was authored. */
(function () {
  'use strict';
  if (!window.fetch) return;
  fetch('data/site-stats.json')
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      Object.keys(d).forEach(function (k) {
        if (k.indexOf('_') === 0) return;
        document.querySelectorAll('[data-stat="' + k + '"]').forEach(function (el) {
          el.textContent = (typeof d[k] === 'number') ? d[k].toLocaleString('en-US') : d[k];
        });
      });
    })
    .catch(function () {});
})();
