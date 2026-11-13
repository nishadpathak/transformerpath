#!/usr/bin/env node
/* A portal instant closes at that clock time. A calendar day with no clock
 * still runs through 23:59:59.999 UTC. */
'use strict';
const {
  parseDeadline, parseCloseInstant, isPast, classifyOpenDeadline
} = require('../lib/deadline');
const { dualZoneLabel } = require('../lib/tender-time');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const INSTANT = '2026-10-16T23:59:00+02:00';
check('an offset instant is kept whole', parseCloseInstant(INSTANT) === INSTANT);
check('a calendar day is not an instant', parseCloseInstant('2026-10-16') === '');
check('parseDeadline still returns the calendar day inside an instant', parseDeadline(INSTANT) === '2026-10-16');
check('the instant is past at 22:00 UTC', isPast(INSTANT, '2026-10-16T22:00:00Z') === true);
check('the instant is still open at 21:00 UTC', isPast(INSTANT, '2026-10-16T21:00:00Z') === false);
check('the same calendar day is still open at 22:00 UTC', isPast('2026-10-16', '2026-10-16T22:00:00Z') === false);
check('a calendar day is past at 00:00 UTC the next day', isPast('2026-10-16', '2026-10-17T00:00:00Z') === true);
check('11:00 IST on 28 Nov is open on 13 Nov', classifyOpenDeadline('2026-11-28T11:00:00+05:30', '2026-11-13T12:00:00Z') === 'OPEN');
check('11:00 IST on 28 Nov is closed a minute later', classifyOpenDeadline('2026-11-28T11:00:00+05:30', '2026-11-28T05:31:00Z') === 'CLOSED');

const dual = dualZoneLabel('2026-11-28T11:00:00+05:30', 'Asia/Kolkata');
check('portal zone shows 11:00', dual.indexOf('11:00') !== -1, dual);
check('Dubai zone shows 09:30', dual.indexOf('09:30') !== -1, dual);
check('both zone names are present', dual.indexOf('Asia/Kolkata') !== -1 && dual.indexOf('Asia/Dubai') !== -1, dual);

if (failed) {
  console.error('DEADLINE INSTANT FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — deadline instant');
