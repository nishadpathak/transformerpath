/* Event badges.
 *
 * Participation lives in data/event-badges.json. Each company has a history
 * of {event, year, source} entries. source is the exhibitor-list URL for
 * that year. This file turns those entries into badges.
 *
 * An edition still on or before its end date, in its timezone, stays
 * highlighted: "Exhibiting at EP Shanghai · 3–5 Dec 2026". Years of the
 * same series that have already ended share one line, most recent first:
 * "Exhibited at EP Shanghai 2026 · 2025". The morning after the end date
 * the highlighted year joins that line. The browser updates badges already
 * in the page from their data attributes, so the move happens between builds.
 *
 * Adding a show or a year is data only. See how_to_add in the JSON file.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    try { api.use(require('./data/event-badges.json')); } catch (e) { /* tests pass a catalog */ }
  } else {
    root.TPEventBadges = api;
    function boot() {
      var node = document.getElementById('tp-event-badges-data');
      if (node && !api.ready()) {
        try { api.use(JSON.parse(node.textContent)); } catch (e) {}
      }
      api.refresh(document);
    }
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DATA = { events: [], companies: [] };
  var bySlug = Object.create(null);
  var byName = Object.create(null);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isHttpUrl(value) {
    return /^https?:\/\/\S+$/.test(String(value || ''));
  }

  function parseISO(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    return { y: +match[1], m: +match[2], d: +match[3] };
  }

  function rangeLabel(start, end) {
    var a = parseISO(start);
    var b = parseISO(end);
    if (!a || !b) return '';
    var left = MONTHS[a.m - 1];
    var right = MONTHS[b.m - 1];
    if (a.y === b.y && a.m === b.m && a.d === b.d) return a.d + ' ' + left + ' ' + a.y;
    if (a.y === b.y && a.m === b.m) return a.d + '\u2013' + b.d + ' ' + left + ' ' + a.y;
    if (a.y === b.y) return a.d + ' ' + left + '\u2013' + b.d + ' ' + right + ' ' + a.y;
    return a.d + ' ' + left + ' ' + a.y + '\u2013' + b.d + ' ' + right + ' ' + b.y;
  }

  function todayInZone(timeZone, now) {
    var date = now || new Date();
    try {
      var formatted = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
      var match = /^(\d{4}-\d{2}-\d{2})/.exec(formatted);
      if (match) return match[1];
    } catch (e) {}
    return date.toISOString().slice(0, 10);
  }

  function isPast(event, now) {
    if (!event || !event.end) return false;
    return todayInZone(event.timezone, now) > event.end;
  }

  function editionYear(event) {
    if (!event) return '';
    if (/^\d{4}$/.test(String(event.year || ''))) return String(event.year);
    return String(event.end || event.start || '').slice(0, 4);
  }

  function seriesKey(event) {
    return (event && (event.series || event.name)) || '';
  }

  function pastName(event) {
    if (event.past_name) return event.past_name;
    var year = editionYear(event);
    return year ? (event.name + ' ' + year) : event.name;
  }

  function label(event, now) {
    if (!event) return '';
    if (isPast(event, now)) return 'Exhibited at ' + pastName(event);
    var range = rangeLabel(event.start, event.end);
    return 'Exhibiting at ' + event.name + (range ? ' \u00b7 ' + range : '');
  }

  function historyLabel(name, years) {
    var nums = [];
    var seen = Object.create(null);
    (years || []).forEach(function (year) {
      var n = parseInt(year, 10);
      if (!n || seen[n]) return;
      seen[n] = 1;
      nums.push(n);
    });
    nums.sort(function (a, b) { return b - a; });
    if (!name || !nums.length) return '';
    return 'Exhibited at ' + name + ' ' + nums.join(' \u00b7 ');
  }

  function eventBySlug(slug) {
    var events = DATA.events || [];
    for (var i = 0; i < events.length; i++) {
      if (events[i] && events[i].slug === slug) return events[i];
    }
    return null;
  }

  function participationsOf(row) {
    if (row && row.history && row.history.length) {
      return row.history.filter(function (entry) {
        return entry && eventBySlug(entry.event) && isHttpUrl(entry.source);
      });
    }
    if (row && row.event && eventBySlug(row.event)) {
      return [{ event: row.event, year: editionYear(eventBySlug(row.event)), legacy: true }];
    }
    return [];
  }

  function index() {
    bySlug = Object.create(null);
    byName = Object.create(null);
    (DATA.companies || []).forEach(function (row) {
      if (!participationsOf(row).length) return;
      function add(map, key) {
        if (!key) return;
        (map[key] = map[key] || []).push(row);
      }
      add(bySlug, row.slug);
      add(byName, row.name);
      if (row.exhibitor_name && row.exhibitor_name !== row.name) add(byName, row.exhibitor_name);
      (row.aliases || []).forEach(function (alias) {
        if (alias && alias !== row.name) add(byName, alias);
      });
    });
  }

  function use(data) {
    DATA = data && typeof data === 'object' ? data : { events: [], companies: [] };
    index();
    return api;
  }

  function ready() {
    return !!((DATA.events && DATA.events.length) || (DATA.companies && DATA.companies.length));
  }

  function rowsFor(query) {
    query = query || {};
    var rows = [];
    var seen = Object.create(null);
    function add(list) {
      (list || []).forEach(function (row) {
        var key = row.slug || row.name || '';
        if (!key || seen[key]) return;
        seen[key] = 1;
        rows.push(row);
      });
    }
    var slug = String(query.slug || '').replace(/^lab:/, '');
    if (slug) add(bySlug[slug]);
    if (query.name) add(byName[query.name]);
    return rows;
  }

  function attr(name, value) {
    if (value == null || value === '') return '';
    return ' ' + name + '="' + esc(value) + '"';
  }

  function liveBadge(event, pastYears, now) {
    var year = editionYear(event);
    var extra = '';
    if (pastYears && pastYears.length) {
      extra = attr('data-event-year', year) +
        attr('data-event-also', pastYears.join(',')) +
        attr('data-event-series', seriesKey(event));
    }
    return '<a class="event-badge" data-event-badge="' + esc(event.slug) + '" href="' + esc(event.url) + '"' +
      attr('data-event-name', event.name || '') +
      attr('data-event-past', pastName(event)) +
      attr('data-event-start', event.start || '') +
      attr('data-event-end', event.end || '') +
      attr('data-event-tz', event.timezone || 'UTC') +
      extra +
      ' data-event-state="upcoming">' +
      esc(label(event, now)) + '</a>';
  }

  function historyBadge(latest, years, pending) {
    var end = pending ? pending.end : latest.end;
    var tz = pending ? pending.timezone : latest.timezone;
    return '<a class="event-badge" data-event-role="history" data-event-badge="' + esc(latest.slug) + '" href="' + esc(latest.url) + '"' +
      attr('data-event-name', latest.name || '') +
      attr('data-event-past', pastName(latest)) +
      attr('data-event-years', years.join(',')) +
      attr('data-event-series', seriesKey(latest)) +
      (pending ? attr('data-event-pending', editionYear(pending)) : '') +
      attr('data-event-end', end || '') +
      attr('data-event-tz', tz || 'UTC') +
      ' data-event-state="past">' +
      esc(historyLabel(latest.name, years)) + '</a>';
  }

  function htmlFor(query, now) {
    var groups = Object.create(null);
    var rank = Object.create(null);
    (DATA.events || []).forEach(function (event, i) {
      if (!event) return;
      var key = seriesKey(event);
      if (key && rank[key] == null) rank[key] = i;
    });
    rowsFor(query).forEach(function (row) {
      participationsOf(row).forEach(function (part) {
        var event = eventBySlug(part.event);
        var key = seriesKey(event);
        if (!key) return;
        (groups[key] = groups[key] || []).push(event);
      });
    });
    var keys = Object.keys(groups).sort(function (a, b) { return (rank[a] || 0) - (rank[b] || 0); });
    var html = '';
    keys.forEach(function (key) {
      var seen = Object.create(null);
      var live = [];
      var past = [];
      groups[key].forEach(function (event) {
        if (!event || seen[event.slug]) return;
        seen[event.slug] = 1;
        (isPast(event, now) ? past : live).push(event);
      });
      past.sort(function (a, b) { return editionYear(b) - editionYear(a); });
      var pastYears = past.map(editionYear);
      live.forEach(function (event) { html += liveBadge(event, pastYears, now); });
      if (past.length) html += historyBadge(past[0], pastYears, live.length === 1 ? live[0] : null);
    });
    return html;
  }

  function splitYears(value) {
    return String(value || '').split(',').filter(function (year) { return /^\d{4}$/.test(year); });
  }

  function refresh(scope, now) {
    if (!scope || !scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll('[data-event-badge]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-event-role') === 'history') {
        var pending = el.getAttribute('data-event-pending');
        var pendingPast = pending && isPast({
          end: el.getAttribute('data-event-end'),
          timezone: el.getAttribute('data-event-tz') || 'UTC'
        }, now);
        if (pendingPast) {
          el.setAttribute('hidden', '');
          if (el.style) el.style.display = 'none';
          return;
        }
        el.removeAttribute('hidden');
        if (el.style) el.style.display = '';
        el.textContent = historyLabel(el.getAttribute('data-event-name'), splitYears(el.getAttribute('data-event-years')));
        el.setAttribute('data-event-state', 'past');
        return;
      }
      var event = {
        slug: el.getAttribute('data-event-badge'),
        name: el.getAttribute('data-event-name'),
        past_name: el.getAttribute('data-event-past'),
        year: el.getAttribute('data-event-year'),
        start: el.getAttribute('data-event-start'),
        end: el.getAttribute('data-event-end'),
        timezone: el.getAttribute('data-event-tz') || 'UTC',
        url: el.getAttribute('href')
      };
      var past = isPast(event, now);
      if (past && event.year) {
        el.textContent = historyLabel(event.name, [event.year].concat(splitYears(el.getAttribute('data-event-also'))));
      } else {
        el.textContent = label(event, now);
      }
      el.setAttribute('data-event-state', past ? 'past' : 'upcoming');
      if (past) return;
      el.removeAttribute('hidden');
      if (el.style) el.style.display = '';
    });
  }

  function validate(data) {
    var errors = [];
    var events = (data && data.events) || [];
    var slugs = Object.create(null);
    var seriesName = Object.create(null);
    events.forEach(function (event, i) {
      var where = 'events[' + i + ']';
      if (!event || !event.slug) {
        errors.push(where + ' missing slug');
        return;
      }
      if (slugs[event.slug]) errors.push(where + ' duplicate slug ' + event.slug);
      slugs[event.slug] = event;
      if (!/^\d{4}$/.test(String(event.year || ''))) errors.push(where + ' ' + event.slug + ' missing year');
      if (!event.series) errors.push(where + ' ' + event.slug + ' missing series');
      if (!event.name) errors.push(where + ' ' + event.slug + ' missing name');
      if (!event.start || !event.end) errors.push(where + ' ' + event.slug + ' missing dates');
      if (!event.url) errors.push(where + ' ' + event.slug + ' missing url');
      if (event.series) {
        if (seriesName[event.series] && seriesName[event.series] !== event.name) {
          errors.push(where + ' series ' + event.series + ' has two names');
        }
        seriesName[event.series] = event.name;
      }
    });
    ((data && data.companies) || []).forEach(function (row, i) {
      var where = 'companies[' + i + ']' + (row && row.slug ? ' ' + row.slug : '');
      if (!row || !row.history || !row.history.length) {
        errors.push(where + ' missing history');
        return;
      }
      var seen = Object.create(null);
      row.history.forEach(function (entry, j) {
        var at = where + '.history[' + j + ']';
        if (!entry || !entry.event) {
          errors.push(at + ' missing event slug');
        } else if (!slugs[entry.event]) {
          errors.push(at + ' unknown event ' + entry.event);
        } else if (String(entry.year) !== String(slugs[entry.event].year)) {
          errors.push(at + ' year does not match ' + entry.event);
        }
        if (!entry || !/^\d{4}$/.test(String(entry.year || ''))) errors.push(at + ' missing year');
        if (!entry || !isHttpUrl(entry.source)) errors.push(at + ' missing source exhibitor-list URL');
        var key = entry && (entry.event + ':' + entry.year);
        if (key && seen[key]) errors.push(at + ' duplicate ' + key);
        if (key) seen[key] = 1;
      });
    });
    return errors;
  }

  function mountHtml() {
    var json = JSON.stringify(DATA).replace(/</g, '\\u003c');
    return '<script type="application/json" id="tp-event-badges-data">' + json + '</script>\n' +
      '<script src="/event-badges.js"></script>\n';
  }

  function deferScript() {
    return '<script src="/event-badges.js" defer></script>\n';
  }

  function ensureDefer(html) {
    if (!html || html.indexOf('class="event-badge"') < 0) return html;
    if (html.indexOf('/event-badges.js') >= 0) return html;
    return html.replace('</body>', deferScript() + '</body>');
  }

  var api = {
    use: use,
    ready: ready,
    label: label,
    historyLabel: historyLabel,
    rangeLabel: rangeLabel,
    todayInZone: todayInZone,
    isPast: isPast,
    htmlFor: htmlFor,
    refresh: refresh,
    validate: validate,
    mountHtml: mountHtml,
    deferScript: deferScript,
    ensureDefer: ensureDefer
  };
  return api;
});
