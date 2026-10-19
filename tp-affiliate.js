/* tp-affiliate.js — lazy Travelpayouts loader and prefilled flight links.
   The Emerald script is not on the page until a .tp-aff block is near the
   viewport or the visitor uses it, and only after cookie consent. Hotel forms
   are plain HTML and do not wait for this file. */
(function () {
  'use strict';
  if (window.__TP_AFF__) return;
  window.__TP_AFF__ = true;

  function consentOk() {
    try { return localStorage.getItem('tp-cookie-consent') === 'accepted'; } catch (e) { return false; }
  }

  var emeraldStarted = false;
  function loadEmerald() {
    if (emeraldStarted || !consentOk()) return;
    if (document.querySelector('script[data-tp-emerald]')) { emeraldStarted = true; return; }
    var host = document.querySelector('.tp-aff[data-tp-emerald]');
    var src = host && host.getAttribute('data-tp-emerald');
    if (!src) return;
    emeraldStarted = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    s.setAttribute('data-tp-emerald', '1');
    s.setAttribute('data-cmp-ab', '2');
    document.head.appendChild(s);
  }

  function ddmm(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + m[2] : '';
  }

  function flightHref(box) {
    var fallback = box.getAttribute('data-tp-fallback') || '';
    var originEl = box.querySelector('[data-tp-origin]');
    var origin = originEl ? String(originEl.value || '').trim().toUpperCase() : '';
    var dest = String(box.getAttribute('data-tp-dest') || '').toUpperCase();
    var marker = box.getAttribute('data-tp-marker') || '';
    var sub = box.getAttribute('data-tp-sub') || '';
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(dest) || !marker) return fallback;
    var depart = (box.querySelector('[data-tp-depart]') || {}).value || '';
    var ret = (box.querySelector('[data-tp-return]') || {}).value || '';
    var a = ddmm(depart);
    var b = ddmm(ret);
    var params = origin + dest + '1';
    if (a && b) params = origin + a + dest + b + '1';
    else if (a) params = origin + a + dest + '1';
    return 'https://www.aviasales.com/?params=' + params +
      '&marker=' + encodeURIComponent(marker + '.' + sub) +
      '&sub_id=' + encodeURIComponent(sub);
  }

  function arm(el) {
    if (!el || el.getAttribute('data-tp-armed') === '1') return;
    el.setAttribute('data-tp-armed', '1');
    loadEmerald();
  }

  function bind() {
    var nodes = document.querySelectorAll('.tp-aff');
    if (!nodes.length) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) arm(en.target);
        });
      }, { rootMargin: '200px 0px' });
      nodes.forEach(function (n) { io.observe(n); });
    } else {
      nodes.forEach(arm);
    }
    document.addEventListener('pointerdown', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.tp-aff') : null;
      if (t) arm(t);
    }, true);
    document.addEventListener('focusin', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.tp-aff') : null;
      if (t) arm(t);
    }, true);
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-tp-flight-go]') : null;
      if (!a) return;
      var box = a.closest('[data-tp-flight]');
      if (!box) return;
      var href = flightHref(box);
      if (href) a.href = href;
    }, true);
    window.addEventListener('tp-consent-changed', function (ev) {
      if (ev && ev.detail && ev.detail.consent === 'accepted' && document.querySelector('.tp-aff[data-tp-armed]')) {
        loadEmerald();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
