#!/usr/bin/env node
/* build-exhibitions.js — TransformerPath Transformer Exhibition Directory.
 *
 * Generates the verified transformer-exhibition directory from
 * data/exhibitions.json (source-verified against each event's official site).
 *
 * Index page: exhibitions.html — a verified, searchable directory organised by
 * country, showing the structured metadata (organizer, event type, frequency,
 * dates, venue, transformer focus) for each event.
 *
 * Entity pages: for an exhibition already covered by a rich curated event page
 * (build-events.js) we link to that canonical page rather than generating a
 * duplicate/thin one. For exhibitions without a curated page we generate a full
 * entity page under /events/<slug>/ carrying the verified record and the
 * site's cross-links. This keeps the directory additive without sparse pages.
 *
 * Honesty rules: every field comes verbatim from data/exhibitions.json; the
 * transformer-focus grade and verification status/date are shown as recorded.
 * No exhibitor/visitor/area figure is invented — null is rendered as '—'.
 *
 * Run: node build-exhibitions.js  (after build-events.js).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }

const DATA = JSON.parse(fs.readFileSync('data/exhibitions.json', 'utf8'));
const ENTRIES = DATA.entries || [];

// Exhibition -> rich curated event page slug (build-events.js) where one exists.
// These are the canonical, deeply-linked entity pages; the directory links to
// them rather than generating a duplicate.
const CURATED_SLUG = {
  'CWIEME Berlin 2026': 'cwieme-berlin',
  'CWIEME Shanghai 2026': 'cwieme-shanghai',
  'IEEE PES T&D Conference & Exposition 2026': 'ieee-pes-td',
  'CIGRE Paris Session 2026': 'cigre-paris',
  'Middle East Energy 2026 (50th edition)': 'middle-east-energy',
  'ELECRAMA 2027 (17th edition)': 'elecrama',
  'Enlit Europe 2026': 'enlit-europe',
  'WETEX 2026 (28th edition)': 'wetex',
  'HANNOVER MESSE 2026': 'hannover-messe',
  'WIN EURASIA 2026 (incl. Electrotech Eurasia)': 'win-eurasia',
  'IEEE PES General Meeting 2026': 'ieee-pes-general-meeting',
  'GCC POWER 2026 / CIGRE 22nd Conference': 'gcc-power',
};

const MARKET_BY_COUNTRY = {
  'United States': 'usa', 'United Arab Emirates': 'uae', 'Saudi Arabia': 'saudi-arabia',
  'India': 'india', 'China': 'china', 'Germany': 'germany', 'Türkiye': 'turkiye',
  'Austria': 'austria', 'Italy': 'italy', 'Canada': 'canada', 'Croatia': 'croatia',
  'France': 'france', 'Hungary': 'hungary', 'Indonesia': 'indonesia', 'Oman': 'oman',
  'South Africa': 'south-africa',
};
const TYPE_LABEL = { 'Exhibition': 'Exhibition', 'Conference': 'Conference', 'Exhibition + Conference': 'Exhibition + Conference', 'Technical Conference': 'Technical Conference', 'Technical Colloquium': 'Technical Colloquium', 'Technical Symposium': 'Technical Symposium', 'Conference + Exhibition': 'Conference + Exhibition' };

// Replace the '&' in a slug for the market link label.
const marketSlug = (c) => MARKET_BY_COUNTRY[c] || slugify(c);

function getEventStatus(e) {
  const dates = (e.next_dates || '').match(/(\d{4}-\d{2}-\d{2})/g) || [];
  const end = dates[1] || dates[0] || '';
  const today = '2026-09-11';
  return (end && end < today) ? 'Completed' : 'Upcoming';
}

// Travelpayout-affiliated attendee buttons (Book Hotel / Flights / Things to Do /
// Add to calendar) for a verified exhibition. Mirrors the events.html pattern so
// the Exhibitions directory is monetized like the Events calendar. The calendar
// entry is a data: URI VEVENT; hotel uses a destination-scoped hotellook search.
const TP = { hotel: 'https://search.hotellook.com/?marker=736890&destination=', flights: 'https://kiwi.tpk.ro/dClaRHg1', activities: 'https://kkday.tpk.ro/VGC9WqGf' };
function travelButtons(e, slug) {
  if (!e.city || getEventStatus(e) === 'Completed') return '';
  const dest = encodeURIComponent(e.city);
  const hotel = TP.hotel + dest;
  // Build an .ics-safe calendar URI from the event name/city/country.
  const name = String(e.event_name || '').replace(/[\r\n]/g, ' ').trim();
  const loc = [e.city, e.country].filter(Boolean).join(', ');
  const dates = (e.next_dates || '').match(/(\d{4})-(\d{2})-(\d{2})/g) || [];
  const start = dates[0] ? dates[0].replace(/-/g, '') : '';
  const end = dates[1] ? dates[1].replace(/-/g, '') : start;
  const cal = 'data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR%0D%0AVERSION%3A2.0%0D%0APRODID%3A-%2F%2FTransformerPath%2F%2FEvents%2F%2FEN%0D%0ACALSCALE%3AGREGORIAN%0D%0ABEGIN%3AVEVENT%0D%0AUID%3A' + (start || 'tbd') + '%40transformerpath.com%0D%0ADTSTAMP%3A20260901T000000Z%0D%0ADTSTART%3BVALUE%3DDATE%3A' + (start || '') + '%0D%0ADTEND%3BVALUE%3DDATE%3A' + (end || '') + '%0D%0ASUMMARY%3A' + encodeURIComponent(name) + '%0D%0ALOCATION%3A' + encodeURIComponent(loc) + '%0D%0AEND%3AVEVENT%0D%0AEND%3AVCALENDAR';
  return '<div class="ev-travel" style="margin:6px 0 4px">' +
    '<div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">Travel links may earn an affiliate commission to support TransformerPath independent research.</div>' +
    '<a class="btn btn-outline btn-sm" data-aff="hotel" data-ev="' + esc(name) + '" href="' + esc(hotel) + '" target="_blank" rel="noopener sponsored">🏨 Book Hotel</a> ' +
    '<a class="btn btn-outline btn-sm" data-aff="flights" data-ev="' + esc(name) + '" href="' + esc(TP.flights) + '" target="_blank" rel="noopener sponsored">✈ Find Flights</a> ' +
    '<a class="btn btn-outline btn-sm" data-aff="activities" data-ev="' + esc(name) + '" href="' + esc(TP.activities) + '" target="_blank" rel="noopener sponsored">&#127915;&#65039; Things to Do</a> ' +
    '<a class="btn btn-outline btn-sm" data-aff="calendar" data-ev="' + esc(name) + '" href="' + cal + '" download target="_blank" rel="noopener">&#128197; Add</a>' +
    '</div>';
}

function eventPage(e) {
  const slug = slugify(e.event_name);
  const url = 'https://transformerpath.com/events/' + slug + '/';
  const market = marketSlug(e.country);
  const marketExists = market && fs.existsSync('markets/' + market + '/index.html');
  const marketLink = marketExists ? '<a class="tpill" href="../../markets/' + market + '/">' + esc(e.country) + ' market hub</a>' : '';
  const status = getEventStatus(e);
  // Component categories relevant to transformer exhibitions (cross-link).
  const comps = ['transformer-bushings', 'on-load-tap-changers', 'insulation-materials', 'transformer-cooling', 'protection-monitoring', 'conductors-and-core'];
  const compPills = comps.map(function (c) { return '<a class="tpill" href="../../components/' + c + '.html">' + esc(c.replace(/-/g, ' ')) + '</a>'; }).join(' ');
  const row = function (k, v) { return v ? '<tr><th scope="row">' + esc(k) + '</th><td>' + esc(v) + '</td></tr>' : ''; };
  const schema = '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', name: e.event_name, startDate: (e.next_dates || '').split(' to ')[0], endDate: (e.next_dates || '').split(' to ')[1], eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: { '@type': 'Place', name: e.venue, address: { '@type': 'PostalAddress', addressLocality: e.city, addressRegion: e.state, addressCountry: e.country } }, organizer: { '@type': 'Organization', name: e.organizer } }) + '</script>';

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(e.event_name) + ' — Transformer Exhibition | TransformerPath</title>' +
    '<meta name="description" content="' + esc(e.event_name) + ' (' + esc(e.city + ', ' + e.country) + ') — a ' + esc(e.event_type) + ' (' + esc(e.frequency) + '), ' + esc(e.next_dates) + '. ' + esc((e.transformer_focus || '').slice(0, 130)) + '. Verified source-tracked by TransformerPath.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(e.event_name) + ' — Transformer Exhibition"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css?v=12"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' + schema +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.7rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:26px}.c-wrap .evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:6px 0 16px}.c-wrap .evmeta b{color:var(--text)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap table{width:100%;border-collapse:collapse;margin:10px 0}.c-wrap table th{text-align:left;color:var(--muted);font-weight:600;padding:6px 10px;border-bottom:1px solid var(--border);width:36%}.c-wrap table td{padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text)}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../exhibitions.html" style="color:var(--accent)">Exhibitions</a> › ' + esc(e.city) + ' › ' + esc(e.event_name) + '</nav>' +
    '<h1>' + esc(e.event_name) + '</h1>' +
    '<div class="evmeta"><span><b>Country</b> ' + esc(e.country) + '</span>' + (e.state ? '<span><b>Region</b> ' + esc(e.state) + '</span>' : '') + (e.city ? '<span><b>City</b> ' + esc(e.city) + '</span>' : '') + (e.next_dates ? '<span><b>Dates</b> ' + esc(e.next_dates) + '</span>' : '') + '<span><b>Status</b> ' + (status === 'Completed' ? '<span style="color:var(--muted);font-weight:700">Completed</span>' : '<span style="color:var(--green);font-weight:700">Upcoming</span>') + '</span></div>' +
    '<p class="lead" style="margin-bottom:14px">A ' + esc(e.event_type) + ' (' + esc(e.frequency) + '), verified against its official website on ' + esc(e.verification_date) + (status === 'Completed' ? ' · <i>This edition has ended</i>' : '') + '.</p>' +
    (e.website ? '<a class="btn btn-amber" href="' + esc(e.website) + '" target="_blank" rel="noopener" data-track="event_register" data-track-event="' + esc(slug) + '">Official event website →</a>' : '') +
    travelButtons(e, slug) +
    '<h2>Exhibition record</h2><table>' +
    row('Event', e.event_name) + row('Organizer', e.organizer) + row('Country', e.country) + row('Region / state', e.state) + row('City', e.city) +
    row('Event type', e.event_type) + row('Frequency', e.frequency) + row('Edition status', status) + row('Dates', e.next_dates) + row('Venue', e.venue) +
    row('Exhibition area (sqm)', e.exhibition_area_sqm) + row('Exhibitors', e.exhibitor_count) + row('Visitors', e.visitor_count) +
    row('Transformer focus', e.transformer_focus) + row('Verification', e.verification_status + ' · ' + e.verification_date) +
    '</table>' +
    '<h2>About</h2><p style="line-height:1.7;color:var(--text)">' + esc(e.description) + '</p>' +
    '<h2>Related components</h2><div style="margin:4px 0 8px">' + compPills + '</div>' +
    (marketLink ? '<h2>Related market</h2><div>' + marketLink + '</div>' : '') +
    '<p style="font-size:.8rem;color:var(--muted);margin-top:18px">Directory entries are informational listings verified against the event\'s public website on the recorded date; they do not imply endorsement, verify event quality, or reflect commercial affiliation. Always confirm dates on the official site before travel. Report a <a href="mailto:hello@transformerpath.com?subject=Exhibition%20correction" style="color:var(--accent)">correction</a>.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Meet the transformer industry at ' + esc(e.event_name) + '</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Get your product in front of transformer buyers, or submit an RFQ to reach suppliers in this market.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-component_category="' + esc(slug) + '">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-component_category="' + esc(slug) + '">Get Verified</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n</body>\n</html>';
}

// Index page HTML — a searchable, country-organised directory.
function indexPage() {
  const byCountry = {};
  ENTRIES.forEach(function (e) { (byCountry[e.country] = byCountry[e.country] || []).push(e); });
  const countries = Object.keys(byCountry).sort();
  const countryBlocks = countries.map(function (c) {
    const rows = byCountry[c].sort(function (a, b) { return String(a.next_dates || '').localeCompare(String(b.next_dates || '')); }).map(function (e) {
      const curated = CURATED_SLUG[e.event_name];
      const href = curated && fs.existsSync('events/' + curated + '/index.html') ? 'events/' + curated + '/' : 'events/' + slugify(e.event_name) + '/';
      const focus = String(e.transformer_focus || '').split(' - ')[0];
      const status = getEventStatus(e);
      const statusBadge = status === 'Completed'
        ? '<span style="display:inline-block;background:#1d2330;color:#9fb0c4;font-size:.72rem;font-weight:700;padding:1px 7px;border-radius:6px;margin-left:6px">Completed</span>'
        : '<span style="display:inline-block;background:rgba(34,197,94,.15);color:#4ade80;font-size:.72rem;font-weight:700;padding:1px 7px;border-radius:6px;margin-left:6px">Upcoming</span>';
      return '<div class="ex-row" data-name="' + esc(e.event_name.toLowerCase()) + '" data-country="' + esc(e.country.toLowerCase()) + '" data-city="' + esc((e.city || '').toLowerCase()) + '" data-org="' + esc((e.organizer || '').toLowerCase()) + '"><div class="ex-top"><a class="ex-name" href="' + href + '">' + esc(e.event_name) + '</a><span class="ex-focus">' + esc(focus) + '</span>' + statusBadge + '</div>' +
        '<div class="ex-meta">' + esc(e.city) + (e.state ? ', ' + esc(e.state) : '') + ' · ' + esc(e.event_type) + ' · ' + esc(e.frequency) + ' · ' + esc(e.next_dates) + (e.venue ? ' · ' + esc(e.venue) : '') + '</div>' +
        '<div class="ex-src"><b>' + esc(e.organizer) + '</b> · ' + esc(e.verification_status) + '</div>' +
        (e.website ? '<a class="ex-site" href="' + esc(e.website) + '" target="_blank" rel="noopener">Official site ↗</a>' : '') +
        '</div>';
    }).join('');
    return '<div class="region-h">' + esc(c) + ' (' + byCountry[c].length + ')</div>' + rows;
  }).join('');
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Transformer Exhibitions, Trade Shows &amp; Conferences — Global Directory | TransformerPath</title>' +
    '<meta name="description" content="A verified, searchable directory of transformer-related exhibitions, trade shows, conferences and industry events worldwide — CWIEME, IEEE PES T&amp;D, CIGRE, Middle East Energy, DistribuTECH, Enlit and more — organised by country with dates, venues, organisers and transformer focus.">' +
    '<link rel="canonical" href="https://transformerpath.com/exhibitions.html">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="Transformer Exhibitions &amp; Conferences — Global Directory"><meta property="og:url" content="https://transformerpath.com/exhibitions.html">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">' +
    '<link rel="stylesheet" href="style.css?v=12"><link rel="manifest" href="manifest.webmanifest">' +
    '<style>.ex-wrap{max-width:1000px;margin:0 auto;padding:44px 20px 90px}.ex-wrap h1{font-size:2rem;color:var(--ink)}.ex-wrap .lead{color:var(--muted);font-size:1.02rem;max-width:820px;margin:8px 0 26px}.ex-counts{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 26px}.ex-counts .s{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 18px;text-align:center;min-width:110px}.ex-counts .s b{color:var(--text);font-size:1.4rem;display:block}.ex-counts .s small{color:var(--muted);font-size:.78rem;font-weight:600}.region-h{font-size:1.05rem;font-weight:800;color:var(--ink);text-transform:uppercase;letter-spacing:.05em;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}.ex-row{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:13px 16px;margin-bottom:10px}.ex-row .ex-top{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px}.ex-row .ex-name{color:var(--accent);font-weight:700;font-size:.98rem;text-decoration:none}.ex-row .ex-name:hover{text-decoration:underline}.ex-row .ex-focus{color:var(--muted);font-size:.76rem;font-weight:600}.ex-row .ex-meta{color:var(--muted);font-size:.85rem;margin:4px 0}.ex-row .ex-src{color:var(--muted);font-size:.8rem}.ex-row .ex-src b{color:var(--text)}.ex-row .ex-site{display:inline-block;color:var(--accent);font-size:.78rem;font-weight:600;margin-top:6px;text-decoration:none}.ex-row .ex-site:hover{text-decoration:underline}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="ex-wrap">' +
    '<h1>Transformer <span style="color:var(--accent)">Exhibitions</span> &amp; Conferences</h1>' +
    '<p class="lead">A verified, searchable directory of transformer-related exhibitions, trade shows, conferences and industry events worldwide. Each entry is checked against the event\'s official website for dates, venue, organiser and transformer relevance, and carries a verification status. Organised by country — filter by category or search to find the events that matter to your market.</p>' +
    '<div style="margin:0 0 18px"><a class="btn btn-outline btn-sm" data-aff="hotel" href="' + esc(TP.hotel) + '" target="_blank" rel="noopener sponsored">🏨 Book Hotels</a> <a class="btn btn-outline btn-sm" data-aff="flights" href="' + esc(TP.flights) + '" target="_blank" rel="noopener sponsored">✈ Find Flights</a> <a class="btn btn-outline btn-sm" data-aff="activities" href="' + esc(TP.activities) + '" target="_blank" rel="noopener sponsored">&#127915;&#65039; Things to Do</a></div>' +
    '<div class="ex-counts" id="exCounts"></div>' +
    '<input id="exSearch" class="acc-search" type="search" placeholder="Search events… e.g. CWIEME, CIGRE, transformer, Dubai" aria-label="Search exhibitions" style="width:100%;max-width:420px;display:block;margin:0 0 22px;padding:11px 16px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:.95rem;background:var(--card);color:var(--text)">' +
    '<div id="exList">' + countryBlocks + '</div>' +
    '<p style="font-size:.8rem;color:var(--muted);margin-top:22px">Every entry is verified against the event\'s official website on the recorded verification date. Directory listings are informational and do not imply endorsement, verify event quality, or reflect commercial affiliation. Report a <a href="mailto:hello@transformerpath.com?subject=Exhibition%20correction" style="color:var(--accent)">correction</a>. See the <a href="methodology.html" style="color:var(--accent)">research methodology</a>.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Exhibit or attend a transformer event?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Feature your company on TransformerPath, or submit an RFQ to reach transformer suppliers worldwide.</p>' +
    '<a class="btn btn-amber" href="rfq.html">Submit an RFQ →</a> <a class="btn btn-outline btn-sm" href="list-company.html">Get Verified</a></div>' +
    '</main>\n' + FOOT + '\n<script src="analytics.js" defer></script>\n<script>\n(function(){var q=document.getElementById(\"exSearch\");if(!q)return;q.addEventListener(\"input\",function(){var v=this.value.trim().toLowerCase();var rows=document.querySelectorAll(\".ex-row\");var n=0;rows.forEach(function(r){var hay=(r.getAttribute(\"data-name\")||\"\")+\" \"+(r.getAttribute(\"data-country\")||\"\")+\" \"+(r.getAttribute(\"data-city\")||\"\")+\" \"+(r.getAttribute(\"data-org\")||\"\");var show=!v||hay.indexOf(v)>=0;r.style.display=show?\"\":\"none\";if(show)n++;});var el=document.getElementById(\"exList\");if(el){var head=el.querySelectorAll(\".region-h\");head.forEach(function(h){var visible=0;var sib=h.nextElementSibling;while(sib&&sib.classList&&!sib.classList.contains(\"region-h\")){if(sib.style.display!==\"none\")visible++;sib=sib.nextElementSibling;}h.style.display=visible?\"\":\"none\";});}\nvar c=document.getElementById(\"exCounts\");if(c){c.innerHTML=\"<div class=\\\"s\\\"><b>\"+n+\"</b><small>Showing</small></div>\";}});})();\n</script>\n</body>\n</html>';
}

// Generate entity pages for exhibitions WITHOUT a rich curated page.
fs.mkdirSync('events', { recursive: true });
let newPages = 0, linked = 0;
ENTRIES.forEach(function (e) {
  const curated = CURATED_SLUG[e.event_name];
  if (curated && fs.existsSync('events/' + curated + '/index.html')) {
    linked++; // canonical rich page already exists; index links to it.
    return;
  }
  const slug = slugify(e.event_name);
  fs.mkdirSync('events/' + slug, { recursive: true });
  fs.writeFileSync('events/' + slug + '/index.html', eventPage(e));
  newPages++;
});
fs.mkdirSync('.', { recursive: true });
fs.writeFileSync('exhibitions.html', indexPage());
console.log('exhibitions directory entries:', ENTRIES.length, '| new entity pages:', newPages, '| linked to curated pages:', linked);

// meta for other pages/sitemap
fs.writeFileSync('data/exhibitions-meta.json', JSON.stringify({ total: ENTRIES.length, new_pages: newPages, linked_curated: linked, countries: [...new Set(ENTRIES.map(function (e) { return e.country; }))].length }, null, 2));
