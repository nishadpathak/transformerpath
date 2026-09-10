#!/usr/bin/env node
/* check-event-integrity.js — TransformerPath extended Event integrity gate.
 *
 * PURPOSE
 *   Eliminates the class of contradiction where an event card simultaneously
 *   communicates UNCERTAIN dates AND an active/live/register countdown (the
 *   production issue flagged in the Events 2.0 spec). It routes EVERY event
 *   through the SAME canonical resolver (lib/event-status.js) that powers
 *   /events, /exhibitions, search, event detail, homepage, structured data and
 *   the post-event system, and fails hard on unambiguous contradictions. It
 *   also enforces the Event 2.0 integrity rules (duplicate editions, CFP/status
 *   contradictions, provenance) without inventing anything.
 *
 *   This is a GATE (exit 1 on a hard contradiction). It is deliberately narrow
 *   and conservative so it does not produce false positives, but it DOES catch:
 *     - an edition treated as LIVE while its dates are not CONFIRMED
 *     - a COMPLETED edition still carrying an active Register CTA
 *     - a CANCELLED / POSTPONED edition still carrying an active Register CTA
 *     - two canonical editions for the same series+year
 *     - a CFP marked OPEN past its OWN confirmed deadline
 *     - a CFP status/CLOSED+deadline contradiction
 *     - a research/academic event misclassified with exhibition status
 *
 * Run: node check-event-integrity.js
 */
'use strict';
const fs = require('fs');
const status = require('./lib/event-status');

const SERIES = (JSON.parse(fs.readFileSync('data/event-series.json', 'utf8')).series) || [];
const today = new Date().toISOString().slice(0, 10);

const hard = [];
const advisory = [];
function hfail(m) { hard.push(m); }
function adv(m) { advisory.push(m); }

// Build the flat list of canonical editions (all series), computing status via
// the single resolver so every surface agrees.
const editions = [];
SERIES.forEach((s) => {
  (s.editions || []).forEach((ed) => {
    const res = status.resolveStatus({
      s: ed.dates && ed.dates.start, e: ed.dates && ed.dates.end,
      d: ed.note || '', v: ed.venue || '',
      dates_confirmed: ed.dates_confirmed, venue_confirmed: ed.venue_verified,
    });
    editions.push({
      name: ed.name, series: s.name, seriesKey: s.key, year: ed.year, slug: ed.slug,
      lifecycle: ed.lifecycle_status || res && res.key, date_status: ed.date_status,
      has_exhibitors: ed.has_exhibitors, event_type: ed.event_type || [],
      cfp: ed.cfp, register: ed.register || null, cfp_deadline: ed.cfp && ed.cfp.submission_deadline,
      source: ed.source, res, note: res.reason,
    });
  });
});

// 1. Duplicate canonical edition (same series + year).
const seen = {};
editions.forEach((e) => {
  const k = e.seriesKey + '|' + e.year;
  if (seen[k]) hfail('DUPLICATE_EDITION ' + e.series + ' ' + e.year + ' (' + e.slug + ' vs ' + seen[k] + ')');
  seen[k] = e.slug;
});

editions.forEach((e) => {
  const lc = e.lifecycle;

  // 2. LIVE must have CONFIRMED dates (Item 29 — the core contradiction).
  if (lc === 'LIVE' && e.date_status !== 'CONFIRMED') {
    hfail('LIVE_WITH_UNCONFIRMED_DATES ' + e.name + ' (date_status=' + e.date_status + ')');
  }
  // 3. COMPLETED must not carry an active Register CTA.
  if (lc === 'COMPLETED' && e.register) {
    hfail('COMPLETED_WITH_ACTIVE_REGISTER ' + e.name);
  }
  // 4. CANCELLED / POSTPONED must not carry an active Register CTA (no countdown).
  if ((lc === 'CANCELLED' || lc === 'POSTPONED') && e.register) {
    hfail(lc + '_WITH_ACTIVE_REGISTER ' + e.name);
  }
  // 5. CFP status vs its own confirmed deadline.
  if (e.cfp && e.cfp.status) {
    const dl = e.cfp.submission_deadline || e.cfp.full_paper_deadline;
    if (dl && e.cfp.status === 'OPEN' && dl < today) {
      hfail('CFP_OPEN_PAST_CONFIRMED_DEADLINE ' + e.name + ' (deadline ' + dl + ')');
    }
    if (dl && e.cfp.status === 'CLOSED' && dl >= today) {
      hfail('CFP_CLOSED_BEFORE_CONFIRMED_DEADLINE ' + e.name + ' (deadline ' + dl + ')');
    }
  }
  // 6. An academic/technical conference should not carry exhibition status.
  const isConf = (e.event_type || []).some((t) => /ACADEMIC_CONFERENCE|TECHNICAL_CONFERENCE/.test(t));
  if (isConf && e.has_exhibitors === true) {
    adv('CONFERENCE_HAS_EXHIBITION_STATUS ' + e.name + ' — verify; conference should not be exhibition-driven unless co-located');
  }
  // Provenance on canonical editions (each should carry a source).
  if (!e.source && !e.src_url) {
    adv('CANONICAL_EDITION_WITHOUT_SOURCE ' + e.name);
  }
});

console.log('EVENT INTEGRITY GATE');
console.log('Canonical editions checked: ' + editions.length + ' (via single resolver lib/event-status.js)');
if (advisory.length) {
  console.log('Advisory (' + advisory.length + '):');
  advisory.forEach((a) => console.log('  ○ ' + a));
}
if (hard.length) {
  console.error('EVENT INTEGRITY FAILED — ' + hard.length + ' contradiction(s):');
  hard.forEach((h) => console.error('  ✗ ' + h));
  process.exitCode = 1;
} else {
  console.log('EVENT INTEGRITY OK — no LIVE/DATE_TBC, COMPLETED+Register, CANCELLED+countdown, duplicate-edition or CFP/status contradictions.');
}
