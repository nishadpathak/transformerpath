#!/usr/bin/env node
/**
 * build_ssr.js — server-side pre-render of the JSON-backed data pages.
 *
 * The data pages (events, webinars, components, jobs, grids) store their
 * records as JS consts *inside* the page and fill empty containers via
 * client-side innerHTML. Non-JS crawlers therefore see the containers empty.
 *
 * This script reads each page, extracts the embedded data, re-runs the page's
 * own default-view render template, and injects the resulting HTML into the
 * real containers in the static file. The page's JS still runs on load and
 * re-renders the same default view — so nothing changes for JS users — but a
 * crawler / no-JS visitor now sees the records in the initial HTML.
 *
 * Injection is idempotent via invisible marker comments (browsers ignore them).
 * Run:  node build_ssr.js
 */
'use strict';
process.env.TZ = 'UTC';

const fs = require('fs');
const path = require('path');
/* ONE canonical event-status resolver, shared with build-events.js and
   check-event-integrity.js. This file used to re-derive status and countdowns
   from raw dates, which is how "Dates TBC" could render beside "Live now". */
const { resolveStatus, isTravelSafe, isDiscoverable, isUpcoming } = require('./lib/event-status');
const { eventHref, eventPageMap, resolveEventSlug } = require('./lib/event-href');
const { loadEvents } = require('./lib/events-reader');
const { dateLine, allowsCalendar, badgeText } = require('./lib/event-display');
const { eventBadge, intelBadge } = require('./lib/provenance-badge');
const tpAff = require('./lib/travelpayouts');
const directorySsr = require('./lib/directory-ssr');

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

// Escape text/attribute values for safe, valid HTML (matches how innerHTML
// would present them; browsers render entities identically).
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Lowercased kebab slug for a grid-country name; must match the directory
// names build-grids.js writes under /grids/<slug>/.
function countrySlug(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Extract a `const NAME = <value>;` value. Works for array/object literals
// (bracket-matching that ignores strings and // and /* */ comments) and for
// primitive string/number/boolean values. Returns the evaluated value.
function extractConst(src, name, startFrom = 0) {
  const escName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:const|let|var)\\s+' + escName + '\\s*=\\s*');
  const m = re.exec(src.slice(startFrom));
  if (!m) throw new Error('const ' + name + ' not found');
  let i = startFrom + m.index + m[0].length;
  while (i < src.length && /\s/.test(src[i])) i++;
  const open = src[i];
  if (open === '[' || open === '{') {
    const close = open === '[' ? ']' : '}';
    const start = i;
    let depth = 0, inStr = null, escp = false, line = false, block = false;
    for (; i < src.length; i++) {
      const ch = src[i];
      const nx = src[i + 1];
      if (line) { if (ch === '\n') line = false; continue; }
      if (block) { if (ch === '*' && nx === '/') { block = false; i++; } continue; }
      if (inStr) {
        if (escp) { escp = false; continue; }
        if (ch === '\\') { escp = true; continue; }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '/' && nx === '/') { line = true; i++; continue; }
      if (ch === '/' && nx === '*') { block = true; i++; continue; }
      if (ch === '`' || ch === "'" || ch === '"') { inStr = ch; continue; }
      if (ch === open) depth++;
      else if (ch === close) { depth--; if (depth === 0) break; }
    }
    const lit = src.slice(start, i + 1);
    return new Function('return (' + lit + ')')();
  }
  // primitive value: a quoted string, or a bare token (number/true/false/null)
  let end = i;
  if (open === '"' || open === "'" || open === '`') {
    const q = open; end = i + 1; let escp = false;
    for (; end < src.length; end++) {
      const ch = src[end];
      if (escp) { escp = false; continue; }
      if (ch === '\\') { escp = true; continue; }
      if (ch === q) { end++; break; }
    }
  } else {
    while (end < src.length && !/[\s;,)\]}]/.test(src[end])) end++;
  }
  const lit = src.slice(i, end);
  return new Function('return (' + lit + ')')();
}

// Inject `newInner` into the element that opens with `openTag`, bracketed by
// invisible idempotent marker comments. Returns the new page HTML.
function inject(html, openTag, id, newInner) {
  const startM = '<!--SSR:' + id + '-->';
  const endM = '<!--/SSR:' + id + '-->';
  let cm = html.indexOf(startM);
  if (cm >= 0) {
    const em = html.indexOf(endM, cm);
    const before = html.slice(0, cm + startM.length);
    const after = html.slice(em);
    return before + '\n' + newInner + '\n' + after;
  }
  const ia = html.indexOf(openTag);
  if (ia < 0) throw new Error('open tag not found: ' + openTag);
  const at = ia + openTag.length;
  return html.slice(0, at) + '\n' + startM + '\n' + newInner + '\n' + endM + '\n' + html.slice(at);
}

// Inject `newInner` into the element matching `id="..."`, bracketed by
// invisible idempotent marker comments. Robust across arbitrary attributes.
function findMatchingClose(html, tag, from) {
  const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) depth--;
    else depth++;
    if (depth === 0) return m.index;
  }
  return -1;
}

/* Replace an element's children. Marker comments make a second run replace
 * only the previous prerender, even when the new HTML contains the same tag. */
function replaceInnerById(html, id, newInner) {
  const startM = '<!--SSR:' + id + '-->';
  const endM = '<!--/SSR:' + id + '-->';
  const cm = html.indexOf(startM);
  if (cm >= 0) {
    const em = html.indexOf(endM, cm);
    if (em < 0) throw new Error('unclosed SSR marker ' + id);
    return html.slice(0, cm) + startM + '\n' + newInner + '\n' + html.slice(em);
  }
  const re = new RegExp('<([a-zA-Z0-9]+)([^>]*\\bid=["\']' + id + '["\'][^>]*)>');
  const m = re.exec(html);
  if (!m) throw new Error('id not found: ' + id);
  const openEnd = m.index + m[0].length;
  const closeAt = findMatchingClose(html, m[1], openEnd);
  if (closeAt < 0) throw new Error('close not found: ' + id);
  return html.slice(0, openEnd) + '\n' + startM + '\n' + newInner + '\n' + endM + '\n' + html.slice(closeAt);
}

function injectById(html, id, newInner) {
  const startM = '<!--SSR:' + id + '-->';
  const endM = '<!--/SSR:' + id + '-->';
  let cm = html.indexOf(startM);
  if (cm >= 0) {
    const em = html.indexOf(endM, cm);
    if (em >= 0) {
      const before = html.slice(0, cm + startM.length);
      const after = html.slice(em);
      return before + '\n' + newInner + '\n' + after;
    }
  }
  const re = new RegExp('<([a-zA-Z0-9]+)[^>]*\\bid=["\']' + id + '["\'][^>]*>');
  const m = re.exec(html);
  if (!m) return html;
  const at = m.index + m[0].length;
  return html.slice(0, at) + '\n' + startM + '\n' + newInner + '\n' + endM + '\n' + html.slice(at);
}

// en-GB short date, e.g. "23 Aug 2026" — never emit "Invalid Date"
const fmt = (d) => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const dt = new Date(d + 'T12:00:00Z');
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' });
};
function webinarCta(w) {
  if (w.fmt === 'On-demand') return 'Watch replay →';
  if (w.fmt === 'Recurring') return 'View programme →';
  if (w.fmt === 'Live') return 'Register →';
  return 'View →';
}

/* ------------------------------------------------------------------ *
 * EVENTS
 * ------------------------------------------------------------------ */
