#!/usr/bin/env node
/* build-event-canonicalization.js — TransformerPath Events DATA INTEGRITY engine.
 *
 * PURPOSE
 *   The raw feed data/events.json is flat and occasionally duplicated, with no
 *   series/edition model and no structured status. This script normalises it into
 *   ONE canonical event feed and prints the data-integrity audit diagnostics.
 *   It does NOT invent anything: it collapses ONLY the duplicate groups declared
 *   in data/event-series.json (and self-evident name+city matches), computes
 *   every status through the single canonical resolver (lib/event-status.js),
 *   and flags low-confidence cases for review rather than auto-merging.
 *
 *   Output:
 *     data/events-canonical.json   the deduped, status-annotated canonical feed
 *     console                      the audit report (counts, no fake facts)
 *
 * Principle: CORRECTNESS > COVERAGE. A smaller verified database beats a large
 * untrustworthy one. UNKNOWN > GUESSED. TBC > INVENTED DATE. MONITORING > FALSE
 * CONFIRMATION. ONE CANONICAL EDITION > DUPLICATE RECORDS.
 *
 * Run: node build-event-canonicalization.js
 */
'use strict';
const fs = require('fs');
const status = require('./lib/event-status');

const RAW = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const MAP = JSON.parse(fs.readFileSync('data/event-series.json', 'utf8'));
const today = new Date().toISOString().slice(0, 10);

// ── Small helpers ──────────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const alnum = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const yearOf = (s) => { const m = String(s || '').match(/(20\d{2})/); return m ? parseInt(m[1], 10) : null; };
function nameNoYear(s) { return norm(String(s || '').replace(/(20\d{2})/g, ' ')).trim(); }

// Transformer relevance keyword scoring (SPEC: HIGH/MEDIUM/LOW).
const HIGH = /transformer|bushing|oltc|tap-?changer|reactor|substation|gsu|generator step-?up|crgo|core.?clamp|winding|insulation|dielectric|partial discharge|hvdc|converter transformer|power transformer|distribution transformer|dry-?type|rectifier transformer|furnace transformer|instrument transformer/i;
const MED = /hv |high voltage|medium voltage|mv |transmission|distribution|grid|t&d|power equipment|switchgear|circuit breaker|electrical|ctc|conductor|cable|manufacturing equipment|vacuum|drying/vacuum|testing|diagnostic|dga|monitoring|asset management|standards|iec|cigre|ieee/i;
const LOW = /solar pv|wind turbine|battery|energy storage|ev charging|consumer|smart meter|lighting|hydrogen|water|bess|e-?mobility/i;

function relevanceClass(rec) {
  const x = norm([rec.n, rec.d, (rec.categories || []).join(' ')].join(' '));
  if (HIGH.test(x)) return 'HIGH_TRANSFORMER_RELEVANCE';
  if (MED.test(x)) return 'MEDIUM_TRANSFORMER_RELEVANCE';
  if (LOW.test(x)) return 'LOW_TRANSFORMER_RELEVANCE';
  return 'LOW_TRANSFORMER_RELEVANCE';
}

// Map a resolved status (from lib/event-status) into the SPLIT model that the
// spec requires: lifecycle, date confidence, venue confidence.
function split(rec, resolved) {
  const key = resolved.key;
  const end = rec.dates && rec.dates.end;
  const hasEnd = !!end;
  const futureish = !hasEnd || end >= today;
  let lifecycle, dateC, venueC;
  switch (key) {
    case 'COMPLETED': lifecycle = 'COMPLETED'; break;
    case 'CONFIRMED_UPCOMING': lifecycle = 'UPCOMING'; break;
    case 'LIVE': lifecycle = 'LIVE'; break;
    case 'DATE_TBC': lifecycle = futureish ? 'UPCOMING' : 'MONITORING'; break;
    case 'VENUE_TBC': lifecycle = futureish ? 'UPCOMING' : 'COMPLETED'; break;
    case 'POSTPONED': lifecycle = 'POSTPONED'; break;
    case 'CANCELLED': lifecycle = 'CANCELLED'; break;
    default: lifecycle = 'MONITORING';
  }
  dateC = rec.dates_confirmed === false ? 'DATE_TBC' : (key === 'DATE_TBC' ? 'DATE_TBC' : 'CONFIRMED');
  venueC = rec.venue_verified === false ? (key === 'VENUE_TBC' ? 'VENUE_TBC' : 'UNVERIFIED') : 'CONFIRMED';
  return { lifecycle, date_confidence: dateC, venue_confidence: venueC, status_key: key, status_reason: resolved.reason };
}

const canonical = [];     // canonical editions (deduped)
const possibleDupes = []; // flagged, NOT auto-merged (REVIEW_REQUIRED)
const seriesList = [];

