/* Run node build-tenders.js, then run this test against the generated board. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { localClose, dateLabel, officialAmendments, amendmentLabel } = require('../lib/tender-board-evidence');
const intake = require('../lib/tender-notices');

assert.match(localClose('2026-11-28T11:00:00+05:30', 'Asia/Kolkata'), /11:00.*Asia\/Kolkata.*09:30.*Asia\/Dubai/);
assert.match(localClose('2026-11-23T10:00:00+02:00', ''), /23 Nov 2026, 10:00 UTC\+02:00 \(notice offset\).*12:00.*Asia\/Dubai/);
assert.match(localClose('2026-11-23T10:00:00+02:00', 'Bad/Zone'), /notice offset/);
assert.equal(localClose('2026-11-28', 'Asia/Kolkata'), '');
assert.equal(dateLabel('2026-11-28'), '28 Nov 2026');
assert.equal(dateLabel('2026-02-31'), '');
const ownerNotice = 'https://ted.europa.eu/en/notice/-/detail/111111-2026';
const a = { type: 'amendment', date: '2026-11-20', source_url: ownerNotice };
const ext = { type: 'deadline_extended', date: '2026-11-21', source_url: ownerNotice };
assert.deepEqual(officialAmendments([a, a, ext, { ...a, date: '2026-02-31' }, { ...a, type: 'submission_deadline' },
  { ...a, source_url: 'https://tendersontime.com/example' }, { ...a, source_url: 'ftp://ted.europa.eu/path' }]), [ext, a]);
assert.equal(amendmentLabel(ext), 'Deadline extension · 21 Nov 2026');
const notice = {
  title: 'Transformer maintenance equipment',
  buyer: 'Tender authority', category: 'service', country: 'Germany',
  official_reference: 'TEST-A01', official_source_url: ownerNotice, close_at: '2026-12-03T11:00:00+01:00',
  date_found: '2026-11-18', last_verified: '2026-11-22',
  summary: 'The authority invites tenders for maintenance equipment. Bidders should refer to the official notice.',
  status_events: [a]
};
const tenders = [];
const options = { regionOf: () => 'Europe', addTender: row => (tenders.push(row), row), notices: [notice] };
assert.equal(intake.mergeInto(tenders, options).added.length, 1);
assert.deepEqual(tenders[0].status_events, [a]);
tenders[0].status_events.push({ type: 'published', date: '2026-11-18', source_url: ownerNotice });
const updated = { ...notice, status_events: [ext, a], close_at: '2026-12-11T11:00:00+01:00' };
assert.equal(intake.mergeInto(tenders, { ...options, notices: [updated] }).merged.length, 1);
assert.equal(tenders[0].close_at, updated.close_at);
assert.deepEqual(tenders[0].status_events.map(x => x.type), ['published', 'deadline_extended', 'amendment']);
assert.deepEqual(tenders[0].status_events.slice(1), [ext, a]);

const board = fs.readFileSync('tenders.html', 'utf8');
assert.match(board, /<script src="\/tp-tender-searches\.js" defer><\/script>/);
assert.match(board, /id="tenderSavedSearches"[^>]*hidden/);
assert.match(board, /id="tenderSavedStatus"[^>]*role="status"/);
assert.match(board, /No email alerts or cross-device sync/);
assert.match(board, /id="tenderAlerts"[^>]*hidden/);
assert.match(board, /id="tenderAlertsToggle"[^>]*aria-pressed="false"/);
assert.match(board, /No email is sent/);
assert.match(board, /data-alert-key="[a-f0-9]{32}" data-alert-close="[^"]+" data-alert-verified="20[0-9-]+"/);
assert.match(board, /Deadline[^<]*(Asia\/Dubai)/);
assert.match(board, /Deadline[^<]*time not stated/);
assert.match(board, /class="t-notice"[^>]*>Official notice/);
assert.match(board, /rel="canonical" href="https:\/\/transformerpath\.com\/tenders\.html"/);
assert.doesNotMatch(board, /id="(?:voltage|mva)Filter"/);
const browser = fs.readFileSync('tp-tender-searches.js', 'utf8');
assert.doesNotMatch(browser, /\bfetch\(|\bXMLHttpRequest\b|\bsendBeacon\b|watchlist-subscribe|analytics\.js/);
console.log('TENDER SAVED SEARCHES OK: exact or date-only close, explicit official amendments, existing free notice links and private assets.');
