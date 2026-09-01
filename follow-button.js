/* follow-button.js — shared Follow/Unfollow component for TransformerPath.
 *
 * Lightweight, progressive-enhancement Follow button. Scans the page for
 * <button class="follow-btn" data-follow-type="..." data-follow-subject="..."
 * data-follow-label="..."> elements and turns each into a live toggle.
 *
 * It lazily loads the supabase config + client (from supabase-config.js and
 * supabase.js) only when at least one Follow button is present AND the user is
 * signed in, then renders the correct state (Following / Follow). When the
 * account layer is unavailable the button stays an inert hint to "sign in",
 * and the page is unaffected. Never throws, never blocks rendering.
 *
 * Load with  defer  after the page body. Usage on an entity page:
 *   <script src="follow-button.js" defer></script>
 * and a button somewhere in content:
 *   <button class="follow-btn" data-follow-type="company"
 *           data-follow-subject="Hitachi Energy" data-follow-label="Hitachi Energy">Follow</button>
 */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { resolve(); };
      document.head.appendChild(s);
    });
  }

  function init() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.follow-btn'));
    if (!buttons.length) return;

    // Wire the sign-in requirement: if no account client, the button is a sign-in hint.
    var TP = window.TP;
    if (!TP || !TP.ready || !TP.user) {
      buttons.forEach(function (b) {
        b.setAttribute('aria-disabled', 'true');
        b.innerHTML = 'Sign in to follow';
        b.onclick = function () { window.location.href = 'workspace.html'; };
      });
      // One-time: listen for auth to upgrade buttons.
      if (TP && TP.onAuth) TP.onAuth(function () { refreshAll(); });
      return;
    }

    function refreshAll() {
      buttons.forEach(function (b) {
        var type = b.getAttribute('data-follow-type');
        var subject = b.getAttribute('data-follow-subject');
        var label = b.getAttribute('data-follow-label') || subject;
        TP.isFollowing(type, subject).then(function (is) {
          b.classList.toggle('following', !!is);
          b.innerHTML = is ? 'Following ✓' : 'Follow';
          b.setAttribute('aria-pressed', is ? 'true' : 'false');
        });
      });
    }

    buttons.forEach(function (b) {
      b.onclick = function () {
        if (!TP.user) { window.location.href = 'workspace.html'; return; }
        var type = b.getAttribute('data-follow-type');
        var subject = b.getAttribute('data-follow-subject');
        var label = b.getAttribute('data-follow-label') || subject;
        var was = b.classList.contains('following');
        var done = was ? TP.unfollow(type, subject) : TP.follow({ type: type, subject: subject, label: label });
        done.then(function (ok) {
          if (ok) { b.classList.toggle('following', !was); b.innerHTML = was ? 'Follow' : 'Following ✓'; b.setAttribute('aria-pressed', was ? 'false' : 'true'); }
        });
      };
    });
    refreshAll();
  }

  // Ensure supabase-config.js + supabase.js are present, then init.
  if (!window.TP_SUPABASE) {
    var config = document.createElement('script');
    config.src = 'supabase-config.js'; config.async = true;
    config.onload = function () { loadScript('supabase.js').then(init); };
    config.onerror = function () { init(); }; // no config -> inert buttons
    document.head.appendChild(config);
  } else {
    loadScript('supabase.js').then(init);
  }
})();
