/* TransformerPath course gate — premium learning content.
   Include on any page that is part of the paid learning tier:
     <script src="course-gate.js"></script>
   Access model: same localStorage key as the Design Engineer Track paywall
   (tp-course-access, 12-month expiry, granted on Stripe return or via the
   creator master key ?key=...). Client-side gate — same protection level
   as the rest of the static-site paywall. */
(function () {
  var KEY = 'tp-course-access';
  var MASTER = 'tp-creator-unlock-2024';
  var STRIPE = 'https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00';

  // Creator master key unlocks any gated page directly.
  var params = new URLSearchParams(location.search);
  if (params.get('key') === MASTER) {
    localStorage.setItem(KEY, JSON.stringify({
      expiry: Date.now() + 365 * 24 * 3600 * 1000,
      paid_at: new Date().toISOString(),
      isCreator: true
    }));
    params.delete('key');
    history.replaceState({}, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  }

  // Stripe Payment Link return (?session_id=...) grants access, same as engineer-track.
  if (params.get('session_id')) {
    localStorage.setItem(KEY, JSON.stringify({
      expiry: Date.now() + 365 * 24 * 3600 * 1000,
      paid_at: new Date().toISOString()
    }));
  }

  try {
    var a = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (a && a.expiry > Date.now()) return; // access valid — page stays open
  } catch (e) {}

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
      '<b style="color:#fff">Yearly Access</b> — one payment, 12 months, everything included.</p>' +
      '<a href="' + STRIPE + '" target="_blank" rel="noopener" style="display:inline-block;background:#f5a623;color:#0d1b2e;' +
      'font-weight:800;padding:14px 34px;border-radius:10px;text-decoration:none;font-size:1.05rem">Unlock Yearly Access — $199 →</a>' +
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
