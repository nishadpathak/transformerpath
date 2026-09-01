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

// en-GB short date, e.g. "23 Aug 2026"
const fmt = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' });

/* ------------------------------------------------------------------ *
 * EVENTS
 * ------------------------------------------------------------------ */
function renderEvents(html) {
  const EVENTS = extractConst(html, 'EVENTS');
  const AFF = extractConst(html, 'AFFILIATE');
  const now = new Date(new Date().toDateString());
  const hotelURL = (ev) =>
    AFF.travelpayoutsMarker
      ? `https://search.hotellook.com/?marker=${AFF.travelpayoutsMarker}&destination=${encodeURIComponent(ev.c)}&checkIn=${ev.s}&checkOut=${ev.e}`
      : (AFF.travelLink || `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(ev.c)}&checkin=${ev.s}&checkout=${ev.e}`);
  const flightURL = () => AFF.kiwiLink || null;

  let list = EVENTS.filter((ev) => new Date(ev.e) >= now);
  list.sort((a, b) => a.s.localeCompare(b.s));

  const PLATFORM_TZ_MS = 4*60*60*1000; // GST/Asia-Dubai
  const todayUTC = (function(){ var g=new Date(Date.now()+PLATFORM_TZ_MS); return Date.UTC(g.getUTCFullYear(),g.getUTCMonth(),g.getUTCDate()); })();
  const relDays = (d) => Math.ceil((Date.parse(d+'T00:00:00Z') - todayUTC) / 86400000);
  const badgeHTML = (ev) => {
    if (/unconfirmed|date est\.|⚠/i.test(ev.d)) return '<span class="badge-unc">Date est.</span>';
    if (/tbc|tbd/i.test(ev.v)) return '<span class="badge-unc">Venue TBC</span>';
    return '';
  };
  const relLabel = (ev) => {
    const d = relDays(ev.s);
    if (d <= 0) return Date.parse(ev.e+'T00:00:00Z') >= todayUTC ? '<span class="rel-today">Live now</span>' : '';
    if (d === 1) return '<span class="rel-soon">In 1 day</span>';
    if (d <= 31) return `<span class="rel-soon">In ${d} days</span>`;
    return '';
  };
  const icsHref = (ev) => {
    const dt = (d) => d.replace(/-/g, '');
    const escv = (t) => (t || '').replace(/,/g, '\\,');
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TransformerPath//Events//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
      'UID:' + dt(ev.s) + '-' + dt(ev.e) + '@transformerpath.com',
      'DTSTAMP:' + dt(new Date().toISOString().slice(0, 10)) + 'T000000Z',
      'DTSTART;VALUE=DATE:' + dt(ev.s), 'DTEND;VALUE=DATE:' + dt(ev.e),
      'SUMMARY:' + escv(ev.n), 'LOCATION:' + escv(ev.v + ', ' + ev.c + ', ' + ev.co), 'URL:' + ev.u,
      'END:VEVENT','END:VCALENDAR'];
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
  };

  // Up-Next strip (soonest 3) — pre-rendered so crawlers see it too
  const up = EVENTS.filter((ev) => new Date(ev.e) >= now).sort((a, b) => a.s.localeCompare(b.s)).slice(0, 3);
  const upNext = up.map((ev) => {
    const d = relDays(ev.s);
    const lbl = d < 0 ? 'Live now' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days';
    // Absolute date is the primary, timezone-stable label; the relative badge is
    // recomputed client-side (data-rel="<start date>") so it can never go stale
    // between builds (a crawl can never see "Today" for a passed event).
    return `<div class="up-next-card"><span class="up-next-abs">${fmt(ev.s)} → ${fmt(ev.e)}</span><h3>${esc(ev.n)}</h3><span class="up-next-rel" data-rel="${esc(ev.s)}">${lbl}</span><div class="venue">📍 ${esc(ev.v)} — ${esc(ev.c)}, ${esc(ev.co)}</div><a class="btn btn-amber btn-sm" href="${esc(ev.u)}" target="_blank" rel="noopener">View →</a></div>`;
  }).join('\n');

  const cards = list.map((ev) => {
    const soon = new Date(ev.s) > now && (new Date(ev.s) - now) / 86400000 <= 31;
    return `<div class="intel-item event-card">
      <h3>${esc(ev.n)}${soon ? '<span class="badge-soon">Soon</span>' : ''}${badgeHTML(ev)}</h3>
      <div class="dates">${fmt(ev.s)} → ${fmt(ev.e)}${relLabel(ev)}</div>
      <div class="venue">📍 ${esc(ev.v)} — ${esc(ev.c)}, ${esc(ev.co)} · ${esc(ev.r)}</div>
      <p style="color:var(--muted); font-size:.92rem; margin-bottom:10px">${esc(ev.d)}</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <a class="btn btn-amber btn-sm" href="${esc(ev.u)}" target="_blank" rel="noopener">Official site →</a>
        <a class="btn btn-outline btn-sm" data-aff="hotel" data-ev="${esc(ev.n)}" href="${esc(hotelURL(ev))}" target="_blank" rel="noopener sponsored">🏨 Book Hotel</a>
        ${flightURL(ev) ? `<a class="btn btn-outline btn-sm" data-aff="flights" data-ev="${esc(ev.n)}" href="${esc(flightURL(ev))}" target="_blank" rel="noopener sponsored">✈ Find Flights</a>` : ''}
        ${AFF.kkdayLink ? `<a class="btn btn-outline btn-sm" data-aff="activities" data-ev="${esc(ev.n)}" href="${esc(AFF.kkdayLink)}" target="_blank" rel="noopener sponsored">🎟️ Things to Do</a>` : ''}
        <a class="btn btn-outline btn-sm" data-aff="calendar" data-ev="${esc(ev.n)}" href="${esc(icsHref(ev))}" download target="_blank" rel="noopener">📅 Add</a>
      </div>
    </div>`;
  }).join('\n');

  html = inject(html, '<div id="grid">', 'events-grid', cards);
  html = inject(html, '<div id="upNext" class="up-next" aria-label="Upcoming events">', 'events-upnext', upNext);
  html = inject(html, '<p style="text-align:center; color:var(--muted); font-size:.88rem" id="count">', 'events-count',
    `Showing ${list.length} upcoming events`);
  return { page: html, records: list.length };
}

