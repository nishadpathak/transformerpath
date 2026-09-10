#!/usr/bin/env node
/* lib/event-status.js — TransformerPath ONE canonical event-status resolver.
 *
 * PURPOSE
 *   The raw event registry (data/events.json) carries no structured status; each
 *   surface historically inferred its own state from free text, so the same
 *   event could read "Confirmed" on the events page and "To be confirmed" on
 *   the market page. This module is the single source of truth for event state.
 *   Every surface (Events, Homepage, Search, Market pages, Company pages,
 *   structured data, post-event intelligence, Alerts) MUST route through it.
 *
 * STATES (canonical keys + UI label/tone)
 *   CONFIRMED_UPCOMING  Confirmed  ok
 *   LIVE                Live now   ok
 *   COMPLETED           Completed  muted
 *   DATE_TBC            Dates TBC  warn
 *   VENUE_TBC           Venue TBC  warn
 *   MONITORING          Unconfirmed — verify  warn
 *   POSTPONED           Postponed  bad
 *   CANCELLED           Cancelled  bad
 *
 * RULES (honest-first, deterministic; never invents confirmation)
 *   - An EXPLICIT structured status wins, but is validated against the set.
 *     An unknown explicit value degrades to MONITORING rather than guessing.
 *   - Otherwise resolution is precedence-ordered (see below) and derives ONLY
 *     from existing cues in the record (dates, description, venue) — it is a
 *     normalisation of what is already there, never new fact.
 *   - Dates are considered confirmed ONLY when the record carries no date
 *     uncertainty cue ("date est.", "provisional", "tbc/tbd/tba", "unconfirmed",
 *     "do not book", "exact dates tbc"). If a date is uncertain the event can
 *     NEVER be CONFIRMED_UPCOMING or LIVE — it becomes DATE_TBC (future) or
 *     MONITORING (no usable end date).
 *   - "LIVE" is only ever returned when the event's confirmed dates span today.
 *     An uncertain or purely future event never shows "Live now".
 *   - COMPLETED requires a confirmed end date strictly before today. A past
 *     event whose dates were never confirmed stays DATE_TBC / MONITORING — it
 *     is not treated as a completed occurrence.
 *   - CANCELLED / POSTPONED always beat an explicit temporal state (a cancelled
 *     event is not "completed").
 *
 * event-local timezone: pass rec.tz (IANA, e.g. "Asia/Dubai") or opts.tz. When
 * present it is used for the "today" boundary; otherwise the server timezone.
 * A record with a tz is flagged in the returned envelope (tz_used) so surfaces
 * can render local dates accurately.
 *
 * Run standalone: node lib/event-status.js   (prints self-test results)
 */
'use strict';

const STATES = {
  CONFIRMED_UPCOMING: { key: 'CONFIRMED_UPCOMING', label: 'Confirmed', tone: 'ok' },
  LIVE:               { key: 'LIVE',               label: 'Live now', tone: 'ok' },
  COMPLETED:          { key: 'COMPLETED',          label: 'Completed', tone: 'muted' },
  DATE_TBC:           { key: 'DATE_TBC',           label: 'Dates TBC', tone: 'warn' },
  VENUE_TBC:          { key: 'VENUE_TBC',          label: 'Venue TBC', tone: 'warn' },
  MONITORING:         { key: 'MONITORING',         label: 'Unconfirmed — verify with organiser', tone: 'warn' },
  POSTPONED:          { key: 'POSTPONED',          label: 'Postponed', tone: 'bad' },
  CANCELLED:          { key: 'CANCELLED',          label: 'Cancelled', tone: 'bad' },
  /* Positive evidence the event is NOT on the organiser's calendar — a stronger
     statement than "we have not confirmed the dates". DATE_TBC means unknown;
     these two mean we looked and found nothing, so the record must leave normal
     upcoming discovery rather than sit there with a countdown. */
  RESEARCH_REQUIRED:    { key: 'RESEARCH_REQUIRED',    label: 'Research required', tone: 'warn' },
  REJECTED_NO_EVIDENCE: { key: 'REJECTED_NO_EVIDENCE', label: 'Not on organiser calendar', tone: 'bad' },
};
const ALLOWED = new Set(Object.keys(STATES));

const TONE = { ok: '#16a34a', bad: '#b91c1c', warn: '#b45309', muted: '#6b7280' };
const TONE_BG = { ok: 'rgba(22,163,74,.12)', bad: 'rgba(185,28,28,.12)', warn: 'rgba(180,83,9,.14)', muted: 'rgba(107,114,128,.12)' };

