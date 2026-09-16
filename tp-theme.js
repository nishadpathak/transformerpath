/* ============================================================================
   TransformerPath — shared theme controller
   ----------------------------------------------------------------------------
   One light/dark choice, remembered across every page.

   Uses the same localStorage key ('theme') the style.css pages already use, so
   a visitor who picks light on the home page still gets light in the
   calculator, and vice versa.

   Pages that are dark by design (3D viewers) set <html class="tp-dark"> in
   their markup. Those keep their dark canvas — the toggle is not shown there,
   because switching them to light would hurt the renders they exist to show.

   Self-initialising: include with <script src="tp-theme.js" defer></script>
   and it finds a place for the toggle on its own.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'theme';
  var root = document.documentElement;

  // Dark-by-design pages opt out of toggling entirely.
  var isFixedDark = root.classList.contains('tp-dark');

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function apply(mode) {
    if (mode === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  // ── Initial paint ────────────────────────────────────────────────────────
  // Dark is the site default (matches the existing style.css pages), but an
  // explicit stored choice always wins.
  if (!isFixedDark) {
    apply(stored() || 'dark');
  }

  // ── Toggle button ────────────────────────────────────────────────────────
  function label(mode) { return mode === 'dark' ? '☀️' : '🌙'; }

  function build() {
    if (isFixedDark) return;                       // no toggle on 3D pages
    if (document.querySelector('.tp-theme-toggle')) return;  // already present

    // Don't duplicate the toggle the style.css pages already ship.
    if (document.getElementById('theme-toggle')) return;

    var btn = document.createElement('button');
    btn.className = 'tp-theme-toggle';
    btn.type = 'button';
    btn.textContent = label(current());
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.setAttribute('title', 'Toggle dark mode');

    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      btn.textContent = label(next);
    });

    // Prefer sitting inside the page's own nav row; otherwise float it.
    var host = document.querySelector('.tp-navlinks')
            || document.querySelector('.nav-links')
            || document.querySelector('[role="navigation"]');

    if (host) host.appendChild(btn);
    else { btn.classList.add('tp-floating'); document.body.appendChild(btn); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  // Keep tabs in sync when the choice changes in another one.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || isFixedDark) return;
    apply(e.newValue || 'dark');
    var b = document.querySelector('.tp-theme-toggle');
    if (b) b.textContent = label(current());
  });
})();
