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
const CFG = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
const CSSV = (CFG.assets && CFG.assets.css) || 13;
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }

const DATA = JSON.parse(fs.readFileSync('data/exhibitions.json', 'utf8'));
const ENTRIES = DATA.entries || [];

// Exhibition -> rich curated event page slug (build-events.js) where one exists.
// These are the canonical, deeply-linked entity pages; the directory links to
// them rather than generating a duplicate.
const CURATED_SLUG = {
  'CWIEME Berlin 2027': 'cwieme-berlin',
  'CWIEME Berlin 2026': 'cwieme-berlin',
  'CWIEME Shanghai 2027': 'cwieme-shanghai',
  'CWIEME Shanghai 2026': 'cwieme-shanghai',
  'IEEE PES T&D Conference & Exposition 2028': 'ieee-pes-td',
  'IEEE PES T&D Conference & Exposition 2026': 'ieee-pes-td',
  'CIGRE Paris Session 2028': 'cigre-paris',
  'CIGRE Paris Session 2026': 'cigre-paris',
  'Middle East Energy 2027 (51st edition)': 'middle-east-energy',
  'Middle East Energy 2026 (50th edition)': 'middle-east-energy',
  'ELECRAMA 2027 (17th edition)': 'elecrama',
  'Enlit Europe 2026': 'enlit-europe',
  'WETEX 2026 (28th edition)': 'wetex',
  'HANNOVER MESSE 2027': 'hannover-messe',
  'HANNOVER MESSE 2026': 'hannover-messe',
  'WIN EURASIA 2027 (incl. Electrotech Eurasia)': 'win-eurasia',
  'WIN EURASIA 2026 (incl. Electrotech Eurasia)': 'win-eurasia',
  'IEEE PES General Meeting 2027': 'ieee-pes-general-meeting',
  'IEEE PES General Meeting 2026': 'ieee-pes-general-meeting',
  'GCC POWER 2026 / CIGRE 22nd Conference': 'gcc-power',
  'Coiltech Italia 2026 (17th edition)': 'coiltech-italia',
  'CIGRE Australia A2 Transformer & Reactor Workshop 2027': 'cigre-australia-a2'
};

const MARKET_BY_COUNTRY = {
  'United States': 'usa', 'United Arab Emirates': 'uae', 'Saudi Arabia': 'saudi-arabia',
  'India': 'india', 'China': 'china', 'Germany': 'germany', 'Türkiye': 'turkiye',
  'Austria': 'austria', 'Italy': 'italy', 'Canada': 'canada', 'Croatia': 'croatia',
  'France': 'france', 'Hungary': 'hungary', 'Indonesia': 'indonesia', 'Oman': 'oman',
  'South Africa': 'south-africa', 'Switzerland': 'switzerland', 'Sweden': 'sweden',
  'Australia': 'australia'
};

const marketSlug = (c) => MARKET_BY_COUNTRY[c] || slugify(c);

function getEventStatus(e) {
  const dates = (e.next_dates || '').match(/(\d{4}-\d{2}-\d{2})/g) || [];
  const end = dates[1] || dates[0] || '';
  const today = new Date().toISOString().slice(0, 10);
  if (!end) return 'Dates TBC';
  return (end < today) ? 'Completed' : 'Upcoming';
}

