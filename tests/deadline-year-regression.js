#!/usr/bin/env node
/* A bare year is an imprecise deadline, not 1 January.
 * Bahrain Sitra's record says "2026". That must stay open through 31 Dec 2026
 * and render "Deadline: 2026 (exact date not stated)".
 *
 * Run after build-tenders.js so the generated Sitra page is checked too.
 */
'use strict';
const fs = require('fs');
const {
  parseDeadline, deadlineLabel, isPast, classifyOpenDeadline
} = require('../lib/deadline');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

console.log('=== YEAR-ONLY DEADLINE ===');
const TODAY = '2026-10-15';
const YEAR = '2026';

check('a bare year is not 1 January', parseDeadline('2026') === '2026' && parseDeadline('2026') !== '2026-01-01');
check('a year inside a phrase is not 1 January', parseDeadline('expected 2026') === '2026');
check('the label names the year and says the date is not stated', deadlineLabel('2026') === 'Deadline: 2026 (exact date not stated)');
check('15 Oct 2026 is before 31 Dec 2026', isPast(YEAR, TODAY) === false);
check('31 Dec 2026 is still inside the year', isPast(YEAR, '2026-12-31') === false);
check('1 Jan 2027 is after the year', isPast(YEAR, '2027-01-01') === true);
check('a year-only tendering row stays open on 15 Oct 2026', classifyOpenDeadline(YEAR, TODAY) === 'OPEN');
check('a year-only tendering row closes after 31 Dec', classifyOpenDeadline(YEAR, '2027-01-01') === 'CLOSED');
check('an explicit 14 May 2026 is still that day', parseDeadline('2026-05-14') === '2026-05-14');
check('14 May 2026 is already past on 15 Oct', classifyOpenDeadline('2026-05-14', TODAY) === 'CLOSED');
check('an explicit 1 January stays 1 January', parseDeadline('2026-01-01') === '2026-01-01');
check('28 Oct 2026 stays a calendar day', parseDeadline('Bid closing 2026-10-28') === '2026-10-28');

const projects = JSON.parse(fs.readFileSync('data/projects.json', 'utf8')).projects;
const sitra = projects.find(function (p) {
  return p.project === 'Bahrain EWA Sitra 400 kV grid substation — transformer & reactor works';
});
check('Bahrain Sitra is on file', !!sitra);
check('Bahrain Sitra expected value is the bare year 2026', sitra && sitra.expected === '2026');
check('Bahrain Sitra is still in tendering', sitra && String(sitra.status).toLowerCase() === 'tendering');
const sitraDeadline = parseDeadline(sitra && sitra.expected);
check('Bahrain Sitra deadline is the year, not 1 January', sitraDeadline === '2026', sitraDeadline);
check('Bahrain Sitra is not closed on 15 Oct 2026', classifyOpenDeadline(sitraDeadline, TODAY) !== 'CLOSED');

const pagePath = 'tenders/bahrain-ewa-sitra-400-kv-grid-substation/index.html';
const page = fs.readFileSync(pagePath, 'utf8');
check('the Sitra page shows the imprecise deadline', page.indexOf('Deadline: 2026 (exact date not stated)') >= 0);
check('the Sitra page is not closed', /<b>Status<\/b> Closed/.test(page) === false);
check('the Sitra page does not store 1 January', page.indexOf('2026-01-01') < 0);

const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders;
const row = tenders.find(function (t) { return t.title === 'Bahrain EWA Sitra 400 kV grid substation'; });
check('the Sitra tender record is published', !!row);
check('the Sitra record deadline is 2026', row && row.deadline === '2026', row && row.deadline);
check('the Sitra record is not CLOSED', row && row.status !== 'CLOSED', row && row.status);

if (failed) {
  console.error('YEAR-ONLY DEADLINE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — year-only deadline');
