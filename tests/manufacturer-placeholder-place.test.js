#!/usr/bin/env node
/* A missing manufacturer city, country, or product category is omitted.
 * A census dash is not a place and not a category. Run:
 * node tests/manufacturer-placeholder-place.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { statedPlace, listedWhere } = require('../lib/stated-place');
const schema = require('../lib/seo-schema');
const catalog = require('../lib/seo-catalog');
const { fitWindow } = require('../lib/seo-fit');

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

check(statedPlace('—') === '' && statedPlace(' – ') === '' && statedPlace('-') === '' && statedPlace('  ') === '', 'a dash or blank place is missing');
check(statedPlace('Argentina') === 'Argentina' && statedPlace(' Richmond ') === 'Richmond', 'a real place is kept');
check(listedWhere('—', '—') === '', 'ABB-style city and country add no place phrase');
check(listedWhere('—', 'Argentina') === ' in Argentina', 'a dash city is omitted and the country stays');
check(listedWhere('Apodaca', 'Mexico') === ' in Apodaca, Mexico', 'a real city and country stay');

const nowhere = catalog.manufacturerListingCopy({ name: 'ABB', city: '—', country: '—', types: [] });
check(nowhere.title === 'ABB | transformer manufacturer', 'missing location title does not use a dash: ' + nowhere.title);
check(nowhere.description === 'ABB is listed.', 'missing location and category description: ' + nowhere.description);
check(nowhere.title.indexOf('—') === -1 && nowhere.description.indexOf('—') === -1, 'ABB copy prints no dash placeholder');
check(!nowhere.city && !nowhere.country && !nowhere.prods, 'ABB copy has no city, country, or category');

const cityDash = catalog.manufacturerListingCopy({ name: 'Miron', city: '—', country: 'Argentina', types: [] });
check(cityDash.description === 'Miron is listed in Argentina.', 'dash city with a real country: ' + cityDash.description);
check(cityDash.description.indexOf('—') === -1, 'dash city is not printed');
check(/Argentina/.test(cityDash.title) && cityDash.title.indexOf('—') === -1, 'title keeps the country and drops the dash: ' + cityDash.title);

const typed = catalog.manufacturerListingCopy({ name: 'Prolec GE', city: 'Apodaca', country: 'Mexico', types: ['PT'] });
check(typed.description === 'Prolec GE in Mexico is listed for power transformers, Apodaca.', 'sourced category and place stay: ' + typed.description);
check(/Mexico/.test(typed.title), 'sourced country stays in the title: ' + typed.title);

const noAddress = schema.entryNode('https://transformerpath.com/manufacturers/abb/', {
  name: 'ABB', city: '—', country: '—', asOrganization: true, description: nowhere.description
});
check(!noAddress.address, 'JSON-LD omits the address when city and country are dashes');
const countryOnly = schema.entryNode('https://transformerpath.com/manufacturers/miron/', {
  name: 'Miron', city: '—', country: 'Argentina', asOrganization: true
});
check(countryOnly.address && countryOnly.address.addressCountry === 'Argentina' && !countryOnly.address.addressLocality, 'JSON-LD keeps the country and omits a dash city');
const both = schema.entryNode('https://transformerpath.com/manufacturers/prolec-ge/', {
  name: 'Prolec GE', city: 'Apodaca', country: 'Mexico', asOrganization: true
});
check(both.address.addressLocality === 'Apodaca' && both.address.addressCountry === 'Mexico', 'JSON-LD keeps a real city and country');

const pages = fs.readFileSync(path.join(__dirname, '..', 'build-company-pages.js'), 'utf8');
check(pages.indexOf('listedWhere(r.city, r.country)') !== -1, 'the profile generator omits a missing place from the lead');
check(pages.indexOf('across the \' + esc(r.country)') === -1, 'the profile generator does not print a raw country into the RFQ line');

const cat = catalog.create();
const abb = cat.companies.abb;
check(abb && abb.country === '—', 'the ABB census country is still the recorded dash, not a guessed country');
const abbDraft = catalog.draft('manufacturers/abb/index.html', '<h1>ABB</h1>', cat);
check(abbDraft.draftTitle.indexOf('—') === -1, 'ABB draft title has no dash placeholder: ' + abbDraft.draftTitle);
check(abbDraft.draftDesc.indexOf('—') === -1, 'ABB draft description has no dash placeholder: ' + abbDraft.draftDesc);
check(abbDraft.draftDesc.indexOf('listed for transformers') === -1, 'ABB description does not invent a product category');
const abbOrg = abbDraft.nodes.filter(function (n) { return n['@type'] === 'Organization' && n.name === 'ABB'; })[0];
check(abbOrg && !abbOrg.address, 'ABB JSON-LD has no address');
const fittedTitle = fitWindow(abbDraft.draftTitle, 50, 60, abbDraft.padsTitle);
const fittedDesc = fitWindow(abbDraft.draftDesc, 140, 160, abbDraft.padsDesc);
check(fittedTitle.indexOf('in —') === -1 && fittedDesc.indexOf('—') === -1, 'fitted ABB title and description do not restore the dash: ' + fittedTitle + ' || ' + fittedDesc);

let stray = 0;
Object.keys(cat.companies).forEach(function (slug) {
  const copy = catalog.manufacturerListingCopy(cat.companies[slug]);
  const blob = copy.title + ' ' + copy.description;
  if (/in\s+[—–-](?:\s|\.|$|,)/.test(blob) || /,\s*[—–-](?:\s|\.|$)/.test(blob)) stray++;
  if (copy.city === '—' || copy.country === '—' || copy.city === '–' || copy.country === '–') stray++;
});
check(stray === 0, 'no manufacturer listing keeps a dash as a city or country (' + stray + ')');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('manufacturer placeholder place checks passed');
