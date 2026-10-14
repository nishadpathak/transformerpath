#!/usr/bin/env node
/* tests/market-country-regression.js
 *
 * A tender assigned to country X must never appear on country Y's market page
 * unless an evidenced cross-border link field exists (http(s) source URL).
 * Project country and delivery country are assignments, not title keywords.
 *
 * Run: node tests/market-country-regression.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const mc = require('../lib/market-country');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const SAUDI = { slug: 'saudi-arabia', name: 'Saudi Arabia', gridsName: 'Saudi Arabia', manufName: 'Saudi Arabia' };
const MEXICO = { slug: 'mexico', name: 'Mexico', gridsName: 'Mexico', manufName: 'Mexico' };
const FRANCE = { slug: 'france', name: 'France', gridsName: 'France', manufName: 'France' };
const GERMANY = { slug: 'germany', name: 'Germany', gridsName: 'Germany', manufName: 'Germany' };

console.log('=== MARKET COUNTRY REGRESSION ===');

const tenders = JSON.parse(fs.readFileSync(path.join('data', 'tenders.json'), 'utf8')).tenders || [];
const penasco = tenders.find(function (t) {
  return t && t.title === 'Central Fotovoltaica Puerto Peñasco Secuencia III';
});
check('Puerto Peñasco Secuencia III is in the tender file', !!penasco);
check('Puerto Peñasco is assigned to Mexico', penasco && mc.canonicalCountry(penasco.country) === 'mexico');
check('Puerto Peñasco has no evidenced cross-border link', penasco && mc.evidencedCrossBorderCountries(penasco).length === 0);
check('Puerto Peñasco does not appear on Saudi Arabia', penasco && !mc.recordOnMarket(penasco, SAUDI));
check('Puerto Peñasco does appear on Mexico', penasco && mc.recordOnMarket(penasco, MEXICO));

const keywordTrap = {
  title: 'Central Fotovoltaica Puerto Peñasco Secuencia III',
  utility: 'CFE',
  country: 'Mexico'
};
check('Title keyword "sec" does not place a Mexico tender on Saudi Arabia', !mc.recordOnMarket(keywordTrap, SAUDI));

const unevidenced = {
  country: 'Mexico',
  cross_border_links: [{ country: 'Saudi Arabia', note: 'mentioned in a headline' }]
};
check('Cross-border country without a source URL does not appear', !mc.recordOnMarket(unevidenced, SAUDI));

const badUrl = {
  country: 'Mexico',
  cross_border_links: [{ country: 'Saudi Arabia', source_url: 'not-a-url' }]
};
check('Cross-border link with a non-http source does not appear', !mc.recordOnMarket(badUrl, SAUDI));

const evidenced = {
  country: 'Germany',
  title: 'Example interconnector',
  cross_border_links: [{ country: 'France', source_url: 'https://example.com/interconnector-evidence' }]
};
check('Tender assigned to Germany stays off France without being the delivery country', !mc.recordOnMarket({ country: 'Germany', title: 'Example' }, FRANCE));
check('Evidenced cross-border link places that tender on France', mc.recordOnMarket(evidenced, FRANCE));
check('Evidenced cross-border link still leaves it on Germany', mc.recordOnMarket(evidenced, GERMANY));

const delivery = { country: 'Germany', delivery_country: 'France', title: 'Plant delivered to France' };
check('Delivery country places the tender on the delivery market', mc.recordOnMarket(delivery, FRANCE));
check('Delivery country keeps the project country market', mc.recordOnMarket(delivery, GERMANY));
check('Delivery country does not leak onto an unrelated market', !mc.recordOnMarket(delivery, SAUDI));

const saudiAlias = tenders.find(function (t) { return t && t.country === 'Saudi' && /Saudi Power Procurement/.test(t.title || ''); });
check('Corpus tender country "Saudi" is the Saudi Arabia assignment', !!saudiAlias);
check('Country variant "Saudi" appears on the Saudi Arabia market', saudiAlias && mc.recordOnMarket(saudiAlias, SAUDI));
check('Country variant "Saudi" does not appear on Mexico', saudiAlias && !mc.recordOnMarket(saudiAlias, MEXICO));

const src = fs.readFileSync(path.join('build-markets.js'), 'utf8');
const markets = [];
const re = /\{ slug: '([^']+)', name: '([^']+)', gridsName: '([^']+)', manufName: '([^']+)'/g;
let match;
while ((match = re.exec(src))) {
  markets.push({ slug: match[1], name: match[2], gridsName: match[3], manufName: match[4] });
}
check('Market identities parsed from build-markets.js', markets.length >= 30, String(markets.length));

let leaks = 0;
markets.forEach(function (market) {
  const marketSet = mc.marketCountries(market);
  tenders.forEach(function (tender) {
    if (!tender) return;
    const on = mc.recordOnMarket(tender, market);
    const assignedHit = mc.assignedCountries(tender).some(function (c) { return marketSet.indexOf(c) >= 0; });
    const crossHit = mc.evidencedCrossBorderCountries(tender).some(function (c) { return marketSet.indexOf(c) >= 0; });
    if (on && !assignedHit && !crossHit) {
      leaks++;
      if (leaks <= 8) console.error('  leak ' + market.slug + ' ← ' + (tender.country || '(blank)') + ' | ' + tender.title);
    }
    if (!on && assignedHit) {
      leaks++;
      if (leaks <= 8) console.error('  missing ' + market.slug + ' ← ' + tender.country + ' | ' + tender.title);
    }
  });
});
check('No tender appears on a market it is not assigned to, unless a sourced cross-border link names it', leaks === 0, String(leaks));

const saudiHtmlPath = path.join('markets', 'saudi-arabia', 'index.html');
const mexicoHtmlPath = path.join('markets', 'mexico', 'index.html');
check('Built Saudi market page exists', fs.existsSync(saudiHtmlPath));
if (fs.existsSync(saudiHtmlPath)) {
  const saudiHtml = fs.readFileSync(saudiHtmlPath, 'utf8');
  check('Built Saudi market page does not list Puerto Peñasco', !/Puerto Peñasco|Puerto Penasco/i.test(saudiHtml));
}
if (fs.existsSync(mexicoHtmlPath)) {
  const mexicoHtml = fs.readFileSync(mexicoHtmlPath, 'utf8');
  check('Built Mexico market page lists Puerto Peñasco', /Puerto Peñasco/.test(mexicoHtml));
}

if (failed) {
  console.error('MARKET COUNTRY REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('MARKET COUNTRY REGRESSION PASSED');
