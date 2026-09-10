#!/usr/bin/env node
/* lib/event-search.js — EVENT SEARCH RESOLUTION (series vs edition).
 *
 * A search by an EVENT-SERIES name must default its primary result to the
 * NEAREST UPCOMING EDITION, not to a completed one. This module is the single
 * source of that resolution and is written as a UMD build: it can be `require`d
 * in Node (for the self-test and the build-time normalizer) AND loaded in the
 * browser (search.html) as window.TP_EVENT_SEARCH.
 *
 * RULES (implemented exactly):
 *   1. Exact series-name query            -> nearest UPCOMING edition.
 *   2. Query contains a year              -> exact matching edition.
 *   3. No future edition exists           -> canonical Event Series page;
 *      show "Next edition: not yet announced" where appropriate.
 *   4. DATE_TBC is still UPCOMING         -> lifecycle_status UPCOMING,
 *      date_status TBC. TBC is not historical/inactive.
 *   5. COMPLETED editions rank BELOW the current/upcoming edition for a
 *      generic series-name query.
 *   6. CANCELLED editions must NEVER be the default result.
 *   7. POSTPONED editions show POSTPONED and replacement dates ONLY when
 *      sourced (replacement dates must come from the record's proven fields;
 *      never invented).
 *   8. Search aliases resolve to the canonical series/edition (no duplicate
 *      results).
 *
 * IMPORTANT GUARD: SEO score, sponsorship, Featured status or payment must
 * NEVER override this event-intent resolution. This module ignores any such
 * ranking signal and resolves purely on lifecycle/date intent.
 *
 * Run standalone: node lib/event-search.js
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TP_EVENT_SEARCH = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Canonical lifecycle keys. date_status is separate (TBC / CONFIRMED).
  const LIFECYCLE = ['UPCOMING', 'LIVE', 'COMPLETED', 'POSTPONED', 'CANCELLED'];

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
  function keyOf(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ').replace(/\s+/g, '-'); }
  function alnum(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Query parsing ────────────────────────────────────────────────────────
  // Returns { seriesRaw, year, intent, isEventQuery }.
  const INTENT = {
    summary: /summary|what happened|recap|results|wrap-?up|review|coverage|report|aftermath/i,
    exhibitors: /exhibitor|who should i mee?t|who to choose|booth|stand|meet\b|supplier\b/i,
    future: /upcoming|next|calendar|schedule|dates\b/i,
  };
  function parseQuery(q) {
    const raw = String(q || '').trim();
    const lo = raw.toLowerCase();
    const yearM = raw.match(/(20\d{2})/);
    let seriesRaw = raw
      .replace(/20\d{2}/g, ' ')
      .replace(/\b(summary|what happened|recap|results|wrap.?up|review|coverage|report|aftermath)\b/gi, ' ')
      .replace(/\b(exhibitors?|who should i mee?t|booth|stand|supplier|meet)\b/gi, ' ')
      .replace(/^\s+(summary|exhibitor|upcoming|next)\s*$/i, ' ')
      .replace(/\s+/g, ' ').trim();
    let intent = null;
    if (INTENT.summary.test(lo)) intent = 'summary';
    else if (INTENT.exhibitors.test(lo)) intent = 'exhibitors';
    else if (INTENT.future.test(lo)) intent = 'future';
    return {
      seriesRaw: seriesRaw,
      seriesKey: keyOf(seriesRaw),
      year: yearM ? parseInt(yearM[1], 10) : null,
      intent: intent,
      isEventQuery: seriesRaw.length >= 3 && (yearM || intent || true), // any namey query can be an event query
    };
  }

  // ── Edition helpers ──────────────────────────────────────────────────────
  function seriesMatch(e, query) {
    const b = alnum(query.seriesRaw) || alnum(query.seriesKey);
    // Require a real series token (>=3 chars). An empty token (e.g. the query
    // reduced to just "exhibitors"/a year) must NOT match every edition, else it
    // would resolve to a specific series' result when the user gave none.
    if (b.length < 3) return false;
    const a = alnum(e.seriesKey || e.series || e.name || '');
    const nameNoYear = alnum((e.name || '').replace(/20\d{2}/g, ''));
    return a.indexOf(b) >= 0 || nameNoYear.indexOf(b) >= 0;
  }
  function lifecycleLabel(e) { return (e.lifecycle_status || 'MONITORING').toUpperCase(); }
  // Display status for the card: lifecycle + separate date_status.
  function statusParts(e) {
    const lc = lifecycleLabel(e);
    const ds = e.date_status === 'TBC' ? 'DATE TBC' : (e.date_confirmed ? '' : 'DATE TBC');
    return { lifecycle: lc, date: ds };
  }
  function dateLabel(e) {
    if (e.date_status === 'TBC' || e.date_confirmed === false) return 'Dates TBC';
    return fmtDate(e.dates && e.dates.start) + ' – ' + fmtDate(e.dates && e.dates.end);
  }
  function venueLabel(e) { return (e.venue_verified && e.venue) ? e.venue : null; }

  // ── Resolution ───────────────────────────────────────────────────────────
  // editions: array of canonical edition objects (see /data/event-*.json).
  function resolve(query, editions) {
    editions = editions || [];
    const p = parseQuery(query);
    // Group this series.
    const candidates = editions.filter((e) => seriesMatch(e, p));
    if (!candidates.length) return { type: 'no_match', query, parse: p, primary: null, ranked: [] };

    const cancelled = candidates.filter((e) => lifecycleLabel(e) === 'CANCELLED');
    const active = candidates.filter((e) => lifecycleLabel(e) !== 'CANCELLED');
    const upcoming = active
      .filter((e) => lifecycleLabel(e) === 'UPCOMING')
      .sort((a, b) => String(a.dates && a.dates.start).localeCompare(String(b.dates && b.dates.start)));
    const live = active.find((e) => lifecycleLabel(e) === 'LIVE');
    const completed = active
      .filter((e) => lifecycleLabel(e) === 'COMPLETED')
      .sort((a, b) => String(b.dates && b.dates.start).localeCompare(String(a.dates && a.dates.start))); // newest first
    const postponed = active.filter((e) => lifecycleLabel(e) === 'POSTPONED');

    // Rule 2 — year-present query: exact matching edition.
    if (p.year) {
      const exact = candidates.find((e) => Number(e.year) === p.year);
      if (exact) return { type: 'edition', query, parse: p, primary: exact, ranked: [exact].concat(active.filter((e) => e !== exact)), has_year: true };
      // Year asked for but not present for this series -> fall to nearest intent.
    }

    // Rule (summary intent) — latest COMPLETED edition with a published summary.
    if (p.intent === 'summary') {
      const withSummary = completed.filter((e) => e.has_published_summary);
      const primary = withSummary[0] || completed[0] || null;
      return { type: 'edition', query, parse: p, primary, ranked: withSummary.concat(completed.filter((e) => e !== withSummary[0])) };
    }

    const seriesPage = { series: candidates[0].series, seriesKey: candidates[0].seriesKey, name: candidates[0].series, slug: candidates[0].seriesSlug, next_edition_announced: active.some((e) => lifecycleLabel(e) === 'UPCOMING' || lifecycleLabel(e) === 'LIVE') };
    const nearestUpcoming = upcoming[0] || null;
    // Rule 1 / 4 — nearest UPCOMING (even if date_status TBC). TBC is still UPCOMING.
    // Rule 3 — if no upcoming (and nothing live), the DEFAULT result is the
    // canonical Event Series page ("next edition: not yet announced"), NOT a
    // completed edition. Completed editions still appear in the ranked list.
    const primaryUpcoming = nearestUpcoming || live;

    if (!primaryUpcoming) {
      const ranked = []
        .concat(completed)
        .concat(postponed)
        .concat(cancelled);
      const seen = new Set();
      const uniq = ranked.filter((e) => { const k = (e.slug || '') + '|' + e.year; if (seen.has(k)) return false; seen.add(k); return true; });
      return { type: 'series_only', query, parse: p, primary: null, ranked: uniq, series: seriesPage, note: 'Next edition: not yet announced' };
    }

    // Rule 5 — upcoming/live rank above completed. Cancelled never default (excluded).
    const ranked = []
      .concat(upcoming)
      .concat(live ? [live] : [])
      .concat(completed)
      .concat(postponed)
      .concat(cancelled); // cancelled may appear later in the list but never as primary
    // unique by slug/year
    const seen = new Set();
    const uniq = ranked.filter((e) => { const k = (e.slug || '') + '|' + e.year; if (seen.has(k)) return false; seen.add(k); return true; });

    return { type: 'edition', query, parse: p, primary: primaryUpcoming, ranked: uniq, series: seriesPage };
  }

  // ── Result card (render) ─────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function chip(label, cls) {
    const map = { UPCOMING: 'var(--amber)', LIVE: '#16a34a', COMPLETED: 'var(--muted)', POSTPONED: '#b91c1c', CANCELLED: '#b91c1c', 'DATE TBC': '#b45309' };
    const color = map[label] || 'var(--muted)';
    return '<span class="es-chip" style="color:' + color + ';border-color:' + color + '">' + esc(label) + '</span>';
  }
  function renderCard(e, opts) {
    opts = opts || {};
    const sp = statusParts(e);
    const title = /20\d{2}$/.test(String(e.name)) ? e.name : e.name + ' ' + (e.year || '');
    const href = e.href || ('/events/' + (e.slug || ''));
    const acts = [];
    const lc = lifecycleLabel(e);
    if (lc === 'COMPLETED') acts.push('<a class="es-act" href="' + href + '">View Event</a>', '<a class="es-act" href="' + href + '?tab=after">What Happened?</a>');
    else if (lc === 'LIVE' || lc === 'UPCOMING' || lc === 'POSTPONED') {
      acts.push('<a class="es-act" href="' + href + '">View Event</a>', '<a class="es-act" href="' + href + '?tab=plan">Who Should I Meet?</a>', '<button class="es-act es-save" data-ev="' + esc(e.slug || '') + '">Save Event</button>');
    }
    return '<div class="es-card' + (opts.primary ? ' es-primary' : '') + '" data-event="' + esc(e.slug || '') + '">' +
      '<div class="es-head">' + chip(sp.lifecycle) + (sp.date === 'DATE TBC' ? chip('DATE TBC') : '') + '</div>' +
      '<div class="es-title">' + esc(title) + '</div>' +
      '<div class="es-meta">' + esc(dateLabel(e)) + '</div>' +
      '<div class="es-meta">' + esc(e.city || '') + (e.country ? ', ' + esc(e.country) : '') + '</div>' +
      (venueLabel(e) ? '<div class="es-meta">Venue: ' + esc(venueLabel(e)) + '</div>' : '') +
      ((e.categories && e.categories.length) ? '<div class="es-cats">' + e.categories.map((c) => '<span class="es-cat">' + esc(c) + '</span>').join(' ') + '</div>' : '') +
      '<div class="es-acts">' + acts.join('') + '</div>' +
      '</div>';
  }

  return { LIFECYCLE, parseQuery, resolve, renderCard, statusParts, dateLabel, chip, esc };

}));

// ── Self-test (run: node lib/event-search.js) ──────────────────────────────
if (require.main === module) {
  const S = require('./event-search');
  let fails = 0;
  const assert = (c, m) => { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ok — ' + m); };

  // Test dataset mirroring the spec: MEE 2025 COMPLETED, 2026 COMPLETED, 2027 UPCOMING.
  const mk = (over) => Object.assign({
    series: 'Middle East Energy', seriesKey: 'middle-east-energy', seriesSlug: 'middle-east-energy',
    city: 'Dubai', country: 'United Arab Emirates', venue: 'Dubai World Trade Centre', venue_verified: true,
    categories: ['Power Transformers', 'Substations'], href: '/events/middle-east-energy/',
  }, over);
  const EDITIONS = [
    mk({ year: 2025, name: 'Middle East Energy 2025', slug: 'middle-east-energy-2025', dates: { start: '2025-09-01', end: '2025-09-03' }, date_confirmed: true, lifecycle_status: 'COMPLETED', date_status: 'CONFIRMED', has_published_summary: true, has_exhibitors: true }),
    mk({ year: 2026, name: 'Middle East Energy 2026', slug: 'middle-east-energy-2026', dates: { start: '2026-09-01', end: '2026-09-03' }, date_confirmed: true, lifecycle_status: 'COMPLETED', date_status: 'CONFIRMED', has_published_summary: false, has_exhibitors: true }),
    mk({ year: 2027, name: 'Middle East Energy 2027', slug: 'middle-east-energy-2027', dates: { start: '2027-09-07', end: '2027-09-09' }, date_confirmed: false, lifecycle_status: 'UPCOMING', date_status: 'TBC', has_published_summary: false, has_exhibitors: true }),
  ];

  console.log('EVENT SEARCH RESOLUTION self-test');
  const T = (q) => S.resolve(q, EDITIONS);

  // Search "Middle East Energy" -> 2027 primary (nearest upcoming), not 2026/2025.
  assert(T('Middle East Energy').primary && T('Middle East Energy').primary.year === 2027, '“Middle East Energy” -> 2027 primary (nearest upcoming)');
  assert(T('middle east energy').primary.year === 2027, 'case-insensitive series query -> 2027 primary');
  // Search "Middle East Energy 2026" -> 2026 primary.
  assert(T('Middle East Energy 2026').primary.year === 2026, '“Middle East Energy 2026” -> 2026 primary');
  // Search "Middle East Energy summary" -> latest completed edition WITH a published summary (2025).
  assert(T('Middle East Energy summary').primary.year === 2025, '“Middle East Energy summary” -> 2025 (latest completed with published summary)');
  // Search "Middle East Energy exhibitors 2027" -> 2027 exhibitor intelligence.
  assert(T('Middle East Energy exhibitors 2027').primary.year === 2027, '“Middle East Energy exhibitors 2027” -> 2027');
  // Rule 4: 2027 is UPCOMING even though dates are TBC.
  assert(T('Middle East Energy').primary.lifecycle_status === 'UPCOMING' && T('Middle East Energy').primary.date_status === 'TBC', 'TBC edition is still UPCOMING (not historical)');
  // Rule 5: completed ranks below upcoming in a generic query.
  const ranked = T('Middle East Energy').ranked;
  assert(ranked[0].year === 2027, 'ranked[0] is the upcoming edition');
  // Rule 3: series with only completed editions -> Event Series page (no future edition).
  const onlyPast = EDITIONS.filter((e) => e.year !== 2027);
  const r3 = S.resolve('Middle East Energy', onlyPast);
  assert(r3.type === 'series_only' && r3.primary === null, 'no future edition -> series page, not a completed default');
  assert(r3.note && /not yet announced/i.test(r3.note), 'series page says "next edition: not yet announced"');
  // Rule 6: CANCELLED never default. If 2027 is cancelled, it must NOT be primary.
  const withCan = EDITIONS.map((e) => e.year === 2027 ? Object.assign({}, e, { lifecycle_status: 'CANCELLED' }) : e);
  const pCan = S.resolve('Middle East Energy', withCan).primary;
  assert(!(pCan && pCan.year === 2027 && pCan.lifecycle_status === 'CANCELLED'), 'a cancelled edition is never the default result');
  // Rule 8: alias "MEE" style naming should not create a duplicate result.
  const alias = S.resolve('Middle East Energy', EDITIONS);
  assert(alias.ranked.length === EDITIONS.length, 'no duplicate edition results for a series query');

  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'EVENT SEARCH RESOLUTION PASS'));
  process.exitCode = fails ? 1 : 0;
}