function renderEvents(html) {
  const EVENTS = loadEvents();
  /* Same platform day as the page script. UTC+4, no DST. Status chips and the
     "Showing N upcoming events" line are both taken from this clock at build
     time, so a prerender cannot keep yesterday's "Live now". */
  const EVENTS_DAY_OFFSET_MS = 4*60*60*1000; // UTC+4, no DST
  const TODAY = (function () {
    var g = new Date(Date.now() + EVENTS_DAY_OFFSET_MS);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return g.getUTCFullYear() + '-' + p(g.getUTCMonth() + 1) + '-' + p(g.getUTCDate());
  })();
  const todayUTC = Date.parse(TODAY + 'T00:00:00Z');
  const now = new Date(TODAY + 'T00:00:00Z');

  /* Normal upcoming discovery. A record whose organiser calendar was checked and
     did not list it (REJECTED_NO_EVIDENCE) or that is still under research is not
     an upcoming event — it leaves this list rather than sitting in it with a
     warning nobody reads. */
  let list = EVENTS.filter((ev) => isUpcoming(ev, TODAY));
  list.sort((a, b) => String(a.s || a.start || '').localeCompare(String(b.s || b.start || '')));

  const relDays = (d) => Math.ceil((Date.parse(d+'T00:00:00Z') - todayUTC) / 86400000);
  /* Adapter over the canonical resolver. The old local copy re-implemented the
     rules and drifted: it treated a past end-date as COMPLETED even when the
     dates were never confirmed, and it had no notion of "this countdown is not
     allowed". Card labels stay as before; the STATE now comes from one place. */
  const CARD_LABEL = {
    CONFIRMED_UPCOMING: '', LIVE: '', COMPLETED: '',
    DATE_TBC: 'Date est.', VENUE_TBC: 'Venue TBC',
    MONITORING: 'Verify with organiser', POSTPONED: 'Postponed', CANCELLED: 'Cancelled',
  };
  const evState = (ev) => {
    const st = resolveStatus(ev, { today: TODAY });
    return { key: st.key, label: CARD_LABEL[st.key] === undefined ? st.label : CARD_LABEL[st.key], st: st };
  };
  const badgeHTML = (ev) => {
    const prov = eventBadge(ev);
    if (prov) return prov;
    const b = badgeText(ev);
    return b ? '<span class="badge-unc">' + esc(b) + '</span>' : '';
  };
  const travelable = (ev) => allowsCalendar(ev) && isTravelSafe(evState(ev).st);
  /* A relative chip is a CLAIM about when the event happens. It is therefore only
     permitted when the canonical resolver says the dates are confirmed. DATE_TBC,
     MONITORING, VENUE_TBC, POSTPONED, CANCELLED and COMPLETED get no countdown and
     can never say "Live now" — that combination was reaching production. */
  const relLabel = (ev) => {
    if (!allowsCalendar(ev)) return '';
    const key = evState(ev).key;
    // data-rel/data-rel-end let the client script recompute the badge against
    // today's date so it never goes stale between builds.
    const relAttr = ` data-rel="${esc(ev.s)}" data-rel-end="${esc(ev.e)}"`;
    if (key === 'LIVE') return `<span class="rel-today"${relAttr}>Live now</span>`;
    if (key !== 'CONFIRMED_UPCOMING') return '';
    const d = relDays(ev.s);
    if (d <= 0) return '';
    if (d === 1) return `<span class="rel-soon"${relAttr}>In 1 day</span>`;
    if (d <= 31) return `<span class="rel-soon"${relAttr}>In ${d} days</span>`;
    return '';
  };
  const icsHref = (ev) => (allowsCalendar(ev) && ev.id) ? ('events/ics/' + ev.id + '.ics') : '';

  // Up-Next strip (soonest 3) — pre-rendered so crawlers see it too
  /* The hero strip must consume the SAME canonical record as the full list, or the
     same event can show two different date-confidence states on one page. Only
     confirmed-date events are eligible for the strip at all, because every card in
     it carries a relative-time claim. */
  const upEligible = EVENTS.filter((ev) => {
    if (!isUpcoming(ev, TODAY)) return false;
    const st = evState(ev).st;
    return st.key === 'CONFIRMED_UPCOMING' || st.key === 'LIVE';
  });
  const up = upEligible.sort((a, b) => a.s.localeCompare(b.s)).slice(0, 3);
  const upNext = up.map((ev) => {
    const d = relDays(ev.s);
    const lbl = evState(ev).key === 'LIVE' ? 'Live now'
      : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days';
    // Absolute date is the primary, timezone-stable label; the relative badge is
    // recomputed client-side (data-rel="<start date>", data-rel-end="<end date>") so it can never go stale
    // between builds (a crawl can never see "Today" or "Live now" for a passed event).
    return `<div class="up-next-card"><span class="up-next-abs">${fmt(ev.s)} → ${fmt(ev.e)}</span><h3>${esc(ev.n)}</h3><span class="up-next-rel" data-rel="${esc(ev.s)}" data-rel-end="${esc(ev.e)}">${lbl}</span><div class="venue">📍 ${esc(ev.v)} — ${esc(ev.c)}, ${esc(ev.co)}</div><a class="btn btn-amber btn-sm" href="${esc(ev.u)}" target="_blank" rel="noopener">View →</a> <a class="btn btn-outline btn-sm" href="${esc('map.html?layer=events&q=' + encodeURIComponent(ev.n))}">View on map</a></div>`;
  }).join('\n');

  const cards = list.map((ev) => {
    const soon = allowsCalendar(ev) && ev.s && new Date(ev.s) > now && (new Date(ev.s) - now) / 86400000 <= 31;
    const trav = travelable(ev);
    const dateLbl = dateLine(ev);
    const venueLbl = `${esc(ev.v) || 'Not yet published by organiser'} — ${esc(ev.c) || 'Not yet published by organiser'}, ${esc(ev.co)}`;
    return `<div class="intel-item event-card" data-start="${esc(ev.s)}" data-end="${esc(ev.e)}">
      <h3>${esc(ev.n)}${soon ? '<span class="badge-soon">Soon</span>' : ''}${badgeHTML(ev)}</h3>
      <div class="dates">${dateLbl}${relLabel(ev)}</div>
      <div class="venue">📍 ${venueLbl}${esc(ev.r) ? ' · ' + esc(ev.r) : ''}</div>
      <p style="color:var(--muted); font-size:.92rem; margin-bottom:10px">${esc(ev.d)}</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        ${ev.u ? `<a class="btn btn-amber btn-sm" href="${esc(ev.u)}" target="_blank" rel="noopener">Official site →</a>` : '<span>Official site: Not yet published by organiser</span>'}
        ${eventHref(ev, { fallbackListing: false }) ? `<a class="btn btn-outline btn-sm" href="${esc(eventHref(ev, { fallbackListing: false }))}">Event page →</a>` : ''}
        <a class="btn btn-outline btn-sm" href="${esc('map.html?layer=events&q=' + encodeURIComponent(ev.n))}">View on map</a>
        ${trav ? tpAff.calendarLinks({ slug: resolveEventSlug(ev.n) || ev.n, city: ev.c, checkIn: ev.s, checkOut: ev.e, disclosureHref: 'affiliate-disclosure.html' }) : ''}
        ${icsHref(ev) ? `<a class="btn btn-outline btn-sm" data-aff="calendar" data-ev="${esc(ev.n)}" href="${esc(icsHref(ev))}">📅 Add</a>` : ''}
      </div>
    </div>`;
  }).join('\n');

  html = inject(html, '<div id="grid">', 'events-grid', cards);
  html = inject(html, '<div id="upNext" class="up-next" aria-label="Upcoming events">', 'events-upnext', upNext);
  const depthConfirmed = EVENTS.filter((ev) => ev.date_status === 'CONFIRMED' && ev.source_url && ev.source_checked_at && ev.end && ev.end >= TODAY).length;
  const depthProjected = EVENTS.filter((ev) => ev.date_status === 'PROJECTED' && (!ev.end || ev.end >= TODAY)).length;
  const depthCountries = new Set(EVENTS.filter((ev) => {
    if (ev.research_status === 'REJECTED_NO_EVIDENCE' || ev.date_status === 'CANCELLED') return false;
    if (!isDiscoverable(resolveStatus(ev, { today: TODAY }))) return false;
    if (!ev.country) return false;
    if (!ev.end) return ev.date_status === 'TBA' || ev.date_status === 'PROJECTED';
    return ev.end >= TODAY;
  }).map((ev) => ev.country)).size;
  const depthOther = list.length - depthConfirmed - depthProjected;
  const countText = 'Showing ' + list.length + ' upcoming events. ' +
    depthConfirmed + ' upcoming confirmed · ' + depthProjected + ' projected' +
    (depthOther > 0 ? ' · ' + depthOther + ' dates not confirmed' : '') +
    ' · ' + depthCountries + ' countries hosting';
  html = inject(html, '<p style="text-align:center; color:var(--muted); font-size:.88rem" id="count">', 'events-count',
    countText);

  // Dynamically generate JSON-LD schema with only future, discoverable, scheduled events
  const jsonLdEvents = list
    .filter((ev) => allowsCalendar(ev) && ev.end >= TODAY)
    .slice(0, 60)
    .map((ev) => ({
      '@type': 'Event',
      name: ev.n,
      startDate: ev.s,
      endDate: ev.e,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: ev.v,
        address: {
          '@type': 'PostalAddress',
          addressLocality: ev.c,
          addressCountry: ev.co,
        },
      },
      url: ev.u,
    }));

  const jsonLdScript = `<script type="application/ld+json" id="events-ld">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonLdEvents }, null, 2)}\n</script>`;
  html = html.replace(/<script type="application\/ld\+json" id="events-ld">[\s\S]*?<\/script>/, jsonLdScript);

  // Synchronize client-side EVENTS array and event-page slug map
  html = html.replace(/const EVENT_PAGES\s*=\s*\{[\s\S]*?\};/m, 'const EVENT_PAGES = ' + JSON.stringify(eventPageMap()) + ';');
  html = html.replace(/const EVENTS\s*=\s*\[[\s\S]*?\];/m, 'const EVENTS = ' + JSON.stringify(EVENTS) + ';');

  const past = EVENTS.filter((ev) => ev.end && ev.end < TODAY && ev.research_status !== 'REJECTED_NO_EVIDENCE').slice(-30).reverse();
  const pastHtml = past.map((ev) => '<div class="intel-item event-card"><h3>' + esc(ev.n) + ' <span class="badge-unc">Completed</span></h3><div class="dates">' + esc(dateLine(ev)) + '</div><div class="venue">' + esc(ev.v || 'Not yet published by organiser') + '</div></div>').join('\n');
  html = injectById(html, 'pastGrid', pastHtml);

  return { page: html, records: list.length };
}

