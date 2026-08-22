/* TransformerPath course gate — premium learning content, tier-aware.
   Include on any page that is part of the paid learning tier:
     <script src="course-gate.js"></script>
   Access model: same localStorage key as the Design Engineer Track / Learn
   paywalls (tp-course-access), 12-month expiry, granted on Stripe return or
   via the creator master key (?key=...). Client-side gate — same protection
   level as the rest of the static-site paywall.

   Tiers: 'learner' ($199/yr, default/legacy) < 'professional' ($599/yr)
   < 'enterprise' ($1,999/yr). Any paid tier unlocks everything this script
   gates — tier only matters for pages/sections that check a minimum tier
   via TP_ACCESS.hasTier(). A grant never downgrades an existing higher tier,
   and always extends (never shortens) the stored expiry. */
(function () {
  var KEY = 'tp-course-access';
  var MASTER = 'tp-creator-unlock-2024';
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
      // Never downgrade tier, never shorten expiry — extend/keep the better of the two.
      if (RANK[existing.tier] > RANK[tier2]) tier2 = existing.tier;
      if (existing.expiry > newExpiry) newExpiry = existing.expiry;
    }
    var record = { expiry: newExpiry, paid_at: (existing && existing.paid_at) || new Date().toISOString(), tier: tier2 };
    if (isCreator || (existing && existing.isCreator)) record.isCreator = true;
    try { localStorage.setItem(KEY, JSON.stringify(record)); } catch (e) {}
    return record;
  }

  var params = new URLSearchParams(location.search);

  // Creator master key unlocks any gated page directly, full access.
  if (params.get('key') === MASTER) {
    grant('enterprise', true);
    params.delete('key');
    history.replaceState({}, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  }

  // Stripe Payment Link return grants access. The three plan links redirect
  // back with ?unlocked=learner|professional|enterprise (set in the Stripe
  // Dashboard "after payment" redirect for each Payment Link — see
  // STRIPE-SETUP-TODO.md). Older/legacy links that only return ?session_id=
  // with no ?unlocked= are treated as the Learner tier for backward
  // compatibility with the original single-tier $199 link.
  var unlockedTier = params.get('unlocked');
  var stripeReturn = params.get('session_id');
  if (unlockedTier || stripeReturn) {
    grant(unlockedTier || 'learner', false);
  }

  function currentAccess() {
    var a = readAccess();
    if (a && a.expiry > Date.now()) return a;
    return null;
  }

  // Exposed so pages can do finer-grained, tier-specific gating if needed
  // (e.g. "this section needs Professional or above") without re-reading
  // localStorage themselves.
  window.TP_ACCESS = {
    get: currentAccess,
    hasAnyAccess: function () { return !!currentAccess(); },
    hasTier: function (min) {
      var a = currentAccess();
      if (!a) return false;
      var need = RANK[min] || RANK.learner;
      return (RANK[a.tier] || RANK.learner) >= need;
    }
  };

  if (currentAccess()) return; // access valid — page stays open

  function lock() {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lock);
  } else {
    lock();
  }
})();
