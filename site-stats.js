/* TransformerPath — central site counters loader.
 * Fills any [data-stat="<key>"] element from data/site-stats.json, so counters
 * are driven by ONE source of truth and never drift. Also syncs the animated
 * count-up KPIs ([data-count="<key>"]) from the same canonical source, so the
 * KPI row never shows a hard-coded stale figure. Graceful: on error it leaves
 * however the page was authored. */
(function () {
  'use strict';
  if (!window.fetch) return;
  fetch('/data/site-stats.json')
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      var awardParts = [d.awardsConfirmed, d.awardsInferred, d.awardsUnknown];
      var awardTracked = awardParts.every(function (n) { return typeof n === 'number'; })
        ? awardParts[0] + awardParts[1] + awardParts[2]
        : null;
      if (awardTracked != null) d.awards = awardTracked;
      Object.keys(d).forEach(function (k) {
        if (k.indexOf('_') === 0) return;
        var v = (typeof d[k] === 'number') ? d[k].toLocaleString('en-US') : d[k];
        document.querySelectorAll('[data-stat="' + k + '"]').forEach(function (el) {
          el.textContent = v;
        });
        // Count-up KPIs: set the animation target from canonical data.
        document.querySelectorAll('[data-count="' + k + '"]').forEach(function (el) {
          var n = (typeof d[k] === 'number') ? d[k] : parseInt(d[k], 10);
          if (!isNaN(n)) el.dataset.count = String(n);
        });
      });
      if (awardTracked != null) {
        document.querySelectorAll('a[href*="type=awards"]').forEach(function (el) {
          el.setAttribute('title', awardTracked + ' awards tracked, split by transformer scope');
        });
      }
    })
    .catch(function () {});
})();
