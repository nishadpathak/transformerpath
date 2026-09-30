/* TransformerPath PWA: one service-worker register, install prompt, standalone chrome.
 * Dismiss persists for DISMISS_DAYS (localStorage timestamp). Never nag in standalone. */
(function () {
  'use strict';
  if (window.__TP_PWA__) return;
  window.__TP_PWA__ = true;

  var DISMISS_INSTALL = 'tp-pwa-install-dismissed-until';
  var DISMISS_IOS = 'tp-pwa-ios-hint-dismissed-until';
  var DISMISS_DAYS = 45;
  var LEGACY_INSTALL = 'tp-pwa-install-dismissed';
  var LEGACY_IOS = 'tp-pwa-ios-hint-dismissed';

  function standalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || document.referrer.indexOf('android-app://') === 0;
  }

  function dismissedUntil(key, legacyKey) {
    try {
      if (legacyKey && localStorage.getItem(legacyKey) === '1') {
        // Migrate permanent legacy dismiss → long cooldown
        var untilLegacy = Date.now() + DISMISS_DAYS * 86400000;
        localStorage.setItem(key, String(untilLegacy));
        localStorage.removeItem(legacyKey);
        return untilLegacy;
      }
      var raw = localStorage.getItem(key);
      if (!raw) return 0;
      var n = parseInt(raw, 10);
      return isNaN(n) ? 0 : n;
    } catch (e) { return 0; }
  }

  function dismissFor(key, days) {
    try {
      localStorage.setItem(key, String(Date.now() + (days || DISMISS_DAYS) * 86400000));
    } catch (e) {}
  }

  function stillDismissed(key, legacyKey) {
    return Date.now() < dismissedUntil(key, legacyKey);
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
    var p = location.pathname.replace(/\/$/, '') || '/';
    if (p === '/intel' || p.indexOf('/intel') === 0) return 'intel';
    if (p === '/map' || p.indexOf('/map') === 0) return 'map';
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
      '<a href="/intel"' + (tab === 'intel' ? ' aria-current="page"' : '') + '>Intel</a>' +
      '<a href="/map"' + (tab === 'map' ? ' aria-current="page"' : '') + '>Map</a>' +
      '<a href="/directory"' + (tab === 'directory' ? ' aria-current="page"' : '') + '>Directory</a>' +
      '<a href="/learn"' + (tab === 'learn' ? ' aria-current="page"' : '') + '>Learn</a>';
    document.body.appendChild(nav);
    document.documentElement.classList.add('tp-pwa-standalone');
  }

  function chromeInstall(deferred) {
    if (standalone() || document.getElementById('tpInstall')) return;
    if (stillDismissed(DISMISS_INSTALL, LEGACY_INSTALL)) return;
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
        dismissFor(DISMISS_INSTALL, DISMISS_DAYS);
        wrap.remove();
        return;
      }
      if (act === 'go' && deferred) {
        wrap.remove();
        deferred.prompt();
        try {
          deferred.userChoice.then(function (choice) {
            if (choice && choice.outcome === 'dismissed') dismissFor(DISMISS_INSTALL, DISMISS_DAYS);
            if (choice && choice.outcome === 'accepted') dismissFor(DISMISS_INSTALL, 365);
          });
        } catch (err) {}
      }
    });
    document.body.appendChild(wrap);
  }

  function iosHint() {
    if (standalone()) return;
    var ua = navigator.userAgent || '';
    if (!/iPhone/.test(ua) || !/Safari/.test(ua) || /CriOS|FxiOS|EdgiOS/.test(ua)) return;
    if (stillDismissed(DISMISS_IOS, LEGACY_IOS)) return;
    if (document.getElementById('tpIosHint')) return;
    var bar = document.createElement('div');
    bar.id = 'tpIosHint';
    bar.className = 'tp-pwa-banner';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Add to Home Screen: tap Share, then Add to Home Screen.</span>' +
      '<button type="button" data-pwa="no" class="ghost">OK</button>';
    bar.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-pwa') === 'no') {
        dismissFor(DISMISS_IOS, DISMISS_DAYS);
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

  var mq = window.matchMedia('(display-mode: standalone)');
  function onStandaloneChange() {
    if (mq.matches) {
      var hint = document.getElementById('tpIosHint');
      if (hint) hint.remove();
      var install = document.getElementById('tpInstall');
      if (install) install.remove();
      ready(bottomNav);
    }
  }
  if (mq.addEventListener) mq.addEventListener('change', onStandaloneChange);
  else if (mq.addListener) mq.addListener(onStandaloneChange);

  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    if (standalone()) return;
    if (stillDismissed(DISMISS_INSTALL, LEGACY_INSTALL)) return;
    deferredPrompt = e;
    ready(function () { chromeInstall(deferredPrompt); });
  });
})();
