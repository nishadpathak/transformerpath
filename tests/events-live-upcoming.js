#!/usr/bin/env node
/* Events split confirmed in-progress dates into Live now. Projected dates stay upcoming.
 * Run: node tests/events-live-upcoming.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'events.html'), 'utf8');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}
check(html.indexOf('id="eventsLiveHeading"') !== -1 && html.indexOf('>Live now</h2>') !== -1, 'Live now heading exists');
check(html.indexOf('id="eventsUpcomingHeading"') !== -1 && html.indexOf('>Upcoming</h2>') !== -1, 'Upcoming heading exists');
check(html.indexOf('function isLiveNow(ev)') !== -1, 'live dates use a date check');
check(html.indexOf("ev.date_status !== 'CONFIRMED'") !== -1, 'unconfirmed events are not live');
check(html.indexOf('Showing ${live.length} live now · ${upcoming.length} upcoming') !== -1, 'count names both groups');
check(/<!--SSR:events-count-->\s*Showing \d+ upcoming events/.test(html), 'prerender count line stays for the existing regression');
if (failed) process.exit(1);
console.log('events split checks passed');
