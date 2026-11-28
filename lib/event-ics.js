'use strict';
/* ICS files for CONFIRMED editions only. UID is id@transformerpath.com.
 * Hours plus an IANA timezone become one UTC VEVENT per open day.
 * A record without hours stays an all-day event. */
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

function hourRows(ev) {
  if (!ev || !ev.timezone || !Array.isArray(ev.hours)) return [];
  return ev.hours.filter(function (row) {
    return row && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && /^\d{2}:\d{2}$/.test(row.open) && /^\d{2}:\d{2}$/.test(row.close);
  });
}

/* Wall time in an IANA zone, written as a UTC basic stamp. */
function zonedToUtcBasic(day, hhmm, timeZone) {
  const parts = day.split('-').map(Number);
  const clock = hhmm.split(':').map(Number);
  const guess = Date.UTC(parts[0], parts[1] - 1, parts[2], clock[0], clock[1], 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  function asUtc(ms) {
    const map = {};
    dtf.formatToParts(new Date(ms)).forEach(function (p) {
      if (p.type !== 'literal') map[p.type] = p.value;
    });
    const hour = map.hour === '24' ? 0 : Number(map.hour);
    return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second || 0));
  }
  let utc = guess;
  for (let i = 0; i < 3; i++) utc = guess - (asUtc(utc) - utc);
  return new Date(utc).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function vevent(ev, timed) {
  const end = ev.end || ev.start;
  const lines = [
    'BEGIN:VEVENT',
    'UID:' + (timed ? timed.uid : (ev.id + '@transformerpath.com')),
    'DTSTAMP:' + ymd(ev.source_checked_at || '2026-10-14') + 'T000000Z'
  ];
  if (timed) {
    lines.push('DTSTART:' + timed.start, 'DTEND:' + timed.end);
  } else {
    lines.push('DTSTART;VALUE=DATE:' + ymd(ev.start), 'DTEND;VALUE=DATE:' + exclusiveEnd(end));
  }
  lines.push('SUMMARY:' + icsEscape(ev.name));
  const location = ev.ics_location
    ? String(ev.ics_location)
    : [ev.venue, ev.city, ev.country].filter(Boolean).join(', ');
  lines.push('LOCATION:' + icsEscape(location));
  if (timed && timed.description) lines.push('DESCRIPTION:' + icsEscape(timed.description));
  if (ev.official_url) lines.push('URL:' + ev.official_url);
  lines.push('END:VEVENT');
  return lines;
}

function timedSlots(ev) {
  const label = ev.hours_label ? String(ev.hours_label) : String(ev.timezone || '');
  return hourRows(ev).map(function (row) {
    return {
      uid: ev.id + '-' + ymd(row.date) + '@transformerpath.com',
      start: zonedToUtcBasic(row.date, row.open, ev.timezone),
      end: zonedToUtcBasic(row.date, row.close, ev.timezone),
      description: row.open + '-' + row.close + (label ? ' ' + label : '')
    };
  });
}

/* One UTC span from the first opening to the last close, when the record
 * asks for a single timed VEVENT instead of one block per open day. */
function spanSlot(ev) {
  if (!ev || !ev.ics_span) return null;
  const rows = hourRows(ev);
  if (!rows.length) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    uid: ev.id + '@transformerpath.com',
    start: zonedToUtcBasic(first.date, first.open, ev.timezone),
    end: zonedToUtcBasic(last.date, last.close, ev.timezone),
    description: ev.ics_description || ''
  };
}

function eventBody(ev) {
  // Some editions publish hours for visitors but retain an existing all-day
  // calendar block. Do not replace its UID with separate daily appointments.
  const span = ev.ics_all_day === true ? null : spanSlot(ev);
  const slots = ev.ics_all_day === true ? [] : span ? [span] : timedSlots(ev);
  const blocks = slots.length ? slots.map(function (slot) { return vevent(ev, slot); }) : [vevent(ev)];
  return blocks.map(function (lines) { return lines.join('\r\n'); }).join('\r\n');
}

function eventIcs(ev) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TransformerPath//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    eventBody(ev),
    'END:VCALENDAR'
  ].join('\r\n') + '\r\n';
}

function calendarIcs(events, calName) {
  const body = events.map(eventBody).join('\r\n');
  return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TransformerPath//Events//EN\r\nX-WR-CALNAME:' + icsEscape(calName) + '\r\n' + body + '\r\nEND:VCALENDAR\r\n';
}

module.exports = { eventIcs, calendarIcs, zonedToUtcBasic };