// ── Series from the canonical map ─────────────────────────────────────────
(MAP.series || []).forEach((s) => {
  seriesList.push({ key: s.key, name: s.name, seriesSlug: s.seriesSlug, href: s.href, editions: (s.editions || []).length });
  (s.editions || []).forEach((ed) => {
    const resolved = status.resolveStatus({
      s: ed.dates && ed.dates.start, e: ed.dates && ed.dates.end,
      d: ed.note || '', v: ed.venue || '', dates_confirmed: ed.dates_confirmed, venue_confirmed: ed.venue_verified,
    });
    canonical.push(Object.assign({}, ed, {
      series: s.name, seriesKey: s.key, seriesSlug: s.seriesSlug, href: s.href || ('/events/' + s.seriesSlug + '/'),
      relevance: relevanceClass(ed),
      split: split(ed, resolved),
      aliases: (s.aliases || []).filter((a) => a.indexOf(ed.name.toLowerCase()) >= 0 || ed.year && a.indexOf(String(ed.year)) >= 0),
    }));
  });
});

// ── Non-series raw feed entries (compute status; duplicate-flag matches) ───
const seriesAliasSet = new Set();
(MAP.series || []).forEach((s) => (s.aliases || []).forEach((a) => seriesAliasSet.add(alnum(a))));

const seenCount = {}; // normalized (nameNoYear + city) -> count
RAW.forEach((r) => {
  const nameNorm = alnum(nameNoYear(r.n));
  // Skip feed entries that are already the canonical series edition (dedup).
  if (seriesAliasSet.size && (seriesAliasSet.has(alnum(r.n)) || [...seriesAliasSet].some((a) => a.indexOf(nameNorm) >= 0 && nameNorm && nameNorm.length >= 6))) return;
  const resolved = status.resolveStatus({ s: r.s, e: r.e, d: r.d, v: r.v, dates_confirmed: !/date est\.|provisional|tbc|tbd|tba|unconfirm|est\./i.test(r.d || '') });
  const rec = { n: r.n, year: yearOf(r.n), series: null, seriesKey: null, seriesSlug: null, name: r.n, slug: null,
    city: r.c, country: r.co, venue: r.v, venue_verified: false, dates: { start: r.s, end: r.e }, lifecycle_status: null,
    has_published_summary: false, has_exhibitors: false, relevance: relevanceClass(r), aliases: [], u: r.u, d: r.d };
  rec.split = split(rec, resolved);
  rec.lifecycle_status = rec.split.lifecycle;
  canonical.push(rec);

  // Possible-duplicate flagging (normalized name-without-year + city).
  const key = nameNorm + '|' + alnum(r.c);
  if (seenCount[key]) {
    possibleDupes.push({ a: r.n, b: seenCount[key].name, city: r.c, state: 'REVIEW_REQUIRED', reason: 'same normalized name (no year) + city; verify before merging' });
  } else {
    seenCount[key] = { name: r.n };
  }
});

// ── Audit diagnostics (the report) ─────────────────────────────────────────
const flags = { unconfirmed_future: 0, estimated_as_confirmed: 0, stale_live: 0, cancelled_shown_active: 0, low_relevance: 0, monitoring: 0, broken_reg: 0 };
canonical.forEach((c) => {
  const sp = c.split || {};
  if (sp.lifecycle === 'UPCOMING' && sp.date_confidence !== 'CONFIRMED') flags.unconfirmed_future++;
  if (sp.date_confidence === 'DATE_TBC' && /confirmed/i.test(String(c.d))) flags.estimated_as_confirmed++;
  if (sp.lifecycle === 'COMPLETED' && sp.date_confidence !== 'CONFIRMED') flags.stale_live++;
  if (sp.lifecycle === 'CANCELLED' || sp.lifecycle === 'POSTPONED') { /* counted in status_key */ }
  if (c.relevance === 'LOW_TRANSFORMER_RELEVANCE') flags.low_relevance++;
  if (sp.lifecycle === 'MONITORING') flags.monitoring++;
  if (!c.u || c.u === '#' || /year|202\d\.|previous|old/i.test(String(c.u))) flags.broken_reg++;
});
const statusCount = {};
canonical.forEach((c) => { const k = c.split.status_key || '?'; statusCount[k] = (statusCount[k] || 0) + 1; });

fs.writeFileSync('data/events-canonical.json', JSON.stringify({ generated_at: today, canonical_editions: canonical, possible_duplicates: possibleDupes }, null, 2));

console.log('EVENTS DATA INTEGRITY AUDIT (canonicalization)');
console.log('Raw feed records: ' + RAW.length + ' | Canonical editions emitted: ' + canonical.length);
console.log('Event series identified: ' + seriesList.length);
console.log('Series: ' + seriesList.map((s) => s.name + ' (' + s.editions + ' edition' + (s.editions === 1 ? '' : 's') + ')').join('; '));
console.log('Possible duplicates (REVIEW_REQUIRED, NOT auto-merged): ' + possibleDupes.length);
console.log('  ' + possibleDupes.map((p) => p.a + ' ~ ' + p.b + ' [' + p.city + ']').join('; '));
console.log('Status distribution: ' + JSON.stringify(statusCount));
console.log('Audit flags: unconfirmed_future=' + flags.unconfirmed_future + ' estimated_as_confirmed=' + flags.estimated_as_confirmed +
  ' low_relevance=' + flags.low_relevance + ' monitoring=' + flags.monitoring + ' broken_reg=' + flags.broken_reg);
console.log('Wrote data/events-canonical.json');
// This is diagnostic tooling, not a pass/fail gate by itself. The REAL pass/fail
// is the quality gates (check-config/check-links/check-event-intel/check-brand).
process.exitCode = 0;