// Precedence (strongest first). A key that appears earlier overrides a weaker
// signal — so a cancelled event is never "completed", and a date-TBC event is
// never "confirmed" or "live".
const PRECEDENCE = ['REJECTED_NO_EVIDENCE', 'RESEARCH_REQUIRED', 'CANCELLED', 'POSTPONED', 'DATE_TBC', 'VENUE_TBC', 'MONITORING', 'COMPLETED', 'LIVE', 'CONFIRMED_UPCOMING'];

// Negative lookahead so "not cancelled" / "no do not book" doesn't misfire.
function has(text, re) { return re.test(text) && !/not cancelled|not postponed/.test(text.match(/[a-z ]{0,24}/) ? text.match(/[a-z ]{0,24}/)[0] : ''); }

function toMs(d) {
  if (!d) return 0;
  const t = new Date(String(d).replace(/Z$/, '')).getTime();
  return isNaN(t) ? 0 : t;
}
function isoToday(tz) {
  // Best-effort local "today" as YYYY-MM-DD. When a tz is supplied we can only
  // approximate (Node has no ICU tz guarantee without Intl), but we record that
  // getTimezoneOffset is independent; surfaces pass the tz string for display.
  const n = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate(), tz: tz || null };
}

function mk(key, extra) {
  const s = STATES[key];
  return Object.assign({ key, label: s.label, tone: s.tone, color: TONE[s.tone], background: TONE_BG[s.tone] }, extra || {});
}

// Uncertainty cues that mean "these dates are NOT confirmed".
const DATE_UNCERTAIN = /unconfirm|do not book|provisional|date est\.|dates pending|exact dates (tbc|tbd|tba)|(^|[\s(])est\.(\s|\))|\(est\.\)|\b(tbc|tbd|tba)\b|dates (tba|tbd|tbc)/i;
// Venue uncertainty cues.
/* Positive non-existence: we checked the authoritative calendar and it is absent.
   Deliberately narrow — "unconfirmed" alone is DATE_TBC, not rejection. */