/* ------------------------------------------------------------------ *
 * WEBINARS
 * ------------------------------------------------------------------ */
function renderWebinars(html) {
  const WEBINARS = extractConst(html, 'WEBINARS');
  const now = new Date(new Date().toDateString());
  const TYPE_LABEL = { OEM: 'Manufacturer', Supplier: 'Supplier', Institute: 'Institute / Media' };

  let list = WEBINARS.filter((w) => !w.date || (/^\d{4}-\d{2}-\d{2}$/.test(w.date) && new Date(w.date + 'T23:59:59') >= now));
  list.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return (a.n || '').localeCompare(b.n || '');
  });

  const cards = list.map((w) => {
    const soon = w.date && new Date(w.date + 'T00:00:00') > now && (new Date(w.date + 'T00:00:00') - now) / 86400000 <= 31;
    const dateLine = w.date
      ? `<div class="dates">🗓️ ${fmt(w.date)} · Live session · timezone on organiser page</div>`
      : `<div class="dates">${w.fmt === 'On-demand' ? '▶ On-demand / replay' : w.fmt === 'Recurring' ? '🔁 Recurring series' : '● Live program'}</div>`;
    const langTags = (w.lang || []).map((l) => `<span class="tag tag-lang">${esc(l)}</span>`).join('');
    return `<div class="intel-item webinar-card">
      <h3>${esc(w.n)}${soon ? '<span class="badge-soon">Soon</span>' : ''}</h3>
      ${dateLine}
      <div class="meta">
        <span class="tag tag-${(w.t || '').toLowerCase()}">${esc(TYPE_LABEL[w.t] || w.t)}</span>
        <span class="tag tag-fmt">${esc(w.fmt)}</span>
        ${langTags}
        <span style="color:var(--muted)">· ${esc(w.r)}</span>
      </div>
      <p style="color:var(--muted); font-size:.92rem; margin-bottom:10px">${esc(w.d)}</p>
      <a class="btn btn-amber btn-sm" href="${esc(w.u)}" target="_blank" rel="noopener">${webinarCta(w)}</a>
    </div>`;
  }).join('\n');

  html = inject(html, '<div id="grid">', 'webinars-grid', cards);
  html = inject(html, '<p style="text-align:center; color:var(--muted); font-size:.88rem" id="count">', 'webinars-count',
    `Showing ${list.length} webinar programs & sessions`);
  return { page: html, records: list.length };
}

/* ------------------------------------------------------------------ *
 * COMPONENTS
 * ------------------------------------------------------------------ */
function renderComponents(html) {
  const COMPONENTS = extractConst(html, 'COMPONENTS');
  const keys = Object.keys(COMPONENTS);
  let htmlStr = '';
  keys.forEach((c) => {
    COMPONENTS[c].forEach(([n, d]) => {
      htmlStr += `<div class="card"><span style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--accent)">${esc(c)}</span><h3 style="margin:6px 0 6px">${esc(n)}</h3><p>${esc(d)}</p><p style="margin-top:10px;font-size:.83rem"><a href="rfq.html" style="color:var(--accent);font-weight:700">Request quotes →</a></p></div>`;
    });
  });
  const grid = htmlStr || '<p style="grid-column:1/-1;text-align:center;color:var(--muted)">No components match.</p>';
  html = inject(html, '<div id="compGrid" class="grid grid-3">', 'components-grid', grid);
  let count = 0;
  keys.forEach((c) => { count += COMPONENTS[c].length; });
  return { page: html, records: count };
}

/* ------------------------------------------------------------------ *
 * JOBS
 * ------------------------------------------------------------------ */
