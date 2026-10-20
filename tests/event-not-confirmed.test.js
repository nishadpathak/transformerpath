#!/usr/bin/env node
/* Projected and undated events say "not confirmed" and are not treated as dated. */
'use strict';
const fs = require('fs');
const display = require('../lib/event-display');
const hub = require('../lib/event-hub-copy');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const projected = { date_status: 'PROJECTED', start: '2027-03-01', end: '2027-03-03' };
const undated = { date_status: 'TBA', start: '', end: '' };
check('projected badge says not confirmed', display.badgeText(projected) === 'not confirmed');
check('projected date says not confirmed', display.dateLine(projected).indexOf('not confirmed') >= 0);
check('undated badge says not confirmed', display.badgeText(undated) === 'not confirmed');
check('undated date says not confirmed', display.dateLine(undated).indexOf('not confirmed') >= 0);
check('a projected line is not a concrete date', hub.concreteDateLine(projected) === '');
check('a confirmed date is unchanged', display.dateLine({ date_status: 'CONFIRMED', start: '2026-11-24', end: '2026-11-26' }).indexOf('not confirmed') < 0);

const list = fs.readFileSync('events.html', 'utf8');
check('events list no longer badges Unconfirmed', list.indexOf('>Unconfirmed<') < 0);
check('events list no longer badges Date est', list.indexOf('>Date est.<') < 0);
check('events list marks projected rows not confirmed', list.indexOf('>not confirmed<') >= 0 && list.indexOf(', not confirmed') >= 0);
check('client renderer reads date_status', list.indexOf("ev.date_status === 'PROJECTED'") >= 0 && list.indexOf('function datesNotConfirmed') >= 0);
const edition = fs.readFileSync('events/techcon-north-america-2027/index.html', 'utf8');
check('undated edition says not confirmed', edition.indexOf('not confirmed') >= 0 && edition.indexOf('>Dates TBA<') < 0);

if (failed) {
  console.error('EVENT NOT CONFIRMED FAILED (' + failed + ')');
  process.exit(1);
}
console.log('EVENT NOT CONFIRMED PASS');
