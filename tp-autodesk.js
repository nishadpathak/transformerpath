/* tp-autodesk.js — point each Autodesk note at data/autodesk-affiliate.json.
   The static href is the placeholder plus the page sid. Once baseUrl is an
   https URL, this script rewrites the click. It does not inject new notes. */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  if (root.__TP_AUTODESK__) return;
  root.__TP_AUTODESK__ = true;

  function hrefFor(baseUrl, param, sid) {
    var base = String(baseUrl || '');
    var key = String(param || '');
    var id = encodeURIComponent(String(sid || ''));
    if (!base || !key || !sid) return '';
    if (/[?&]$/.test(base)) return base + key + '=' + id;
    if (base.indexOf('?') !== -1) return base + '&' + key + '=' + id;
    return base + '?' + key + '=' + id;
  }

  function apply(cfg) {
    if (!cfg || typeof cfg.baseUrl !== 'string' || !/^https:\/\//.test(cfg.baseUrl)) return;
    if (!cfg.subIdParam) return;
    var bySid = {};
    (cfg.placements || []).forEach(function (p) {
      if (p && p.sid) bySid[p.sid] = p;
    });
    var nodes = document.querySelectorAll('[data-tp-autodesk]');
    for (var i = 0; i < nodes.length; i++) {
      var sid = nodes[i].getAttribute('data-tp-autodesk');
      if (!bySid[sid]) continue;
      var a = nodes[i].querySelector('[data-tp-autodesk-link]');
      if (!a) continue;
      a.href = hrefFor(cfg.baseUrl, cfg.subIdParam, sid);
      a.rel = 'sponsored noopener';
      a.target = '_blank';
    }
  }

  fetch('/data/autodesk-affiliate.json', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) { if (cfg) apply(cfg); })
    .catch(function () {});
})(typeof window !== 'undefined' ? window : null);
