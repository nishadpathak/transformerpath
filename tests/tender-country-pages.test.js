#!/usr/bin/env node
/* Country tender pages list every tender once, link a sourced award only
 * when awards.json has that tender, and label directory manufacturers as
 * directory matches.
 */
'use strict';
const fs = require('fs');
const { canonicalCountry } = require('../lib/market-country');
const { slugForCountry, groupTenders, directoryGroupsFor, makerRows } = require('../lib/tender-countries');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders || [];
const awards = JSON.parse(fs.readFileSync('data/awards.json', 'utf8')).awards || [];
const manuf = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const groups = groupTenders(tenders);
const byTender = {};
awards.forEach(function (award) { if (award.tender_id) byTender[award.tender_id] = award; });

const index = fs.readFileSync('tenders/countries.html', 'utf8');
check('country index exists', index.indexOf('data-country-index="1"') >= 0);
check('index says directory matches are not predictions', /directory matches, not predictions of who will win/i.test(index));

const seen = {};
Object.keys(groups).forEach(function (slug) {
  const group = groups[slug];
  const file = 'tenders/country/' + slug + '/index.html';
  check(slug + ' page exists', fs.existsSync(file));
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  check(slug + ' heading names manufacturers active in this country', html.indexOf('Manufacturers active in this country') >= 0);
  check(slug + ' labels directory matches', html.indexOf('data-directory-label="1"') >= 0 && /not a prediction of who will win/i.test(html));
  check(slug + ' canonical is the country page', html.indexOf('https://transformerpath.com/tenders/country/' + slug + '/') >= 0);
  const makers = makerRows(directoryGroupsFor(manuf, group.canonical));
  const listed = html.match(/data-directory-maker="([^"]*)"/g) || [];
  check(slug + ' lists every directory row for the country', listed.length === makers.length, listed.length + ' vs ' + makers.length);
  makers.forEach(function (maker) {
    const attr = String(maker.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    check(slug + ' includes ' + maker.name, html.indexOf('data-directory-maker="' + attr + '"') >= 0);
  });
  group.tenders.forEach(function (tender) {
    check(tender.tender_id + ' appears once', !seen[tender.tender_id], tender.tender_id);
    seen[tender.tender_id] = slug;
    check(tender.tender_id + ' is on its country page', html.indexOf('data-tender-id="' + tender.tender_id + '"') >= 0);
    const award = byTender[tender.tender_id];
    const token = 'data-tender-id="' + tender.tender_id + '"';
    const start = html.indexOf(token);
    const next = start < 0 ? -1 : html.indexOf('data-tender-id="', start + token.length);
    const row = start < 0 ? '' : html.slice(start, next < 0 ? undefined : next);
    const hasLink = row.indexOf('data-award-link="1"') >= 0;
    if (award && award.awardee && (award.source_urls || []).some(function (url) { return /^https?:\/\//.test(url); })) {
      check(tender.tender_id + ' links the sourced awardee', hasLink && html.indexOf('/awards.html#award-' + tender.tender_id) >= 0);
      const awardeeHtml = String(award.awardee).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      check(tender.tender_id + ' names the awardee', row.indexOf(awardeeHtml) >= 0);
    } else {
      check(tender.tender_id + ' has no award link', !hasLink);
    }
  });
});

check('every tender is on exactly one country page', Object.keys(seen).length === tenders.length, Object.keys(seen).length + ' vs ' + tenders.length);
check('Saudi aliases share one page', slugForCountry('Saudi') === slugForCountry('Saudi Arabia') && slugForCountry('Saudi') === 'saudi-arabia');
check('USA and UAE use the directory country', slugForCountry('USA') === 'united-states' && slugForCountry('United Arab Emirates') === 'united-arab-emirates');

const usa = fs.readFileSync('tenders/country/united-states/index.html', 'utf8');
check('USA page does not treat a directory name as a winner prediction', usa.indexOf('not a prediction of who will win') >= 0);
check('USA directory row is filed under USA', usa.indexOf('data-filed-under="USA"') >= 0);
check('USA page lists Acme Electric from the USA directory', usa.indexOf('data-directory-maker="Acme Electric (Hubbell)"') >= 0);
const india = fs.readFileSync('tenders/country/india/index.html', 'utf8');
check('USA maker is not listed on the India page', india.indexOf('Acme Electric (Hubbell)') < 0);

const latvia = canonicalCountry('Latvia');
check('Latvia has tenders', !!groups[slugForCountry('Latvia')]);
if (groups[slugForCountry('Latvia')]) {
  const latviaHtml = fs.readFileSync('tenders/country/' + slugForCountry('Latvia') + '/index.html', 'utf8');
  check('Latvia has no invented manufacturers', latviaHtml.indexOf('data-directory-maker=') < 0 && /No manufacturer directory rows are filed under this country/.test(latviaHtml));
  check('Latvia canonical country is Latvia', latvia === 'latvia');
}

const awardsHtml = fs.readFileSync('awards.html', 'utf8');
awards.forEach(function (award) {
  if (!award.tender_id) return;
  check(award.tender_id + ' award anchor exists', awardsHtml.indexOf('id="award-' + award.tender_id + '"') >= 0);
});

if (failed) {
  console.error('TENDER COUNTRY PAGES FAILED (' + failed + ')');
  process.exit(1);
}
console.log('TENDER COUNTRY PAGES OK');
