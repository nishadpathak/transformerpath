/* TransformerPath cookie consent loader.
   Google AdSense (auto-ads) is normally loaded via a static <script> in the
   <head>. AdSense sets advertising cookies, so for EU/UK ePrivacy + GDPR we
   only load it after the visitor accepts. consent.js replaces that static tag
   on every page and injects the AdSense script only when consent is 'accepted'.

   State (localStorage['tp-cookie-consent']):
     - 'accepted'  -> load AdSense (auto-ads initialize via the script itself)
     - 'essential' -> never load AdSense (cookies kept to essentials)
     - null        -> not decided; show the banner

   Nothing here loads a third-party script unless the visitor opts in. */
(function () {
  var PUB = 'ca-pub-5646978915498298';
  var KEY = 'tp-cookie-consent';
  var started = false;

  function loadAdSense() {
    if (document.querySelector('script[data-tp-adsense]')) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + PUB;
    s.setAttribute('data-tp-adsense', '1');
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }

  function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function showBanner() {
    if (document.getElementById('tp-consent') || !document.body) return;
    var b = document.createElement('div');
    b.id = 'tp-consent';
    b.setAttribute('style', 'position:fixed;left:16px;right:16px;bottom:16px;z-index:100000;background:#0d1b2e;color:#fff;font-family:Inter,system-ui,-apple-system,sans-serif;padding:18px 22px;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.4);max-width:760px;margin:0 auto;font-size:.9rem;line-height:1.5;display:flex;gap:16px;flex-wrap:wrap;align-items:center;');
    b.innerHTML =
      '<div style="flex:1 1 320px">We use essential cookies to keep the site working, and Google AdSense may set advertising cookies to show relevant ads. <a href="privacy.html" style="color:#f5a623;text-decoration:underline">Privacy policy</a>.</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">' +
      '<button data-c="accept" style="background:#f5a623;color:#0d1b2e;border:none;border-radius:9px;padding:10px 18px;font-weight:800;cursor:pointer">Accept</button>' +
      '<button data-c="essential" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:9px;padding:10px 18px;font-weight:600;cursor:pointer">Essential only</button>' +
      '</div>';
    document.body.appendChild(b);
    b.addEventListener('click', function (e) {
      var c = e.target && e.target.getAttribute && e.target.getAttribute('data-c');
      if (!c) return;
      setConsent(c === 'accept' ? 'accepted' : 'essential');
      if (b.parentNode) b.parentNode.removeChild(b);
      if (c === 'accept') loadAdSense();
    });
  }

  function start() {
    if (started) return;
    started = true;
    var c = getConsent();
    if (c === 'accepted') { loadAdSense(); return; }
    if (c === 'essential') { return; }
    showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