function renderJobs(html) {
  const jobBoard = require('./lib/job-board');
  const DATA = extractConst(html, 'DATA');
  const FN = extractConst(html, 'FN');
  const FN_CLASS = extractConst(html, 'FN_CLASS');
  let published = [];
  try {
    published = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/job-postings.json'), 'utf8')).published || [];
  } catch (e) { published = []; }
  const live = jobBoard.publicOpenings(published).map(function (row) { return jobBoard.displayRow(row); });

  const liveGrid = (live.length ? live.map((j) =>
    `<div class="live-row${j.featured ? ' is-featured' : ''}">
     <span class="lt">${j.featured ? '<span class="job-featured" data-job-featured="1">FEATURED</span> ' : ''}${esc(j.t)}</span>
     <span class="lc">${esc(j.co)}</span>
     <span class="ll">📍 ${esc(j.loc)}</span>
     <span class="ld">${esc(j.fn)} · verified ${esc(j.last_verified_at)}</span>
     <a class="lapply" href="${esc(j.posting_url)}" target="_blank" rel="noopener">Apply →</a>
     ${j.featured ? '<p class="job-featured-note">' + esc(j.featured_note) + '</p>' : ''}
   </div>`).join('\n') : '<p class="jobs-empty">0 live openings.</p>');

  // default view of the employer board (no search / country / function filter)
  const groups = {};
  DATA.forEach((d) => { (groups[d.country] = groups[d.country] || []).push(d); });
  const order = Object.keys(groups).sort();
  const board = order.map((country) => {
    const items = groups[country];
    return `<div class="country-h">${esc(items[0].flag)} ${esc(country)}</div>` + items.map((d) =>
      `<div class="emp-card">
        <div class="emp-head">
          <div><h3>${esc(d.co)}</h3><div class="hq">📍 ${esc(d.hq)}</div></div>
          <a class="btn btn-amber btn-sm" href="${esc(d.url)}" target="_blank" rel="noopener">Careers →</a>
        </div>
        <div>${(d.fn || []).map((x) => `<span class="fn-pill ${FN_CLASS[x]}">${esc(FN[x].split(' ')[0])}</span>`).join('')}</div>
        <ul>${(d.roles || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </div>`).join('');
  }).join('\n');

  const companies = new Set(DATA.map((d) => d.co + '|' + d.country)).size;
  const countries = new Set(DATA.map((d) => d.country)).size;
  const roles = DATA.reduce((s, d) => s + (d.roles ? d.roles.length : 0), 0);
  const stats =
    `<div class="s"><b>${live.length}</b><small>Live openings</small></div>
     <div class="s"><b>${companies}</b><small>Employers</small></div>
     <div class="s"><b>${countries}</b><small>Countries</small></div>
     <div class="s"><b>${roles}</b><small>typical role types listed by employers</small></div>`;

  html = inject(html, '<div id="liveBoard">', 'jobs-live', liveGrid);
  html = inject(html, '<div id="board">', 'jobs-board', board);
  html = inject(html, '<div class="stat-row" id="statRow">', 'jobs-stats', stats);
  html = inject(html, 'id="count">', 'jobs-count', `Showing ${DATA.length} employers across ${order.length} countries`);
  return { page: html, records: DATA.length + live.length };
}

/* ------------------------------------------------------------------ *
 * GRIDS  (data tables + country board + stats; the SVG map stays JS)
 * ------------------------------------------------------------------ */
