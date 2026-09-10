#!/usr/bin/env node
/* build-event-summary-pages.js — render post-event intelligence summary pages.
 *
 * Reads data/post-event-summaries.json and renders a stable /events/<slug>/summary
 * page for each summary. Only ADMIN_STATUS === 'PUBLISHED' is marked index,follow
 * (it may enter the sitemap via build-seo.js). Non-published summaries render an
 * honest "research status" page with noindex,follow so they are never mistaken
 * for a finished summary. It never invents facts — it renders only the source-
 * backed facts in the record.
 *
 * Run: node build-event-summary-pages.js   (after the QA gate passes)
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/post-event-summaries.json', 'utf8'));
const EV = { CONFIRMED: '#16a34a', COMPANY_REPORTED: '#b45309', SECONDARY_SOURCE: '#2563eb', UNVERIFIED: '#64748b' };

const HEAD = '<header>\n  <link rel="stylesheet" href="tp-nav.css?v=12"><div class="container nav"><a href="index.html" class="logo" style="display:inline-flex;align-items:center;gap:9px"><svg class="logo-mark" width="34" height="34" viewBox="0 0 64 64" aria-hidden="true" style="flex:none"><circle cx="32" cy="32" r="26" fill="#0d1b2e" stroke="rgba(255,255,255,.30)" stroke-width="2"/><g stroke="#f5a623" stroke-width="1.4" fill="none" opacity=".8"><line x1="8" y1="32" x2="56" y2="32"/><ellipse cx="32" cy="32" rx="11" ry="26"/><ellipse cx="32" cy="32" rx="21" ry="26"/></g><path d="M36.5 9.6 L25 34 L32 34 L27.5 54.4 L42.9 27.5 L35.2 27.5 L39.7 9.6 Z" fill="#f5a623"/></svg><span class="word">Transformer<span class="accent">Path</span></span></a><button class="menu-toggle" aria-label="Menu" aria-expanded="false" aria-controls="mainNav">\u2630</button><nav class="tpnav" id="mainNav" aria-label="Primary"><a href="intel.html">Intel</a><a href="manufacturers.html">Manufacturers</a><a href="projects.html">Projects</a><a href="tenders.html">Tenders</a><a href="events.html">Events</a><a href="learn.html">Learn</a><a href="tools.html" class="tpnav-opt">Tools</a><a href="rfq.html">RFQ</a><span class="tpnav-utils"><a href="search.html">\uD83D\uDD0D</a><a href="workspace.html" data-tp-account>Account</a></span></nav></div><script>const t=document.getElementById(\'theme-toggle\');const h=document.documentElement;if((localStorage.getItem(\'theme\')||\'dark\')===\'dark\')h.setAttribute(\'data-theme\',\'dark\');</script><script src="tp-nav.js?v=5" defer></script>';
const FOOT = '<footer><div class="container"><p style="margin:0;color:var(--muted);font-size:.85rem">\u00A9 2026 TransformerPath. All rights reserved. <a href="events.html" style="color:var(--accent)">Events</a></p></div></footer>';

const SECTION_LABELS = {
  event_overview: 'Event overview', transformer_industry_presence: 'Transformer industry presence',
  key_announcements: 'Key announcements', product_technology_developments: 'Product / technology developments',
  project_procurement_signals: 'Project / procurement signals', market_themes: 'Market themes',
  what_to_watch_next: 'What to watch next', sources: 'Sources',
};

function renderSummary(s) {
  const published = s.admin_status === 'PUBLISHED';
  const robots = published ? 'index,follow' : 'noindex,follow';
  const statusBadge = published
    ? '<span style="background:rgba(22,163,74,.14);color:#16a34a;border:1px solid #16a34a;border-radius:999px;padding:2px 12px;font-size:.72rem;font-weight:800;text-transform:uppercase">Published · source-backed</span>'
    : '<span style="background:rgba(180,83,9,.14);color:#b45309;border:1px solid #b45309;border-radius:999px;padding:2px 12px;font-size:.72rem;font-weight:800;text-transform:uppercase">Research in progress · not published</span>';

  const facts = (s.facts || []).map((f) => '<div class="fact">' +
    '<b>' + esc(f.statement) + '</b> <span class="ev" style="color:' + (EV[f.confidence] || '#64748b') + '">' + esc(f.confidence) + '</span><br>' +
    '<span style="color:var(--muted);font-size:.82rem">Source: <a href="' + esc(f.source_url || '#') + '" target="_blank" rel="noopener">' + esc(f.source_title || 'source') + '</a> · ' + esc(f.source_type || '') + (f.entity && f.entity.type ? ' · ' + esc(f.entity.type) + ':' + esc(f.entity.id) : '') + '</span></div>').join('');

  const sections = (s.sections || {});
  const secHtml = Object.keys(SECTION_LABELS).map((k) => {
    const txt = sections[k];
    if (!txt) return '';
    return '<h2>' + SECTION_LABELS[k] + '</h2><p>' + esc(txt) + '</p>';
  }).join('');

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(s.event) + ' — Post-Event Transformer Industry Summary | TransformerPath</title>' +
    '<meta name="description" content="Post-event transformer-industry intelligence summary for ' + esc(s.event) + ' (' + esc(s.edition || '') + '). Source-backed facts with confidence; not a generic event recap.">' +
    '<link rel="canonical" href="https://transformerpath.com/events/' + esc(s.slug) + '/summary/">' +
    '<meta name="robots" content="' + robots + '">' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg">' +
    '<link rel="stylesheet" href="style.css?v=12"><link rel="stylesheet" href="tp-nav.css?v=12">' +
    '<style>.s-wrap{max-width:920px;margin:0 auto;padding:42px 20px 90px}.s-wrap h1{font-size:1.9rem;color:var(--ink)}.s-wrap h2{font-size:1.2rem;color:var(--ink);margin-top:22px}.s-wrap .src{color:var(--muted);font-size:.85rem}.fact{background:var(--card);border:1px solid var(--border);border-radius:9px;padding:10px 14px;margin:6px 0;font-size:.9rem}.fact .ev{display:inline-block;font-size:.7rem;font-weight:800;margin-left:6px}.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="s-wrap">' +
    '<nav style="font-size:.78rem;color:var(--muted);margin-bottom:10px"><a href="events.html" style="color:var(--accent)">Events</a> \u203A ' + esc(s.event) + '</nav>' +
    '<h1>Post-Event Transformer Industry Summary</h1>' +
    '<div style="margin:6px 0 14px">' + statusBadge + ' <span style="color:var(--muted);font-size:.82rem">' + esc(s.event) + ' · ' + esc(s.edition || '') + ' · ' + (s.verified && s.verified.dates || '') + ' · <a href="events.html" style="color:var(--accent)">events \u2197</a></span></div>' +
    '<p class="src">Every fact is source-backed; confidence shows the evidence level: <b>CONFIRMED</b> (official/primary), <b>COMPANY_REPORTED</b>, <b>SECONDARY_SOURCE</b>, <b>UNVERIFIED</b> (social/discovery only, never presented as confirmed).</p>' +
    '<div class="card"><h2 style="margin-top:0">Overview</h2><p>' + esc(s.overview || s.sections && s.sections.event_overview || '') + '</p>' +
    '<h2>Source-backed facts</h2>' + (facts || '<p style="color:var(--muted)">No source-backed facts yet.</p>') + '</div>' +
    '<h2>Sections</h2>' + (secHtml || '<p style="color:var(--muted)">Sections not yet populated — this summary is in research.</p>') +
    '<p class="src" style="margin-top:18px">Last updated ' + esc(s.last_updated || '') + '</p>' +
    '</main>\n' + FOOT + '\n<script src="analytics.js?v=5" defer></script>\n<script src="tp-nav.js?v=5" defer></script>\n</body>\n</html>';
}

fs.mkdirSync('events', { recursive: true });
let built = 0;
DATA.summaries.forEach((s) => {
  const dir = 'events/' + s.slug + '/summary';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/index.html', abs(renderSummary(s)));
  built++;
  console.log('OK events/' + s.slug + '/summary/ [' + s.admin_status + '] (' + (s.facts || []).length + ' facts)');
});
console.log('event-summary pages: ' + built);
