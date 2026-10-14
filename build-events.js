#!/usr/bin/env node
/* build-events.js — series hubs and edition pages from the canonical feed.
 * No hardcoded edition years. The hub always leads with the next CONFIRMED
 * edition, or says the next edition is not yet announced.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
execFileSync(process.execPath, [path.join(__dirname, 'build-event-canonicalization.js')], { stdio: 'inherit' });
const { dubaiToday, fmtDay, dateLine, nullText, allowsCalendar, badgeText } = require('./lib/event-display');
const { eventIcs, calendarIcs } = require('./lib/event-ics');

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
const ALL = (CANON.canonical_editions || []).map((e) => {
  e.n = e.name || '';
  e.s = e.start || '';
  e.e = e.end || '';
  return e;
});

function upcoming(ev) {
  if (ev.research_status === 'REJECTED_NO_EVIDENCE') return false;
  if (ev.lifecycle_status === 'REJECTED_NO_EVIDENCE' || ev.lifecycle_status === 'CANCELLED') return false;
  if (!ev.end) return ev.date_status === 'TBA' || ev.date_status === 'PROJECTED' || ev.date_status === 'CONFIRMED';
  return ev.end >= TODAY;
}
function isPast(ev) { return !!(ev.end && ev.end < TODAY); }

const groups = {};
ALL.forEach((ev) => {
  const k = ev.series_slug || ev.id;
  (groups[k] = groups[k] || []).push(ev);
});

function nextConfirmed(list) {
  return list.filter((ev) => ev.date_status === 'CONFIRMED' && upcoming(ev) && ev.start)
    .sort((a, b) => a.start.localeCompare(b.start))[0] || null;
}
function checkedDate(list) {
  const dates = list.map((e) => e.source_checked_at).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

const written = new Set();
function writePage(rel, html) {
  const dir = path.dirname(rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(rel, html);
  written.add(dir);
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
function deadlineHtml(ev) {
  if (!ev.deadlines || !ev.deadlines.length) return '<p>' + esc(nullText()) + '</p>';
  return '<ul>' + ev.deadlines.map((d) => '<li>' + esc(d.kind) + (d.date ? ': ' + esc(fmtDay(d.date)) : '') + '</li>').join('') + '</ul>';
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

function jsonLd(ev) {
  if (ev.date_status !== 'CONFIRMED' || !ev.start || !ev.source_url || !ev.source_checked_at) return '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ev.name,
    startDate: ev.start,
    endDate: ev.end || ev.start,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: ev.official_url || undefined,
    location: {
      '@type': 'Place',
      name: ev.venue || ev.city || undefined,
      address: {
        '@type': 'PostalAddress',
        addressLocality: ev.city || undefined,
        addressCountry: ev.country || undefined,
      },
    },
  };
  if (ev.organiser) data.organizer = { '@type': 'Organization', name: ev.organiser, url: ev.official_url || undefined };
  return '<script type="application/ld+json">' + JSON.stringify(data) + '</script>';
}

function shell(title, desc, canonical, body, ld) {
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(String(desc || '').slice(0, 160)) + '">' +
    '<link rel="canonical" href="' + canonical + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:url" content="' + canonical + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css?v=' + CSSV + '"><link rel="stylesheet" href="../../tp-nav.css?v=' + CSSV + '">' +
    '<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap .lead{color:var(--muted)}.c-wrap h2{font-size:1.2rem;margin-top:22px}.evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:.92rem}</style>' +
    (ld || '') +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap">' + body +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px">' +
    '<div style="font-size:.8rem;color:var(--muted);margin-bottom:12px">Exhibiting here? Feature your company on TransformerPath — from $399 per event.</div>' +
    '<a class="btn btn-amber" href="../../sponsor.html">Feature your company — $399 →</a></div>' +
    '<p style="font-size:.85rem;color:var(--muted);text-align:center;margin-top:12px"><a href="../../events.html">Events</a> · <a href="../../exhibitions.html">Exhibitions</a> · <a href="../../webinars.html">Webinars</a></p>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js?v=2" defer></script>\n</body>\n</html>';
}

function seriesTitle(slug, list) {
  const sample = list[0];
  return String(sample.name || slug).replace(/\s*\(?20\d{2}\)?/g, '').replace(/\s+/g, ' ').trim();
}

Object.keys(groups).forEach((slug) => {
  const list = groups[slug].slice().sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));
  const nxt = nextConfirmed(list);
  const seriesName = seriesTitle(slug, list);
  const checked = checkedDate(list);
  const leadName = nxt ? nxt.name : seriesName;
  const h1 = seriesName;
  const cta = nxt
    ? ('Meet the industry at ' + nxt.name)
    : ('Next edition: dates not yet announced' + (checked ? ' (checked ' + checked + ')' : ''));
  const past = list.filter(isPast);
  const others = list.filter((ev) => ev !== nxt);
  const leadBlock = nxt
    ? ('<p class="lead">' + esc(dateLine(nxt)) + (nxt.venue ? ' · ' + esc(nxt.venue) : '') + (nxt.city ? ', ' + esc(nxt.city) : '') + '</p>' +
      '<p><span class="badge">' + esc(badgeText(nxt)) + '</span></p>' +
      '<div class="evmeta">' +
      '<span><b>Organiser</b> ' + esc(nxt.organiser || nullText()) + '</span>' +
      (nxt.official_url ? '<span><a href="' + esc(nxt.official_url) + '">Official site</a></span>' : '<span>' + esc(nullText()) + '</span>') +
      (allowsCalendar(nxt) ? '<span><a href="../../events/ics/' + esc(nxt.id) + '.ics">Add to calendar</a></span>' : '') +
      '</div>' +
      '<p>' + esc(nxt.description || '') + '</p>' +
      '<h2>Deadlines</h2>' + deadlineHtml(nxt) +
      '<h2>Programme</h2>' + programmeHtml(nxt) +
      '<h2>Key exhibitors</h2>' + exhibitorHtml(nxt) +
      '<h2>Stats</h2>' + statsHtml(nxt))
    : ('<p class="lead">' + esc(cta) + '</p><p>' + esc(nullText()) + '</p>');
  const pastHtml = past.length
    ? '<h2>Past editions</h2><ul>' + past.map((ev) => '<li><a href="../' + esc(ev.id) + '/">' + esc(ev.name) + '</a> — Completed' +
      ((ev.intel_links || []).map((id) => ' · <a href="../' + esc(id) + '/summary/">post-event summary</a>').join('')) +
      '</li>').join('') + '</ul>'
    : '';
  const otherHtml = others.filter((ev) => !isPast(ev) && ev !== nxt).length
    ? '<h2>Other editions</h2><ul>' + others.filter((ev) => !isPast(ev)).map((ev) => '<li><a href="../' + esc(ev.id) + '/">' + esc(ev.name) + '</a> — ' + esc(dateLine(ev)) + '</li>').join('') + '</ul>'
    : '';
  const body = '<nav style="font-size:.8rem;color:var(--muted)"><a href="../../events.html">Events</a> › ' + esc(seriesName) + '</nav>' +
    '<h1>' + esc(h1) + '</h1>' + leadBlock + pastHtml + otherHtml +
    '<h2>' + esc(cta.indexOf('Meet the industry') === 0 ? cta : 'Meet the industry') + '</h2>';
  /* Keep the CTA sentence exact for the rollover check. */
  const body2 = body.replace('<h2>' + esc(cta.indexOf('Meet the industry') === 0 ? cta : 'Meet the industry') + '</h2>',
    '<p id="series-cta"><b>' + esc(cta) + '</b></p>');
  writePage('events/' + slug + '/index.html', shell(
    seriesName + ' — TransformerPath',
    nxt ? (nxt.description || seriesName) : cta,
    'https://transformerpath.com/events/' + slug + '/',
    body2,
    nxt ? jsonLd(nxt) : ''
  ));

  list.forEach((ev) => {
    const pastEd = isPast(ev);
    const badge = pastEd ? 'Completed' : badgeText(ev);
    const nextLink = nxt && nxt.id !== ev.id ? '<p><a href="../' + esc(slug) + '/">Next edition: ' + esc(nxt.name) + '</a></p>' : '<p><a href="../' + esc(slug) + '/">Series hub</a></p>';
    const edBody = '<nav style="font-size:.8rem"><a href="../../events.html">Events</a> › <a href="../' + esc(slug) + '/">' + esc(seriesName) + '</a> › ' + esc(ev.name) + '</nav>' +
      '<h1>' + esc(ev.name) + '</h1>' +
      '<p>' + esc(badge || '') + '</p>' +
      '<p class="lead">' + esc(dateLine(ev)) + '</p>' +
      '<div class="evmeta"><span><b>Venue</b> ' + esc(ev.venue || nullText()) + '</span>' +
      '<span><b>City</b> ' + esc(ev.city || nullText()) + '</span>' +
      '<span><b>Organiser</b> ' + esc(ev.organiser || nullText()) + '</span></div>' +
      (ev.official_url ? '<p><a href="' + esc(ev.official_url) + '">Official site</a></p>' : '<p>Official site: ' + esc(nullText()) + '</p>') +
      '<p>' + esc(ev.description || '') + '</p>' +
      (ev.relevance_reason ? '<p>' + esc(ev.relevance_reason) + '</p>' : '') +
      '<h2>Deadlines</h2>' + deadlineHtml(ev) +
      '<h2>Programme</h2>' + programmeHtml(ev) +
      '<h2>Key exhibitors</h2>' + exhibitorHtml(ev) +
      '<h2>Stats</h2>' + statsHtml(ev) +
      ((ev.intel_links || []).length ? '<h2>Post-event summary</h2><ul>' + ev.intel_links.map((id) => '<li><a href="../' + esc(id) + '/summary/">' + esc(id) + '</a></li>').join('') + '</ul>' : '') +
      nextLink +
      (pastEd ? '' : '<p id="series-cta"><b>Meet the industry at ' + esc(ev.name) + '</b></p>');
    writePage('events/' + ev.id + '/index.html', shell(
      ev.name + ' — TransformerPath',
      ev.description || ev.name,
      'https://transformerpath.com/events/' + ev.id + '/',
      edBody,
      pastEd ? '' : jsonLd(ev)
    ));
  });
});