function renderGrids(html) {
  const SYNC_AREAS = extractConst(html, 'SYNC_AREAS');
  const INTERCONNECTORS = extractConst(html, 'INTERCONNECTORS');
  const GREEN_H2 = extractConst(html, 'GREEN_H2');
  const OFFSHORE_HVDC = extractConst(html, 'OFFSHORE_HVDC');
  const GRID_CAPEX = extractConst(html, 'GRID_CAPEX');
  const DATA = extractConst(html, 'DATA');
  const LAST_VERIFIED = extractConst(html, 'LAST_VERIFIED');
  const gridDates = require('./lib/grid-record-dates');
  const GRID_DATES = gridDates.load();
  if (String(LAST_VERIFIED) !== GRID_DATES.census_verified) {
    throw new Error('grids.html LAST_VERIFIED ' + LAST_VERIFIED + ' does not match census_verified ' + GRID_DATES.census_verified);
  }

  const icClass = (s) => {
    if (/operational|trial|energized/i.test(s)) return 'st-op';
    if (/construction|commissioning/i.test(s)) return 'st-con';
    if (/paused|shelved|delayed/i.test(s)) return 'st-hold';
    if (/study|framework|planning/i.test(s)) return 'st-study';
    return 'st-plan';
  };

  const syncRows = SYNC_AREAS.map((s) =>
    `<tr><td>${esc(s[0])}</td><td style="color:var(--muted)">${esc(s[1])}</td><td>${esc(s[2])}</td></tr>`).join('\n');

  const projRows = (arr) => arr.map((p) =>
    `<tr><td>${esc(p[0])}<span class="rt">${esc(p[1])} — ${esc(p[5])}</span></td><td style="color:var(--muted)">${esc(p[2])}</td><td class="kv">${esc(p[3])}</td><td><span class="badge ${icClass(p[4])}">${esc(p[4])}</span></td></tr>`).join('\n');

  const capexRows = GRID_CAPEX.map((p) =>
    `<tr><td>${esc(p[0])}<span class="rt">${esc(p[1])} — ${esc(p[5])}</span></td><td style="color:var(--muted)">${esc(p[2])}</td><td class="kv">${esc(p[3])}</td><td><span class="badge st-plan">${esc(p[4])}</span></td></tr>`).join('\n');

  function projChips(c) {
    const ic = INTERCONNECTORS.filter((p) => (p[1] || '').includes(c.flag)).length;
    const off = OFFSHORE_HVDC.filter((p) => (p[1] || '').includes(c.flag)).length;
    const h2 = GREEN_H2.filter((p) => (p[1] || '').includes(c.flag)).length;
    const cx = GRID_CAPEX.filter((p) => (p[1] || '').includes(c.flag)).length;
    const parts = [];
    if (ic) parts.push('⚡ ' + ic + ' interconnector project' + (ic > 1 ? 's' : ''));
    if (off) parts.push('🌊 ' + off + ' offshore HVDC programme' + (off > 1 ? 's' : ''));
    if (h2) parts.push('💧 ' + h2 + ' green H₂ project' + (h2 > 1 ? 's' : ''));
    if (cx) parts.push('💰 grid CAPEX programme');
    return parts.length ? `<div class="proj-links">${parts.join(' · ')}</div>` : '';
  }

  const regions = [...new Set(DATA.map((c) => c.region))];
  const groups = {};
  DATA.forEach((c) => { (groups[c.region] = groups[c.region] || []).push(c); });

  const board = regions.filter((rg) => groups[rg]).map((region) =>
    `<div class="region-h">${esc(region)}</div>` + groups[region].map((c) =>
      `<div class="country-card">
        <div class="country-head">
          <span class="flag">${esc(c.flag)}</span><h3><a href="/grids/${esc(countrySlug(c.country))}/" style="color:inherit;text-decoration:none">${esc(c.country)}</a></h3>
          <span class="badge b-freq">${esc(c.freq)} Hz</span>
          <span class="badge b-sync">${esc(c.sync)}</span>
          <span class="badge b-cnt">${c.grids.length} operator${c.grids.length > 1 ? 's' : ''}</span>
        </div>
        ${(c.grids || []).map((g) => `<div class="grid-row"><b>${esc(g[0])}</b><span style="color:var(--muted)">${esc(g[1])} <span class="op-updated">${esc(gridDates.operatorLabel(g[0], GRID_DATES))}</span></span><span class="kv">${esc(g[2])}</span>${g[3] ? `<a href="${esc(g[3])}" target="_blank" rel="noopener">Site →</a>` : '<span></span>'}</div>`).join('')}${projChips(c)}
      </div>`).join('')).join('\n');

  const ops = DATA.reduce((s, c) => s + c.grids.length, 0);
  const regs = new Set(DATA.map((c) => c.region)).size;
  const stats =
    `<div class="s"><b>${DATA.length}</b><small>Countries</small></div>
     <div class="s"><b>${ops}</b><small>Operators &amp; utilities</small></div>
     <div class="s"><b>${regs}</b><small>Regions</small></div>
     <div class="s"><b>${SYNC_AREAS.length}</b><small>Synchronous areas</small></div>
     <div class="s"><b>${INTERCONNECTORS.length}</b><small>Interconnector projects</small></div>
     <div class="s"><b>${GREEN_H2.length}</b><small>Green H₂ projects</small></div>
     <div class="s"><b>${OFFSHORE_HVDC.length}</b><small>Offshore HVDC programs</small></div>
     <div class="s"><b>${GRID_CAPEX.length}</b><small>CAPEX plans</small></div>`;

  html = inject(html, '<tbody id="syncBody">', 'grids-sync', syncRows);
  html = inject(html, '<tbody id="icBody">', 'grids-ic', projRows(INTERCONNECTORS));
  html = inject(html, '<tbody id="offBody">', 'grids-off', projRows(OFFSHORE_HVDC));
  html = inject(html, '<tbody id="capexBody">', 'grids-capex', capexRows);
  html = inject(html, '<div id="board">', 'grids-board', board);
  html = inject(html, '<div class="stat-row" id="statRow">', 'grids-stats', stats);
  html = inject(html, 'id="lvLine">', 'grids-lv',
    `${esc(gridDates.censusLabel(GRID_DATES))}. Each operator row shows that operator record's own updated date. Sources: official utility, operator &amp; regulator filings. Report a <a href=\"mailto:hello@transformerpath.com?subject=Grid%20census%20correction\" style=\"color:var(--accent);font-weight:600\">correction</a>.`);
  return { page: html, records: DATA.length };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 * MANUFACTURERS — the 519-maker census lives in data/manufacturers.json
 * (86 country groups) and is fetched client-side today, leaving the
 * #board empty for crawlers. Replicate the default render into the HTML.
 * ------------------------------------------------------------------ */
function renderManufacturers(html) {
  const DATA = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'))
    .filter((c) => c.makers.some((m) => !/^Served by/i.test(m[0])));
  const TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));
  const TNAME = { PT: 'Power', DT: 'Distribution', DRY: 'Dry/Cast' };
  const regions = [...new Set(DATA.map((c) => c.region))];
  // Manufacturer -> company entity page slug (for the directory -> entity link graph).
  const { censusNameKey, directoryCompanySlug, aliasRowHidden, ownedProfileSlugs } = require('./lib/company-aliases');
  let CSMAP = {};
  try { JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (c) { CSMAP[censusNameKey(c.name)] = c.slug; }); } catch (e) {}
  const csl = (m) => CSMAP[censusNameKey(m[0])];
  const paidListings = require('./lib/paid-listings');
  const claimListing = require('./lib/claim-listing');
  const eventBadges = require('./event-badges');
  const availability = require('./lib/availability');
  const availabilityBySlug = availability.load();
  const declaredOrigin = require('./lib/declared-origin');
  const ORIGIN = declaredOrigin.bySlug(declaredOrigin.load());
  const paidDoc = paidListings.load();
  const paySlug = (name) => directoryCompanySlug(name, CSMAP);
  const vbadge = (m, slug) => {
    if (m[4] === 'P') return '<span class="v-badge pro">★ Supplier Pro</span>';
    if (slug && paidListings.isVerifiedManufacturer(slug, paidDoc)) {
      return '<span class="v-badge" data-paid-badge="verified-manufacturer" data-company-slug="' + paidListings.esc(slug) + '">✓ Verified</span>';
    }
    return '';
  };
  const verifyCtas = (name, slug) => {
    const claim = claimListing.linkHtml(slug);
    const paid = (!slug || paidListings.isVerifiedManufacturer(slug, paidDoc))
      ? ''
      : paidListings.verifiedManufacturerCtasHtml({ companySlug: slug, trackName: name, compact: true });
    if (!paid) {
      return '<div class="mfr-verify-ctas" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:100%;min-width:0">' + claim + '</div>';
    }
    return paid.replace(/(<div class="mfr-verify-ctas"[^>]*>)/, '$1' + claim);
  };
  const tpills = (types) => { if (!types) return ''; return types.split(',').map((t) => t.trim()).filter(Boolean).map((t) => `<span class="tpill t-${t}">${esc(TNAME[t] || t)}</span>`).join(''); };
  const ownedProfiles = ownedProfileSlugs(DATA, CSMAP);
  const visibleMakers = (list) => (list || []).filter((m) => !aliasRowHidden(m[0], CSMAP, ownedProfiles));
  const groups = {};
  DATA.forEach((c) => { (groups[c.region] = groups[c.region] || []).push(c); });

  // Neutral alphabetical ordering (lib/directory-sort): manufacturers within a
  // country by canonical sort_name (locale-aware, case-insensitive, leading
  // article dropped), and countries within a region alphabetically. NEVER by
  // verification/paid status, completeness, or data/insertion order.
  const { sortName, naturalCompare, compareCountries } = require('./lib/directory-sort');
  DATA.forEach((c) => { c.makers = c.makers.slice().sort((a, b) => naturalCompare(sortName(a[0]), sortName(b[0]))); });
  Object.keys(groups).forEach((rg) => { groups[rg].sort((a, b) => compareCountries(a.country, b.country)); });

  const board = regions.filter((rg) => groups[rg]).map((region) =>
    `<div class="region-h">${esc(region)}</div>` + groups[region].map((c) => {
      const shown = visibleMakers(c.makers);
      const real = shown.filter((m) => !/^Served by/i.test(m[0])).length;
      return `<div class="ctry-card"><div class="ctry-head"><span class="flag">${esc(c.flag)}</span><h3>${esc(c.country)}</h3><span class="cnt">${real} maker${real !== 1 ? 's' : ''}</span></div>` +
        shown.map((m) => /^Served by/i.test(m[0])
          ? `<div class="mk-row"><span class="note">${esc(m[0])}</span></div>`
          : (function () {
            const slug = paySlug(m[0]);
            const flag = availability.forSlug(slug, availabilityBySlug);
            const nameInner = csl(m) ? `<a class="prof" href="manufacturers/${csl(m)}/" style="color:var(--accent);font-weight:700">${esc(m[0])}</a>` : `<b>${esc(m[0])}</b>`;
            const badges = eventBadges.htmlFor({ slug: slug, name: m[0] });
            return `<div class="mk-row"><span class="mk-name">${nameInner}${badges}</span>${vbadge(m, slug)}${flag ? availability.markHtml(flag, slug) : ''}${tpills(m[3])}<span class="city">${esc(m[1] || '')}${m[5] ? ` · est. ${esc(m[5])}` : ''}</span>${declaredOrigin.listingHtml(ORIGIN[slug] || null)}${m[2] ? `<a href="${esc(m[2])}" target="_blank" rel="noopener">Site →</a>` : '<span></span>'}${verifyCtas(m[0], slug)}</div>`;
          })()).join('') +
        `</div>`;
    }).join('')).join('');

  const censusMakers = DATA.reduce((s, c) => s + c.makers.filter((m) => !/^Served by/i.test(m[0])).length, 0);
  const makers = DATA.reduce((s, c) => s + visibleMakers(c.makers).filter((m) => !/^Served by/i.test(m[0])).length, 0);
  if (makers !== censusMakers) console.log('NOTE directory render collapsed ' + (censusMakers - makers) + ' plant-alias rows (' + censusMakers + ' -> ' + makers + ')');
  if (makers < 400) { console.warn('!! manufacturer census unexpectedly small ('+makers+'); check data/manufacturers.json'); }
  let completeness = 54;
  try {
    const siteStats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
    if (typeof siteStats.dataCompleteness === 'number') completeness = siteStats.dataCompleteness;
  } catch (e) {}
  const stats = `<div class="s"><b>${makers}</b><small>Companies</small></div>
     <div class="s"><b>${DATA.length}</b><small>Countries</small></div>
     <div class="s"><b>${new Set(DATA.map((c) => c.region)).size}</b><small>Regions</small></div>
     <div class="s"><b>${completeness}%</b><small>Data completeness</small></div>`;

  html = inject(html, '<div id="board">', 'mfg-board', board);
  html = html.replace(/<script type="application\/json" id="tp-event-badges-data">[\s\S]*?<\/script>\s*<script src="\/event-badges\.js"><\/script>\s*/, '');
  html = html.replace('<script>\nconst DATA_URL', eventBadges.mountHtml() + '<script>\nconst DATA_URL');
  html = inject(html, '<p style="color:var(--muted); font-size:.85rem; margin-bottom:14px" id="count">', 'mfg-count',
    `Showing ${makers} companies across ${DATA.length} countries`);
  html = inject(html, '<div class="stat-row" id="statRow">', 'mfg-stats', stats);

  // Quick-jump "By country" bar — regenerated from the census so it is
  // ALPHABETICAL and carries each country's canonical count: "USA (41) · …".
  // (Replaces the hand-maintained bare-name list.)
  const jump = DATA.slice().sort((a, b) => compareCountries(a.country, b.country)).map((c) => {
    const slug = c.country.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const n = c.makers.filter((m) => !/^Served by/i.test(m[0])).length;
    return `<a href="manufacturers/${slug}.html" style="color:var(--accent)">${esc(c.country)} (${n})</a>`;
  }).join(' | ');
  html = html.replace(/<p style="font-size:\.8rem;line-height:1\.9">[\s\S]*?<\/p>/, '<p style="font-size:.8rem;line-height:1.9">' + jump + '</p>');

  // Dataset size is the public company count (plant-alias rows stay off this page).
  html = html.replace(/("size"\s*:\s*)\d+/g, '$1' + makers);

  const aliasMap = require('./lib/company-aliases').ALIASES;
  const aliasSlugs = {};
  Object.keys(aliasMap).forEach(function (key) { aliasSlugs[key] = aliasMap[key].slug; });
  const earnedSlugs = [];
  (paidDoc.listings || []).forEach(function (row) {
    if (paidListings.reviewed(row) && row.product === 'verified_manufacturer' && row.company_slug) {
      earnedSlugs.push(String(row.company_slug).trim().toLowerCase());
    }
  });
  html = html.replace(/const VERIFIED_MANUFACTURER_PAY_URL = [^;]*;/, 'const VERIFIED_MANUFACTURER_PAY_URL = ' + JSON.stringify(paidListings.VERIFIED_MANUFACTURER_PAYMENT_LINK) + ';');
  html = html.replace(/const AVAILABILITY = [^;]*;/, 'const AVAILABILITY = ' + JSON.stringify(availabilityBySlug) + ';');
  html = html.replace(/const EARNED_VERIFIED_SLUGS = [^;]*;/, 'const EARNED_VERIFIED_SLUGS = ' + JSON.stringify(earnedSlugs) + ';');
  html = html.replace(/const MAKER_ALIAS = [^;]*;/, 'const MAKER_ALIAS = ' + JSON.stringify(aliasSlugs) + ';');

  const featuredSlot = paidListings.featuredListingSlotHtml({ scope: 'directory', doc: paidDoc });
  const featuredRe = /<section class="tp-featured-slot" data-featured-slot="directory"[\s\S]*?<\/section>/;
  if (featuredRe.test(html)) html = html.replace(featuredRe, featuredSlot);
  else html = html.replace('<div id="board">', featuredSlot + '\n<div id="board">');

  return { page: html, records: makers };
}