/* ------------------------------------------------------------------ *
 * WEBINARS
 * ------------------------------------------------------------------ */
function renderWebinars(html) {
  const WEBINARS = extractConst(html, 'WEBINARS');
  const now = new Date(new Date().toDateString());
  const TYPE_LABEL = { OEM: 'Manufacturer', Supplier: 'Supplier', Institute: 'Institute / Media' };

  let list = WEBINARS.filter((w) => !w.date || new Date(w.date) >= now);
  list.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return (a.n || '').localeCompare(b.n || '');
  });

  const cards = list.map((w) => {
    const soon = w.date && new Date(w.date) > now && (new Date(w.date) - now) / 86400000 <= 31;
    const dateLine = w.date
      ? `<div class="dates">🗓️ ${fmt(w.date)} · Live session</div>`
      : `<div class="dates">${w.fmt === 'On-demand' ? '▶ On-demand library' : w.fmt === 'Recurring' ? '🔁 Recurring series' : '● Live program'}</div>`;
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
      <a class="btn btn-amber btn-sm" href="${esc(w.u)}" target="_blank" rel="noopener">Register / Watch →</a>
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
  const LIVE = extractConst(html, 'LIVE');
  const DATA = extractConst(html, 'DATA');
  const FN = extractConst(html, 'FN');
  const FN_CLASS = extractConst(html, 'FN_CLASS');

  const liveGrid = LIVE.map((j) =>
    `<div class="live-row">
     <span class="lt">${esc(j.t)}</span>
     <span class="lc">${esc(j.co)}</span>
     <span class="ll">📍 ${esc(j.loc)}</span>
     <span class="ld">${esc(j.fn)} · ${esc(j.posted)}</span>
     <a class="lapply" href="${esc(j.url)}" target="_blank" rel="noopener">Apply →</a>
   </div>`).join('\n');

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
    `<div class="s"><b>${LIVE.length}</b><small>Live openings</small></div>
     <div class="s"><b>${companies}</b><small>Employers</small></div>
     <div class="s"><b>${countries}</b><small>Countries</small></div>
     <div class="s"><b>${roles}+</b><small>Role categories</small></div>`;

  html = inject(html, '<div id="liveBoard">', 'jobs-live', liveGrid);
  html = inject(html, '<div id="board">', 'jobs-board', board);
  html = inject(html, '<div class="stat-row" id="statRow">', 'jobs-stats', stats);
  html = inject(html, 'id="count">', 'jobs-count', `Showing ${DATA.length} employers across ${order.length} countries`);
  return { page: html, records: DATA.length + LIVE.length };
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
        ${(c.grids || []).map((g) => `<div class="grid-row"><b>${esc(g[0])}</b><span style="color:var(--muted)">${esc(g[1])}</span><span class="kv">${esc(g[2])}</span>${g[3] ? `<a href="${esc(g[3])}" target="_blank" rel="noopener">Site →</a>` : '<span></span>'}</div>`).join('')}${projChips(c)}
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
    `Data last verified ${LAST_VERIFIED} &middot; sources: official utility, operator &amp; regulator filings &middot; maintained encyclopedia-style from the TransformerPath grid census. Report a <a href=\"mailto:hello@transformerpath.com?subject=Grid%20census%20correction\" style=\"color:var(--accent);font-weight:600\">correction</a>.`);
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
  const TNAME = { PT: 'Power', DT: 'Distribution', DRY: 'Dry/Cast' };
  const regions = [...new Set(DATA.map((c) => c.region))];
  // Manufacturer -> company entity page slug (for the directory -> entity link graph).
  let CSMAP = {};
  try { JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (c) { CSMAP[c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = c.slug; }); } catch (e) {}
  const csl = (m) => CSMAP[String(m[0]).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()];
  const vbadge = (m) => { if (m[4] === 'P') return '<span class="v-badge pro">★ Pro Verified</span>'; if (m[4] === 'V') return '<span class="v-badge">✓ Verified</span>'; return ''; };
  const tpills = (types) => { if (!types) return ''; return types.split(',').map((t) => t.trim()).filter(Boolean).map((t) => `<span class="tpill t-${t}">${esc(TNAME[t] || t)}</span>`).join(''); };
  const groups = {};
  DATA.forEach((c) => { (groups[c.region] = groups[c.region] || []).push(c); });

  const board = regions.filter((rg) => groups[rg]).map((region) =>
    `<div class="region-h">${esc(region)}</div>` + groups[region].map((c) => {
      const real = c.makers.filter((m) => !/^Served by/i.test(m[0])).length;
      return `<div class="ctry-card"><div class="ctry-head"><span class="flag">${esc(c.flag)}</span><h3>${esc(c.country)}</h3><span class="cnt">${real} maker${real !== 1 ? 's' : ''}</span></div>` +
        c.makers.map((m) => /^Served by/i.test(m[0])
          ? `<div class="mk-row"><span class="note">${esc(m[0])}</span></div>`
          : `<div class="mk-row">${csl(m) ? `<a class="prof" href="manufacturers/${csl(m)}/" style="color:var(--accent);font-weight:700">${esc(m[0])}</a>` : `<b>${esc(m[0])}</b>`}${vbadge(m)}${tpills(m[3])}<span class="city">${esc(m[1] || '')}${m[5] ? ` · est. ${esc(m[5])}` : ''}</span>${m[2] ? `<a href="${esc(m[2])}" target="_blank" rel="noopener">Site →</a>` : '<span></span>'}</div>`).join('') +
        `</div>`;
    }).join('')).join('');

  const makers = DATA.reduce((s, c) => s + c.makers.filter((m) => !/^Served by/i.test(m[0])).length, 0);
  if (makers < 400) { console.warn('!! manufacturer census unexpectedly small ('+makers+'); check data/manufacturers.json'); }
  const stats = `<div class="s"><b>${makers}</b><small>Manufacturers</small></div>
     <div class="s"><b>${DATA.length}</b><small>Countries</small></div>
     <div class="s"><b>${new Set(DATA.map((c) => c.region)).size}</b><small>Regions</small></div>`;

  html = inject(html, '<div id="board">', 'mfg-board', board);
  html = inject(html, '<p style="color:var(--muted); font-size:.85rem; margin-bottom:14px" id="count">', 'mfg-count',
    `Showing ${makers} makers in ${DATA.length} countries`);
  html = inject(html, '<div class="stat-row" id="statRow">', 'mfg-stats', stats);

  // Global-leaders tier leaderboard (data/manufacturer-tiers.json)
  try {
    const TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));
    const TIER_LABEL = { 1: 'Global leaders', 2: 'Major regional', 3: 'Specialized / custom' };
    let tierHtml = '';
    for (const t of [1, 2, 3]) {
      const items = (TIERS || []).filter((r) => r.tier === t);
      if (!items.length) continue;
      tierHtml += `<h3><span class="tbadge t${t}">Tier ${t}</span> ${TIER_LABEL[t]}</h3>`;
      tierHtml += '<table><thead><tr><th>Manufacturer</th><th>Country</th><th>Capacity / yr</th><th>Max voltage</th><th>Certifications</th><th>Regions</th><th>Source</th></tr></thead><tbody>';
      tierHtml += items.map((r) => `<tr>
        <td>${r.site ? `<a href="${esc(r.site)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}</td>
        <td>${esc(r.country || r.cc)}</td>
        <td${r.note ? ` title="${esc(r.note)}"` : ''}>${r.mva ? '~' + r.mva.toLocaleString('en-US') + ' MVA' : '—'}${r.note ? ' <span aria-hidden="true" style="color:var(--muted);cursor:help">&#8505;</span>' : ''}</td>
        <td>${r.kv ? esc(r.kv) + ' kV' : '—'}</td>
        <td>${esc((r.certs || []).join(', ') || '—')}</td>
        <td>${esc((r.regions || []).join(', ') || '—')}</td>
        <td style="font-size:.78rem;color:var(--muted)">${esc(r.source || '—')}</td></tr>`).join('');
      tierHtml += '</tbody></table>';
    }
    html = inject(html, '<div class="tiers" id="tiersRoot">', 'mfg-tiers', tierHtml);
  } catch (e) { /* tiers optional */ }

  // Keep the Dataset schema "size" in sync with the live census count.
  html = html.replace(/("size"\s*:\s*)\d+/g, '$1' + makers);

  return { page: html, records: makers };
}

const jobs = [
  ['events.html', renderEvents, 'events'],
  ['webinars.html', renderWebinars, 'webinars'],
  ['components.html', renderComponents, 'components'],
  ['jobs.html', renderJobs, 'jobs'],
  ['grids.html', renderGrids, 'grids'],
  ['manufacturers.html', renderManufacturers, 'manufacturers'],
];

for (const [file, fn, label] of jobs) {
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
  const mkgCountries = M.filter((g) => g.makers.some((x) => !String(x[0] || '').startsWith('Served by'))).length;
  const gridCountries = G.length;
  const gridOperators = G.reduce((s, g) => s + g.grids.length, 0);
  const prev = (function () { try { return JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8')); } catch (e) { return {}; } })();
  let ok = true;
  if (makers < 500) { console.error('!! manufacturers census < 500: ' + makers); ok = false; }
  if (mkgCountries < 80) { console.error('!! manufacturing countries < 80: ' + mkgCountries); ok = false; }
  if (gridCountries < 140) { console.error('!! grid countries < 140: ' + gridCountries); ok = false; }
  if (ok) {
    console.log('OK  census assertion — ' + makers + ' makers / ' + mkgCountries + ' manufacturing countries / ' +
      gridCountries + ' grid countries / ' + gridOperators + ' operators');
    if (prev.manufacturers && prev.manufacturers !== makers) {
      console.log('NOTE manufacturers count changed ' + prev.manufacturers + ' -> ' + makers);
    }
  } else {
    process.exitCode = 1; // fail the Netlify build
  }
} catch (e) { console.error('!! census assertion error: ' + e.message); }
