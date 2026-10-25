/* TransformerPath cookie consent banner.
   Google Analytics loads only after Accept (analytics.js listens for
   tp-consent-changed). The AdSense loader is stamped into <head> by
   build-dist.js on article and learn pages only, so the AdSense crawler
   can see it there without a click. This file does not inject that script
   on any page. Personalized ads for EEA, UK and Switzerland visitors are
   gated by Google's certified CMP (AdSense → Privacy & messaging /
   Funding Choices), not by this banner.

   State (localStorage['tp-cookie-consent']):
     - 'accepted'  -> allow GA4
     - 'essential' -> never load GA4
     - null        -> not decided; show the banner
 */
(function () {
  var KEY = 'tp-cookie-consent';
  var started = false;

  function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function notify(value) {
    try {
      window.dispatchEvent(new CustomEvent('tp-consent-changed', { detail: { consent: value } }));
    } catch (e) {}
  }

  function showBanner() {
    if (document.getElementById('tp-consent') || !document.body) return;
    var b = document.createElement('div');
    b.id = 'tp-consent';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Cookie consent');
    b.setAttribute('style',
      'position:fixed;left:0;right:0;bottom:0;z-index:100000;background:#0d1b2e;color:#fff;' +
      'font-family:Inter,system-ui,-apple-system,sans-serif;padding:10px 16px 12px;' +
      'border-top:1px solid rgba(245,166,35,.45);box-shadow:0 -8px 28px rgba(0,0,0,.28);' +
      'font-size:.82rem;line-height:1.4;');
    b.innerHTML =
      '<div class="tp-consent-inner">' +
      '<div class="tp-consent-copy">We use essential cookies to keep the site working. With your consent we load Google Analytics. Advertising uses Google AdSense; visitors in the EEA, UK and Switzerland get Google&rsquo;s privacy message before personalized ads. <a href="/privacy.html">Privacy policy</a>.</div>' +
      '<div class="tp-consent-actions">' +
      '<button type="button" data-c="accept">Accept</button>' +
      '<button type="button" data-c="essential">Essential only</button>' +
      '</div></div>';
    var css = document.getElementById('tp-consent-css');
    if (!css) {
      css = document.createElement('style');
      css.id = 'tp-consent-css';
      css.textContent =
        '#tp-consent a{color:#f5a623;text-decoration:underline}' +
        '.tp-consent-inner{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:10px;align-items:stretch}' +
        '.tp-consent-actions{display:flex;gap:8px;flex-wrap:wrap}' +
        '.tp-consent-actions button{flex:1 1 140px;min-height:40px;border-radius:9px;padding:9px 16px;font-weight:800;cursor:pointer;font-family:inherit}' +
        '.tp-consent-actions [data-c=accept]{background:#f5a623;color:#0d1b2e;border:none}' +
        '.tp-consent-actions [data-c=essential]{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);font-weight:600}' +
        '@media (min-width:720px){.tp-consent-inner{flex-direction:row;align-items:center}.tp-consent-copy{flex:1}.tp-consent-actions{flex:none}}';
      document.head.appendChild(css);
    }
    document.body.appendChild(b);
    function syncPad() {
      var h = Math.ceil(b.getBoundingClientRect().height) || 72;
      document.documentElement.style.setProperty('--tp-consent-pad', h + 'px');
      document.body.style.paddingBottom = 'var(--tp-consent-pad)';
    }
    syncPad();
    if (window.ResizeObserver) new ResizeObserver(syncPad).observe(b);
    window.addEventListener('resize', syncPad);
    b.addEventListener('click', function (e) {
      var c = e.target && e.target.getAttribute && e.target.getAttribute('data-c');
      if (!c) return;
      var value = c === 'accept' ? 'accepted' : 'essential';
      setConsent(value);
      document.body.style.paddingBottom = '';
      document.documentElement.style.removeProperty('--tp-consent-pad');
      if (b.parentNode) b.parentNode.removeChild(b);
      notify(value);
    });
  }

  function start() {
    if (started) return;
    started = true;
    var c = getConsent();
    if (c === 'accepted') return;
    if (c === 'essential') { return; }
    showBanner();
  }

  window.tpResetConsent = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    started = false;
    var existing = document.getElementById('tp-consent');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    showBanner();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
