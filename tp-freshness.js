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

  /* Mirrors netlify.toml: schedule = "0 * * * *" */
  var CADENCE = 'hourly';
  var CADENCE_LONG = 'refreshed hourly, on the hour (UTC)';

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

  /* Mirror of lib/intel-freshness.js classifyIntelStatus.
     A same-day source reads "Updated" plus that calendar day. Visitors
     arriving later must see the age of latest_source_iso, not a frozen
     "Updated today". tests/intel-status-age.js fails if this drifts. */
  var COVERAGE_LAG_DAYS = 10;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function dayIso(d) {
    if (!d) return null;
    var s = String(d).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  function formatDayUTC(iso) {
    var p = iso.split('-');
    return String(Number(p[2])) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }

  function classify(opts) {
    opts = opts || {};
    var now = opts.now || new Date();
    var todayIso = now.toISOString().slice(0, 10);
    var sourceIso = dayIso(opts.latestSourceIso);
    var statusLabel = 'INTEL COVERAGE DELAYED';
    var reason = 'no_validated_source_date';
    var ageDays = null;
    if (sourceIso) {
      ageDays = Math.round((Date.parse(todayIso + 'T00:00:00Z') - Date.parse(sourceIso + 'T00:00:00Z')) / 86400000);
      var dayLabel = formatDayUTC(sourceIso);
      var dayOk = /^\d{1,2} [A-Za-z]{3} \d{4}$/.test(dayLabel);
      if (ageDays < 0) {
        statusLabel = 'INTEL COVERAGE DELAYED';
        reason = 'future_source_date_rejected';
      } else if (ageDays === 0 && dayOk) {
        statusLabel = 'Updated ' + dayLabel;
        reason = 'source_within_1d';
      } else if (ageDays === 1 && dayOk) {
        statusLabel = 'UPDATED ' + dayLabel;
        reason = 'source_within_1d';
      } else if (!dayOk) {
        statusLabel = 'INTEL COVERAGE DELAYED';
        reason = 'source_date_unprintable';
      } else if (ageDays > COVERAGE_LAG_DAYS) {
        statusLabel = 'INTEL COVERAGE DELAYED';
        reason = 'source_lag_' + ageDays + 'd';
      } else if (ageDays <= 3) {
        statusLabel = 'DATA CURRENT';
        reason = 'source_within_3d';
      } else if (ageDays <= 7) {
        statusLabel = 'REFRESH DELAYED';
        reason = 'source_within_7d';
      } else {
        statusLabel = 'INTEL COVERAGE DELAYED';
        reason = 'source_lag_' + ageDays + 'd';
      }
    }
    if (sourceIso && ageDays != null && ageDays > 30) {
      statusLabel = 'DATA STALE';
      reason = 'source_lag_' + ageDays + 'd';
    }
    if (!sourceIso) {
      statusLabel = 'DATA STALE';
      reason = 'no_validated_source_date';
    }
    return {
      statusLabel: statusLabel,
      reason: reason,
      ageDays: ageDays,
      latest_source_iso: sourceIso,
      latest_source_date: sourceIso ? formatDayUTC(sourceIso) : null
    };
  }

  function dot(label) {
    if (label === 'DATA CURRENT' || /^updated \d{1,2} [A-Za-z]{3} \d{4}$/i.test(label || '')) return '#1a9d4a';
    if (label === 'REFRESH DELAYED' || label === 'INTEL COVERAGE DELAYED') return '#e0a800';
    return '#94a3b8';
  }

  function replaceStatusText(el, statusLabel) {
    if (!el) return;
    var html = el.innerHTML;
    if (html.indexOf('● ') !== -1) {
      el.innerHTML = html.replace(/● [^<]+/, '● ' + statusLabel);
    } else if (/status <b/i.test(html)) {
      el.innerHTML = html.replace(/status <b[^>]*>[^<]*<\/b>/i, 'status <b style="color:var(--text)">' + statusLabel + '</b>');
    } else {
      el.textContent = statusLabel;
    }
    el.setAttribute('data-intel-status', statusLabel);
  }

  function ageBanners() {
    var hosts = [
      document.getElementById('hero-live-pill'),
      document.getElementById('stamp'),
      document.getElementById('freshnessLine')
    ];
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (!host) continue;
      var live = classify({ latestSourceIso: host.getAttribute('data-intel-source') });
      if (!live.latest_source_iso || !live.statusLabel) continue;
      if (host.id === 'hero-live-pill') {
        host.setAttribute('data-intel-status', live.statusLabel);
        var badge = document.getElementById('hero-live-status');
        if (badge) badge.textContent = live.statusLabel;
        var mark = document.getElementById('hero-live-dot');
        if (mark) mark.style.background = dot(live.statusLabel);
      } else {
        replaceStatusText(host, live.statusLabel);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ageBanners);
  else ageBanners();

  window.TPIntelClock = { classify: classify, dot: dot, ageBanners: ageBanners };
})();
