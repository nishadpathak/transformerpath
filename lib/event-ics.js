'use strict';
/* ICS files for CONFIRMED editions only. UID is id@transformerpath.com. */
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
function eventIcs(ev) {
  const end = ev.end || ev.start;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TransformerPath//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + ev.id + '@transformerpath.com',
    'DTSTAMP:' + ymd(ev.source_checked_at || '2026-10-14') + 'T000000Z',
    'DTSTART;VALUE=DATE:' + ymd(ev.start),
    'DTEND;VALUE=DATE:' + exclusiveEnd(end),
    'SUMMARY:' + icsEscape(ev.name),
    'LOCATION:' + icsEscape([ev.venue, ev.city, ev.country].filter(Boolean).join(', ')),
  ];
  if (ev.official_url) lines.push('URL:' + ev.official_url);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
function calendarIcs(events, calName) {
  const body = events.map((ev) => {
    const end = ev.end || ev.start;
    return [
      'BEGIN:VEVENT',
      'UID:' + ev.id + '@transformerpath.com',
      'DTSTAMP:' + ymd(ev.source_checked_at || '2026-10-14') + 'T000000Z',
      'DTSTART;VALUE=DATE:' + ymd(ev.start),
      'DTEND;VALUE=DATE:' + exclusiveEnd(end),
      'SUMMARY:' + icsEscape(ev.name),
      'LOCATION:' + icsEscape([ev.venue, ev.city, ev.country].filter(Boolean).join(', ')),
      ev.official_url ? ('URL:' + ev.official_url) : '',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  }).join('\r\n');
  return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TransformerPath//Events//EN\r\nX-WR-CALNAME:' + icsEscape(calName) + '\r\n' + body + '\r\nEND:VCALENDAR\r\n';
}
module.exports = { eventIcs, calendarIcs };
