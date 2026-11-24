'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'analytics.js'), 'utf8');
const choice = 'tp-cookie-consent';

function page(href, initial) {
  const listeners = new Map(), values = new Map(), scripts = [];
  if (initial) values.set(choice, initial);
  const location = new URL(href);
  const document = {
    referrer: 'https://www.google.com/search?q=someone%40example.com',
    querySelector: () => scripts.find(node => node['data-tp-ga4']) || null,
    querySelectorAll: () => [],
    getElementById: () => null,
    body: { innerText: '' },
    createElement: tag => ({ tag, setAttribute(key, value) { this[key] = value; } }),
    head: { appendChild(node) { if (node.tag === 'script') scripts.push(node); } },
    addEventListener(type, fn) { (listeners.get('d:' + type) || listeners.set('d:' + type, []).get('d:' + type)).push(fn); }
  };
  const context = {
    document, location, URL, URLSearchParams, Date,
    localStorage: { getItem(key) { return values.get(key) || null; } },
    addEventListener(type, fn) { (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); }
  };
  context.window = context;
  const v = vm.createContext(context);
  function load() { vm.runInContext(code, v); }
  function fire(key, args = {}) { for (const fn of listeners.get(key) || []) fn(args); }
  function consent(next, clean = false) {
    next ? values.set(choice, next) : values.delete(choice);
    fire(clean ? 'storage' : 'tp-consent-changed', clean ? { key: choice } : { detail: { consent: next } });
  }
  function entries() { return (context.dataLayer || []).map(row => Array.from(row)); }
  function form(name) {
    const target = { getAttribute: key => key === 'data-track-form' ? name : '', getAttributeNames: () => ['data-track-form'] };
    fire('d:submit', { target });
  }
  load();
  fire('d:DOMContentLoaded');
  return { load, scripts, consent, entries, context, form };
}

for (const origin of ['https://www.transformerpath.com', 'https://deploy-preview-469--transformerpath.netlify.app', 'http://localhost']) {
  const site = page(origin + '/pricing.html', 'accepted');
  assert.equal(site.scripts.length, 0);
  assert.equal(site.entries().length, 0);
}
const site = page('https://transformerpath.com/pricing/?utm_source=newsletter&utm_campaign=private%40example.com&unlocked=professional&token=secret#private');
site.context.TP_EVENT('rfq_submitted', {});
assert.equal(site.scripts.length, 0);
assert.equal(site.entries().length, 0);
site.consent('essential');
assert.equal(site.scripts.length, 0);
site.consent('accepted');
site.load(); // duplicate included script
assert.equal(site.scripts.length, 1);
const config = site.entries().filter(row => row[0] === 'config');
assert.equal(config.length, 1);
assert.equal(config[0][2].page_location, 'https://transformerpath.com/pricing.html');
assert.equal(config[0][2].page_referrer, 'https://www.google.com/');
assert.equal(config[0][2].campaign_source, 'newsletter');
assert.equal(config[0][2].campaign_name, undefined);
assert.equal(config[0][2].allow_ad_personalization_signals, false);
assert.equal(site.entries().filter(row => row[1] === 'pricing_view').length, 1);

site.form('rfq_submitted');
site.form('supplier_claim_submitted');
site.form('newsletter_signup');
site.context.TP_EVENT('rfq_submitted', { category: 'Power', email: 'a@example.com', value: '123-456-7890', manufacturer: 'wrong@example.com', client_reference_id: 'secret' });
site.context.TP_EVENT('verified_purchase', { value: 499 });
const events = site.entries().filter(row => row[0] === 'event');
assert.deepEqual(Array.from(events, row => row[1]), ['pricing_view', 'rfq_submit_attempt', 'newsletter_submit_attempt', 'rfq_submitted']);
assert.deepEqual(JSON.parse(JSON.stringify(events[3][2])), { category: 'Power' });
site.context.TP_EVENT('affiliate_click', { sub_id: 'event_wetex_hotel', placement: 'hotel' });
site.context.TP_EVENT('rfq_submitted', { sub_id: 'event_wetex_hotel', placement: 'hotel' });
site.context.TP_EVENT('affiliate_click', { sub_id: 'event_visitor123456_hotel', placement: 'unknown' });
const affiliate = site.entries().filter(row => row[0] === 'event').slice(-3);
assert.deepEqual(JSON.parse(JSON.stringify(affiliate.map(row => row[2]))), [
  { sub_id: 'event_wetex_hotel', placement: 'hotel' }, {}, {}
]);
const full = page('https://transformerpath.com/pricing.html?unlocked=professional', 'accepted');
assert.equal(full.entries().some(row => row[1] === 'checkout_return'), true);
assert.equal(full.entries().some(row => row[1] === 'purchase'), false);
site.consent(null);
assert.equal(site.context['ga-disable-' + config[0][1]], true);
const before = site.entries().length;
site.context.TP_EVENT('rfq_submitted', {});
assert.equal(site.entries().length, before);
site.consent('accepted', true);
assert.equal(site.scripts.length, 1);
assert.equal(site.context['ga-disable-' + config[0][1]], false);
assert.equal(site.entries().filter(row => row[1] === 'pricing_view').length, 1);
console.log('Analytics: production opt-in, clean paths, no duplicate/wrong conversions, and revocation passed.');