const TP = { hotel: 'https://search.hotellook.com/?marker=736890&destination=', flights: 'https://kiwi.tpk.ro/dClaRHg1', activities: 'https://kkday.tpk.ro/VGC9WqGf' };
function travelButtons(e, slug) {
  const st = getEventStatus(e);
  if (!e.city || st === 'Completed' || st === 'Dates TBC') return '';
  const dest = encodeURIComponent(e.city);
  const hotel = TP.hotel + dest;
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
  const comps = ['transformer-bushings', 'on-load-tap-changers', 'insulation-materials', 'transformer-cooling', 'protection-monitoring', 'conductors-and-core'];
  const compPills = comps.map(function (c) { return '<a class="tpill" href="../../components/' + c + '.html">' + esc(c.replace(/-/g, ' ')) + '</a>'; }).join(' ');
  const row = function (k, v) { return v ? '<tr><th scope="row">' + esc(k) + '</th><td>' + esc(v) + '</td></tr>' : ''; };
  const dateParts = (e.next_dates || '').match(/(\d{4}-\d{2}-\d{2})/g) || [];
  const schemaObj = { '@context': 'https://schema.org', '@type': 'Event', name: e.event_name, eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: { '@type': 'Place', name: e.venue, address: { '@type': 'PostalAddress', addressLocality: e.city, addressRegion: e.state, addressCountry: e.country } }, organizer: { '@type': 'Organization', name: e.organizer } };
  if (dateParts[0]) schemaObj.startDate = dateParts[0];
  if (dateParts[1] || dateParts[0]) schemaObj.endDate = dateParts[1] || dateParts[0];
  const schema = '<script type="application/ld+json">' + JSON.stringify(schemaObj) + '</script>';

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(e.event_name) + ' — Transformer Exhibition | TransformerPath</title>' +
    '<meta name="description" content="' + esc(e.event_name) + ' (' + esc(e.city + ', ' + e.country) + ') — a ' + esc(e.event_type) + ' (' + esc(e.frequency) + '), ' + esc(e.next_dates) + '. ' + esc((e.transformer_focus || '').slice(0, 130)) + '. Verified source-tracked by TransformerPath.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(e.event_name) + ' — Transformer Exhibition"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css?v=' + CSSV + '"><link rel="stylesheet" href="../../tp-nav.css?v=' + CSSV + '"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' + schema +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.7rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:26px}.c-wrap .evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:6px 0 16px}.c-wrap .evmeta b{color:var(--text)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap table{width:100%;border-collapse:collapse;margin:10px 0}.c-wrap table th{text-align:left;color:var(--muted);font-weight:600;padding:6px 10px;border-bottom:1px solid var(--border);width:36%}.c-wrap table td{padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text)}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../exhibitions.html" style="color:var(--accent)">Exhibitions</a> › ' + esc(e.city) + ' › ' + esc(e.event_name) + '</nav>' +
    '<h1>' + esc(e.event_name) + '</h1>' +
    '<div class="evmeta"><span><b>Country</b> ' + esc(e.country) + '</span>' + (e.state ? '<span><b>Region</b> ' + esc(e.state) + '</span>' : '') + (e.city ? '<span><b>City</b> ' + esc(e.city) + '</span>' : '') + (e.next_dates ? '<span><b>Dates</b> ' + esc(e.next_dates) + '</span>' : '<span><b>Dates</b> Not confirmed</span>') + '<span><b>Status</b> ' + (status === 'Completed' ? '<span style="color:var(--muted);font-weight:700">Completed</span>' : status === 'Dates TBC' ? '<span style="color:#b45309;font-weight:700">Dates TBC</span>' : '<span style="color:var(--green);font-weight:700">Upcoming</span>') + '</span>' + (e.city || e.country ? '<span><a href="../../map.html?layer=events&amp;q=' + encodeURIComponent(e.event_name) + '" style="color:var(--accent)">View on map</a></span>' : '') + '</div>' +
    '<p class="lead" style="margin-bottom:14px">A ' + esc(e.event_type) + ' (' + esc(e.frequency) + '), verified against its official website on ' + esc(e.verification_date) + (status === 'Completed' ? ' · <i>This edition has ended</i>' : '') + '.</p>' +
    (e.website ? '<a class="btn btn-amber" href="' + esc(e.website) + '" target="_blank" rel="noopener" data-track="event_register" data-track-event="' + esc(slug) + '">Official event website →</a>' : '') +
    travelButtons(e, slug) +
    '<h2>Exhibition record</h2><table>' +
    row('Event', e.event_name) + row('Organizer', e.organizer) + row('Country', e.country) + row('Region / state', e.state) + row('City', e.city) +
    row('Event type', e.event_type) + row('Frequency', e.frequency) + row('Edition status', status) + row('Dates', e.next_dates) + row('Venue', e.venue) +
    row('Exhibition area (sqm)', e.exhibition_area_sqm) + row('Exhibitors', e.exhibitor_count) + row('Visitors', e.visitor_count) +
    row('Transformer focus', e.transformer_focus) + row('Verification', '✓ Verified · ' + e.verification_date) +
    '</table>' +
    '<h2>About</h2><p style="line-height:1.7;color:var(--text)">' + esc(e.description) + '</p>' +
    '<h2>Related components</h2><div style="margin:4px 0 8px">' + compPills + '</div>' +
    (marketLink ? '<h2>Related market</h2><div>' + marketLink + '</div>' : '') +
    '<p style="font-size:.8rem;color:var(--muted);margin-top:18px">Directory entries are informational listings verified against the event\'s public website on the recorded date; they do not imply endorsement, verify event quality, or reflect commercial affiliation. Always confirm dates on the official site before travel. Report a <a href="mailto:hello@transformerpath.com?subject=Exhibition%20correction" style="color:var(--accent)">correction</a>.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Meet the transformer industry at ' + esc(e.event_name) + '</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Get your product in front of transformer buyers, or submit an RFQ to reach suppliers in this market.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-component_category="' + esc(slug) + '">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-component_category="' + esc(slug) + '">Get Verified</a></div>' +
    '<div style="font-size:.85rem;color:var(--muted);text-align:center;margin-top:8px">Explore: <a href="../../events.html" style="color:var(--accent);font-weight:600">Events</a> · <a href="../../webinars.html" style="color:var(--accent);font-weight:600">Webinars</a> · <a href="../../learn.html" style="color:var(--accent);font-weight:600">Learn</a> · <a href="../../intel.html" style="color:var(--accent);font-weight:600">Intel</a> · <a href="../../map.html?layer=events" style="color:var(--accent);font-weight:600">Map</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js?v=7" defer></script>\n</body>\n</html>';
}

