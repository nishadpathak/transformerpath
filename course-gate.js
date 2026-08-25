/* TransformerPath course gate — premium learning content, tier-aware.
   Include on any page that is part of the paid learning tier:
     <script src="course-gate.js"></script>

   Access model: same localStorage key as the Design Engineer Track / Learn
   paywalls (tp-course-access), 12-month expiry.

   SECURITY MODEL (updated): access is granted ONLY after a paid Stripe
   Checkout Session is verified by the server-side /.netlify/functions/
   verify-access function. The client no longer trusts ?key=, ?unlocked= or
   ?session_id= on their own — anyone could forge those. Instead, when the
   page loads with ?session_id={CHECKOUT_SESSION_ID} (the Stripe Payment Link
   "after payment" redirect), we ask the server to confirm that session is
   paid and return the tier; only then do we store access.

   NOTE: Stripe Dashboard must set the env secret STRIPE_SECRET_KEY and each
   Payment Link's "after payment" redirect must point at
     https://transformerpath.com/pricing.html?session_id={CHECKOUT_SESSION_ID}&unlocked=<tier>
   Until then verification is unavailable and no new access is granted
   (existing stored access keeps working — it is not revoked).

   Tiers: 'learner' < 'professional' < 'enterprise'. Any paid tier unlocks
   everything this script gates; tier only matters for sections that check a
   minimum via TP_ACCESS.hasTier(). A grant never downgrades or shortens an
   existing higher/longer one. */
(function () {
  var KEY = 'tp-course-access';
  var RANK = { learner: 1, professional: 2, enterprise: 3 };
  var TWELVE_MONTHS = 365 * 24 * 3600 * 1000;

  function readAccess() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  function grant(tier, isCreator) {
    var now = Date.now();
    var existing = readAccess();
    var newExpiry = now + TWELVE_MONTHS;
    var tier2 = RANK[tier] ? tier : 'learner';
    if (existing && existing.expiry > now) {
      if (RANK[existing.tier] > RANK[tier2]) tier2 = existing.tier;
      if (existing.expiry > newExpiry) newExpiry = existing.expiry;
    }
    var record = { expiry: newExpiry, paid_at: (existing && existing.paid_at) || new Date().toISOString(), tier: tier2 };
    if (isCreator || (existing && existing.isCreator)) record.isCreator = true;
    try { localStorage.setItem(KEY, JSON.stringify(record)); } catch (e) {}
    return record;
  }

  function currentAccess() {
    var a = readAccess();
    if (a && a.expiry > Date.now()) return a;
    return null;
  }

  // ── Server-side verification ──────────────────────────────────────────
  // POST {session_id} -> /.netlify/functions/verify-access -> {valid, tier, configured}
  function verifySession(sessionId) {
    return fetch('/.netlify/functions/verify-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    }).then(function (r) { return r.json(); }).catch(function () {
      return { valid: false, configured: true, reason: 'network_error' };
    });
  }

  // Exposed so pages can do finer-grained, tier-specific gating if needed.
  window.TP_ACCESS = {
    get: currentAccess,
    hasAnyAccess: function () { return !!currentAccess(); },
    hasTier: function (min) {
      var a = currentAccess();
      if (!a) return false;
      var need = RANK[min] || RANK.learner;
      return (RANK[a.tier] || RANK.learner) >= need;
    },
    // Async: verify a Stripe session on the server; grant on success.
    verify: function (sessionId, cb) {
      verifySession(sessionId).then(function (res) {
        if (res && res.valid) grant(res.tier || 'learner', false);
        if (typeof cb === 'function') cb(res);
        return res;
      });
    },
  };

  var params = new URLSearchParams(location.search);
  var sessionId = params.get('session_id');

  // If we already have valid access, the page stays open immediately.
  if (currentAccess()) return;

  // Otherwise, if this is a Stripe return with a session, verify on the server
  // first and only grant when it is confirmed paid. ?unlocked= is NOT trusted:
  // it is used only by analytics for purchase tracking, never for access.
  if (sessionId) {
    verifySession(sessionId).then(function (res) {
      if (res && res.valid) {
        grant(res.tier || 'learner', false);
        // Clean the query string so refresh doesn't re-verify, then reload.
        history.replaceState({}, '', location.pathname + '#' + (location.hash || ''));
        location.reload();
      } else {
        showGate();
      }
    });
    return;
  }

  // No stored access and no verifiable session -> gate the page.
  showGate();

  function showGate() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', lock);
    } else {
      lock();
    }
  }

  function lock() {
    if (!document.body) return;
    document.documentElement.style.overflow = 'hidden';
    var d = document.createElement('div');
    d.id = 'tp-gate';
    d.setAttribute('style',
      'position:fixed;inset:0;z-index:99999;background:#0d1b2e;color:#fff;' +
      'display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;' +
      'font-family:"Segoe UI",system-ui,-apple-system,sans-serif');
    d.innerHTML =
      '<div style="max-width:520px">' +
      '<div style="font-size:3rem;margin-bottom:10px">🔒</div>' +
      '<h1 style="font-size:1.6rem;margin:0 0 10px">Premium learning content</h1>' +
      '<p style="color:#b8c4d4;font-size:.98rem;line-height:1.6;margin:0 0 22px">' +
      'The TransformerPath courses, 3D models, formulas and design calculators are part of ' +
      '<b style="color:#fff">Yearly Access</b> — three plans from $199/year, everything included.</p>' +
      '<a href="pricing.html" style="display:inline-block;background:#f5a623;color:#0d1b2e;' +
      'font-weight:800;padding:14px 34px;border-radius:10px;text-decoration:none;font-size:1.05rem">See Plans — from $199/year →</a>' +
      '<p style="color:#7c8aa0;font-size:.82rem;margin:18px 0 0">Already paid? Access is stored in the browser you used at checkout — ' +
      'open this page there, or complete checkout again from that device.</p>' +
      '<p style="margin:22px 0 0"><a href="learn.html" style="color:#f5a623;text-decoration:none;font-weight:600">← Back to Learn</a>' +
      '<span style="color:#44536b"> · </span>' +
      '<a href="engineer-track.html" style="color:#f5a623;text-decoration:none;font-weight:600">See the full program →</a></p>' +
      '</div>';
    document.body.appendChild(d);
  }
})();
