/* Event badges.
 *
 * Participation lives in data/event-badges.json. This file only turns an
 * event's start and end into the visible label. On the end date, in the
 * event's timezone, the label is still "Exhibiting". The next calendar day
 * it becomes "Exhibited". The browser updates badges already in the page
 * from their data attributes, so the tense stays right between builds.
 *
 * Adding a show: append one events object and one companies row per
 * participant. Directory and profile templates call htmlFor(); they do not
 * name a specific exhibition.
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

  function pastName(event) {
    if (event.past_name) return event.past_name;
    var year = String(event.end || event.start || '').slice(0, 4);
    return year ? (event.name + ' ' + year) : event.name;
  }

  function label(event, now) {
    if (!event) return '';
    if (isPast(event, now)) return 'Exhibited at ' + pastName(event);
    var range = rangeLabel(event.start, event.end);
    return 'Exhibiting at ' + event.name + (range ? ' \u00b7 ' + range : '');
  }

  function eventBySlug(slug) {
    var events = DATA.events || [];
    for (var i = 0; i < events.length; i++) {
      if (events[i] && events[i].slug === slug) return events[i];
    }
    return null;
  }

  function index() {
    bySlug = Object.create(null);
    byName = Object.create(null);
    (DATA.companies || []).forEach(function (row) {
      if (!row || !row.event || !eventBySlug(row.event)) return;
      if (row.slug) (bySlug[row.slug] = bySlug[row.slug] || []).push(row);
      if (row.name) (byName[row.name] = byName[row.name] || []).push(row);
      if (row.exhibitor_name && row.exhibitor_name !== row.name) {
        (byName[row.exhibitor_name] = byName[row.exhibitor_name] || []).push(row);
      }
      (row.aliases || []).forEach(function (alias) {
        if (alias && alias !== row.name) (byName[alias] = byName[alias] || []).push(row);
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
        var key = row.event + '\n' + (row.slug || '');
        if (seen[key]) return;
        seen[key] = 1;
        rows.push(row);
      });
    }
    var slug = String(query.slug || '').replace(/^lab:/, '');
    if (slug) add(bySlug[slug]);
    if (query.name) add(byName[query.name]);
    return rows;
  }

  function badgeHtml(event, now) {
    if (!event || !event.slug || !event.url) return '';
    var past = isPast(event, now);
    return '<a class="event-badge" data-event-badge="' + esc(event.slug) + '" href="' + esc(event.url) + '"' +
      ' data-event-name="' + esc(event.name || '') + '"' +
      ' data-event-past="' + esc(event.past_name || '') + '"' +
      ' data-event-start="' + esc(event.start || '') + '"' +
      ' data-event-end="' + esc(event.end || '') + '"' +
      ' data-event-tz="' + esc(event.timezone || 'UTC') + '"' +
      ' data-event-state="' + (past ? 'past' : 'upcoming') + '">' +
      esc(label(event, now)) + '</a>';
  }

  function htmlFor(query, now) {
    var wanted = Object.create(null);
    rowsFor(query).forEach(function (row) { wanted[row.event] = 1; });
    var html = '';
    (DATA.events || []).forEach(function (event) {
      if (event && wanted[event.slug]) html += badgeHtml(event, now);
    });
    return html;
  }

  function refresh(scope, now) {
    if (!scope || !scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll('[data-event-badge]');
    Array.prototype.forEach.call(nodes, function (el) {
      var event = {
        slug: el.getAttribute('data-event-badge'),
        name: el.getAttribute('data-event-name'),
        past_name: el.getAttribute('data-event-past'),
        start: el.getAttribute('data-event-start'),
        end: el.getAttribute('data-event-end'),
        timezone: el.getAttribute('data-event-tz') || 'UTC',
        url: el.getAttribute('href')
      };
      el.textContent = label(event, now);
      el.setAttribute('data-event-state', isPast(event, now) ? 'past' : 'upcoming');
    });
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
    rangeLabel: rangeLabel,
    todayInZone: todayInZone,
    isPast: isPast,
    badgeHtml: badgeHtml,
    htmlFor: htmlFor,
    refresh: refresh,
    mountHtml: mountHtml,
    deferScript: deferScript,
    ensureDefer: ensureDefer
  };
  return api;
});
