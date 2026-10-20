#!/usr/bin/env node
/* build-events.js — series hubs and edition pages from the canonical feed.
 * No hardcoded edition years. The hub names the next CONFIRMED edition.
 * If none is confirmed, it names the next upcoming edition that already
 * has a concrete date in data/events-canonical.json. Otherwise it says
 * the next edition is not yet announced.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
execFileSync(process.execPath, [path.join(__dirname, 'build-event-canonicalization.js')], { stdio: 'inherit' });
const { dubaiToday, fmtDay, dateLine, nullText, allowsCalendar, badgeText } = require('./lib/event-display');
const { seriesFeature } = require('./lib/event-hub-copy');
const { eventBadge } = require('./lib/provenance-badge');
const { eventIcs, calendarIcs } = require('./lib/event-ics');
const tpAff = require('./lib/travelpayouts');
const paidListings = require('./lib/paid-listings');
const schema = require('./lib/seo-schema');
const eventSeo = require('./lib/event-seo');
const PAID_LISTINGS = paidListings.load();

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
const CFG = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
const CSSV = (CFG.assets && CFG.assets.css) || 12;
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const TODAY = dubaiToday();
const CANON = JSON.parse(fs.readFileSync('data/events-canonical.json', 'utf8'));
const byId = {};
(CANON.canonical_editions || []).forEach((e) => { byId[e.id] = e; });
const SERIES_FILTER = String(process.env.TP_EVENT_SERIES || '').split(',').map((s) => s.trim()).filter(Boolean);
const EVENT_DIRECTORY = (function () {
  try { return JSON.parse(fs.readFileSync('data/event-directory.json', 'utf8')).sections || {}; }
  catch (e) { return {}; }
})();
const ALL = (CANON.canonical_editions || []).map((e) => {
  e.n = e.name || '';
  e.s = e.start || '';
  e.e = e.end || '';
  return e;
});

function isPast(ev) { return !!(ev.end && ev.end < TODAY); }
function travelBlock(ev) {
  if (!allowsCalendar(ev) || !ev.city) return '';
  return tpAff.eventWidgets({
    slug: ev.series_slug || ev.id,
    city: ev.city,
    checkIn: ev.start,
    checkOut: ev.end,
    prefix: '../../',
    disclosureHref: '../../affiliate-disclosure.html',
  });
}

/* Visitor guide is data, not a hardcoded page list. Absent field → no block. */
function visitorGuideBlock(ev) {
  const url = ev && typeof ev.languagepath_visit_url === 'string' ? ev.languagepath_visit_url : '';
  if (!/^https:\/\/languagepath\.org\/events\/visiting\/[a-z0-9-]+\/$/.test(url)) return '';
  return '<aside class="lp-visit" style="margin:16px 0;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--card)">' +
    '<a href="' + esc(url) + '" rel="noopener" target="_blank">Travelling there? Phrases, etiquette and local tips for visitors</a>' +
    '</aside>';
}

const groups = {};
ALL.forEach((ev) => {
  const k = ev.series_slug || ev.id;
  (groups[k] = groups[k] || []).push(ev);
});

