/* CSV pay controls. The Payment Link is not in this file.
 * A click reads data/csv-pay-plans.json and only then leaves the page.
 */
(function () {
  var host = typeof globalThis !== 'undefined' ? globalThis : this;

  function pageWindow() {
    if (host.window && host.window.location) return host.window;
    if (host.location) return host;
    return null;
  }

  function pageDocument() {
    return host.document || null;
  }

  function pageFetch() {
    var win = pageWindow();
    if (win && typeof win.fetch === 'function') return win.fetch.bind(win);
    if (typeof host.fetch === 'function') return host.fetch.bind(host);
    return null;
  }

  function go(url) {
    var win = pageWindow();
    if (!url || !win || !win.location) return '';
    if (typeof win.location.assign === 'function') win.location.assign(url);
    else win.location.href = url;
    return url;
  }

  function onClick(event) {
    var node = event && event.target && event.target.closest
      ? event.target.closest('[data-csv-product]')
      : null;
    if (!node) return;
    if (event.preventDefault) event.preventDefault();
    var product = node.getAttribute('data-csv-product') || '';
    var fetchPlan = pageFetch();
    if (!fetchPlan) return;
    fetchPlan('/data/csv-pay-plans.json', { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .then(function (doc) {
        var plans = doc && doc.plans && typeof doc.plans === 'object' ? doc.plans : {};
        go(plans[product] || '');
      })
      .catch(function () {});
  }

  function boot() {
    var document = pageDocument();
    if (!document || !document.addEventListener) return;
    var root = document.documentElement;
    if (root && root.getAttribute && root.getAttribute('data-csv-pay-bound') === '1') return;
    if (root && root.setAttribute) root.setAttribute('data-csv-pay-bound', '1');
    document.addEventListener('click', onClick);
  }

  var document = pageDocument();
  if (document) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  if (typeof module === 'object' && module && module.exports) {
    module.exports = { onClick: onClick, go: go };
  }
})();
