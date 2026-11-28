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
const { eventIcs } = require('../lib/event-ics');
const { MAX_FILENAME, calendarFilename, calendarHeaderRules } = require('../lib/event-calendar-download');

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

const root = path.join(__dirname, '..');
const byId = new Map(loadEvents().filter((ev) => ev && ev.id).map((ev) => [ev.id, ev]));
const missing = [];
const undated = [];
const linked = new Set();
listHtmlFiles(root).forEach((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const re = /href="([^"]*events\/ics\/([A-Za-z0-9-]+)\.ics)"/g;
  let m;
  while ((m = re.exec(html))) {
    const rel = path.normalize(path.join(path.dirname(file), m[1].split('?')[0]));
    const id = m[2];
    linked.add(id);
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
assert.equal(calendarFilename('ep-shanghai-2026'), 'ep-shanghai-2026.ics');
const long = 'mmec-mozambique-mining-oil-and-gas-energy-conference-2027';
const short = calendarFilename(long);
assert(short.length <= MAX_FILENAME && short.endsWith('-2027.ics') && short.startsWith('mmec-'));
assert.notEqual(short, calendarFilename(long.replace('oil', 'solar')));
assert.throws(() => calendarFilename('bad/calendar'), /Invalid event calendar id/);
const expectedRules = calendarHeaderRules(linked);
const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
assert(headers.includes('Strict-Transport-Security'), 'unrelated response headers survive regeneration');
for (const rule of expectedRules) assert(headers.includes(rule), 'legacy .ics route must set its short HTTP attachment name');
assert.equal((headers.match(/Content-Disposition: attachment; filename="[^"]+\.ics"/g) || []).length,
  expectedRules.length, 'stale calendar-only headers are removed');

const shanghai = byId.get('cwieme-shanghai-2027');
assert.equal(shanghai.timezone, 'Asia/Shanghai');
assert.deepStrictEqual(shanghai.hours.map(x => [x.date, x.open, x.close]), [
  ['2027-06-23', '09:30', '17:00'], ['2027-06-24', '09:30', '17:00'], ['2027-06-25', '09:30', '15:00']
]);
const calendar = eventIcs(shanghai);
assert.deepStrictEqual(calendar.match(/^UID:.*$/gm), ['UID:cwieme-shanghai-2027@transformerpath.com']);
assert(calendar.includes('DTSTART;VALUE=DATE:20270623\r\nDTEND;VALUE=DATE:20270626'));
const edition = fs.readFileSync(path.join(root, 'events/cwieme-shanghai-2027/index.html'), 'utf8');
if (edition.includes('<b>Hours</b>')) {
  assert(edition.includes('Shanghai local time: Asia/Shanghai, UTC+8'));
  assert(edition.includes(shanghai.hours_source_url.replace('&', '&amp;')));
}
console.log('event calendar links, short HTTP attachment names and stable CWIEME UID resolve');
