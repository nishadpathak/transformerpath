/* TransformerPath PWA — install prompt, SW register, standalone chrome.
 *
 * 2026 patterns:
 *   - Never prompt on first paint; gate on engagement (time + meaningful actions)
 *   - Respect dismiss with a cool-down (soft re-prompt after DISMISS_DAYS)
 *   - Never show when already installed / standalone
 *   - Capture beforeinstallprompt outcome via TP_TRACK when available
 *   - Benefit-oriented copy; Chromium vs iOS flows separated
 */
(function () {
  'use strict';
  if (window.__TP_PWA__) return;
  window.__TP_PWA__ = true;

  var DISMISS_INSTALL = 'tp-pwa-install-dismissed-until';
  var DISMISS_IOS = 'tp-pwa-ios-hint-dismissed-until';
  var ENGAGE_KEY = 'tp-pwa-engage';
  var DISMISS_DAYS = 45;
  var ACCEPT_DAYS = 365;
  var MIN_DWELL_MS = 45000;          // 45s on site before soft prompt
  var MIN_ENGAGE_SCORE = 2;          // or: 2 meaningful actions
  var LEGACY_INSTALL = 'tp-pwa-install-dismissed';
  var LEGACY_IOS = 'tp-pwa-ios-hint-dismissed';
  var LEGACY_SEEN = 'tp-pwa-install-seen';
  var LEGACY_SEEN_IOS = 'tp-pwa-ios-seen';

  var deferredPrompt = null;
  var installShown = false;
  var iosShown = false;
  var engage = { score: 0, startedAt: Date.now(), pages: 1 };

  function track(name, props) {
    try {
      if (typeof window.TP_TRACK === 'function') window.TP_TRACK(name, props || {});
    } catch (e) {}
  }

  function standalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || document.referrer.indexOf('android-app://') === 0;
  }

  function loadEngage() {
    try {
      var raw = sessionStorage.getItem(ENGAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          engage.score = Number(parsed.score) || 0;
          engage.startedAt = Number(parsed.startedAt) || Date.now();
          engage.pages = Number(parsed.pages) || 1;
        }
      }
    } catch (e) {}
  }

  function saveEngage() {
    try {
      sessionStorage.setItem(ENGAGE_KEY, JSON.stringify(engage));
    } catch (e) {}
  }

  function bumpEngage(points, reason) {
    engage.score += points || 1;
    saveEngage();
    track('pwa_engagement', { score: engage.score, reason: reason || 'action' });
    maybeShowPrompts();
  }

  function engagementReady() {
    var dwell = Date.now() - engage.startedAt;
    return dwell >= MIN_DWELL_MS || engage.score >= MIN_ENGAGE_SCORE || engage.pages >= 2;
  }

  function dismissedUntil(key, legacyKey) {
    try {
      // Clear obsolete session "seen" flags that caused re-prompt quirks
      try {
        sessionStorage.removeItem(LEGACY_SEEN);
        sessionStorage.removeItem(LEGACY_SEEN_IOS);
      } catch (e0) {}

      if (legacyKey && localStorage.getItem(legacyKey) === '1') {
        var untilLegacy = Date.now() + DISMISS_DAYS * 86400000;
        localStorage.setItem(key, String(untilLegacy));
        localStorage.removeItem(legacyKey);
        return untilLegacy;
      }
      var raw = localStorage.getItem(key);
      if (!raw) return 0;
      // Legacy boolean-ish values
      if (raw === '1' || raw === 'true') {
        var migrated = Date.now() + DISMISS_DAYS * 86400000;
        localStorage.setItem(key, String(migrated));
        return migrated;
      }
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

  function chromeInstall() {
    if (installShown || standalone() || document.getElementById('tpInstall')) return;
    if (!deferredPrompt) return;
    if (stillDismissed(DISMISS_INSTALL, LEGACY_INSTALL)) return;
    if (!engagementReady()) return;

    installShown = true;
    var wrap = document.createElement('div');
    wrap.id = 'tpInstall';
    wrap.className = 'tp-pwa-banner';
    wrap.setAttribute('role', 'status');
    wrap.innerHTML =
      '<span><b>Add TransformerPath to your home screen</b> — offline intel access and faster launch.</span>' +
      '<button type="button" data-pwa="go">Install</button>' +
      '<button type="button" data-pwa="no" class="ghost">Not now</button>';

    wrap.addEventListener('click', function (e) {
      var act = e.target && e.target.getAttribute && e.target.getAttribute('data-pwa');
      if (act === 'no') {
        dismissFor(DISMISS_INSTALL, DISMISS_DAYS);
        track('pwa_install_dismiss', { source: 'banner', cooldown_days: DISMISS_DAYS });
        wrap.remove();
        return;
      }
      if (act === 'go' && deferredPrompt) {
        var dp = deferredPrompt;
        deferredPrompt = null;
        wrap.remove();
        track('pwa_install_prompt_shown', { source: 'banner' });
        try {
          dp.prompt();
          Promise.resolve(dp.userChoice).then(function (choice) {
            var outcome = (choice && choice.outcome) || 'unknown';
            track('pwa_install_outcome', { outcome: outcome });
            if (outcome === 'accepted') dismissFor(DISMISS_INSTALL, ACCEPT_DAYS);
            else dismissFor(DISMISS_INSTALL, DISMISS_DAYS);
          }).catch(function () {
            dismissFor(DISMISS_INSTALL, DISMISS_DAYS);
          });
        } catch (err) {
          track('pwa_install_outcome', { outcome: 'error' });
          dismissFor(DISMISS_INSTALL, DISMISS_DAYS);
        }
      }
    });

    document.body.appendChild(wrap);
    track('pwa_install_banner_visible', { score: engage.score, pages: engage.pages });
  }

  function iosHint() {
    if (iosShown || standalone()) return;
    var ua = navigator.userAgent || '';
    if (!/iPhone/.test(ua) || !/Safari/.test(ua) || /CriOS|FxiOS|EdgiOS/.test(ua)) return;
    if (stillDismissed(DISMISS_IOS, LEGACY_IOS)) return;
    if (!engagementReady()) return;
    if (document.getElementById('tpIosHint')) return;

    iosShown = true;
    var bar = document.createElement('div');
    bar.id = 'tpIosHint';
    bar.className = 'tp-pwa-banner';
    bar.setAttribute('role', 'status');
    bar.innerHTML =
      '<span><b>Add to Home Screen</b> for offline intel — tap Share, then Add to Home Screen.</span>' +
      '<button type="button" data-pwa="no" class="ghost">Got it</button>';
    bar.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-pwa') === 'no') {
        dismissFor(DISMISS_IOS, DISMISS_DAYS);
        track('pwa_ios_hint_dismiss', { cooldown_days: DISMISS_DAYS });
        bar.remove();
      }
    });
    document.body.appendChild(bar);
    track('pwa_ios_hint_visible', { score: engage.score });
  }

  function maybeShowPrompts() {
    if (standalone()) return;
    chromeInstall();
    iosHint();
  }

  function wireEngagement() {
    loadEngage();
    // Count this page view toward multi-page engagement
    try {
      var path = location.pathname;
      var last = sessionStorage.getItem('tp-pwa-last-path');
      if (last && last !== path) {
        engage.pages += 1;
        bumpEngage(1, 'page_view');
      } else {
        saveEngage();
      }
      sessionStorage.setItem('tp-pwa-last-path', path);
    } catch (e) { saveEngage(); }

    // Time-on-site gate
    setTimeout(function () { maybeShowPrompts(); }, MIN_DWELL_MS + 50);

    // Meaningful actions
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('a[href*="intel"], a[href*="/map"], a[href*="directory"], a[href*="manufacturers"], a[href*="power3d"], a[href*="explorer"], a[href*="learn"], a[href*="rfq"]')) {
        bumpEngage(1, 'nav_click');
      }
      if (t.closest('[data-track], .follow-btn, #heroWatchBtn, [data-pwa]')) {
        bumpEngage(1, 'ui_action');
      }
    }, { passive: true });

    window.addEventListener('tp-consent-changed', function () { bumpEngage(1, 'consent'); });
    window.addEventListener('tp-3d-state', function (ev) {
      if (ev && ev.detail && ev.detail.state === 'READY') bumpEngage(2, '3d_ready');
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  registerSW();

  ready(function () {
    bottomNav();
    if (!standalone()) wireEngagement();
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

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    if (standalone()) return;
    if (stillDismissed(DISMISS_INSTALL, LEGACY_INSTALL)) {
      track('pwa_bip_suppressed', { reason: 'dismissed' });
      return;
    }
    deferredPrompt = e;
    track('pwa_bip_captured', { engaged: engagementReady() });
    // Do NOT show immediately — wait for engagement gate
    maybeShowPrompts();
  });

  window.addEventListener('appinstalled', function () {
    dismissFor(DISMISS_INSTALL, ACCEPT_DAYS);
    deferredPrompt = null;
    var banner = document.getElementById('tpInstall');
    if (banner) banner.remove();
    track('pwa_appinstalled', {});
  });

  // Expose tiny test hooks (non-enumerable-ish)
  window.__TP_PWA_API__ = {
    engagementReady: engagementReady,
    stillDismissed: function () { return stillDismissed(DISMISS_INSTALL, LEGACY_INSTALL); },
    bumpEngage: bumpEngage,
    MIN_DWELL_MS: MIN_DWELL_MS,
    DISMISS_DAYS: DISMISS_DAYS
  };
})();
