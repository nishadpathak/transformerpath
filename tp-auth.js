/* Header Sign in with Google, avatar menu, and the /me page.
 *
 * The button stays hidden unless window.TP_GOOGLE_AUTH.clientId is set.
 * That file is empty unless GOOGLE_CLIENT_ID and SESSION_SECRET were both
 * present at build. The session cookie is HttpOnly, so this script learns
 * who is signed in only from GET /api/auth/me.
 */
(function () {
  'use strict';

  function authConfigured(cfg) {
    return !!(cfg && String(cfg.clientId || '').trim());
  }

  function ready(fn) {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'text') node.textContent = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    return node;
  }

  function initial(me) {
    var source = (me && (me.name || me.email)) || '';
    var ch = String(source).trim().charAt(0);
    return ch ? ch.toUpperCase() : '•';
  }

  function safePicture(url) {
    return /^https:\/\/[^\s]+$/.test(String(url || '')) ? String(url) : '';
  }

  var gsiPromise = null;
  function loadGsi() {
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('gsi')); };
      document.head.appendChild(s);
    });
    return gsiPromise;
  }

  function paintMe(me, configured) {
    var status = document.querySelector('[data-tp-me-status]');
    if (!status) return;
    var profile = document.querySelector('[data-tp-me-profile]');
    var name = document.querySelector('[data-tp-me-name]');
    var email = document.querySelector('[data-tp-me-email]');
    var out = document.querySelector('main [data-tp-signout]');
    if (me && me.signedIn) {
      status.textContent = 'You are signed in.';
      if (name) name.textContent = me.name || '';
      if (email) email.textContent = me.email || '';
      if (profile) profile.hidden = false;
      if (out) out.hidden = false;
      return;
    }
    if (profile) profile.hidden = true;
    if (out) out.hidden = true;
    if (!configured || (me && me.configured === false)) {
      status.textContent = 'Google sign-in is not configured on this deploy, so the header button stays hidden. You can still use the rest of the site.';
      return;
    }
    status.textContent = 'You are not signed in. Use Sign in with Google in the header. You can still use the rest of the site.';
  }

  function renderMenu(slot, me) {
    slot.textContent = '';
    var btn = el('button', {
      type: 'button',
      class: 'tp-auth-avatar',
      'aria-expanded': 'false',
      'aria-haspopup': 'true',
      'aria-controls': 'tp-auth-menu',
      'aria-label': 'Account menu'
    });
    var picture = safePicture(me.picture);
    if (picture) {
      var img = el('img', { alt: '', src: picture, referrerpolicy: 'no-referrer' });
      btn.appendChild(img);
    } else {
      btn.textContent = initial(me);
    }
    var menu = el('div', { id: 'tp-auth-menu', class: 'tp-auth-menu', role: 'menu' });
    menu.hidden = true;
    var name = el('p', { class: 'tp-auth-name', text: me.name || me.email || 'Signed in' });
    var account = el('a', { href: '/me.html', role: 'menuitem', text: 'Your account' });
    var out = el('button', { type: 'button', role: 'menuitem', 'data-tp-signout': '1', text: 'Sign out' });
    menu.appendChild(name);
    menu.appendChild(account);
    menu.appendChild(out);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!slot.contains(e.target)) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    slot.appendChild(btn);
    slot.appendChild(menu);
  }

  function renderButton(slot, clientId) {
    slot.textContent = '';
    var holder = el('div', { class: 'tp-auth-button' });
    var error = el('p', { class: 'tp-auth-error' });
    error.hidden = true;
    slot.appendChild(holder);
    slot.appendChild(error);
    loadGsi().then(function () {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        error.hidden = false;
        error.textContent = 'Sign-in is unavailable right now.';
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: function (resp) { onCredential(slot, resp, error); },
        auto_select: false,
        cancel_on_tap_outside: true
      });
      window.google.accounts.id.renderButton(holder, {
        type: 'standard',
        theme: 'filled_black',
        size: 'medium',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 220
      });
    }).catch(function () {
      error.hidden = false;
      error.textContent = 'Sign-in is unavailable right now.';
    });
  }

  function onCredential(slot, resp, error) {
    var credential = resp && resp.credential;
    if (!credential) return;
    error.hidden = true;
    fetch('/api/auth/google', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ credential: credential })
    }).then(function (res) {
      return res.json().then(function (body) { return { ok: res.ok, body: body }; });
    }).then(function (result) {
      if (!result.ok || !result.body || !result.body.ok) {
        error.hidden = false;
        error.textContent = 'Sign-in did not complete. Try again.';
        return;
      }
      window.location.reload();
    }).catch(function () {
      error.hidden = false;
      error.textContent = 'Sign-in did not complete. Try again.';
    });
  }

  function signOut() {
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { accept: 'application/json' }
    }).then(function () {
      window.location.reload();
    }).catch(function () {
      window.location.reload();
    });
  }

  ready(function () {
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-tp-signout]') : null;
      if (!btn) return;
      e.preventDefault();
      signOut();
    });

    var cfg = window.TP_GOOGLE_AUTH || {};
    var configured = authConfigured(cfg);
    var slot = document.querySelector('[data-tp-auth]');
    if (slot && !configured) slot.hidden = true;

    if (!configured) {
      paintMe(null, false);
      return;
    }

    fetch('/api/auth/me', { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (me) {
        paintMe(me, true);
        if (!slot) return;
        slot.hidden = false;
        if (me && me.signedIn) renderMenu(slot, me);
        else renderButton(slot, String(cfg.clientId).trim());
      })
      .catch(function () {
        paintMe(null, true);
        if (!slot) return;
        slot.hidden = false;
        renderButton(slot, String(cfg.clientId).trim());
      });
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { authConfigured: authConfigured };
  }
})();
