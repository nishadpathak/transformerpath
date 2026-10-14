/* Account-aware entitlement helper.
 *
 * Stripe is the processor. The grant is an account entitlement (server) plus
 * the HMAC cookie issued after a verified checkout. localStorage is a cache.
 *
 * Professional-only UI is marked data-tp-need="professional".
 * Whole pages: <html data-tp-need-page="professional">.
 * Team shared-link is not a product — seats are organization memberships.
 */
(function () {
  'use strict';
  var RANK = { free: 0, learning: 1, learner: 1, professional: 2, team: 3, enterprise: 3 };
  var state = { plan: 'free', rank: 0, source: 'none', expires_at: null };

  function injectCss() {
    if (document.getElementById('tp-ent-css')) return;
    var st = document.createElement('style');
    st.id = 'tp-ent-css';
    st.textContent =
      '.tp-locked{opacity:.62}' +
      '#tp-plan-gate{position:fixed;inset:0;z-index:99990;background:rgba(7,17,28,.88);color:#fff;' +
      'display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;' +
      'font-family:"Segoe UI",system-ui,-apple-system,sans-serif}' +
      '#tp-plan-gate a.tp-plan-cta{display:inline-block;background:#f5a623;color:#0d1b2e;font-weight:800;' +
      'padding:14px 28px;border-radius:10px;text-decoration:none;margin-top:8px}';
    (document.head || document.documentElement).appendChild(st);
  }

  function applyControls() {
    document.querySelectorAll('[data-tp-need]').forEach(function (el) {
      var need = RANK[String(el.getAttribute('data-tp-need') || '').toLowerCase()] || 0;
      var ok = state.rank >= need;
      el.classList.toggle('tp-locked', !ok);
      if (!ok) el.setAttribute('aria-disabled', 'true');
      else el.removeAttribute('aria-disabled');
    });
    document.querySelectorAll('[data-tp-plan-label]').forEach(function (el) {
      el.textContent = state.plan === 'free' ? 'Free' : (state.plan.charAt(0).toUpperCase() + state.plan.slice(1));
    });
  }

  function pageNeed() {
    var root = document.documentElement;
    var need = (root && root.getAttribute('data-tp-need-page')) ||
      (document.body && document.body.getAttribute('data-tp-need-page'));
    return String(need || '').toLowerCase();
  }

  function applyPage() {
    var need = pageNeed();
    if (!need) return;
    var rankNeed = RANK[need] || 0;
    var existing = document.getElementById('tp-plan-gate');
    if (state.rank >= rankNeed) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    if (!document.body) return;
    var d = document.createElement('div');
    d.id = 'tp-plan-gate';
    d.innerHTML =
      '<div style="max-width:520px">' +
      '<h1 style="font-size:1.5rem;margin:0 0 10px">Professional entitlement required</h1>' +
      '<p style="color:#b8c4d4;line-height:1.55;margin:0 0 18px">This tool is on the Professional plan. Access follows your TransformerPath account — sign in on any device after checkout. Stripe is the payment processor only.</p>' +
      '<a class="tp-plan-cta" href="pricing.html#professional">See Professional — $599 →</a>' +
      '<p style="margin:16px 0 0;font-size:.85rem"><a href="workspace.html" style="color:#f5a623">Sign in to My TransformerPath</a>' +
      ' · <a href="pricing.html" style="color:#f5a623">Plans</a></p>' +
      '</div>';
    document.body.appendChild(d);
  }

  function apply() {
    injectCss();
    applyControls();
    applyPage();
  }

  function fromLocal() {
    try {
      var a = JSON.parse(localStorage.getItem('tp-course-access') || 'null');
      if (a && a.expiry > Date.now()) {
        var key = String(a.tier || 'learning').toLowerCase();
        if (key === 'enterprise') key = 'team';
        if (key === 'learner') key = 'learning';
        state = { plan: key, rank: RANK[key] || 1, source: 'cache', expires_at: new Date(a.expiry).toISOString() };
      }
    } catch (e) {}
  }

  fromLocal();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-tp-need]');
    if (!el) return;
    var need = RANK[String(el.getAttribute('data-tp-need') || '').toLowerCase()] || 0;
    if (state.rank >= need) return;
    e.preventDefault();
    e.stopPropagation();
    location.href = 'pricing.html#professional';
  }, true);

  function pullServer() {
    if (!window.TP || !TP.getSession) return;
    TP.getSession().then(function (r) {
      var sess = r && r.data && r.data.session;
      if (!sess) { apply(); return; }
      fetch('/.netlify/functions/account', {
        headers: { authorization: 'Bearer ' + sess.access_token },
      }).then(function (x) { return x.json(); }).then(function (snap) {
        if (!snap || !snap.entitlement) { apply(); return; }
        var key = String(snap.entitlement.plan_key || snap.entitlement.plan || 'free').toLowerCase();
        if (key === 'enterprise') key = 'team';
        if (key === 'learner') key = 'learning';
        state = {
          plan: key,
          rank: RANK[key] || 0,
          source: 'account',
          expires_at: snap.entitlement.expires_at || null,
        };
        apply();
      }).catch(function () { apply(); });
    });
  }

  function waitTp() {
    if (window.TP && TP.onAuth) TP.onAuth(function () { pullServer(); });
    else if (window.TP && TP.getSession) pullServer();
    else setTimeout(waitTp, 200);
  }
  waitTp();

  window.TP_ENTITLEMENT = {
    get: function () { return state; },
    has: function (min) { return state.rank >= (RANK[String(min || '').toLowerCase()] || 0); },
  };
})();
