'use strict';
/* Shared event date labels. PROJECTED and TBA never look like a confirmed date. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dubaiToday() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date());
}

function fmtDay(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const dt = new Date(d + 'T12:00:00Z');
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function expectedLabel(start) {
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return 'Dates not confirmed';
  const m = parseInt(start.slice(5, 7), 10);
  return 'Expected ~' + (MONTHS[m - 1] || '') + ' ' + start.slice(0, 4) + ', not confirmed';
}

function dateLine(ev) {
  const status = ev.date_status || null;
  if (status === 'CONFIRMED' && ev.start) {
    const a = fmtDay(ev.start);
    const b = ev.end && ev.end !== ev.start ? fmtDay(ev.end) : '';
    return b ? (a + ' → ' + b) : a;
  }
  if (status === 'PROJECTED') return expectedLabel(ev.start);
  if (status === 'CANCELLED') return 'Cancelled';
  if (!ev.start || status === 'TBA') return 'Dates not confirmed';
  const a = fmtDay(ev.start);
  const b = ev.end && ev.end !== ev.start ? fmtDay(ev.end) : '';
  return b ? (a + ' → ' + b) : (a || 'Not yet published by organiser');
}

function nullText() { return 'Not yet published by organiser'; }

function allowsCalendar(ev) {
  return ev.date_status === 'CONFIRMED' && !!ev.start && !!ev.end && !!ev.source_url && !!ev.source_checked_at;
}

function badgeText(ev) {
  if (ev.research_status === 'REJECTED_NO_EVIDENCE') return 'Not on organiser calendar';
  /* Confirmed dates with a source use the shared provenance badge, not a status chip. */
  if (ev.date_status === 'CONFIRMED' && ev.source_url && ev.source_checked_at) return '';
  if (ev.date_status === 'PROJECTED') return 'not confirmed';
  if (ev.date_status === 'TBA' || !ev.start) return 'not confirmed';
  if (ev.date_status === 'CANCELLED') return 'Cancelled';
  return '';
}

module.exports = { dubaiToday, fmtDay, expectedLabel, dateLine, nullText, allowsCalendar, badgeText, MONTHS };