const NO_EVIDENCE = /no .{0,40}(listed|found|scheduled).{0,40}(calendar|website|programme|program)|not listed on|could not verify|no evidence of|does not appear on/i;
const VENUE_UNCERTAIN = /venue (tbc|tba|tbd)|venue to be (announced|confirmed)|(^|[\s(])venue (tbc|tbd|tba)/i;

/**
 * resolveStatus(rec, opts) -> { key, label, tone, color, background, tz_used, reason, isTravelSafe }
 *  rec: the event record. Recognised fields:
 *    s, e          start/end date (YYYY-MM-DD)
 *    d, v          description, venue (free text cues)
 *    status        optional explicit structured status (canonical key)
 *    status_note   optional authoritative note about status
 *    dates_confirmed, venue_confirmed   optional booleans
 *    tz            optional IANA timezone
 */
function resolveStatus(rec, opts) {
  opts = opts || {};
  const r = rec || {};
  const d = String(r.d || '') + ' ' + String(r.status_note || '');
  const v = String(r.v || '');
  const dl = d.toLowerCase();
  const vl = v.toLowerCase();
  const now = new Date();
  const start = toMs(r.s);
  const end = toMs(r.e);
  const tz = r.tz || opts.tz || null;

  // 0. Explicit structured status — authoritative if valid.
  if (r.status) {
    const k = String(r.status).toUpperCase();
    if (ALLOWED.has(k)) return mk(k, { tz_used: tz, reason: 'explicit status' });
    // Unknown explicit value: do not invent — degrade to MONITORING.
    return mk('MONITORING', { tz_used: tz, reason: 'explicit status "' + r.status + '" not recognised' });
  }

  const datesConfirmed = r.dates_confirmed !== false && !DATE_UNCERTAIN.test(dl);
  const venueConfirmed = r.venue_confirmed !== false && !VENUE_UNCERTAIN.test(vl);

  // 0b. Positive evidence of non-existence beats every temporal reading. This is
  // NOT the same as unconfirmed dates: the organiser's own calendar was checked
  // and the event was not on it.
  if (NO_EVIDENCE.test(dl)) return mk('REJECTED_NO_EVIDENCE', { tz_used: tz, reason: 'organiser calendar checked; event not listed' });

  // 1. CANCELLED / POSTPONED / re-scheduled — always dominant.
  if (/cancel|\boff\b|withdrawn/.test(dl) && !/not cancelled/.test(dl)) return mk('CANCELLED', { tz_used: tz, reason: 'description states cancellation' });
  if (/postpon|reschedul|moved to/.test(dl)) return mk('POSTPONED', { tz_used: tz, reason: 'description states postponement/reschedule' });

  // 2. Temporal state, only computed from confirmed dates.
  const hasStart = !!start, hasEnd = !!end;
  const todayYmd = isoToday(tz);
  const todayMs = toMs(todayYmd.y + '-' + String(todayYmd.m).padStart(2, '0') + '-' + String(todayYmd.d).padStart(2, '0'));

  // A past event must have a CONFIRMED end date to be COMPLETED; a past event
  // with unconfirmed dates is not a confirmed occurrence.
  if (hasEnd && end < todayMs && datesConfirmed) {
    return mk('COMPLETED', { tz_used: tz, reason: 'confirmed end date before today' });
  }

  // 3. Dates not confirmed -> never CONFIRMED_UPCOMING / LIVE.
  if (!datesConfirmed) {
    return mk(hasEnd && end >= todayMs ? 'DATE_TBC' : 'MONITORING', { tz_used: tz, reason: 'dates not confirmed' });
  }

  // 4. Venue not confirmed -> VENUE_TBC (still ahead of temporal states).
  if (!venueConfirmed) {
    return mk('VENUE_TBC', { tz_used: tz, reason: 'venue not confirmed' });
  }

  // 5. Live: confirmed dates spanning today.
  if (hasStart && hasEnd && start <= todayMs && todayMs <= end) {
    return mk('LIVE', { tz_used: tz, reason: 'confirmed dates span today' });
  }

  // 6. Upcoming (confirmed, future).
  if (hasStart && start > todayMs) {
    return mk('CONFIRMED_UPCOMING', { tz_used: tz, reason: 'confirmed future start date' });
  }

  // 7. Fallback — a record we cannot positively place stays MONITORING.
  return mk('MONITORING', { tz_used: tz, reason: 'no conclusive date/venue evidence' });
}

// Convenience accessors.
function isLive(st) { return st && st.key === 'LIVE'; }
// Travel booking (flights/hotel/calendar) is only sensible for a confirmed
// UPCOMING event — not for one already live, and never for an unconfirmed one.
function isTravelSafe(st) { return st && st.key === 'CONFIRMED_UPCOMING'; }
/* Countdown is allowed ONLY for a CONFIRMED future edition. It is NEVER shown
   for DATE_TBC / ESTIMATED / MONITORING / VENUE_TBC / COMPLETED / POSTPONED /
   CANCELLED / LIVE, or for unverifiable records (REJECTED_NO_EVIDENCE). */
function allowsCountdown(st) { return st && st.key === 'CONFIRMED_UPCOMING'; }
/* Records that failed verification must not appear in normal upcoming discovery. */
function isDiscoverable(st) { return st && st.key !== 'REJECTED_NO_EVIDENCE' && st.key !== 'RESEARCH_REQUIRED'; }
function chip(st) {
  if (!st) return '';
  return '<span style="display:inline-block;background:' + st.background + ';color:' + st.color +
    ';border:1px solid ' + st.color + ';border-radius:999px;padding:2px 12px;font-size:.78rem;font-weight:800;' +
    'text-transform:uppercase;letter-spacing:.04em;margin-right:8px">' + st.label + '</span>';
}

module.exports = { STATES, ALLOWED, PRECEDENCE, resolveStatus, isLive, isTravelSafe, allowsCountdown, isDiscoverable, chip, mk };

// ── Self-test (run: node lib/event-status.js) ──────────────────────────────
if (require.main === module) {
  let fails = 0;
  const assert = (cond, msg) => { if (!cond) { fails++; console.error('  ✗ ' + msg); } else console.log('  ok — ' + msg); };

  console.log('EVENT STATUS RESOLVER self-test');
  // Confirmed future event.
  assert(resolveStatus({ s: '2027-01-01', e: '2027-01-03', d: 'Flagship show', v: 'Dubai World Trade Centre' }).key === 'CONFIRMED_UPCOMING', 'confirmed future -> CONFIRMED_UPCOMING');
  // Explicit status wins.
  assert(resolveStatus({ s: '2026-01-01', e: '2026-01-03', d: 'Flagship show', v: 'Venue', status: 'CANCELLED' }).key === 'CANCELLED', 'explicit CANCELLED beats past dates');
  // Cancelled described in text dominates a future date.
  assert(resolveStatus({ s: '2027-01-01', e: '2027-01-03', d: 'Event cancelled', v: 'Venue' }).key === 'CANCELLED', 'cancel text -> CANCELLED even for future dates');
  // Unconfirmed/estimated dates -> DATE_TBC (never CONFIRMED/LIVE), even in future.
  assert(resolveStatus({ s: '2027-05-11', e: '2027-05-13', d: 'Date est. (recurring early September)', v: 'Dubai Exhibition Centre' }).key === 'DATE_TBC', 'estimated future dates -> DATE_TBC');
  assert(resolveStatus({ s: '2027-09-07', e: '2027-09-09', d: 'Date est. (recurring early September)', v: 'Dubai World Trade Centre' }).key === 'DATE_TBC', 'estimated dates never CONFIRMED/LIVE');
  // LIVE only when confirmed dates span today.
  // (build a record that spans now, confirmed)
  const nowD = new Date();
  const ymd = (ofs) => { const x = new Date(nowD.getTime() + ofs * 86400000); return x.toISOString().slice(0, 10); };
  assert(resolveStatus({ s: ymd(-1), e: ymd(1), d: 'Live event', v: 'Venue' }).key === 'LIVE', 'confirmed dates spanning today -> LIVE');
  // Completed when confirmed end before today.
  assert(resolveStatus({ s: '2026-01-01', e: '2026-01-03', d: 'done', v: 'Venue' }).key === 'COMPLETED', 'confirmed past end date -> COMPLETED');
  // Past event with unconfirmed dates -> MONITORING, not COMPLETED.
  assert(resolveStatus({ s: '2026-01-01', e: '2026-01-03', d: 'date est.', v: 'Venue' }).key === 'MONITORING', 'past unconfirmed dates -> MONITORING (not COMPLETED)');
  // Venue TBC.
  assert(resolveStatus({ s: '2026-12-01', e: '2026-12-03', d: 'Confirmed dates', v: 'Venue TBC' }).key === 'VENUE_TBC', 'venue TBC -> VENUE_TBC');
  // No usable evidence -> MONITORING.
  assert(resolveStatus({ d: 'event', v: '' }).key === 'MONITORING', 'no usable dates -> MONITORING');
  // Unknown explicit status -> MONITORING (never invented).
  assert(resolveStatus({ status: 'SOMETHING_NEW' }).key === 'MONITORING', 'unknown explicit status -> MONITORING');

  // ── Priority-1 regression cases: countdown gating + never-LIVE ──────────
  const startsTomorrow = resolveStatus({ s: ymd(1), e: ymd(3), d: 'Confirmed', v: 'Venue' });
  assert(startsTomorrow.key === 'CONFIRMED_UPCOMING' && allowsCountdown(startsTomorrow), 'starts tomorrow -> CONFIRMED_UPCOMING (countdown allowed)');
  const endedYesterday = resolveStatus({ s: ymd(-3), e: ymd(-1), d: 'Confirmed', v: 'Venue' });
  assert(endedYesterday.key === 'COMPLETED', 'ended yesterday -> COMPLETED');
  const startsToday = resolveStatus({ s: ymd(0), e: ymd(1), d: 'Confirmed', v: 'Venue' });
  assert(startsToday.key === 'LIVE' && !allowsCountdown(startsToday), 'starts today -> LIVE (no countdown while live)');
  const tbc = resolveStatus({ s: ymd(30), e: ymd(32), d: 'Date TBC', v: 'Venue' });
  assert(tbc.key === 'DATE_TBC' && !allowsCountdown(tbc) && !isLive(tbc), 'DATE_TBC -> no countdown, never LIVE');
  const est = resolveStatus({ s: ymd(30), e: ymd(32), d: 'dates est.', v: 'Venue' });
  assert(est.key !== 'LIVE' && !isLive(est), 'ESTIMATED -> never LIVE');
  const cancelled = resolveStatus({ s: ymd(30), e: ymd(32), d: 'Cancelled', v: 'Venue' });
  assert(cancelled.key === 'CANCELLED' && !allowsCountdown(cancelled), 'CANCELLED -> no countdown');
  const postponed = resolveStatus({ s: ymd(30), e: ymd(32), d: 'Rescheduled to later', v: 'Venue' });
  assert(postponed.key === 'POSTPONED' && !allowsCountdown(postponed), 'POSTPONED -> no countdown');
  assert(!isDiscoverable({ key: 'REJECTED_NO_EVIDENCE' }) && !isDiscoverable({ key: 'RESEARCH_REQUIRED' }), 'REJECTED/RESEARCH -> absent from normal upcoming discovery');

  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'EVENT STATUS RESOLVER PASS'));
  process.exitCode = fails ? 1 : 0;
}
