#!/usr/bin/env node
/* Urgent replacement request: Netlify form, no price, lead pricing flag off.
 * Run: node tests/urgent-replacement.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const flags = require('../lib/feature-flags');
const offer = require('../lib/urgent-request');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const saved = process.env.TP_PROVIDER_LEAD_PRICING;
delete process.env.TP_PROVIDER_LEAD_PRICING;

const file = JSON.parse(fs.readFileSync(path.join(root, 'data/feature-flags.json'), 'utf8'));
check('committed lead pricing flag is off', file.provider_lead_pricing === false);
check('unset env follows the file', flags.providerLeadPricingEnabled() === false);
process.env.TP_PROVIDER_LEAD_PRICING = '1';
check('env 1 turns the flag on', flags.providerLeadPricingEnabled() === true);
process.env.TP_PROVIDER_LEAD_PRICING = 'off';
check('env off forces the flag off', flags.providerLeadPricingEnabled() === false);
if (saved == null) delete process.env.TP_PROVIDER_LEAD_PRICING;
else process.env.TP_PROVIDER_LEAD_PRICING = saved;

check('published lead amount is empty', offer.PUBLISHED_LEAD_PRICE == null);
check('flag off renders no offer', offer.leadOfferMarkup(false) === '');
check('flag on still renders no offer', offer.leadOfferMarkup(true) === '');

const page = fs.readFileSync(path.join(root, 'request-urgent.html'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'rental-emergency.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'build-rental-emergency.js'), 'utf8');

function visible(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
}
const text = visible(page);
const formStart = page.indexOf('<form');
const formEnd = page.indexOf('</form>');
const form = formStart >= 0 && formEnd > formStart ? page.slice(formStart, formEnd) : '';

check('standalone page exists', page.length > 0);
check('form is a Netlify form', /name="urgent-replacement"/.test(form) && /method="POST"/.test(form) && /data-netlify="true"/.test(form) && /name="form-name" value="urgent-replacement"/.test(form));
check('honeypot is declared', /data-netlify-honeypot="bot-field"/.test(form) && /name="bot-field"/.test(form));
check('rating field', /name="rating"/.test(form) && /Rating \(kVA\/MVA\)/.test(form));
check('primary and secondary voltage', /name="primary_voltage"/.test(form) && /name="secondary_voltage"/.test(form));
check('oil or dry', /name="cooling"/.test(form) && /<option>Oil<\/option>/.test(form) && /<option>Dry<\/option>/.test(form));
check('pad, pole, or substation', /name="mounting"/.test(form) && /<option>Pad<\/option>/.test(form) && /<option>Pole<\/option>/.test(form) && /<option>Substation<\/option>/.test(form));
check('country and city', /name="country"/.test(form) && /name="city"/.test(form));
check('how soon options', /name="how_soon"/.test(form) && /<option>24h<\/option>/.test(form) && /<option>1 week<\/option>/.test(form) && /<option>1 month<\/option>/.test(form));
check('rent or buy', /name="rent_or_buy"/.test(form) && /value="rent"/.test(form) && /value="buy"/.test(form));
check('company and work email', /name="company"/.test(form) && /Work email/.test(form) && /name="email"/.test(form) && /type="email"/.test(form));
check('notes', /name="notes"/.test(form));
check('consent is required and exact', /name="consent"[^>]*required/.test(form) && form.indexOf('I agree TransformerPath may share my request with matching providers.') !== -1);
check('no personal name field', !/name="name"|Full name|Your name|Contact name/i.test(form));
check('thank-you says the request will be routed', page.indexOf('TransformerPath will route the request.') !== -1 && page.indexOf('id="urgentThanks"') !== -1);
check('posts to Netlify and notifies', page.indexOf("fetch(\"/\",") !== -1 || page.indexOf("fetch('/',") !== -1);
check('notify helper is included', page.indexOf('/form-notify.js') !== -1 && page.indexOf('TP_NOTIFY') !== -1);
check('lead offer slot stays empty', /id="urgent-lead-offer" hidden/.test(page) && /data-lead-offer="off"/.test(page) && /var leadOffer = ""/.test(page));
check('page reads the disabled flag', page.indexOf('flags.provider_lead_pricing !== true') !== -1);
check('no price and no payment wiring', page.indexOf('$') === -1 && !/stripe|buy\.stripe|\bpayment\b|\bcheckout\b|\bUSD\b|\bAED\b/i.test(page));
const mailtos = page.match(/mailto:[^"'\s>]+/gi) || [];
check('contact is hello@transformerpath.com only', mailtos.length > 0 && mailtos.every(function (mail) { return mail === 'mailto:hello@transformerpath.com'; }));
check('page does not place the brand in Dubai or the UAE', !/\bDubai\b|\bUAE\b|United Arab Emirates/i.test(text));
check('page is in the sitemap', sitemap.indexOf('https://transformerpath.com/request-urgent.html') !== -1);
check('canonical matches the sitemap URL', page.indexOf('href="https://transformerpath.com/request-urgent.html"') !== -1);
check('builder keeps the hub block and the form', builder.indexOf('Need a transformer fast?') !== -1 && builder.indexOf('request-urgent.html') !== -1 && builder.indexOf('leadOfferMarkup') !== -1);
check('hub block is prominent', hub.indexOf('class="urgent-banner"') !== -1 && hub.indexOf('class="btn btn-amber" href="/request-urgent.html"') !== -1);

const data = JSON.parse(fs.readFileSync(path.join(root, 'data/rental-emergency-providers.json'), 'utf8'));
(data.companies || []).forEach(function (row) {
  const slug = String(row.id || '').replace(/^rent:/, '');
  const profile = fs.readFileSync(path.join(root, 'rental-emergency', slug, 'index.html'), 'utf8');
  check(row.company_name + ' has a small form link', profile.indexOf('class="rent-urgent-link"') !== -1 && profile.indexOf('/request-urgent.html?from=' + slug) !== -1 && profile.indexOf('urgent-banner') === -1);
});

if (failed) {
  console.error('URGENT REPLACEMENT FAILED (' + failed + ')');
  process.exit(1);
}
console.log('URGENT REPLACEMENT OK');
