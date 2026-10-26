#!/usr/bin/env node
/* A card shows Live now while today is inside the event dates, and not Soon
 * as well. Soon stays for a confirmed event that has not started.
 * Run: node tests/events-soon-live.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { showSoonBadge } = require('../lib/event-status');

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

const running = { s: '2026-10-26', e: '2026-10-29', date_status: 'CONFIRMED', d: 'Symposium', v: 'Hall' };
check(showSoonBadge(running, '2026-10-26') === false, 'the start day is not Soon');
check(showSoonBadge(running, '2026-10-28') === false, 'a middle day is not Soon');
check(showSoonBadge(running, '2026-10-29') === false, 'the end day is not Soon');
check(showSoonBadge({ s: '2026-10-27', e: '2026-10-30', d: 'Expo', v: 'Hall' }, '2026-10-26') === true, 'an event that has not started can be Soon');
check(showSoonBadge({ s: '2026-12-20', e: '2026-12-22', d: 'Expo', v: 'Hall' }, '2026-10-26') === false, 'an event more than 31 days away is not Soon');
check(showSoonBadge({ s: '2026-10-20', e: '2026-10-22', d: 'Expo', v: 'Hall' }, '2026-10-26') === false, 'an event that already ended is not Soon');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'events.html'), 'utf8');
check(/const soon = open && !isLiveNow\(ev\) && relDays\(ev\.s\) > 0 && relDays\(ev\.s\) <= 31;/.test(html), 'event cards omit Soon while today is inside the dates');
const liveBranch = html.split("el.textContent = 'Live now';")[1] || '';
check(liveBranch.indexOf("liveCard.querySelectorAll('.badge-soon')") !== -1 && liveBranch.indexOf('badge.remove') !== -1, 'a stale Soon chip is removed when the card becomes Live now');

const ssr = fs.readFileSync(path.join(root, 'build_ssr.js'), 'utf8');
check(ssr.indexOf('showSoonBadge(ev, TODAY)') !== -1, 'the events prerender uses the same Soon rule');
check(!/new Date\(ev\.s\) > now/.test(ssr), 'the prerender does not compare the start to a local midnight');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('events soon/live checks passed');
