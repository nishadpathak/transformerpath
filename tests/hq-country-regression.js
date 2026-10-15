#!/usr/bin/env node
/* Head office wins over a plant row. Hyosung, Prolec GE and Siemens Energy
 * are the audited cases. A US company with no sourced foreign head office
 * stays in the USA. */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const headOffice = require('../lib/head-office');

const root = path.join(__dirname, '..');
const index = headOffice.load(root);
const offices = index.offices;

assert(offices.length >= 3, 'head offices are recorded');
offices.forEach(function (office) {
  assert(/^https:\/\//.test(office.source_url), office.name + ' has a public source URL');
  assert(office.country && office.city && office.retrieved_at, office.name + ' has city, country and a check date');
});

assert.strictEqual(headOffice.canonicalRowReplacesAliasHq(true, false), true);
assert.strictEqual(headOffice.canonicalRowReplacesAliasHq(true, true), false);
assert.strictEqual(headOffice.canonicalRowReplacesAliasHq(false, false), false);

const hyosung = headOffice.officeFor({ name: 'Hyosung Heavy Industries', slug: 'hyosung-heavy-industries' }, index);
const prolec = headOffice.officeFor({ name: 'Prolec GE', slug: 'prolec-ge' }, index);
const siemens = headOffice.officeFor({ name: 'Siemens Energy', slug: 'siemens-energy' }, index);
assert.strictEqual(hyosung.country, 'South Korea');
assert.strictEqual(hyosung.city, 'Seoul');
assert.strictEqual(prolec.country, 'Mexico');
assert.strictEqual(prolec.city, 'Apodaca');
assert.strictEqual(siemens.country, 'Germany');
assert.strictEqual(siemens.city, 'Munich');
assert.strictEqual(headOffice.officeFor({ name: 'Howard Industries (Howard Power Solutions)' }, index), null);

const manuf = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
function row(country, name) {
  const group = manuf.find(function (g) { return g.country === country; });
  return group && group.makers.find(function (m) { return m[0] === name; });
}
assert(row('South Korea', 'Hyosung Heavy Industries'), 'Hyosung stays in the South Korea census');
assert.strictEqual(row('South Korea', 'Hyosung Heavy Industries')[1], 'Seoul');
assert(row('Mexico', 'Prolec GE'), 'Prolec stays in the Mexico census');
assert(row('Germany', 'Siemens Energy'), 'Siemens Energy is listed under Germany');
assert.strictEqual(row('Germany', 'Siemens Energy')[1], 'Munich');
assert(!row('USA', 'Siemens Energy'), 'Siemens Energy is not listed as a USA company');
assert(row('USA', 'Howard Industries (Howard Power Solutions)'), 'a US maker with no foreign head-office source stays in the USA');
assert(row('USA', 'HICO America (Hyosung)'), 'the Memphis plant row stays in the USA list');

const review = JSON.parse(fs.readFileSync(path.join(root, 'data/usa-hq-review.json'), 'utf8'));
const usaMakers = manuf.find(function (g) { return g.country === 'USA'; }).makers
  .filter(function (m) { return !/^Served by/i.test(m[0]); });
usaMakers.forEach(function (m) {
  const hit = review.profiles.find(function (p) { return p.name === m[0]; });
  assert(hit, 'USA profile reviewed: ' + m[0]);
});

function pageHas(slug, text) {
  const html = fs.readFileSync(path.join(root, 'manufacturers', slug, 'index.html'), 'utf8');
  assert(html.indexOf(text) !== -1, slug + ' page should contain ' + text);
}
pageHas('hyosung-heavy-industries', 'South Korea');
pageHas('hyosung-heavy-industries', 'Seoul');
pageHas('hyosung-heavy-industries', 'https://www.hyosungheavyindustries.com/en/company/info/global-network');
pageHas('prolec-ge', 'Mexico');
pageHas('prolec-ge', 'Apodaca');
pageHas('siemens-energy', 'Germany');
pageHas('siemens-energy', 'Munich');
pageHas('siemens-energy', 'https://www.siemens-energy.com/global/en/home/general/corporate-information.html');
pageHas('howard-industries-howard-power-solutions', 'USA');

console.log('hq-country-regression: ok');