function renderRow(e) {
  const curated = CURATED_SLUG[e.event_name];
  const href = curated && fs.existsSync('events/' + curated + '/index.html') ? 'events/' + curated + '/' : 'events/' + slugify(e.event_name) + '/';
  const focusRaw = String(e.transformer_focus || '').split(' - ')[0].trim();
  const status = getEventStatus(e);
  const statusBadge = status === 'Completed'
    ? '<span style="display:inline-block;background:#1d2330;color:#9fb0c4;font-size:.72rem;font-weight:700;padding:1px 7px;border-radius:6px;margin-left:6px">Completed</span>'
    : status === 'Dates TBC'
    ? '<span style="display:inline-block;background:rgba(180,83,9,.14);color:#b45309;font-size:.72rem;font-weight:700;padding:1px 7px;border-radius:6px;margin-left:6px">Dates TBC</span>'
    : '<span style="display:inline-block;background:rgba(34,197,94,.15);color:#4ade80;font-size:.72rem;font-weight:700;padding:1px 7px;border-radius:6px;margin-left:6px">Upcoming</span>';
  
  const focusBadgeColor = focusRaw === 'Primary' ? 'border-color:rgba(245,166,35,.5);color:var(--accent)' : 'color:var(--muted)';
  return '<div class="ex-row" data-focus="' + esc(focusRaw.toLowerCase()) + '" data-type="' + esc((e.event_type || '').toLowerCase()) + '" data-status="' + esc(status.toLowerCase()) + '" data-name="' + esc(e.event_name.toLowerCase()) + '" data-country="' + esc(e.country.toLowerCase()) + '" data-city="' + esc((e.city || '').toLowerCase()) + '" data-org="' + esc((e.organizer || '').toLowerCase()) + '">' +
    '<div class="ex-top"><a class="ex-name" href="' + href + '">' + esc(e.event_name) + '</a>' +
    '<span class="tpill" style="font-size:.7rem;' + focusBadgeColor + '">' + esc(focusRaw) + ' Focus</span>' + statusBadge + '</div>' +
    '<div class="ex-meta">📍 ' + esc(e.city) + (e.state ? ', ' + esc(e.state) : '') + ', <b>' + esc(e.country) + '</b> · ' + esc(e.event_type) + ' · ' + esc(e.frequency) + ' · <b style="color:var(--text)">' + esc(e.next_dates) + '</b>' + (e.venue ? ' (' + esc(e.venue) + ')' : '') + '</div>' +
    '<p style="color:var(--muted);font-size:.88rem;margin:6px 0 8px;line-height:1.5">' + esc(e.description) + '</p>' +
    '<div class="ex-src"><b>' + esc(e.organizer) + '</b> · <span style="color:var(--accent)">✓ Verified</span> ' + esc(e.verification_date) + '</div>' +
    (e.website ? '<div style="margin-top:6px"><a class="ex-site" href="' + esc(e.website) + '" target="_blank" rel="noopener">Official site ↗</a>' + (status === 'Upcoming' ? ' · <a class="ex-site" href="' + href + '">View detail &amp; travel →</a>' : '') + '</div>' : '') +
    '</div>';
}

