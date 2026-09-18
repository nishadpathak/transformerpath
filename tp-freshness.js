/* ============================================================================
   TransformerPath — canonical freshness statement
   ----------------------------------------------------------------------------
   One source of truth for "how often does this update", because the site had
   drifted into claiming three different cadences at once: the same intel pages
   said both "updated hourly" and "updated every morning", while the homepage
   said "daily" and the FAQ said "refreshed daily".

   THREE DATES, DELIBERATELY SEPARATE — they are not the same thing and
   conflating them is how a page ends up claiming data is fresher than it is:

     buildDate    when this page was last published
     refreshDate  when the intel job last pulled from its sources
     observedDate when the underlying source itself observed the value
                  (a metal price quoted "2 Sep cash" was observed on 2 Sep,
                  whatever time we fetched it)

   CADENCE is derived from netlify.toml's schedule for the refresh-data
   function. If that cron changes, change CADENCE here — nowhere else.

   Usage: give an element data-tp-fresh="cadence" | "refreshed" | "observed"
   and this fills it in. Elements are left untouched if the data is unknown,
   so a page never renders an empty or invented claim.
   ========================================================================== */
(function () {
  'use strict';

  /* Curated Daily Intel is refreshed with each publication cycle */
  var CADENCE = 'daily';
  var CADENCE_LONG = 'refreshed daily with each publication cycle';

  var FEED = '/.netlify/functions/intel-feed';

  function fmt(d) {
    try {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
             ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' UTC';
    } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
  }

  function paint(map) {
    var els = document.querySelectorAll('[data-tp-fresh]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-tp-fresh');
      if (map[k]) els[i].textContent = map[k];
    }
  }

  function run() {
    /* Cadence is known without a network call, so paint it immediately. */
    paint({ cadence: CADENCE, cadenceLong: CADENCE_LONG });

    /* The refresh timestamp is only knowable from the feed itself. If the
       request fails we leave the element as authored rather than guessing. */
    if (!window.fetch) return;
    fetch(FEED, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.timestamp) return;
        var when = fmt(new Date(d.timestamp));
        paint({ refreshed: when, cadence: CADENCE, cadenceLong: CADENCE_LONG });
      })
      .catch(function () { /* leave the authored text in place */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  window.TP_FRESHNESS = { cadence: CADENCE, cadenceLong: CADENCE_LONG };
})();