/* ------------------------------------------------------------------ *
 * INTEL — daily market intelligence feed & archive editions.
 * Pre-renders embedded constants into static HTML containers so
 * search engine crawlers and preview scrapers see the content.
 * ------------------------------------------------------------------ */
function renderIntel(html) {
  let records = 0;
  const CLASSIFY = {
    CONFIRMED: { help: 'Event confirmed.' },
    INFERRED:  { help: 'Opportunity reasonably inferred from the source.' },
    PIPELINE:  { help: 'Planned / tender / pre-award stage.' },
    SUPPORTED: { help: 'Supported evidence — not yet fully verified. No live portal adapter has confirmed this item.' },
    WATCH:     { help: 'Early signal; monitor for confirmation.' },
  };
  function tag(items, base) {
    return (items || []).map(function(it) { return (it && !it.cls) ? Object.assign({}, it, { cls: base }) : it; });
  }
  function card(it) {
    const langCode = (it.lang && it.lang !== 'en') ? String(it.lang).toUpperCase() : '';
    const langBadge = langCode ? `<span class="lang-badge" title="Source language: ${esc(langCode)}.">${esc(langCode)}</span>` : '';
    const cls = it.cls && CLASSIFY[it.cls] ? `<span class="cls-badge cls-${esc(it.cls)}" title="${esc(CLASSIFY[it.cls].help)}">${esc(it.cls)}</span>` : '';
    const ev = (it.evidence_grade && it.evidence_grade !== 'CONFIRMED' && it.evidence_grade !== it.cls && CLASSIFY[it.evidence_grade])
      ? `<span class="cls-badge cls-${esc(it.evidence_grade)}" title="${esc(CLASSIFY[it.evidence_grade].help)}">${esc(it.evidence_grade)}</span>` : '';
    const newBadge = it.isNew ? '<span class="new-badge">NEW</span>' : '';
    const badges = [langBadge, cls, ev, newBadge].filter(Boolean).join(' ');
    const val = it.value ? `<span class="val">${esc(it.value)}</span> · ` : '';
    const src = it.src ? `<span class="src">${esc(it.src)}</span>` : '';
    const url = it.url || '#';
    return `<div class="card">
      <div class="card-title"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(it.title)}</a> ${badges}</div>
      <div class="card-snippet">${esc(it.snippet)}</div>
      <div class="card-meta">${val}${src}<a class="tp-li-share-inline" data-linkedin-share data-url="${esc(url)}" href="#" rel="noopener" title="Share this item on LinkedIn">LinkedIn</a></div>
    </div>`;
  }

  // 1. Generation 2 (tabs & panels: intel.html and 13 dated editions)
  if (html.includes('id="panel-news"')) {
    // Live intel.html: build-intel-feed-ui.js owns the timeline (age, relevance,
    // and the shared provenance badge). Replacing it here drops that markup.
    if (html.includes('<!--SSR:intel-timeline-->')) {
      /* leave the richer SSR in place */
    } else if (html.includes('id="intel-timeline"') && fs.existsSync('data/intel-feed-ui.json')) {
      try {
        const feed = JSON.parse(fs.readFileSync('data/intel-feed-ui.json', 'utf8'));
        const first = (feed.posts || []).filter(function (p) {
          return p.desk === 'news' || p.desk === 'grid' || p.desk === 'awards';
        }).slice(0, 12);
        const cards = first.map(function (p) {
          const href = p.url || ('intel.html#p-' + p.id);
          return '<article class="intel-post" id="p-' + esc(p.id) + '">' +
            '<div class="intel-avatar" aria-hidden="true">TP</div><div class="intel-body">' +
            '<div class="intel-byline"><strong>TransformerPath</strong><span class="intel-date">' +
            esc(p.date || 'Date not stated') + '</span></div>' +
            '<h3 class="intel-headline"><a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(p.headline) + '</a></h3>' +
            (p.soWhat ? '<p class="intel-sowhat">' + esc(p.soWhat) + '</p>' : '') +
            (p.evidenceNote ? '<p class="intel-evidence-note" style="font-size:.76rem;color:#f0c14a;margin:6px 0 0">' + esc(p.evidenceNote) + '</p>' : '') +
            '<div class="intel-meta">' +
            [
              (p.cls ? '<span class="cls-badge cls-' + esc(p.cls) + '">' + esc(p.cls) + '</span>' : ''),
              ((p.evidenceGrade && p.evidenceGrade !== 'CONFIRMED' && p.evidenceGrade !== p.cls)
                ? '<span class="cls-badge cls-' + esc(p.evidenceGrade) + '" title="Supported evidence — not yet fully verified. No live portal adapter has confirmed this item.">' + esc(p.evidenceGrade) + '</span>'
                : ''),
              (intelBadge(p) || '')
            ].filter(Boolean).join(' ') +
            '<span class="intel-region">' + esc(p.region || '') + '</span>' +
            '<span class="src">' + esc(p.sourceName || p.src || '') + '</span></div></div></article>';
        }).join('');
        html = injectById(html, 'intel-timeline', cards);
        records += first.length;
        html = injectById(html, 'panel-news',
          '<p class="intel-legacy-note">Full regional dump loads from curated NEWS when you open this desk. The timeline is the briefing.</p>');
      } catch (e) { /* fall through to NEWS dump */ }
    } else {
    // NEWS
    try {
      const NEWS = extractConst(html, 'NEWS');
      if (NEWS) {
        const order = ['GCC', 'India', 'Europe', 'USA', 'RoW'];
        const keys = order.filter(k => NEWS[k]).concat(Object.keys(NEWS).filter(k => !order.includes(k)));
        let newsHtml = '';
        for (const k of keys) {
          const r = NEWS[k];
          if (!r || !r.items || !r.items.length) continue;
          records += r.items.length;
          newsHtml += `<div class="region-h">${esc(r.label || k)}</div>` + tag(r.items, 'INFERRED').map(card).join('');
        }
        html = injectById(html, 'panel-news', newsHtml);
      }
    } catch (e) { /* ignore */ }
    }

    // GRID_NEWS
    try {
      const GRID_NEWS = extractConst(html, 'GRID_NEWS');
      if (GRID_NEWS) {
        const order = ['GCC', 'India', 'Europe', 'USA', 'China', 'AsiaPac', 'LatAm', 'Africa'];
        const keys = order.filter(k => GRID_NEWS[k]).concat(Object.keys(GRID_NEWS).filter(k => !order.includes(k)));
        let gridHtml = '';
        for (const k of keys) {
          const r = GRID_NEWS[k];
          if (!r || !r.items || !r.items.length) continue;
          records += r.items.length;
          gridHtml += `<div class="region-h">${esc(r.label || k)}</div>` + tag(r.items, 'CONFIRMED').map(card).join('');
        }
        html = injectById(html, 'panel-grid', gridHtml);
      }
    } catch (e) { /* ignore */ }

    // REPAIR_NEWS
    try {
      const REPAIR_NEWS = extractConst(html, 'REPAIR_NEWS');
      if (Array.isArray(REPAIR_NEWS)) {
        records += REPAIR_NEWS.length;
        const repHtml = `<div class="region-h">Transformer Service &amp; Repair Demand</div>` + tag(REPAIR_NEWS, 'WATCH').map(card).join('');
        html = injectById(html, 'panel-repair', repHtml);
      }
    } catch (e) { /* ignore */ }

    // FACTORIES
    try {
      const FACTORIES = extractConst(html, 'FACTORIES');
      if (Array.isArray(FACTORIES)) {
        records += FACTORIES.length;
        const rows = FACTORIES.map(f => `<tr>
          <td><span class="dot ${esc(f.color || '')}"></span><strong>${esc(f.name)}</strong></td>
          <td>${esc(f.loc || '')}</td><td>${esc(f.backer || '')}</td><td>${esc(f.cap || '')}</td>
          <td>${esc(f.status || '')}</td><td><a class="plain" href="${esc(f.src || '#')}" target="_blank" rel="noopener">source</a></td></tr>`).join('');
        const facHtml = `<div class="region-h">New / Expanding Transformer Factories</div>
          <div class="table-wrap"><table class="factory-grid"><thead><tr><th scope="col">Project</th><th scope="col">Location</th><th scope="col">Backer</th><th scope="col">Capability</th><th scope="col">Status</th><th scope="col">Src</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        html = injectById(html, 'panel-factories', facHtml);
      }
    } catch (e) { /* ignore */ }

    // PIPELINE
    try {
      const PIPELINE = extractConst(html, 'PIPELINE');
      if (Array.isArray(PIPELINE)) {
        records += PIPELINE.length;
        const rows = PIPELINE.map(p => `<tr>
          <td><strong>${esc(p.project)}</strong></td><td>${esc(p.buyer || '')}</td><td>${esc(p.scope || '')}</td>
          <td>${esc(p.expected || '')}</td><td>${esc(p.status || '')}</td>
          <td><a class="plain" href="${esc(p.url || '#')}" target="_blank" rel="noopener">${esc(p.src || 'source')}</a></td></tr>`).join('');
        const pipHtml = `<div class="region-h">Pre-Award Pipeline — tenders &amp; expected awards to chase</div>
          <div class="table-wrap"><table class="factory-grid"><thead><tr><th scope="col">Project</th><th scope="col">Buyer</th><th scope="col">Scope</th><th scope="col">Expected</th><th scope="col">Status</th><th scope="col">Src</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        html = injectById(html, 'panel-pipeline', pipHtml);
      }
    } catch (e) { /* ignore */ }

    // H2_PROJECTS
    try {
      const H2_PROJECTS = extractConst(html, 'H2_PROJECTS');
      if (Array.isArray(H2_PROJECTS)) {
        records += H2_PROJECTS.length;
        const GCC_IN = ['\ud83c\uddf8\ud83c\udde6', '\ud83c\udde6\ud83c\uddea', '\ud83c\uddf4\ud83c\uddf2', '\ud83c\uddf6\ud83c\udde6', '\ud83c\uddf0\ud83c\uddfc', '\ud83c\udde7\ud83c\udded', '\ud83c\uddea\ud83c\uddec', '\ud83c\uddee\ud83c\uddf3'];
        const rows = H2_PROJECTS.map(p => {
          const near = GCC_IN.some(f => (p[1] || '').includes(f));
          return `<tr${near ? ' style="background:rgba(74,222,128,.06)"' : ''}>
            <td><strong>${esc(p[0])}</strong>${near ? ' <span class="new-badge" title="GCC / India — addressable">●</span>' : ''}</td>
            <td>${esc(p[1])}</td><td>${esc(p[2])}</td><td>${esc(p[3])}</td><td>${esc(p[4])}</td><td>${esc(p[5])}</td></tr>`;
        }).join('');
        const h2Html = `<div class="region-h">Green Hydrogen Projects — electrolyser &amp; grid-connection transformer demand</div>
          <div style="font-size:.85rem;opacity:.85;margin:4px 0 10px">Every ~100 MW electrolyser block needs rectifier-transformer sets plus a dedicated grid-connection substation. Rectifier duty (high harmonics, thermal cycling) favours upgraded insulation systems — aramid / hybrid kits over standard kraft. Highlighted rows = GCC / Egypt / India, addressable. Seeded from the Grids census; statuses maintained by the daily job.</div>
          <div class="table-wrap"><table class="factory-grid"><thead><tr><th scope="col">Project</th><th scope="col">Location</th><th scope="col">Electrolyser</th><th scope="col">Output</th><th scope="col">Status</th><th scope="col">Note</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        html = injectById(html, 'panel-h2', h2Html);
      }
    } catch (e) { /* ignore */ }

    // TECH_WATCH
    try {
      const TECH_WATCH = extractConst(html, 'TECH_WATCH');
      if (TECH_WATCH) {
        let techCards = '';
        for (const k of ['SST', 'SF6FREE', 'FLUIDS', 'HYBRID', 'DIGITAL']) {
          const r = TECH_WATCH[k];
          if (!r || !r.items || !r.items.length) continue;
          records += r.items.length;
          techCards += `<div class="region-h">${esc(r.label || k)}</div>` + tag(r.items, 'WATCH').map(card).join('');
        }
        const note = `<div style="font-size:.85rem;opacity:.85;margin:4px 0 10px">Weekly scan of transformer &amp; grid-equipment technology — solid-state transformers, SF₆-free HV, ester/insulation fluids, hybrid &amp; amorphous cores, and digital-twin monitoring. <span class="new-badge">NEW</span> = added this week. Items with an addressable angle are noted in the snippet.</div>`;
        const techHtml = `<div class="region-h">Technology Watch — worldwide</div>` + note + techCards;
        html = injectById(html, 'panel-tech', techHtml);
      }
    } catch (e) { /* ignore */ }
  } else if (html.includes('id="intelList"')) {
    // 2. Generation 1 (intel-2026-06-18 to 07-09)
    try {
      const NEWS = extractConst(html, 'NEWS');
      if (NEWS) {
        function legacyCard(it) {
          return '<div class="intel-item"><h3>' + esc(it.title) + '</h3><p>' + esc(it.snippet) + '</p>' +
            '<div class="card-meta">' + (it.value ? '<span class="ival">' + esc(it.value) + '</span> · ' : '') +
            (it.url ? '<a class="src" href="' + esc(it.url) + '" target="_blank" rel="noopener">Source: ' + esc(it.src) + ' →</a>' : '<span class="src">' + esc(it.src) + '</span>') +
            '</div></div>';
        }
        let legacyHtml = '';
        for (const k of Object.keys(NEWS)) {
          const r = NEWS[k];
          if (!r || !r.items || !r.items.length) continue;
          records += r.items.length;
          legacyHtml += '<h2 class="region-h">' + esc(r.label || k) + '</h2>' + r.items.map(legacyCard).join('');
        }
        html = injectById(html, 'intelList', legacyHtml);
      }
    } catch (e) { /* ignore */ }
  }

  return { page: html, records };
}

function loadDirectoryIndex() {
  return JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8'));
}

function renderVendors(html) {
  const index = loadDirectoryIndex();
  const eventBadges = require('./event-badges');
  const view = directorySsr.vendors(index.companies || []);
  html = replaceInnerById(html, 'cntTotal', String(view.total));
  html = replaceInnerById(html, 'cntOem', String(view.oem));
  html = replaceInnerById(html, 'cntComp', String(view.components));
  html = replaceInnerById(html, 'cntCountries', String(view.countries));
  html = replaceInnerById(html, 'vndVisibleCount', String(view.total));
  html = replaceInnerById(html, 'pillAll', 'All categories (' + view.total + ')');
  html = replaceInnerById(html, 'pillOem', 'Transformer OEMs (' + view.oem + ')');
  html = replaceInnerById(html, 'vndCountry', view.countryOptions);
  html = replaceInnerById(html, 'vndList', view.listHtml);
  html = html.replace(/<script type="application\/json" id="tp-event-badges-data">[\s\S]*?<\/script>\s*<script src="\/event-badges\.js"><\/script>\s*/, '');
  const vendorScript = '<script>\n(function() {\n  \'use strict\';\n  var DATA = [];';
  if (html.indexOf(vendorScript) >= 0) html = html.replace(vendorScript, eventBadges.mountHtml() + vendorScript);
  return { page: html, records: view.total };
}

function renderDirectoryPage(html) {
  const index = loadDirectoryIndex();
  const eventBadges = require('./event-badges');
  let siteStats = {};
  try { siteStats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8')); } catch (e) { siteStats = {}; }
  html = replaceInnerById(html, 'directoryRoot', directorySsr.directoryRoot(index.companies || [], siteStats));
  html = html.replace(/<script type="application\/json" id="tp-event-badges-data">[\s\S]*?<\/script>\s*<script src="\/event-badges\.js"><\/script>\s*/, '');
  html = html.replace('<script src="tp-directory.js"', eventBadges.mountHtml() + '<script src="tp-directory.js"');
  return { page: html, records: (index.companies || []).length };
}

const jobs = [
  ['events.html', renderEvents, 'events'],
  ['vendors.html', renderVendors, 'vendors'],
  ['directory.html', renderDirectoryPage, 'directory'],
  ['components.html', renderComponents, 'components'],
  ['jobs.html', renderJobs, 'jobs'],
  ['grids.html', renderGrids, 'grids'],
  ['manufacturers.html', renderManufacturers, 'manufacturers'],
  ['intel.html', renderIntel, 'intel'],
];

// Pre-render all dated intel archive editions
const intelFiles = fs.readdirSync('.').filter(f => /^intel-2026-\d{2}-\d{2}\.html$/.test(f)).sort();
for (const f of intelFiles) {
  jobs.push([f, renderIntel, 'intel-archive']);
}

const onlyFile = process.argv[2];
for (const [file, fn, label] of jobs) {
  if (onlyFile && file !== onlyFile) continue;
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (e) { console.error('!! read ' + file + ' failed: ' + e.message); continue; }
  try {
    const out = fn(html);
    fs.writeFileSync(file, out.page, 'utf8');
    console.log('OK  ' + file.padEnd(18) + ' pre-rendered ' + String(out.records).padStart(6) + ' records');
  } catch (e) {
    console.error('!! ' + file + ' failed: ' + e.message + '\n   ' + (e.stack || '').split('\n').slice(1, 3).join('\n   '));
  }
}

/* ── Census count assertion ──────────────────────────────────────────────
   Guard against accidental data loss in the manufacturer/grid census. If the
   counts fall below the thresholds, fail the build so a bad edit never ships. */
try {
  const M = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
  const G = JSON.parse(fs.readFileSync('data/grids.json', 'utf8'));
  const makers = M.reduce((s, g) => s + g.makers.filter((x) => !String(x[0] || '').startsWith('Served by')).length, 0);
  const publicCount = require('./lib/public-company-count').read(__dirname).publicCount;
  const mkgCountries = M.filter((g) => g.makers.some((x) => !String(x[0] || '').startsWith('Served by'))).length;
  const gridCountries = G.length;
  const gridOperators = G.reduce((s, g) => s + g.grids.length, 0);
  const prev = (function () { try { return JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8')); } catch (e) { return {}; } })();
  let ok = true;
  if (publicCount < 500) { console.error('!! public company count < 500: ' + publicCount); ok = false; }
  if (mkgCountries < 80) { console.error('!! manufacturing countries < 80: ' + mkgCountries); ok = false; }
  if (gridCountries < 140) { console.error('!! grid countries < 140: ' + gridCountries); ok = false; }
  if (ok) {
    console.log('OK  census assertion — ' + publicCount + ' public companies / ' + makers + ' census rows / ' + mkgCountries + ' manufacturing countries / ' +
      gridCountries + ' grid countries / ' + gridOperators + ' operators');
    if (prev.manufacturers && prev.manufacturers !== publicCount) {
      console.log('NOTE public company count changed ' + prev.manufacturers + ' -> ' + publicCount);
    }
  } else {
    process.exitCode = 1; // fail the Netlify build
  }
} catch (e) { console.error('!! census assertion error: ' + e.message); }
