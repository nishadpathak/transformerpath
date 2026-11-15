#!/usr/bin/env node
/* Every events/ics/*.ics link must point at a file, and that event must have dates.
 * Undated links are removed by build-event-ics.js before this check runs.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadEvents } = require('../lib/events-reader');
const { hasCalendarDates, stripIcsAnchor, listHtmlFiles } = require('../build-event-ics');

const sample = '<p>Keep this sentence.</p><div style="display:flex"><a class="btn" href="events/page.html">Event page</a> <a class="btn" data-aff="calendar" href="events/ics/no-dates.ics">📅 Add</a></div>';
const stripped = stripIcsAnchor(sample, 'no-dates');
assert(stripped.includes('Keep this sentence.'), 'stripping a calendar link keeps the surrounding copy');
assert(stripped.includes('href="events/page.html"'), 'stripping a calendar link keeps the other link');
assert(!stripped.includes('no-dates.ics'), 'the undated calendar link is removed');

const span = '<p>Hub copy</p><span><a href="../../events/ics/tba-show.ics">Add to calendar</a></span><p>More copy</p>';
const spanOut = stripIcsAnchor(span, 'tba-show');
assert(spanOut.includes('Hub copy') && spanOut.includes('More copy'), 'span removal keeps the hub copy');
assert(!spanOut.includes('tba-show.ics') && !spanOut.includes('<span>'), 'the undated span link is removed');

assert(hasCalendarDates({ start: '2026-10-13', end: '2026-10-15' }), 'start and end dates can make a calendar');
assert(!hasCalendarDates({ start: '2026-10-13', end: '' }), 'a missing end date is not a calendar');
assert(!hasCalendarDates(null), 'a missing event is not a calendar');

const { eventIcs } = require('../lib/event-ics');
const byId = new Map(loadEvents().filter((ev) => ev && ev.id).map((ev) => [ev.id, ev]));
const icaEv = byId.get('ica-copper-value-chain-transformers-2026');
const icaIcs = eventIcs(icaEv);
assert(icaIcs.indexOf('DTSTART:20261117T130000Z') !== -1, 'ICA calendar starts at 13:00 UTC');
assert(icaIcs.indexOf('DTSTART;VALUE=DATE:') === -1, 'ICA calendar is not an all-day date');
assert(icaIcs.indexOf('DTEND:20261117T140000Z') !== -1, 'ICA calendar uses a one-hour end when no duration is published');
assert(icaIcs.indexOf('LOCATION:https://transformer-academy.com/courses/free-lessons/lessons/the-value-chain-of-copper-for-transformers-explained/') !== -1, 'ICA calendar location is the lesson URL');
assert(icaIcs.indexOf('Online, Online') === -1 && icaIcs.indexOf('LOCATION:Online,') === -1, 'ICA calendar location does not repeat Online');
const wetex = byId.get('wetex-2026');
if (wetex) {
  const wetexIcs = eventIcs(wetex);
  assert(wetexIcs.indexOf('DTSTART;VALUE=DATE:') !== -1, 'an in-person calendar stays all-day');
  assert(wetexIcs.indexOf('DTSTART:20') === -1, 'an in-person calendar has no clock time');
}

const root = path.join(__dirname, '..');
const missing = [];
const undated = [];
listHtmlFiles(root).forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const re = /href="([^"]*events\/ics\/([A-Za-z0-9-]+)\.ics)"/g;
  let m;
  while ((m = re.exec(html))) {
    const rel = path.normalize(path.join(path.dirname(file), m[1].split('?')[0]));
    const id = m[2];
    if (!fs.existsSync(rel)) missing.push(path.relative(root, file) + ' -> ' + m[1]);
    else if (!fs.readFileSync(rel, 'utf8').startsWith('BEGIN:VCALENDAR')) missing.push(rel + ' is not a calendar');
    if (!hasCalendarDates(byId.get(id))) undated.push(id + ' linked from ' + path.relative(root, file));
  }
});

if (missing.length || undated.length) {
  missing.forEach((line) => console.error('MISSING ' + line));
  undated.forEach((line) => console.error('UNDATED ' + line));
  console.error('event calendar check failed: ' + missing.length + ' missing, ' + undated.length + ' undated');
  process.exit(1);
}
console.log('event calendar links resolve');
