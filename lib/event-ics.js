'use strict';
/* ICS files for CONFIRMED editions only. UID is id@transformerpath.com.
 * In-person editions stay all-day. An online session with a published
 * clock is a UTC timestamp. DTEND is the published end, or one hour when
 * the page does not state a duration.
 */
const { isOnlineEvent, scheduleOf, publicUrl } = require('./online-event');
function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function ymd(d) { return String(d || '').replace(/-/g, ''); }
/* All-day DTEND is exclusive: the day after the published end date. */
function exclusiveEnd(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return ymd(d);
  const dt = new Date(d + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10).replace(/-/g, '');
}
function veventLines(ev) {
  const end = ev.end || ev.start;
  const clock = isOnlineEvent(ev) ? scheduleOf(ev) : null;
  const where = isOnlineEvent(ev)
    ? (publicUrl(ev) || 'Online')
    : [ev.venue, ev.city, ev.country].filter(Boolean).join(', ');
  const sessions = clock && clock.sessions && clock.sessions.length ? clock.sessions : [null];
  const blocks = [];
  sessions.forEach(function (session, i) {
    const lines = [
      'BEGIN:VEVENT',
      'UID:' + ev.id + (i ? '-' + (i + 1) : '') + '@transformerpath.com',
      'DTSTAMP:' + ymd(ev.source_checked_at || '2026-10-14') + 'T000000Z',
    ];
    if (session) {
      lines.push('DTSTART:' + session.startUtc);
      lines.push('DTEND:' + session.endUtc);
    } else {
      lines.push('DTSTART;VALUE=DATE:' + ymd(ev.start));
      lines.push('DTEND;VALUE=DATE:' + exclusiveEnd(end));
    }
    lines.push('SUMMARY:' + icsEscape(ev.name));
    lines.push('LOCATION:' + icsEscape(where));
    if (ev.official_url) lines.push('URL:' + ev.official_url);
    lines.push('END:VEVENT');
    blocks.push.apply(blocks, lines);
  });
  return blocks;
}
function eventIcs(ev) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TransformerPath//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ].concat(veventLines(ev), ['END:VCALENDAR']);
  return lines.join('\r\n') + '\r\n';
}
function calendarIcs(events, calName) {
  const body = events.map((ev) => veventLines(ev).join('\r\n')).join('\r\n');
  return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TransformerPath//Events//EN\r\nX-WR-CALNAME:' + icsEscape(calName) + '\r\n' + body + '\r\nEND:VCALENDAR\r\n';
}
module.exports = { eventIcs, calendarIcs };
