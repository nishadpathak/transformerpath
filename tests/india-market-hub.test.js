/* India hub consumes the shared intake and distinguishes bid deadlines from awards. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const hub = require('../lib/india-market-hub');
const seed = require('../data/india-market-hub.json');
const intake = require('../data/tender-notices.json').notices;
const publicIntake = require('../data/public-tender-notices.json').notices;
const at = Date.parse('2026-11-25T01:00:00Z');
const close = Date.parse('2026-12-23T05:30:00Z');
const rfx = ['5002005859', '5002005535'];
const notices = intake.filter((n) => rfx.includes(n.official_reference));
assert.equal(notices.length, 2, 'Use two distinct canonical POWERGRID records');
const rows = hub.activeTenderSnapshot([], notices, at);
const refs = (items) => items.map((t) => t.official_reference);
assert.deepEqual(refs(rows), rfx);
assert.equal(new Set(rows.map((t) => t.official_source_url)).size, 2);
assert(rows.every((t) => Date.parse(t.close_at) === close), '11:00 IST = 05:30 UTC');
assert.deepEqual(refs(hub.activeTenderSnapshot([], notices, close - 1)), rfx);
assert.deepEqual(hub.activeTenderSnapshot([], notices, close), [], 'Cut off at the exact submission time');
assert.deepEqual(hub.activeTenderSnapshot([], notices, close + 1), []);
const row = notices.find((t) => t.official_reference === rfx[0]);
const [other] = notices.filter((t) => t.official_reference !== rfx[0]);
for (const status of ['AWARDED', 'CANCELLED', 'EVALUATION']) {
  assert.deepEqual(refs(hub.activeTenderSnapshot([{ ...row, status }], [row, other], at)), [rfx[1]]);
}
assert.deepEqual(hub.activeTenderSnapshot([{ ...row, status: 'CLOSED' }], [row], at), []);
assert.deepEqual(hub.activeTenderSnapshot([], [{ ...row, country: 'Mexico', buyer_country: 'Mexico' }], at), []);
assert.deepEqual(hub.activeTenderSnapshot([], [{ ...row, official_source_url: 'https://domain.example/not-verified' }], at), []);
assert.deepEqual(hub.activeTenderSnapshot([], [{ ...row, close_at: '2026-12-23' }], at), []);
const rendered = hub.renderTenders(rows);
assert.match(rendered, /data-india-close="2026-12-23T11:00:00[+]05:30"/);
assert.match(rendered, /23 Dec 2026[^<]*11:00[^<]*IST/i);
assert.match(rendered, /Find RFx in PRANIT/);
assert.match(rendered, /notice[s]? (?:are|is) not (?:an )?award/i);
assert.match(hub.renderTenders([]), /data-india-no-open>/);
const html = fs.readFileSync(path.join('markets', 'india', 'index.html'), 'utf8');
assert.match(html, /<title>India Transformer Hub/);
assert.equal((html.match(/<link rel="canonical" href="https:\/\/transformerpath\.com\/markets\/india\/"/g) || []).length, 1);
['tenders','news','directory','awards'].forEach((s) => {
  assert(html.includes('id="india-' + s + '"'), 'India hub renders the ' + s + ' section');
  assert(html.includes('href="#india-' + s + '"'), 'India hub links to the ' + s + ' section');
});
assert(!html.includes('Open / live tenders'), 'No legacy India status heuristic');
const buildNow = Date.now();
const activeRefs = refs(hub.activeTenderSnapshot(require('../data/tenders.json').tenders, intake.concat(publicIntake), buildNow));
for (const r of rfx) {
  // Time-sensitive assertion: a regenerated page must show qualifying refs while
  // open. Do not require those particular bids in builds after closing.
  if (activeRefs.includes(r) && close - buildNow > 3600000) assert(html.includes(r));
}
const mexico = fs.readFileSync(path.join('markets', 'mexico', 'index.html'), 'utf8');
assert(!mexico.includes('data-india-close='));
for (const link of [...seed.capabilities.map((c) => c.path),
  ...seed.news.map((n) => n.profile),
  ...seed.clusters.flatMap((c) => c.entries.map((e) => e.profile)),
  '/tenders/country/india/', '/directory/country/india/'].filter(Boolean)) {
  assert(fs.existsSync(link.slice(1) + (link.endsWith('/') ? 'index.html' : '')), 'Internal destination exists: ' + link);
}
assert(seed.clusters.every((c) => c.entries.every((e) => e.source.startsWith('https://') && e.detail)));
console.log('India market hub: sourcing, 2 separate RFx notices, IST deadline boundaries, canonical sections and internal handoff links passed.');
