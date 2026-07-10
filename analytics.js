/* ═══ TrafoPath analytics loader ═══
   To activate, paste ONE id below and redeploy. No other page edits needed.
   Option A (recommended, privacy-friendly, paid): Plausible — set PLAUSIBLE_DOMAIN = "trafopath.com"
   Option B (free): Google Analytics 4 — set GA4_ID = "G-XXXXXXXXXX"           */
var PLAUSIBLE_DOMAIN = "";
var GA4_ID = "";

(function(){
  if (PLAUSIBLE_DOMAIN) {
    var s = document.createElement('script');
    s.defer = true; s.setAttribute('data-domain', PLAUSIBLE_DOMAIN);
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  } else if (GA4_ID) {
    var g = document.createElement('script');
    g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date()); gtag('config', GA4_ID);
  }
})();