const written = new Set();
function writePage(rel, html) {
  const dir = path.dirname(rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(rel, html);
  written.add(dir);
}

function publishedHref(href) {
  const raw = String(href || '');
  if (raw.charAt(0) !== '/') return '';
  const rel = raw.split('?')[0].split('#')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  if (!rel || rel.indexOf('..') !== -1) return '';
  if (fs.existsSync(rel + '/index.html') || fs.existsSync(rel + '.html') || fs.existsSync(rel)) return raw;
  return '';
}
function directorySection(ev) {
  const block = EVENT_DIRECTORY[ev.id];
  if (!block || !block.entries || !block.entries.length) return '';
  const items = block.entries.map((row) => {
    const label = esc(row.name);
    // A directory row can name a lab that has no profile page. Linking it
    // would 404. The name still appears in the list.
    const href = publishedHref(row.href);
    const link = href ? '<a href="' + esc(href) + '">' + label + '</a>' : label;
    return '<li>' + link + '</li>';
  }).join('');
  return '<h2>' + esc(block.section) + '</h2><ul>' + items + '</ul>';
}
function exhibitorHtml(ev) {
  if (!ev.key_exhibitors || !ev.key_exhibitors.length) return '<p>' + esc(nullText()) + '</p>';
  return '<ul>' + ev.key_exhibitors.map((x) => {
    const label = esc(x.name);
    const link = x.entity_slug ? '<a href="../../manufacturers/' + esc(x.entity_slug) + '/">' + label + '</a>' : label;
    return '<li>' + link + (x.source_url ? ' <a href="' + esc(x.source_url) + '" rel="noopener">source</a>' : '') + '</li>';
  }).join('') + '</ul>';
}
function programmeHtml(ev) {
  if (!ev.programme || !ev.programme.length) return '<p>' + esc(nullText()) + '</p>';
  return '<ul>' + ev.programme.map((p) => '<li>' + esc(p.title) + ' <span style="color:var(--muted)">(' + esc(p.kind) + ')</span></li>').join('') + '</ul>';
}
function deadlineLabel(kind) {
  if (kind === 'call_for_papers') return 'Call for papers';
  if (kind === 'abstract') return 'Abstract deadline';
  return kind || 'Deadline';
}
function httpHref(url) {
  const u = String(url || '').trim();
  return /^https?:\/\//i.test(u) ? u : '';
}
/* Paper deadline sits above the venue block so it is visible without
   scrolling past the travel search. Other deadline kinds stay in the list. */
function deadlineCallout(ev) {
  const paper = (ev.deadlines || []).find((d) => d && d.kind === 'call_for_papers' && d.date);
  if (!paper) return '';
  const when = fmtDay(paper.date) || paper.date;
  const note = paper.note ? '<p style="margin:6px 0 0">' + esc(paper.note) + '</p>' : '';
  const href = httpHref(paper.source_url);
  const link = href ? '<p style="margin:8px 0 0"><a href="' + esc(href) + '">Official call for papers</a></p>' : '';
  return '<aside class="cfp-deadline" style="margin:16px 0;padding:14px 16px;border:2px solid var(--accent);border-radius:10px;background:rgba(245,166,35,.14)">' +
    '<p style="margin:0;font-size:1.15rem"><strong>Paper deadline: ' + esc(when) + '</strong></p>' +
    note + link + '</aside>';
}
function deadlineHtml(ev) {
  if (!ev.deadlines || !ev.deadlines.length) return '<p>' + esc(nullText()) + '</p>';
  return '<ul>' + ev.deadlines.map((d) => {
    const when = d.date ? fmtDay(d.date) : '';
    const note = d.note ? ' — ' + esc(d.note) : '';
    const href = httpHref(d.source_url);
    const link = href ? ' <a href="' + esc(href) + '" rel="noopener">source</a>' : '';
    return '<li><strong>' + esc(deadlineLabel(d.kind)) + '</strong>' + (when ? ': ' + esc(when) : '') + note + link + '</li>';
  }).join('') + '</ul>';
}
function statsHtml(ev) {
  const s = ev.stats || {};
  const rows = ['exhibitors', 'visitors', 'area_sqm', 'countries', 'speakers'].map((k) => {
    const cell = s[k];
    const val = cell && cell.value != null ? esc(cell.value) + (cell.as_of_edition ? ' <span style="color:var(--muted)">(edition ' + esc(cell.as_of_edition) + ')</span>' : '') : esc(nullText());
    return '<li>' + esc(k) + ': ' + val + '</li>';
  }).join('');
  return '<ul>' + rows + '</ul>';
}

function ldScript(pageUrl, crumbs, input) {
  const graph = schema.graph([
    schema.breadcrumbNode(pageUrl, crumbs),
    schema.eventNode(pageUrl, input)
  ]);
  return '<script type="application/ld+json">' + JSON.stringify(graph) + '</script>';
}

function shell(title, desc, canonical, body, ld, eventId, flags) {
  flags = flags || {};
  const badge = eventId ? paidListings.featuredEventHtml(eventId, PAID_LISTINGS) : '';
  const withBadge = badge && body.indexOf('</h1>') >= 0 ? body.replace('</h1>', '</h1>' + badge) : (badge + body);
  const pay = paidListings.featuredEventPayHtml({
    eventId: eventId || '',
    formHref: '../../events.html#submit-event',
    className: 'btn btn-amber btn-sm',
    style: 'margin:0 8px 8px 0'
  });
  const exhibitorPay = paidListings.featuredExhibitorPayHtml({
    eventId: eventId || '',
    formHref: '../../sponsor.html#contact',
    className: 'btn btn-amber',
    label: 'Feature your company — $399 →'
  });
  const robots = flags.noindex ? 'noindex,follow' : 'index,follow';
  const role = flags.role ? ' data-tp-event-role="' + esc(flags.role) + '"' : '';
  const eid = flags.eventId ? ' data-tp-event-id="' + esc(flags.eventId) + '"' : '';
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(String(desc || '').slice(0, 300)) + '">' +
    '<link rel="canonical" href="' + canonical + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="' + robots + '">' +
    '<link rel="stylesheet" href="../../style.css?v=' + CSSV + '"><link rel="stylesheet" href="../../tp-nav.css?v=' + CSSV + '">' +
    '<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap .lead{color:var(--muted)}.c-wrap h2{font-size:1.2rem;margin-top:22px}.evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:.92rem}</style>' +
    (ld || '') +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap"' + role + eid + '>' + withBadge +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px">' +
    '<div style="font-size:.8rem;color:var(--muted);margin-bottom:12px">Feature your company on TransformerPath — Featured Event is $299 per event. Featured Exhibitor is $399 per event.</div>' +
    pay +
    exhibitorPay + '</div>' +
    '<p style="font-size:.85rem;color:var(--muted);text-align:center;margin-top:12px"><a href="../../events.html">Events</a> · <a href="../../exhibitions.html">Exhibitions</a></p>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js?v=2" defer></script>\n</body>\n</html>';
}

function seriesTitle(slug, list) {
  const names = list.map(function (ev) {
    return eventSeo.seriesDisplayName(ev && ev.name, slug);
  }).filter(Boolean);
  names.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
  return names[0] || eventSeo.seriesDisplayName('', slug);
}

Object.keys(groups).forEach((slug) => {
  if (SERIES_FILTER.length && SERIES_FILTER.indexOf(slug) < 0) return;
  const list = groups[slug].slice().sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));
  const feature = seriesFeature(list, TODAY);
  const nxt = feature.featured;
  const seriesName = seriesTitle(slug, list);
  const h1 = seriesName;
  const cta = feature.text;
  const hubUrl = 'https://transformerpath.com/events/' + slug + '/';
  const blurb = eventSeo.hubBlurb(seriesName, list);
  const editionLinks = '<h2>Editions</h2><ul>' + list.map((ev) => {
    const place = [ev.city, ev.country].filter(Boolean).join(', ');
    const summaries = (ev.intel_links || []).map((id) => ' · <a href="../' + esc(id) + '/summary/">post-event summary</a>').join('');
    return '<li><a href="../' + esc(ev.id) + '/">' + esc(ev.name) + '</a> — ' + esc(dateLine(ev)) +
      (place ? ', ' + esc(place) : '') + summaries + '</li>';
  }).join('') + '</ul>';
  const lead = 'Recorded editions of ' + seriesName + '. This series page lists every edition. Each year has its own page. Dates and venues on this hub are the values stored for that edition.';
  const featured = nxt ? visitorGuideBlock(nxt) : '';
  const body = '<nav style="font-size:.8rem;color:var(--muted)"><a href="../../events.html">Events</a> › ' + esc(seriesName) + '</nav>' +
    '<h1>' + esc(h1) + '</h1>' +
    '<p class="lead">' + esc(lead) + '</p>' +
    editionLinks +
    featured +
    '<p id="series-cta" data-hub-asof="' + esc(TODAY) + '"><b>' + esc(cta) + '</b></p>';
  const hubCrumbs = [
    { name: 'Home', item: 'https://transformerpath.com/' },
    { name: 'Events', item: 'https://transformerpath.com/events.html' },
    { name: seriesName, item: hubUrl }
  ];
  writePage('events/' + slug + '/index.html', shell(
    eventSeo.eventHubTitle(seriesName),
    blurb,
    hubUrl,
    body,
    ldScript(hubUrl, hubCrumbs, eventSeo.hubInput(seriesName, blurb)),
    slug,
    { role: 'hub' }
  ));

  list.forEach((ev) => {
    const pastEd = isPast(ev);
    const badge = pastEd
      ? '<span class="badge">Completed</span>'
      : (eventBadge(ev) || (badgeText(ev) ? '<span class="badge">' + esc(badgeText(ev)) + '</span>' : ''));
    const siblings = list.filter((other) => other.id !== ev.id);
    const siblingHtml = siblings.length
      ? '<h2>Other years</h2><ul>' + siblings.map((other) => '<li><a href="../' + esc(other.id) + '/">' + esc(other.name) + '</a></li>').join('') + '</ul>'
      : '';
    const edUrl = 'https://transformerpath.com/events/' + ev.id + '/';
    const edBody = '<nav style="font-size:.8rem"><a href="../../events.html">Events</a> › <a href="../' + esc(slug) + '/">' + esc(seriesName) + '</a> › ' + esc(ev.name) + '</nav>' +
      '<h1>' + esc(ev.name) + '</h1>' +
      '<p>' + (badge || '') + '</p>' +
      '<p class="lead">' + esc(dateLine(ev)) + '</p>' +
      deadlineCallout(ev) +
      '<p>This page is the ' + esc(ev.name) + ' edition. <a href="../' + esc(slug) + '/">All ' + esc(seriesName) + ' editions</a> are listed on the series hub.</p>' +
      '<div class="evmeta"><span><b>Venue</b> ' + esc(ev.venue || nullText()) + '</span>' +
      '<span><b>City</b> ' + esc(ev.city || nullText()) + '</span>' +
      '<span><b>Organiser</b> ' + esc(ev.organiser || nullText()) + '</span></div>' +
      (ev.official_url ? '<p><a href="' + esc(ev.official_url) + '">Official site</a></p>' : '<p>Official site: ' + esc(nullText()) + '</p>') +
      (allowsCalendar(ev) && ev.end >= TODAY ? '<p><a href="../../events/ics/' + esc(ev.id) + '.ics">Add to calendar</a></p>' : '') +
      travelBlock(ev) + visitorGuideBlock(ev) +
      '<p>' + esc(ev.description || '') + '</p>' +
      (ev.relevance_reason ? '<p>' + esc(ev.relevance_reason) + '</p>' : '') +
      '<h2>Deadlines</h2>' + deadlineHtml(ev) +
      '<h2>Programme</h2>' + programmeHtml(ev) +
      directorySection(ev) +
      '<h2>Key exhibitors</h2>' + exhibitorHtml(ev) +
      '<h2>Stats</h2>' + statsHtml(ev) +
      ((ev.intel_links || []).length ? '<h2>Post-event summary</h2><ul>' + ev.intel_links.map((id) => '<li><a href="../' + esc(id) + '/summary/">' + esc(id) + '</a></li>').join('') + '</ul>' : '') +
      siblingHtml +
      (pastEd ? '' : '<p id="series-cta"><b>Meet the industry at ' + esc(ev.name) + '</b></p>');
    const edCrumbs = [
      { name: 'Home', item: 'https://transformerpath.com/' },
      { name: 'Events', item: 'https://transformerpath.com/events.html' },
      { name: seriesName, item: 'https://transformerpath.com/events/' + slug + '/' },
      { name: ev.name, item: edUrl }
    ];
    const noindex = eventSeo.shouldNoindexEdition(ev, TODAY);
    writePage('events/' + ev.id + '/index.html', shell(
      eventSeo.eventProfileTitle(ev),
      ev.description || ev.name,
      edUrl,
      edBody,
      ldScript(edUrl, edCrumbs, eventSeo.editionInput(ev)),
      ev.id,
      { role: 'edition', eventId: ev.id, noindex: noindex }
    ));
  });
});