function indexPage() {
  const upcoming = ENTRIES.filter(e => getEventStatus(e) === 'Upcoming').sort((a, b) => String(a.next_dates || '').localeCompare(String(b.next_dates || '')));
  const past = ENTRIES.filter(e => getEventStatus(e) !== 'Upcoming').sort((a, b) => String(b.next_dates || '').localeCompare(String(a.next_dates || '')));
  
  const upcomingHtml = upcoming.map(renderRow).join('');
  const pastHtml = past.map(renderRow).join('');
  const totalCountries = [...new Set(ENTRIES.map(e => e.country))].length;
  const primaryCount = ENTRIES.filter(e => String(e.transformer_focus).startsWith('Primary')).length;

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Transformer Exhibitions, Trade Shows &amp; Conferences — Global Directory | TransformerPath</title>' +
    '<meta name="description" content="Verified global directory of transformer-specific trade shows, coil-winding expos and high-voltage conferences worldwide — CWIEME, Coiltech, IEEE PES T&amp;D, CIGRE, ELECRAMA, Middle East Energy, DistribuTECH, Enlit and more.">' +
    '<link rel="canonical" href="https://transformerpath.com/exhibitions.html">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="Transformer Exhibitions &amp; Conferences — Global Directory"><meta property="og:url" content="https://transformerpath.com/exhibitions.html">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">' +
    '<link rel="stylesheet" href="style.css?v=' + CSSV + '"><link rel="stylesheet" href="tp-nav.css?v=' + CSSV + '"><link rel="manifest" href="manifest.webmanifest">' +
    '<style>' +
    '.ex-wrap{max-width:1040px;margin:0 auto;padding:44px 20px 90px}' +
    '.ex-wrap h1{font-size:2.1rem;color:var(--ink);letter-spacing:-.02em}' +
    '.ex-wrap .lead{color:var(--muted);font-size:1.02rem;max-width:860px;margin:8px 0 24px;line-height:1.6}' +
    '.ex-counts{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 22px}' +
    '.ex-counts .s{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 18px;text-align:center;min-width:115px;flex:1}' +
    '.ex-counts .s b{color:var(--text);font-size:1.45rem;display:block}' +
    '.ex-counts .s small{color:var(--muted);font-size:.78rem;font-weight:600}' +
    '.filter-bar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;align-items:center}' +
    '.filter-pill{background:var(--card);border:1px solid var(--border);border-radius:999px;padding:5px 14px;font-size:.82rem;color:var(--text);cursor:pointer;user-select:none;transition:all .15s}' +
    '.filter-pill:hover{border-color:var(--accent)}' +
    '.filter-pill.active{background:var(--accent);color:#0a101d;font-weight:700;border-color:var(--accent)}' +
    '.section-title{font-size:1.25rem;font-weight:800;color:var(--ink);margin:32px 0 14px;display:flex;align-items:center;gap:8px}' +
    '.ex-row{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px;transition:border-color .15s}' +
    '.ex-row:hover{border-color:rgba(245,166,35,.4)}' +
    '.ex-row .ex-top{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}' +
    '.ex-row .ex-name{color:var(--accent);font-weight:700;font-size:1.05rem;text-decoration:none}' +
    '.ex-row .ex-name:hover{text-decoration:underline}' +
    '.ex-row .ex-meta{color:var(--muted);font-size:.86rem;margin:6px 0}' +
    '.ex-row .ex-src{color:var(--muted);font-size:.8rem}' +
    '.ex-row .ex-src b{color:var(--text)}' +
    '.ex-row .ex-site{display:inline-block;color:var(--accent);font-size:.82rem;font-weight:600;margin-top:4px;text-decoration:none}' +
    '.ex-row .ex-site:hover{text-decoration:underline}' +
    '</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="ex-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Exhibitions &amp; Conferences</nav>' +
    '<h1>Global Transformer <span style="color:var(--accent)">Exhibitions</span> &amp; Trade Shows</h1>' +
    '<p class="lead">A verified, curated directory of dedicated transformer manufacturing exhibitions, coil-winding trade fairs, T&amp;D expos, and international technical conferences. Every entry is verified against the organizer\'s official portal with edition dates, venues, focus classifications, and links. Looking for all industry events? Browse the <a href="events.html" style="color:var(--accent);font-weight:700">Events Calendar</a> (200+ global dates), <a href="webinars.html" style="color:var(--accent);font-weight:700">Webinars</a>, and <a href="map.html?layer=events" style="color:var(--accent);font-weight:700">Interactive Map</a>.</p>' +
    '<div class="ex-counts" id="exCounts">' +
    '<div class="s"><b>' + ENTRIES.length + '</b><small>Verified Shows</small></div>' +
    '<div class="s"><b>' + upcoming.length + '</b><small>Upcoming Editions</small></div>' +
    '<div class="s"><b>' + primaryCount + '</b><small>Primary Transformer Focus</small></div>' +
    '<div class="s"><b>' + totalCountries + '</b><small>Countries Covered</small></div>' +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 16px;align-items:center">' +
    '<input id="exSearch" class="acc-search" type="search" placeholder="Search exhibitions (e.g. CWIEME, Coiltech, Doble, Berlin, Dubai)…" aria-label="Search exhibitions" style="flex:1;min-width:260px;padding:11px 16px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:.95rem;background:var(--card);color:var(--text)">' +
    '</div>' +
    '<div class="filter-bar">' +
    '<span style="font-size:.82rem;color:var(--muted);font-weight:600;margin-right:4px">Focus:</span>' +
    '<span class="filter-pill active" data-filter="focus" data-val="all">All Focus</span>' +
    '<span class="filter-pill" data-filter="focus" data-val="primary">Primary (Transformer / Coil)</span>' +
    '<span class="filter-pill" data-filter="focus" data-val="major">Major (T&amp;D / Grid)</span>' +
    '<span class="filter-pill" data-filter="focus" data-val="secondary">Secondary (Industrial / Energy)</span>' +
    '</div>' +
    '<h2 class="section-title">⚡ Upcoming Editions (' + upcoming.length + ')</h2>' +
    '<div id="upcomingList">' + upcomingHtml + '</div>' +
    (past.length ? '<h2 class="section-title" style="margin-top:40px;color:var(--muted)">📁 Completed &amp; Archived Editions (' + past.length + ')</h2><div id="pastList">' + pastHtml + '</div>' : '') +
    '<p style="font-size:.8rem;color:var(--muted);margin-top:26px">Every entry is verified against official organizer portals on the recorded date. Listings are informational and do not imply endorsement or commercial affiliation. Report a <a href="mailto:hello@transformerpath.com?subject=Exhibition%20Correction" style="color:var(--accent)">correction</a>.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:18px 20px;text-align:center;margin-top:24px"><b style="color:var(--text);font-size:1.1rem">Exhibiting or Sourcing at a Transformer Show?</b><p style="color:var(--muted);font-size:.92rem;margin:6px 0 14px">Get your company listed in the TransformerPath Manufacturer Directory or submit a structured RFQ to pre-screen suppliers.</p>' +
    '<a class="btn btn-amber" href="rfq.html">Submit an RFQ →</a> <a class="btn btn-outline btn-sm" href="list-company.html" style="margin-left:8px">Get Listed &amp; Verified</a></div>' +
    '</main>\n' + FOOT + '\n<script src="analytics.js?v=7" defer></script>\n<script>\n' +
    '(function(){\n' +
    '  var activeFocus = "all";\n' +
    '  var qInput = document.getElementById("exSearch");\n' +
    '  function filterRows() {\n' +
    '    var q = (qInput ? qInput.value : "").trim().toLowerCase();\n' +
    '    var rows = document.querySelectorAll(".ex-row");\n' +
    '    var matchCount = 0;\n' +
    '    rows.forEach(function(r){\n' +
    '      var f = r.getAttribute("data-focus") || "";\n' +
    '      var hay = (r.getAttribute("data-name") || "") + " " + (r.getAttribute("data-country") || "") + " " + (r.getAttribute("data-city") || "") + " " + (r.getAttribute("data-org") || "");\n' +
    '      var focusOk = activeFocus === "all" || f.indexOf(activeFocus) >= 0;\n' +
    '      var qOk = !q || hay.indexOf(q) >= 0;\n' +
    '      var show = focusOk && qOk;\n' +
    '      r.style.display = show ? "" : "none";\n' +
    '      if (show) matchCount++;\n' +
    '    });\n' +
    '  }\n' +
    '  if (qInput) qInput.addEventListener("input", filterRows);\n' +
    '  document.querySelectorAll("[data-filter=\'focus\']").forEach(function(p){\n' +
    '    p.addEventListener("click", function(){\n' +
    '      document.querySelectorAll("[data-filter=\'focus\']").forEach(function(x){ x.classList.remove("active"); });\n' +
    '      this.classList.add("active");\n' +
    '      activeFocus = this.getAttribute("data-val");\n' +
    '      filterRows();\n' +
    '    });\n' +
    '  });\n' +
    '})();\n' +
    '</script>\n</body>\n</html>';
}

fs.mkdirSync('events', { recursive: true });
let newPages = 0, linked = 0;
ENTRIES.forEach(function (e) {
  const curated = CURATED_SLUG[e.event_name];
  if (curated && fs.existsSync('events/' + curated + '/index.html')) {
    linked++;
    return;
  }
  const slug = slugify(e.event_name);
  fs.mkdirSync('events/' + slug, { recursive: true });
  fs.writeFileSync('events/' + slug + '/index.html', eventPage(e));
  newPages++;
});
fs.writeFileSync('exhibitions.html', indexPage());
console.log('exhibitions directory entries:', ENTRIES.length, '| new entity pages:', newPages, '| linked to curated pages:', linked);
fs.writeFileSync('data/exhibitions-meta.json', JSON.stringify({ total: ENTRIES.length, new_pages: newPages, linked_curated: linked, countries: [...new Set(ENTRIES.map(function (e) { return e.country; }))].length }, null, 2));

