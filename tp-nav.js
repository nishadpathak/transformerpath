/* ============================================================================
   TransformerPath — navigation behaviour
   ----------------------------------------------------------------------------
   Three small jobs, no framework:
     1. the hamburger panel below 1024px
     2. the single "More" menu, with Escape and outside-click to close
     3. marking the current page so you can see where you are

   Everything degrades: if this file fails to load, every primary destination is
   still a plain <a href> and remains clickable. Only More and the hamburger
   depend on JS.
   ========================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var nav = document.querySelector('.tpnav');
    var burger = document.querySelector('.menu-toggle');
    var more = document.querySelector('.tpnav-more');
    var moreBtn = more && more.querySelector('.tpnav-more-btn');

    /* ── Hamburger ─────────────────────────────────────────────────────── */
    if (nav && burger) {
      burger.addEventListener('click', function (e) {
        e.preventDefault();
        var open = nav.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      /* A link tap should close the panel, not leave it covering the page. */
      nav.addEventListener('click', function (e) {
        if (e.target.tagName === 'A' && nav.classList.contains('open')) {
          nav.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    /* ── More ──────────────────────────────────────────────────────────── */
    function closeMore() {
      if (!more || !more.classList.contains('open')) return;
      more.classList.remove('open');
      if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
    }

    if (more && moreBtn) {
      moreBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = more.classList.toggle('open');
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        /* Keep the panel inside the viewport on narrow desktops. */
        if (open) {
          var panel = more.querySelector('.tpnav-more-panel');
          if (panel) {
            panel.style.right = '0';
            panel.style.left = 'auto';
            var r = panel.getBoundingClientRect();
            if (r.left < 8) { panel.style.right = 'auto'; panel.style.left = '0'; }
          }
        }
      });
      document.addEventListener('click', function (e) {
        if (!more.contains(e.target)) closeMore();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          closeMore();
          if (nav && nav.classList.contains('open') && burger) {
            nav.classList.remove('open');
            burger.setAttribute('aria-expanded', 'false');
            burger.focus();
          }
        }
      });
      /* Leaving the menu by keyboard should close it too. */
      more.addEventListener('focusout', function (e) {
        if (!more.contains(e.relatedTarget)) closeMore();
      });
    }

    /* ── Mark the current page ─────────────────────────────────────────── */
    if (nav) {
      var here = location.pathname.split('/').pop() || 'index.html';
      var links = nav.querySelectorAll('a[href]');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href');
        if (!href || href.charAt(0) === '#') continue;
        if (href.split('?')[0].split('#')[0] === here) {
          links[i].setAttribute('aria-current', 'page');
        }
      }
    }

    /* ── Account label reflects sign-in state when accounts are on ─────── */
    var acct = document.querySelector('[data-tp-account]');
    if (acct) {
      try {
        var cfg = window.TP_SUPABASE;
        if (!cfg || !cfg.url || !cfg.anon) {
          acct.textContent = 'Account';           /* accounts not configured */
        }
      } catch (e) { /* never let this break the header */ }
    }
  });
})();