/* A filtered rebuild writes the named series only. It leaves every other
 * event directory and the shared calendar files where they are. */
const confirmedUpcoming = ALL.filter((ev) => allowsCalendar(ev) && ev.end >= TODAY);
if (!SERIES_FILTER.length) {
/* Calendars: CONFIRMED upcoming only. */
fs.mkdirSync('events/ics', { recursive: true });
confirmedUpcoming.forEach((ev) => {
  fs.writeFileSync('events/ics/' + ev.id + '.ics', eventIcs(ev));
});
fs.writeFileSync('events/calendar.ics', calendarIcs(confirmedUpcoming, 'TransformerPath events'));
const regions = {};
confirmedUpcoming.forEach((ev) => {
  const r = ev.region || 'Other';
  (regions[r] = regions[r] || []).push(ev);
});
Object.keys(regions).forEach((r) => {
  const slug = r.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  fs.writeFileSync('events/calendar-' + slug + '.ics', calendarIcs(regions[r], 'TransformerPath — ' + r));
});

/* Old public slugs 301. Do not also publish an HTML copy: two pages for
   one series is the duplicate the redirect exists to remove. */
const eventRedirects = require('./lib/event-redirects');
function syncRedirectFile(file, block) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const next = eventRedirects.spliceMarked(prev, block);
  if (next !== prev) fs.writeFileSync(file, next.endsWith('\n') ? next : next + '\n');
}
syncRedirectFile('_redirects', eventRedirects.redirectsBlock());
syncRedirectFile('netlify.toml', eventRedirects.tomlBlock());

