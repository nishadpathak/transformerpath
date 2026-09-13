/* TransformerPath PWA: one service-worker register, install prompt, standalone chrome. */
(function () {
  'use strict';
  if (window.__TP_PWA__) return;
  window.__TP_PWA__ = true;

  var DISMISS_INSTALL = 'tp-pwa-install-dismissed';
  var DISMISS_IOS = 'tp-pwa-ios-hint-dismissed';
  var SEEN_INSTALL = 'tp-pwa-install-seen';
  var SEEN_IOS = 'tp-pwa-ios-seen';

  function standalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    function go() {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go);
  }

  function currentTab() {
    var p = location.pathname.replace(/\/$/, '') || '/index.html';
    if (p.indexOf('/intel') === 0) return 'intel';
    if (p.indexOf('/map') === 0) return 'map';
    if (p.indexOf('/directory') === 0 || p.indexOf('/manufacturers') === 0) return 'directory';
    if (p.indexOf('/learn') === 0 || p.indexOf('/masterclass') === 0 || p.indexOf('/books') === 0) return 'learn';
    return '';
  }

  function bottomNav() {
    if (!standalone() || document.getElementById('tp-pwa-nav')) return;
    var tab = currentTab();
    var nav = document.createElement('nav');
    nav.id = 'tp-pwa-nav';
    nav.setAttribute('aria-label', 'App');
    nav.innerHTML =
      '<a href="/intel.html"' + (tab === 'intel' ? ' aria-current="page"' : '') + '>Intel</a>' +
      '<a href="/map.html"' + (tab === 'map' ? ' aria-current="page"' : '') + '>Map</a>' +
      '<a href="/directory.html"' + (tab === 'directory' ? ' aria-current="page"' : '') + '>Directory</a>' +
      '<a href="/learn.html"' + (tab === 'learn' ? ' aria-current="page"' : '') + '>Learn</a>';
    document.body.appendChild(nav);
    document.documentElement.classList.add('tp-pwa-standalone');
  }

  function chromeInstall(deferred) {
    if (standalone() || document.getElementById('tpInstall')) return;
    try {
      if (localStorage.getItem(DISMISS_INSTALL) === '1') return;
      if (sessionStorage.getItem(SEEN_INSTALL) === '1') return;
      sessionStorage.setItem(SEEN_INSTALL, '1');
    } catch (e) {}
    var wrap = document.createElement('div');
    wrap.id = 'tpInstall';
    wrap.className = 'tp-pwa-banner';
    wrap.setAttribute('role', 'status');
    wrap.innerHTML = '<span>Install TransformerPath on this device.</span>' +
      '<button type="button" data-pwa="go">Add</button>' +
      '<button type="button" data-pwa="no" class="ghost">Not now</button>';
    wrap.addEventListener('click', function (e) {
      var act = e.target && e.target.getAttribute && e.target.getAttribute('data-pwa');
      if (act === 'no') {
        try { localStorage.setItem(DISMISS_INSTALL, '1'); } catch (err) {}
        wrap.remove();
        return;
      }
      if (act === 'go' && deferred) {
        wrap.remove();
        deferred.prompt();
      }
    });
    document.body.appendChild(wrap);
  }

  function iosHint() {
    if (standalone()) return;
    var ua = navigator.userAgent || '';
    if (!/iPhone/.test(ua) || !/Safari/.test(ua) || /CriOS|FxiOS|EdgiOS/.test(ua)) return;
    try {
      if (localStorage.getItem(DISMISS_IOS) === '1') return;
      if (sessionStorage.getItem(SEEN_IOS) === '1') return;
      sessionStorage.setItem(SEEN_IOS, '1');
    } catch (e) {}
    if (document.getElementById('tpIosHint')) return;
    var bar = document.createElement('div');
    bar.id = 'tpIosHint';
    bar.className = 'tp-pwa-banner';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Add to Home Screen: tap Share, then Add to Home Screen.</span>' +
      '<button type="button" data-pwa="no" class="ghost">OK</button>';
    bar.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-pwa') === 'no') {
        try { localStorage.setItem(DISMISS_IOS, '1'); } catch (err) {}
        bar.remove();
      }
    });
    document.body.appendChild(bar);
  }

  registerSW();

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    bottomNav();
    iosHint();
  });

  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    ready(function () { chromeInstall(deferredPrompt); });
  });
})();
