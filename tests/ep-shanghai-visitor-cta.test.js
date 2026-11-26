'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const edition = JSON.parse(fs.readFileSync(path.join(root, 'data/events-canonical.json'), 'utf8'))
  .canonical_editions.find(ev => ev.id === 'ep-shanghai-2026');
const html = fs.readFileSync(path.join(root, 'events/ep-shanghai-2026/index.html'), 'utf8');
const { applyEventVisitorSpotlight } = require('../lib/event-visitor-spotlight');
const eventsSource = fs.readFileSync(path.join(root, 'events.html'), 'utf8');
const list = applyEventVisitorSpotlight(eventsSource, edition);
assert.equal(applyEventVisitorSpotlight(list, edition), list, 'main Events injection is idempotent');
assert.throws(() => applyEventVisitorSpotlight('<body/>', edition), /unique Events search section/);
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
assert.match(html, /<p id="ep-shanghai-2026-campaign-ended">The overseas visitor perks campaign ended on 25 November/);
assert.match(html, /outside mainland China to register on site/);
assert.match(html, /href="#post-show"/);
assert.match(html, /<section id="post-show"[^>]*>[\s\S]*?No verified post-show findings have been published here/);
assert.ok(html.includes('href="' + edition.post_show.news_url + '"'));
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1]);
assert.equal(ld['@graph'].find(node => node['@type'] === 'Event').offers.url, cta.href_after,
  'search structured data points to ordinary registration, not the expired perks link');
assert.ok(html.indexOf('id="visitor-registration"') < html.indexOf('class="evmeta"'), 'first screen prioritizes registration over event administration');
assert.match(list, /id="event-visit-discovery" hidden/);
assert.ok(list.includes('href="/events/ep-shanghai-2026/#visitor-registration"'));
const campaignScript = html.match(/<script>(\(function\(\)\{var a=document\.getElementById\("ep-shanghai-2026-cta"\)[\s\S]*?)<\/script>/);
assert.ok(campaignScript);
function run(time) {
  const a = { href: cta.href_after, textContent: 'Ordinary', dataset: { campaignUrl: cta.href, campaignCutoff: cta.cutoff, campaignLabel: 'Campaign' }, setAttribute(k, v) { this[k] = v; } };
  const perks = { hidden: true };
  const expiry = { hidden: false };
  const timer = [];
  const clock = { now: () => time, parse: Date.parse };
  vm.runInNewContext(campaignScript[1], {
    Date: clock, setTimeout: (cb, ms) => timer.push({cb, ms}), clearTimeout: () => {},
    document: { getElementById: id => id.endsWith('perks') ? perks : id.endsWith('campaign-ended') ? expiry : a, addEventListener() {} },
    window: { addEventListener() {} },
  });
  return { a, perks, expiry, timer, move(ms) { time = ms; } };
}
const active = run(end - 10000);
assert.equal(active.a.href, cta.href);
assert.equal(active.a['data-track-registration_type'], 'organiser_campaign');
assert.equal(active.perks.hidden, false);
assert.equal(active.expiry.hidden, true);
assert.equal(active.timer[0].ms, 10001);
active.move(end + 1);
active.timer[0].cb();
assert.equal(active.a.href, cta.href_after, 'open tabs change links at expiry, not only on reload');
assert.equal(active.perks.hidden, true);
assert.equal(active.expiry.hidden, false);
const expired = run(end + 1);
assert.equal(expired.a.href, cta.href_after);
assert.equal(expired.a['data-track-registration_type'], 'organiser');
assert.equal(expired.perks.hidden, true);
assert.equal(expired.expiry.hidden, false);
const hubScript = list.match(/<script>(\(function \(\) \{\n  var block = document.getElementById\('event-visit-discovery'\);.*?\}\)\(\);)<\/script>/s);
assert.ok(hubScript, 'main Events publishes a direct registration enhancement');
assert.match(list, /<a[^>]+id="event-visit-discovery-cta" href="https:\/\/www\.epchinashow\.com\//);
function runHub(time, edit = {}) {
  const block = { hidden: true, dataset: { showClose: edition.end + 'T15:00:00+08:00' } };
  const link = { dataset: { campaignUrl: cta.href, campaignCutoff: cta.cutoff, generalLabel: cta.label, ...edit }, getAttribute: () => cta.href_after,
    setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; } };
  const timer = [];
  vm.runInNewContext(hubScript[1], {
    Date: { now: () => time, parse: Date.parse }, setTimeout: (cb, ms) => timer.push({cb, ms}), clearTimeout() {},
    document: { getElementById: id => id.endsWith('cta') ? link : block, addEventListener() {} },
    window: { addEventListener() {} },
  });
  return { block, link, timer, move(ms) { time = ms; } };
}
const hub = runHub(end);
assert.equal(hub.block.hidden, false);
assert.equal(hub.link.href, cta.href, 'main Events links directly to exact organiser campaign up to cutoff');
assert.equal(hub.timer[0].ms, 1);
assert.equal(hub.link['data-track-registration_type'], 'organiser_campaign');
hub.move(end + 1);
hub.timer[0].cb();
assert.equal(hub.link.href, cta.href_after, 'main Events open tab falls back to ordinary organiser registration');
assert.equal(hub.link['data-track-registration_type'], 'organiser');
assert.equal(hub.link.textContent, cta.label);
assert.equal(runHub(Date.parse(edition.end + 'T15:00:00+08:00')).block.hidden, true, 'spotlight expires at the show close');
assert.doesNotMatch(applyEventVisitorSpotlight(eventsSource, { ...edition, visitor_cta: { ...cta, href: 'https://www.epchinashow.com@other.example/EP/' } }), /other\.example/);
console.log('EP Shanghai visitor registration and cutoff OK on both Events pages');