/* Post-event summaries live beside edition pages and use their own slugs.
   Keep those directories even when the slug is not an edition id. */
const summarySlugs = new Set();
try {
  const summaries = JSON.parse(fs.readFileSync('data/post-event-summaries.json', 'utf8'));
  (summaries.summaries || summaries || []).forEach((s) => { if (s && s.slug) summarySlugs.add(s.slug); });
} catch (e) { /* summaries file is optional for this build */ }

/* Drop curated directories this build did not rewrite, so a past edition
   cannot keep a stale "Meet the industry at … 2026" hub. */
if (fs.existsSync('events')) {
  fs.readdirSync('events', { withFileTypes: true }).forEach((ent) => {
    if (!ent.isDirectory()) return;
    if (ent.name === 'ics') return;
    if (summarySlugs.has(ent.name)) return;
    const dir = path.join('events', ent.name);
    if (!written.has(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log('removed stale events/' + ent.name);
    }
  });
}
}

const noindexSeries = {};
ALL.forEach(function (ev) {
  if (eventSeo.shouldNoindexEdition(ev, TODAY)) noindexSeries[ev.series_slug || ev.id] = 1;
});
console.log('OK series hubs ' + Object.keys(groups).length + ' | edition pages ' + ALL.length + ' | ics ' + confirmedUpcoming.length + (SERIES_FILTER.length ? ' | filtered ' + SERIES_FILTER.join(',') : ''));
console.log('series with a noindex unsourced edition: ' + Object.keys(noindexSeries).length);
