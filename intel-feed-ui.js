/* intel-feed-ui.js — X-speed timeline + Reuters desks for TransformerPath Intel.
 * Fetches compact data/intel-feed-ui.json. Never invents dates. Relative
 * "2m ago" / "Live now" are forbidden — source calendar dates only.
 */
(function () {
  'use strict';
  var PAGE = 16;
  var feed = null;
  var tab = 'latest';
  var shown = 0;
  var userRegion = 'Global';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function matches(p) {
    if (tab === 'latest') return p.desk === 'news' || p.desk === 'grid' || p.desk === 'awards';
    if (tab === 'foryou') {
      if (userRegion === 'Global') return p.desk === 'news' || p.desk === 'grid';
      var r = userRegion;
      if (r === 'USA') r = 'North America';
      return (p.region === r || p.region === userRegion) && (p.desk === 'news' || p.desk === 'grid' || p.desk === 'tenders' || p.desk === 'awards');
    }
    if (tab === 'tenders') return p.desk === 'tenders';
    if (tab === 'awards') return p.desk === 'awards';
    if (tab === 'capacity') return p.desk === 'capacity';
    if (tab === 'metals') return p.desk === 'metals';
    return true;
  }

  function card(p) {
    var href = p.url || ('intel.html#p-' + p.id);
    var date = p.date ? esc(p.date) : 'Date not stated';
    var cls = p.cls ? '<span class="cls-badge cls-' + esc(p.cls) + '">' + esc(p.cls) + '</span>' : '';
    var prov = p.provenance ? '<span class="intel-prov intel-prov-' + esc(p.provenance) + '">' + esc(p.provenance) + '</span>' : '';
    return '<article class="intel-post" id="p-' + esc(p.id) + '" data-desk="' + esc(p.desk) + '" data-region="' + esc(p.region) + '">' +
      '<div class="intel-avatar" aria-hidden="true">TP</div>' +
      '<div class="intel-body">' +
      '<div class="intel-byline"><strong>TransformerPath</strong><span class="intel-handle">@intel</span>' +
      '<span class="intel-date" title="Source date — not the page-build clock">' + date + '</span></div>' +
      '<h3 class="intel-headline"><a href="' + esc(href) + '"' + (p.url ? ' target="_blank" rel="noopener"' : '') + '>' + esc(p.headline) + '</a></h3>' +
      (p.soWhat ? '<p class="intel-sowhat">' + esc(p.soWhat) + '</p>' : '') +
      (p.buyer ? '<p class="intel-buyer">Who buys: ' + esc(p.buyer) + '</p>' : '') +
      '<div class="intel-meta">' + cls + prov +
      '<span class="intel-region">' + esc(p.region) + '</span>' +
      (p.value ? '<span class="val">' + esc(p.value) + '</span>' : '') +
      '<span class="src">' + esc(p.sourceName || p.src) + '</span></div>' +
      '<div class="intel-actions">' +
      '<a class="tp-li-share-inline" data-linkedin-share data-url="' + esc(href) + '" href="#" rel="noopener">LinkedIn</a>' +
      '<button type="button" class="intel-copy" data-copy="https://transformerpath.com/intel.html#p-' + esc(p.id) + '">Copy link</button>' +
      '<button type="button" class="follow-btn" data-follow-type="region" data-follow-subject="' + esc(p.region) + '" data-follow-label="' + esc(p.region) + '">Follow ' + esc(p.region) + '</button>' +
      '</div></div></article>';
  }

  function list() {
    if (!feed) return [];
    return feed.posts.filter(matches);
  }

  function paint(reset) {
    var host = $('intel-timeline');
    if (!host) return;
    var items = list();
    if (reset) shown = Math.min(PAGE, items.length);
    var slice = items.slice(0, shown);
    var more = items.length > shown;
    var empty = !slice.length ? '<p class="intel-empty">No sourced posts on this desk yet. TransformerPath is the only poster — items appear when the daily desk files them.</p>' : '';
    var honesty = '';
    if (feed && feed.honesty && feed.honesty.latest_source_date) {
      honesty = '<p class="intel-honesty">Latest sourced item: <b>' + esc(feed.honesty.latest_source_date) + '</b> · dates are on the source, not this visit.</p>';
    }
    host.innerHTML = honesty + empty + slice.map(card).join('') +
      (more ? '<button type="button" class="intel-more" id="intelMore">Show more · ' + (items.length - shown) + ' remaining</button>' : '');
    var btn = $('intelMore');
    if (btn) btn.onclick = function () { shown += PAGE; paint(false); };
    host.querySelectorAll('.intel-copy').forEach(function (b) {
      b.onclick = function () {
        var t = b.getAttribute('data-copy');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(t).then(function () { b.textContent = 'Copied'; }).catch(function () {});
        }
      };
    });
    if (window.TP && window.TP.ready) { /* follow-button.js will upgrade .follow-btn */ }
  }

  function setTab(next) {
    tab = next;
    document.querySelectorAll('.intel-tab').forEach(function (t) {
      var on = t.getAttribute('data-feed') === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var timeline = $('intel-timeline');
    var morePanels = document.querySelectorAll('.intel-legacy-panel');
    if (timeline) timeline.classList.add('active');
    morePanels.forEach(function (p) { p.classList.remove('active'); });
    paint(true);
    if (history.replaceState) history.replaceState(null, '', '#' + tab);
  }

  function bindTabs() {
    document.querySelectorAll('.intel-tab').forEach(function (t) {
      t.addEventListener('click', function () { setTab(t.getAttribute('data-feed')); });
    });
    document.querySelectorAll('.intel-more-desk').forEach(function (t) {
      t.addEventListener('click', function () {
        var panel = t.getAttribute('data-panel');
        document.querySelectorAll('.intel-tab').forEach(function (x) {
          x.classList.remove('active');
          x.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
        var el = document.getElementById('panel-' + panel);
        if (el) el.classList.add('active');
        var tl = $('intel-timeline');
        if (tl) tl.classList.remove('active');
      });
    });
  }

  function detectRegion() {
    try {
      var cached = localStorage.getItem('tp-user-region');
      if (cached) { userRegion = cached; return; }
    } catch (e) { /* ignore */ }
    if (typeof USER_REGION === 'string' && USER_REGION) userRegion = USER_REGION;
  }

  function load() {
    detectRegion();
    bindTabs();
    var hash = (location.hash || '').replace('#', '');
    if (hash && /^(foryou|latest|tenders|awards|capacity|metals)$/.test(hash)) tab = hash;
    fetch('data/intel-feed-ui.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      feed = d;
      setTab(tab);
    }).catch(function () {
      var host = $('intel-timeline');
      if (host && !host.querySelector('.intel-post')) {
        host.insertAdjacentHTML('beforeend', '<p class="intel-empty">Feed JSON unavailable — SSR cards above are the curated first page.</p>');
      }
    });
    var sel = $('region-select');
    if (sel) sel.addEventListener('change', function () {
      userRegion = sel.value || 'Global';
      if (tab === 'foryou') paint(true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
