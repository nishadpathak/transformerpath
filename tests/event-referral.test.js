#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { dubaiToday } = require('../lib/event-display');
const { load, render } = require('../lib/event-referral');

const edition = {
  id: 'fixture-conference-2099',
  series_slug: 'fixture-conference',
  name: 'Fixture Conference 2099',
  date_status: 'CONFIRMED',
  lifecycle_status: 'CONFIRMED_UPCOMING',
  source_url: 'https://event.example/schedule',
  source_checked_at: '2026-11-24',
  official_url: 'https://event.example/registration',
  start: '2099-11-30',
  end: '2099-12-01',
};
const campaign = {
  status: 'approved',
  registration_url: 'https://tickets.example/register?publisher=tp-fixture&campaign=event',
  approved_host: 'tickets.example',
  active_from: '2026-01-01',
  active_through: '2099-11-30',
};
const fixtureRegistry = { [edition.id]: campaign };
const now = '2026-11-24';
assert.ok(load(path.join(__dirname, '../data/event-referrals.json')), 'checkout registry is present and can be parsed');

function renders(ev, entry = campaign, today = now) {
  return render(ev, { [edition.id]: entry }, today);
}
const approved = renders(edition);
assert.match(approved, /href="https:\/\/tickets\.example\/register\?publisher=tp-fixture&amp;campaign=event" rel="sponsored noopener noreferrer"/);
assert.match(approved, /Affiliate disclosure: TransformerPath may earn a commission if you make a qualifying paid registration/);
assert.doesNotMatch(approved, /discount|[0-9]+%|<script|<form/i);
assert.equal(render(edition, {}, now), '');
assert.equal(renders({ ...edition, id: 'fixture-conference-2100' }), '');
assert.equal(renders({ ...edition, official_url: '' }), '');
assert.equal(renders({ ...edition, official_url: campaign.registration_url }), '');
assert.equal(renders({ ...edition, source_checked_at: null }), '');
assert.equal(renders({ ...edition, date_status: 'PROJECTED' }), '');
assert.equal(renders({ ...edition, research_status: 'REJECTED_NO_EVIDENCE' }), '');
assert.equal(renders({ ...edition, lifecycle_status: 'CANCELLED' }), '');
assert.equal(renders({ ...edition, lifecycle_status: 'POSTPONED' }), '');
assert.equal(renders(edition, { ...campaign, status: 'pending' }), '');
assert.equal(renders(edition, { ...campaign, active_from: '2026-11-25' }), '');
assert.equal(renders(edition, { ...campaign, active_from: '2026-02-30' }), '');
assert.equal(renders(edition, { ...campaign, active_through: '2026-11-23' }), '');
assert.equal(renders(edition, { ...campaign, active_through: '2099-12-02' }), '');
assert.equal(renders(edition, campaign, '2099-12-02'), '');
assert.equal(renders(edition, { ...campaign, registration_url: 'http://tickets.example/register?p=tp' }), '');
assert.equal(renders(edition, { ...campaign, registration_url: 'https://tickets.example.evil.example/register' }), '');
assert.equal(renders(edition, { ...campaign, registration_url: 'https://name@tickets.example/register' }), '');
assert.equal(renders(edition, { ...campaign, registration_url: 'https://tickets.example/register?email=someone%40example.net' }), '');

// Run the real generator against a throwaway edition, not against the public
// main registry. Remove the HTML insert and verify every other byte is the same.
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-event-referral-'));
try {
  for (const sub of ['data', '_partials']) fs.mkdirSync(path.join(tmp, sub));
  fs.copyFileSync(path.join(root, 'build-events.js'), path.join(tmp, 'build-events.js'));
  fs.symlinkSync(path.join(root, 'lib'), path.join(tmp, 'lib'), 'dir');
  for (const name of ['data/config.json', '_partials/header.html', '_partials/footer.html']) {
    fs.copyFileSync(path.join(root, name), path.join(tmp, name));
  }
  const sibling = { ...edition, id: 'fixture-conference-2100', name: 'Fixture Conference 2100' };
  fs.writeFileSync(path.join(tmp, 'data/events-canonical.json'), JSON.stringify({ canonical_editions: [edition, sibling] }));
  function generate(registry) {
    fs.writeFileSync(path.join(tmp, 'data/event-referrals.json'), JSON.stringify({ referrals: registry }));
    execFileSync(process.execPath, ['build-events.js'], {
      cwd: tmp,
      env: { ...process.env, TP_SKIP_CANON: '1', TP_EVENT_SERIES: edition.series_slug },
    });
    function page(id) { return fs.readFileSync(path.join(tmp, 'events', id, 'index.html'), 'utf8'); }
    return [page(edition.id), page(sibling.id), page(edition.series_slug)];
  }
  const baseline = generate({});
  assert.deepEqual(load(path.join(tmp, 'data/event-referrals.json')), {});
  const withApproval = generate(fixtureRegistry);
  const block = render(edition, fixtureRegistry, dubaiToday());
  assert.notEqual(block, '', 'fixture approval is current');
  assert.ok(baseline[0].includes('href="https://event.example/registration">Official site</a>'));
  assert.ok(baseline[0].includes('/checkout/?product=featured_event'), 'organizer Spotlight remains');
  assert.ok(withApproval[0].includes(block), 'real renderer inserts the disclosed affiliate CTA');
  assert.equal(withApproval[0].replace(block, ''), baseline[0], 'no other first-party CTA or HTML changed');
  assert.deepEqual(withApproval.slice(1), baseline.slice(1), 'other edition and series hub do not inherit affiliate link');
  assert.deepEqual(generate({ [edition.id]: { ...campaign, status: 'withdrawn' } }), baseline, 'withdrawal rebuild removes only the affiliate CTA');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('event-referral.test.js OK');
