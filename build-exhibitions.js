#!/usr/bin/env node
/* build-exhibitions.js — exhibitions are a view of the canonical feed:
 * type=exhibition AND relevance_tier in (CORE, HIGH).
 * data/exhibitions.json is generated. It is not a second catalogue.
 */
'use strict';
const fs = require('fs');
const { dubaiToday, dateLine, nullText, badgeText, allowsCalendar } = require('./lib/event-display');
const { eventBadge } = require('./lib/provenance-badge');
const tpAff = require('./lib/travelpayouts');
const { platformToday } = require('./lib/event-status');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const TODAY = platformToday();
const canon = JSON.parse(fs.readFileSync('data/events-canonical.json', 'utf8'));
const rows = (canon.canonical_editions || []).filter((ev) => ev.type === 'exhibition' && (ev.relevance_tier === 'CORE' || ev.relevance_tier === 'HIGH'));
rows.sort((a, b) => String(a.start || '9999').localeCompare(String(b.start || '9999')));

const generated = {
  $schema: 'https://transformerpath.com/exhibitions.schema.json',
  directory_type: 'transformer-exhibitions',
  generated_date: TODAY,
  note: 'Generated from data/events-canonical.json. type=exhibition and relevance_tier CORE or HIGH. Unknown figures stay null.',
  entries: rows.map((ev) => ({
    event_name: ev.name,
    id: ev.id,
    country: ev.country,
    city: ev.city,
    website: ev.official_url,
    organizer: ev.organiser,
    event_type: 'Exhibition',
    next_dates: ev.start ? (ev.start + ' to ' + (ev.end || ev.start)) : null,
    date_status: ev.date_status,
    venue: ev.venue,
    exhibition_area_sqm: ev.stats && ev.stats.area_sqm ? ev.stats.area_sqm.value : null,
    exhibitor_count: ev.stats && ev.stats.exhibitors ? ev.stats.exhibitors.value : null,
    visitor_count: ev.stats && ev.stats.visitors ? ev.stats.visitors.value : null,
    description: ev.description,
    verification_status: null,
    source_checked_at: ev.source_checked_at,
    source_url: ev.source_url,
  })),
};
fs.writeFileSync('data/exhibitions.json', JSON.stringify(generated, null, 2) + '\n');

const upcoming = rows.filter((ev) => ev.end && ev.end >= platformToday());
const cards = upcoming.map((ev) => {
  const badge = eventBadge(ev) || (badgeText(ev) ? '<span class="badge-unc">' + esc(badgeText(ev)) + '</span>' : '');
  return '<div class="intel-item"><h3>' + esc(ev.name) + (badge ? ' ' + badge : '') + '</h3>' +
    '<div class="dates">' + esc(dateLine(ev)) + '</div>' +
    '<div class="venue">' + esc(ev.venue || nullText()) + (ev.city ? ' — ' + esc(ev.city) : '') + (ev.country ? ', ' + esc(ev.country) : '') + '</div>' +
    '<p style="color:var(--muted)">' + esc(ev.description || '') + '</p>' +
    '<p style="color:var(--muted);font-size:.86rem">Exhibitors: ' + esc(ev.stats && ev.stats.exhibitors && ev.stats.exhibitors.value != null ? ev.stats.exhibitors.value : nullText()) +
    ' · Visitors: ' + esc(ev.stats && ev.stats.visitors && ev.stats.visitors.value != null ? ev.stats.visitors.value : nullText()) + '</p>' +
    '<a class="btn btn-outline btn-sm" href="events/' + esc(ev.series_slug || ev.id) + '/">Series hub</a> ' +
    (ev.official_url ? '<a class="btn btn-amber btn-sm" href="' + esc(ev.official_url) + '">Official site</a>' : '') +
    (allowsCalendar(ev) && ev.city ? tpAff.calendarLinks({ slug: ev.series_slug || ev.id, city: ev.city, checkIn: ev.start, checkOut: ev.end, disclosureHref: 'affiliate-disclosure.html' }) : '') +
    '</div>';
}).join('\n');

const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>Transformer Exhibitions | TransformerPath</title>' +
  '<meta name="description" content="Transformer and power-industry exhibitions with dates taken from the canonical event feed.">' +
  '<link rel="canonical" href="https://transformerpath.com/exhibitions.html">' +
  '<link rel="stylesheet" href="style.css?v=14"><link rel="stylesheet" href="tp-nav.css?v=14">' +
  '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"></head><body>\n' + HEAD +
  '<main id="main" class="c-wrap" style="max-width:900px;margin:0 auto;padding:44px 20px 80px">' +
  '<h1>Transformer exhibitions</h1>' +
  '<p class="lead" style="color:var(--muted)">A view of canonical editions where type is exhibition and relevance is CORE or HIGH. ' +
  upcoming.length + ' upcoming in this view. Figures the organiser has not published stay as “' + esc(nullText()) + '”.</p>' +
  '<p><a href="events.html">Full events calendar</a> · <a href="events/calendar.ics">Download confirmed calendar</a> · <a href="webinars.html">Webinars</a></p>' +
  cards +
  '</main>\n' + FOOT + '\n</body></html>';
fs.writeFileSync('exhibitions.html', html);
console.log('exhibitions view: ' + rows.length + ' (' + upcoming.length + ' upcoming)');