/* Calendars: CONFIRMED upcoming only. */
const confirmedUpcoming = ALL.filter((ev) => allowsCalendar(ev) && ev.end >= TODAY);
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

/* Old public slugs that do not match the series slug. Keep them as
   aliases so existing links still open the series hub. */
const ALIASES = {
  '7th-international-colloquium-transformer-research-and-asset-management-ictram-2026': '7th-ictram-intl-colloquium-on-transformer-research-and-asset-management',
  'cigre-australia-a2': 'cigre-australia-a2-transformer-and-reactor-workshop',
  'cigre-canada': 'cigre-canada-conference-and-exhibition',
  'cigre-symposium': 'cigre-symposium-cairns',
  'distributech-international-2026': 'distributech',
  'elfack-gothenburg': 'elfack',
  'enlit-africa-2026-formerly-african-utility-week': 'enlit-africa',
  'ichve': 'ichve-ieee-intl-conf-on-high-voltage-engineering',
  'ieee-eic': 'ieee-eic-and-ipmhvc',
  'ieee-pes-transformers-committee-fall': 'ieee-pes-transformers-committee',
  'korea-smart-grid': 'korea-smart-grid-week',
  'megawhat-transformer-iandc-days-2026': 'events.html',
};
Object.keys(ALIASES).forEach((oldSlug) => {
  const target = ALIASES[oldSlug];
  const href = target === 'events.html' ? '/events.html' : ('/events/' + target + '/');
  const html = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">' +
    '<meta http-equiv="refresh" content="0; url=' + href + '">' +
    '<link rel="canonical" href="https://transformerpath.com' + href + '">' +
    '<title>Redirect</title></head><body><p><a href="' + href + '">Continue</a></p></body></html>';
  writePage('events/' + oldSlug + '/index.html', html);
});

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

console.log('OK series hubs ' + Object.keys(groups).length + ' | edition pages ' + ALL.length + ' | ics ' + confirmedUpcoming.length);
