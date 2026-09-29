/* tp-watchlist.js — Free local Intel watchlists (browser-stored).
 * Intel Pro adds shared org watchlists, alerts and exports; this is the free teaser.
 * Supports card watches + GCC portal keyword presets (DEWA / Etimad / MEWRE).
 */
(function () {
  'use strict';
  var KEY = 'tp_intel_watchlist';
  var MAX = 40;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  var TP_WATCHLIST = {
    list: function () { return load(); },
    has: function (id) {
      return load().some(function (x) { return x.id === id; });
    },
    add: function (item) {
      var list = load();
      if (!item || !item.id) return list;
      if (list.some(function (x) { return x.id === item.id; })) return list;
      if (list.length >= MAX) {
        alert('Free watchlists hold up to ' + MAX + ' items. Remove one, or upgrade to Intel Pro for shared lists and alerts.');
        return list;
      }
      list.unshift({
        id: item.id,
        title: item.title || 'Intel item',
        href: item.href || '',
        region: item.region || '',
        keywords: item.keywords || '',
        kind: item.kind || 'item',
        saved_at: new Date().toISOString()
      });
      save(list);
      TP_WATCHLIST.render();
      TP_WATCHLIST.syncButtons();
      TP_WATCHLIST.highlightMatches();
      return list;
    },
    remove: function (id) {
      var list = load().filter(function (x) { return x.id !== id; });
      save(list);
      TP_WATCHLIST.render();
      TP_WATCHLIST.syncButtons();
      TP_WATCHLIST.highlightMatches();
      return list;
    },
    toggle: function (item) {
      if (TP_WATCHLIST.has(item.id)) return TP_WATCHLIST.remove(item.id);
      return TP_WATCHLIST.add(item);
    },
    clear: function () {
      save([]);
      TP_WATCHLIST.render();
      TP_WATCHLIST.syncButtons();
      TP_WATCHLIST.highlightMatches();
    },
    syncButtons: function () {
      document.querySelectorAll('[data-watch-id]').forEach(function (btn) {
        var id = btn.getAttribute('data-watch-id');
        var on = TP_WATCHLIST.has(id);
        btn.textContent = on ? '★ Watching' : '☆ Watch';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.classList.toggle('is-watching', on);
      });
      document.querySelectorAll('[data-watch-preset]').forEach(function (btn) {
        var id = 'preset-' + btn.getAttribute('data-watch-preset');
        var on = TP_WATCHLIST.has(id);
        var label = btn.getAttribute('data-watch-preset');
        if (label === 'DEWA') btn.textContent = on ? '★ Watching DEWA tenders' : '☆ Watch DEWA tenders';
        else if (label === 'Etimad') btn.textContent = on ? '★ Watching Etimad' : '☆ Watch Etimad';
        else if (label === 'MEWRE') btn.textContent = on ? '★ Watching MEWRE' : '☆ Watch MEWRE';
        else btn.textContent = (on ? '★ Watching ' : '☆ Watch ') + label;
        btn.classList.toggle('is-watching', on);
      });
      var countEl = document.getElementById('tp-watch-count');
      if (countEl) countEl.textContent = String(load().length);
    },
    highlightMatches: function () {
      var presets = load().filter(function (x) { return x.kind === 'preset' && x.keywords; });
      document.querySelectorAll('article.intel-post, .card-title').forEach(function (el) {
        el.style.outline = '';
        el.style.outlineOffset = '';
        if (!presets.length) return;
        var text = (el.textContent || '').toLowerCase();
        var hit = presets.some(function (p) {
          return String(p.keywords).split(',').some(function (k) {
            k = k.trim().toLowerCase();
            return k && text.indexOf(k) >= 0;
          });
        });
        if (hit) {
          el.style.outline = '2px solid rgba(245,166,35,.55)';
          el.style.outlineOffset = '2px';
        }
      });
    },
    render: function () {
      var panel = document.getElementById('tp-watchlist-panel');
      if (!panel) return;
      var list = load();
      if (!list.length) {
        panel.innerHTML = '<p style="margin:0;color:var(--muted);font-size:.86rem">No watched items yet. Use a GCC portal preset above, or click <b>☆ Watch</b> on any Intel card (stored in this browser).</p>';
        return;
      }
      panel.innerHTML =
        '<ul style="list-style:none;margin:0;padding:0;display:grid;gap:8px">' +
        list.map(function (x) {
          var link = x.href
            ? '<a href="' + esc(x.href) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;font-weight:700">' + esc(x.title) + '</a>'
            : '<span style="font-weight:700">' + esc(x.title) + '</span>';
          var meta = x.kind === 'preset'
            ? '<div style="font-size:.72rem;color:var(--muted);margin-top:3px">Keyword alert · ' + esc(x.keywords) + ' · matches highlighted on this page</div>'
            : (x.region ? '<div style="font-size:.72rem;color:var(--muted);margin-top:3px">' + esc(x.region) + '</div>' : '');
          return '<li style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--card)">' +
            '<div style="min-width:0">' + link + meta + '</div>' +
            '<button type="button" class="btn btn-outline btn-sm" data-watch-remove="' + esc(x.id) + '" style="font-size:.72rem;flex:none">Remove</button>' +
            '</li>';
        }).join('') +
        '</ul>' +
        '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
        '<button type="button" class="btn btn-outline btn-sm" id="tp-watch-clear">Clear all</button>' +
        '<a class="btn btn-amber btn-sm" href="intel-pro.html">Intel Pro — shared lists &amp; alerts →</a>' +
        '</div>';
      panel.querySelectorAll('[data-watch-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          TP_WATCHLIST.remove(btn.getAttribute('data-watch-remove'));
        });
      });
      var clear = document.getElementById('tp-watch-clear');
      if (clear) clear.addEventListener('click', function () { TP_WATCHLIST.clear(); });
    },
    attach: function () {
      document.querySelectorAll('article.intel-post').forEach(function (art) {
        if (art.querySelector('[data-watch-id]')) return;
        var id = art.id || '';
        if (!id) return;
        var h = art.querySelector('.intel-headline a, h3 a, a');
        var title = (h && (h.textContent || '').trim()) || id;
        var href = (h && h.getAttribute('href')) || ('#' + id);
        var region = art.getAttribute('data-region') || '';
        var byline = art.querySelector('.intel-byline');
        if (!byline) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline btn-sm tp-watch-btn';
        btn.setAttribute('data-watch-id', id);
        btn.setAttribute('style', 'font-size:.68rem;padding:2px 8px;margin-left:6px');
        btn.textContent = '☆ Watch';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          TP_WATCHLIST.toggle({ id: id, title: title, href: href, region: region });
        });
        byline.appendChild(btn);
      });
      document.querySelectorAll('.card-title a').forEach(function (a) {
        var card = a.closest('.card, .intel-card, article, div');
        if (!card || card.querySelector('[data-watch-id]')) return;
        var title = (a.textContent || '').trim();
        if (!title) return;
        var href = a.getAttribute('href') || '';
        var id = 'card-' + hash(title + '|' + href);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline btn-sm tp-watch-btn';
        btn.setAttribute('data-watch-id', id);
        btn.setAttribute('style', 'font-size:.66rem;padding:1px 7px;margin-left:6px;vertical-align:middle');
        btn.textContent = '☆ Watch';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          TP_WATCHLIST.toggle({ id: id, title: title, href: href, region: '' });
        });
        a.parentNode.appendChild(btn);
      });
      document.querySelectorAll('[data-watch-preset]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var name = btn.getAttribute('data-watch-preset');
          var keywords = btn.getAttribute('data-watch-keywords') || name;
          TP_WATCHLIST.toggle({
            id: 'preset-' + name,
            title: name + ' transformer tender watch',
            keywords: keywords,
            kind: 'preset',
            region: 'GCC',
            href: '#tp-watchlists'
          });
        });
      });
      TP_WATCHLIST.syncButtons();
      TP_WATCHLIST.render();
      TP_WATCHLIST.highlightMatches();
    }
  };

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  window.TP_WATCHLIST = TP_WATCHLIST;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { TP_WATCHLIST.attach(); });
  } else {
    TP_WATCHLIST.attach();
  }
})();
