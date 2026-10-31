#!/usr/bin/env node
/* Rental & emergency providers: 18 published listings, one Aggreko row,
 * excluded companies absent, generic contact only, internal outreach flag hidden.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/rental-emergency-providers.json'), 'utf8'));
const companies = data.companies || [];
const hub = fs.readFileSync(path.join(root, 'rental-emergency.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const excluded = ['Hitachi Energy', 'Southern States LLC', 'Mahati Industries'];
const generic = /^(info|sales|enquiry|enquiries|contact|hello|support|service|office|admin)@/i;

function slug(row) {
  return String(row.id || '').replace(/^rent:/, '');
}
function profile(row) {
  return fs.readFileSync(path.join(root, 'rental-emergency', slug(row), 'index.html'), 'utf8');
}
function mainHtml(html) {
  const start = html.indexOf('<main');
  const end = html.indexOf('</main>');
  return start >= 0 && end > start ? html.slice(start, end) : html;
}
function visible(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
}

console.log('=== RENTAL & EMERGENCY PROVIDERS ===');
check('18 listings', companies.length === 18, String(companies.length));
check('hub count attribute matches', /data-listing-count="18"/.test(hub));
check('hub says by country and type', /by country and type/i.test(hub));
check('one Aggreko listing', companies.filter(function (c) { return c.company_name === 'Aggreko'; }).length === 1);
const aggreko = companies.find(function (c) { return c.company_name === 'Aggreko'; });
check('Aggreko covers the US and Canada', aggreko && aggreko.countries.join('|') === 'USA|Canada', aggreko && aggreko.countries.join('|'));
check('Aggreko links both service pages', aggreko && aggreko.service_pages.length === 2 &&
  aggreko.service_pages.some(function (p) { return p.url.indexOf('/en-us/') !== -1; }) &&
  aggreko.service_pages.some(function (p) { return p.url.indexOf('/en-ca/') !== -1; }));
excluded.forEach(function (name) {
  check(name + ' is not a listing', !companies.some(function (c) { return c.company_name === name; }));
  check(name + ' is not on the hub', hub.indexOf(name) === -1);
});
check('outreach flag stays out of the hub', hub.indexOf('no_email_outreach') === -1);
check('hub is in the sitemap', sitemap.indexOf('https://transformerpath.com/rental-emergency.html') !== -1);
check('nav links the hub from the homepage', fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('href="/rental-emergency.html"') !== -1 ||
  fs.readFileSync(path.join(root, 'index.html'), 'utf8').indexOf('href="rental-emergency.html"') !== -1);
check('directory index links the hub', fs.readFileSync(path.join(root, 'directory.html'), 'utf8').indexOf('rental-emergency.html') !== -1);
check('header partial links the hub', fs.readFileSync(path.join(root, '_partials/header.html'), 'utf8').indexOf('rental-emergency.html') !== -1);
check('hub has a prominent urgent request block', hub.indexOf('id="urgent-request"') !== -1 && hub.indexOf('Need a transformer fast?') !== -1 && hub.indexOf('class="btn btn-amber" href="/request-urgent.html"') !== -1);

companies.forEach(function (row) {
  const html = profile(row);
  const body = mainHtml(html);
  const text = visible(body);
  const name = row.company_name;
  check(name + ' profile exists and names the company', text.indexOf(name) !== -1);
  check(name + ' links the company website', body.indexOf(row.website) !== -1);
  (row.service_pages || []).forEach(function (page) {
    check(name + ' links ' + page.url, body.indexOf(page.url) !== -1);
  });
  check(name + ' hides the outreach flag', body.indexOf('no_email_outreach') === -1);
  check(name + ' shows unverified capacity as an em dash', text.indexOf('Capacity') !== -1 && text.indexOf('\u2014') !== -1);
  const email = String(row.contact_email || '');
  if (email) {
    check(name + ' email is generic', generic.test(email), email);
    check(name + ' shows that email', body.indexOf('mailto:' + email) !== -1);
  } else {
    check(name + ' shows no email address', !/mailto:/i.test(body));
  }
  if (row.phone) check(name + ' shows the source phone', text.indexOf(row.phone) !== -1, row.phone);
  else check(name + ' shows no invented phone', !/tel:/i.test(body));
  check(name + ' is in the sitemap', sitemap.indexOf('https://transformerpath.com/rental-emergency/' + slug(row) + '/') !== -1);
  check(name + ' links the urgent request form', body.indexOf('/request-urgent.html?from=' + slug(row)) !== -1 && body.indexOf('Need a transformer fast?') !== -1);
  check(name + ' profile is indexable', /content="index,follow"/.test(html));
});

check('sitemap lists 18 profiles', (sitemap.match(/\/rental-emergency\/[a-z0-9-]+\//g) || []).length === 18);

if (failed) {
  console.error('RENTAL & EMERGENCY DIRECTORY FAILED (' + failed + ')');
  process.exit(1);
}
console.log('RENTAL & EMERGENCY DIRECTORY OK');
