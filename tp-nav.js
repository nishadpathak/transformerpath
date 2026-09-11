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
    var dropdowns = document.querySelectorAll('.tpnav-dropdown');

    /* ── Hamburger ─────────────────────────────────────────────────────── */
    if (nav && burger) {
      burger.addEventListener('click', function (e) {
        e.preventDefault();
        var open = nav.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      /* A link tap should close the panel, not leave it covering the page. */
      nav.addEventListener('click', function (e) {
        if (e.target.tagName === 'A' && !e.target.classList.contains('tpnav-dropdown-btn') && nav.classList.contains('open')) {
          nav.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    /* ── Dropdown: Directories (with hover grace & click/touch toggle) ─── */
    dropdowns.forEach(function (dd) {
      var btn = dd.querySelector('.tpnav-dropdown-btn');
      var panel = dd.querySelector('.tpnav-dropdown-panel');
      var closeTimer = null;

      function openDropdown() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        dd.classList.add('open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }

      function closeDropdown(immediate) {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        if (immediate) {
          dd.classList.remove('open');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        } else {
          closeTimer = setTimeout(function () {
            dd.classList.remove('open');
            if (btn) btn.setAttribute('aria-expanded', 'false');
          }, 220);
        }
      }

      // Mouse hover with grace period
      dd.addEventListener('mouseenter', openDropdown);
      dd.addEventListener('mouseleave', function () { closeDropdown(false); });

      // Click / Touch toggle
      if (btn) {
        btn.addEventListener('click', function (e) {
          var isMobile = window.innerWidth < 1024;
          if (isMobile) {
            e.preventDefault();
            e.stopPropagation();
            var isOpen = dd.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          } else {
            // On desktop, clicking opens if not open
            if (!dd.classList.contains('open')) {
              e.preventDefault();
              openDropdown();
            }
          }
        });
      }

      // Keyboard navigation
      dd.addEventListener('focusout', function (e) {
        if (!dd.contains(e.relatedTarget)) {
          closeDropdown(true);
        }
      });
    });

    /* ── More ──────────────────────────────────────────────────────────── */
    function closeMore() {
      if (!more || !more.classList.contains('open')) return;
      more.classList.remove('open');
      if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
    }

    if (more && moreBtn) {
      var moreTimer = null;

      function openMore() {
        if (moreTimer) { clearTimeout(moreTimer); moreTimer = null; }
        more.classList.add('open');
        moreBtn.setAttribute('aria-expanded', 'true');
        var panel = more.querySelector('.tpnav-more-panel');
        if (panel) {
          panel.style.right = '0';
          panel.style.left = 'auto';
          var r = panel.getBoundingClientRect();
          if (r.left < 8) { panel.style.right = 'auto'; panel.style.left = '0'; }
        }
      }

      function scheduleCloseMore() {
        if (moreTimer) { clearTimeout(moreTimer); moreTimer = null; }
        moreTimer = setTimeout(function () {
          closeMore();
        }, 220);
      }

      more.addEventListener('mouseenter', openMore);
      more.addEventListener('mouseleave', scheduleCloseMore);

      moreBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = more.classList.toggle('open');
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
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

      /* Leaving the menu by keyboard should close it too. */
      more.addEventListener('focusout', function (e) {
        if (!more.contains(e.relatedTarget)) closeMore();
      });
    }

    /* ── Global click & Escape to close all open dropdowns ─────────────── */
    document.addEventListener('click', function (e) {
      dropdowns.forEach(function (dd) {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
          var btn = dd.querySelector('.tpnav-dropdown-btn');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
      if (more && !more.contains(e.target)) closeMore();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        dropdowns.forEach(function (dd) {
          dd.classList.remove('open');
          var btn = dd.querySelector('.tpnav-dropdown-btn');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        });
        closeMore();
        if (nav && nav.classList.contains('open') && burger) {
          nav.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
          burger.focus();
        }
      }
    });

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
