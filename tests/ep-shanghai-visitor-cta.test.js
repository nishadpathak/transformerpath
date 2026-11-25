'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const edition = JSON.parse(fs.readFileSync(path.join(root, 'data/events-canonical.json'), 'utf8'))
  .canonical_editions.find(ev => ev.id === 'ep-shanghai-2026');
const html = fs.readFileSync(path.join(root, 'events/ep-shanghai-2026/index.html'), 'utf8');
const list = fs.readFileSync(path.join(root, 'events.html'), 'utf8');
const cta = edition.visitor_cta;
const end = Date.parse(cta.cutoff);
const match = html.match(/<a[^>]+id="ep-shanghai-2026-cta"[^>]*>/);
assert.ok(match, 'current edition renders the invitation');
assert.ok(match[0].includes('href="' + cta.href_after + '"'), 'ordinary organiser link works without JavaScript, during and after the campaign');
assert.ok(match[0].includes('data-campaign-url="' + cta.href + '"'), 'preserves exact configured campaign URL and case-sensitive query');
assert.ok(match[0].includes('data-track="event_registration_click"') && match[0].includes('data-track-event_id="ep-shanghai-2026"'), 'click tracking is consent-gated through the existing event handler');
assert.doesNotMatch(match[0], /data-track-[^=]+=("[^"]*MasterGuid[^"]*"|"https?:)/);
assert.match(html, /<details id="ep-shanghai-2026-perks" hidden>/);
assert.match(html, /id="ep-shanghai-exhibitors"/);
assert.ok(html.indexOf('id="visitor-registration"') < html.indexOf('class="evmeta"'), 'first screen prioritizes registration over event administration');
assert.match(list, /id="event-visit-discovery" hidden/);
assert.ok(list.includes('href="/events/ep-shanghai-2026/#visitor-registration"'));
const campaignScript = html.match(/<script>(\(function\(\)\{var a=document\.getElementById\("ep-shanghai-2026-cta"\)[\s\S]*?)<\/script>/);
assert.ok(campaignScript);
function run(time) {
  const a = { href: cta.href_after, textContent: 'Ordinary', dataset: { campaignUrl: cta.href, campaignCutoff: cta.cutoff, campaignLabel: 'Campaign' }, setAttribute(k, v) { this[k] = v; } };
  const perks = { hidden: true };
  const timer = [];
  const clock = { now: () => time, parse: Date.parse };
  vm.runInNewContext(campaignScript[1], {
    Date: clock, setTimeout: (cb, ms) => timer.push({cb, ms}), clearTimeout: () => {},
    document: { getElementById: id => id.endsWith('perks') ? perks : a, addEventListener() {} },
    window: { addEventListener() {} },
  });
  return { a, perks, timer, move(ms) { time = ms; } };
}
const active = run(end - 10000);
assert.equal(active.a.href, cta.href);
assert.equal(active.a['data-track-registration_type'], 'organiser_campaign');
assert.equal(active.perks.hidden, false);
assert.equal(active.timer[0].ms, 10001);
active.move(end + 1);
active.timer[0].cb();
assert.equal(active.a.href, cta.href_after, 'open tabs change links at expiry, not only on reload');
assert.equal(active.perks.hidden, true);
const expired = run(end + 1);
assert.equal(expired.a.href, cta.href_after);
assert.equal(expired.a['data-track-registration_type'], 'organiser');
assert.equal(expired.perks.hidden, true);
console.log('EP Shanghai visitor registration and cutoff OK');
