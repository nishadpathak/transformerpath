#!/usr/bin/env node
/* An event whose end date is before the build date is past on every upcoming
   list. Ending on the build date keeps it. Title keywords are not a date. */
'use strict';
const fs = require('fs');
const { platformToday, isUpcoming } = require('../lib/event-status');

let failed = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failed++; console.error('  ✗ ' + msg); }
}

const day = '2026-10-14';
const powergen = { n: 'POWERGEN International 2026', s: '2026-01-20', e: '2026-01-22', co: 'USA', d: 'Power-generation event', v: 'Henry B. Gonzalez Convention Center' };
const endsToday = { n: 'IEEE PowerCon 2026 (Malaysia)', s: '2026-10-11', e: '2026-10-14', co: 'Malaysia', d: 'IEEE PES conference', v: 'Sabah International Convention Centre' };
const endedYesterday = { n: 'Ended yesterday', s: '2026-10-11', e: '2026-10-13', co: 'Germany', d: 'Closed show', v: 'Messe' };
const stillRunning = { n: 'belektro 2026 (Berlin)', s: '2026-10-13', e: '2026-10-15', co: 'Germany', d: 'Electrical trade fair', v: 'Messe Berlin' };

console.log('=== PAST EVENTS ===');
function endedBefore(ev, on) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(ev.e || '')) && ev.e < on;
}
check(endedBefore(powergen, day) && !isUpcoming(powergen, day), 'POWERGEN (ended 22 Jan 2026) is past on 14 Oct 2026');
check(endedBefore(endedYesterday, day) && !isUpcoming(endedYesterday, day), 'end date the day before the build date is past');
check(!endedBefore(endsToday, day) && isUpcoming(endsToday, day), 'end date equal to the build date stays upcoming');
check(!endedBefore(stillRunning, day) && isUpcoming(stillRunning, day), 'already started, end date still ahead, stays upcoming');
check(!isUpcoming({ n: 'No end', s: '2026-10-01', d: 'missing end', v: 'Hall' }, day), 'a missing end date is not treated as upcoming');

const events = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const today = platformToday();
const pastStillUpcoming = events.filter((ev) => endedBefore(ev, today) && isUpcoming(ev, today));
check(pastStillUpcoming.length === 0, 'no corpus event with an end date before ' + today + ' is upcoming (' + pastStillUpcoming.length + ')');

const corpusPowergen = events.find((ev) => ev.n === 'POWERGEN International 2026');
check(corpusPowergen && !isUpcoming(corpusPowergen), 'corpus POWERGEN is off the upcoming list');
const usaUpcoming = events.filter((ev) => ev.co === 'USA' && isUpcoming(ev));
check(!usaUpcoming.some((ev) => ev.n === 'POWERGEN International 2026'), 'USA market/profile upcoming list omits POWERGEN');
check(usaUpcoming.every((ev) => ev.e >= today), 'every USA upcoming event ends on or after the build date');

const germanyUpcoming = events.filter((ev) => ev.co === 'Germany' && isUpcoming(ev));
check(germanyUpcoming.every((ev) => ev.e >= today), 'every Germany profile upcoming event ends on or after the build date');

function usesSharedPredicate(file) {
  const src = fs.readFileSync(file, 'utf8');
  return src.indexOf('isUpcoming') >= 0 && src.indexOf('new Date(ev.e) >= now') < 0 && src.indexOf("e.s || e.startDate") < 0;
}
['build-markets.js', 'build-company-pages.js', 'build-applications.js', 'build_ssr.js', 'build-site-stats.js', 'build-map.js', 'build-commerce-intel.js'].forEach((file) => {
  check(usesSharedPredicate(file), file + ' classifies upcoming with isUpcoming');
});
check(fs.readFileSync('build-exhibitions.js', 'utf8').indexOf('platformToday()') >= 0, 'exhibitions compare the end date with platformToday()');

const ssr = fs.readFileSync('build_ssr.js', 'utf8');
check(ssr.indexOf('const EVENTS_DAY_OFFSET_MS = 4*60*60*1000') >= 0, 'events prerender uses EVENTS_DAY_OFFSET_MS');
check(ssr.indexOf('resolveStatus(ev, { today: TODAY })') >= 0, 'events prerender resolves status on the platform day');
const eventsPage = fs.readFileSync('events.html', 'utf8');
const countMatch = eventsPage.match(/<!--SSR:events-count-->\s*Showing (\d+) upcoming events/);
const upcomingNow = events.filter((ev) => isUpcoming(ev, today));
check(!!countMatch, 'events prerender has a Showing N upcoming events line');
check(countMatch && Number(countMatch[1]) === upcomingNow.length, 'prerendered count matches canonical upcoming events (' + (countMatch && countMatch[1]) + ' vs ' + upcomingNow.length + ')');
const upNext = (eventsPage.match(/<!--SSR:events-upnext-->([\s\S]*?)<!--\/SSR:events-upnext-->/) || [])[1] || '';
const liveCards = upNext.match(/data-rel-end="(\d{4}-\d{2}-\d{2})"[^>]*>Live now/g) || [];
check(liveCards.every(function (chip) {
  const end = chip.match(/data-rel-end="(\d{4}-\d{2}-\d{2})"/)[1];
  return end >= today;
}), 'no prerendered Live now chip belongs to an event that already ended');
check(upNext.indexOf('Powerex Asia') < 0 || today <= '2026-10-16', 'Powerex Asia is not Live now after 16 Oct 2026');

if (failed) {
  console.error('PAST EVENTS REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS');
