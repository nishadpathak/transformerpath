/* Shared tender deadline parser.
 *
 * A bare year is not 1 January. `new Date("2026")` is 1 Jan 2026 UTC, which
 * closed year-only rows (Bahrain Sitra) on the next day. A year with no month
 * and no day is an imprecise deadline: it stays open through 31 December of
 * that year, and the public label says the exact date was not stated.
 *
 * A real calendar day (YYYY-MM-DD) is unchanged.
 */
'use strict';

function parseDeadline(text) {
  if (!text) return '';
  const s = String(text);
  const full = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (full) return full[1] + '-' + full[2] + '-' + full[3];
  const yearMonth = s.match(/\b(20\d{2})-(\d{2})\b/);
  if (yearMonth) return yearMonth[1] + '-' + yearMonth[2];
  const year = s.match(/\b(20\d{2})\b/);
  if (year) return year[1];
  return '';
}

function isYearOnly(deadline) {
  return /^20\d{2}$/.test(String(deadline || ''));
}

function deadlineLabel(deadline) {
  if (!deadline) return '';
  if (isYearOnly(deadline)) return 'Deadline: ' + deadline + ' (exact date not stated)';
  return String(deadline);
}

function asTime(now) {
  if (now == null) return Date.now();
  if (now instanceof Date) return now.getTime();
  const t = new Date(now).getTime();
  return Number.isNaN(t) ? Date.now() : t;
}

/* End of 31 December UTC. The year is still open on that calendar day. */
function deadlineInstant(deadline) {
  if (!deadline) return null;
  if (isYearOnly(deadline)) {
    return Date.UTC(Number(deadline), 11, 31, 23, 59, 59, 999);
  }
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function isPast(deadline, now) {
  const end = deadlineInstant(deadline);
  if (end == null) return false;
  return end < asTime(now);
}

function isNearDeadline(deadline, now) {
  const end = deadlineInstant(deadline);
  if (end == null) return false;
  const days = (end - asTime(now)) / 86400000;
  return days >= 0 && days <= 14;
}

function classifyOpenDeadline(deadline, now) {
  if (isPast(deadline, now)) return 'CLOSED';
  if (isNearDeadline(deadline, now)) return 'CLOSING_SOON';
  return 'OPEN';
}

module.exports = {
  parseDeadline,
  isYearOnly,
  deadlineLabel,
  isPast,
  isNearDeadline,
  classifyOpenDeadline
};
