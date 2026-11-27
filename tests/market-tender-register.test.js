'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { marketTenderSnapshot, marketTenderView, opening } = require('../lib/market-tender-register');

const at = Date.parse('2026-11-27T18:00:00Z');
const china = { name: 'China' };
const notice = {
  official_reference: 'MATCH-123',
  country: 'China',
  buyer: 'Example Buyer',
  title: 'Fixture transformer tender',
  category: 'supply',
  product: 'power-transformer',
  official_source_url: 'https://ted.europa.eu/example/fixture',
  close_at: '2026-12-08T11:00:00+01:00',
  date_found: '2026-11-27',
  last_verified: '2026-11-27',
  summary: 'The buyer seeks transformers. The amendment changes the closing date.'
};
const current = { ...notice, status: 'OPEN', source_verified: true, official_procurement_url: notice.official_source_url };
const end = Date.parse(notice.close_at);
assert.equal(opening(current, end - 1).status, 'CLOSING_SOON');
assert.equal(opening(current, end), null);
const bare = { ...current, close_at: '', deadline: '2026-12-08' };
assert(opening(bare, Date.parse('2026-12-08T23:59:59.999Z')));
assert.equal(opening(bare, Date.parse('2026-12-09T00:00:00Z')), null);
assert.equal(opening(bare, at, true), null, 'India’s editorial list requires a clock time');
for (const override of [
  { status: 'EXPECTED' }, { status: 'AWARDED' }, { status: 'EVALUATION' }, { status: 'CANCELLED' },
  { status: '' }, { awardee: 'Vendor' }, { source_verified: false },
  { official_procurement_url: 'https://example.org/ted.europa.eu/' },
  { official_procurement_url: 'https://ted.europa.eu.example.org/fixture' },
  { official_procurement_url: 'http://ted.europa.eu/fixture' },
  { close_at: '', deadline: '2026' }, { close_at: '', deadline: '2026-11-31' }
]) assert.equal(opening({ ...current, ...override }, at), null, JSON.stringify(override));
const superseded = { ...current, close_at: '2026-11-26T12:00:00Z', status: 'CLOSED' };
const register = marketTenderSnapshot([superseded], [notice], at);
assert.equal(register.length, 1);
assert.equal(register[0].close_at, notice.close_at);
assert.equal(superseded.status, 'CLOSED', 'The board snapshot is not mutated');
assert.equal(marketTenderView(register, china, at).current.length, 1);
assert.equal(marketTenderView(marketTenderSnapshot([{ ...current, status: 'AWARDED' }], [notice], at), china, at).current.length, 0);
assert.equal(marketTenderView(marketTenderSnapshot([{ ...current, status: 'CLOSED' }], [notice], at), china, at).current.length, 0);
assert.equal(marketTenderView(marketTenderSnapshot([], [notice], at), china, at).current.length, 1);
assert.equal(marketTenderView(register, { name: 'India' }, at).current.length, 0);
const view = marketTenderView([
  ...Array.from({ length: 7 }, (_, i) => ({ ...current, title: 'Fixture ' + i })),
  { ...current, title: 'Historical award', status: 'AWARDED' }, { ...current, title: 'Expected tender', status: 'EXPECTED' }
], china, at);
assert.equal(view.current.length, 7, 'The count is computed before the display limit');
assert.deepEqual(view.history.map(t => t.status), ['AWARDED', 'EXPECTED']);

for (const slug of ['china', 'usa', 'canada', 'mexico', 'brazil']) {
  const file = 'markets/' + slug + '/index.html';
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const opening = html.split('<section id="market-open-tenders"')[1].split('</section>')[0];
  assert.match(opening, /Open tender notices [(][0-9]+ at build[)]/);
  assert.doesNotMatch(opening, /data-tender-status="(?:AWARDED|EXPECTED|UNKNOWN|UNDATED|CLOSED|EVALUATION)"/);
  for (const oldLabel of ["<span>active tenders</span>", "Current tenders &amp; procurement", "Open / live tenders"]) assert(!html.includes(oldLabel));
  if (slug === 'china') {
    const record = html.split('<h2 id="market-history-title">')[1].split('</section>')[0];
    assert.match(record, /data-tender-status="EXPECTED"/);
    assert.match(record, /data-tender-status="AWARDED"/);
    assert.doesNotMatch(record, /Check official notice/);
  }
}
console.log('Market tender register: boundaries, source checks, amendments, counts and rendered procurement sections passed.');
