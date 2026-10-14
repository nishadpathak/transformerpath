#!/usr/bin/env node
/* tests/market-country-regression.js
 * Puerto Peñasco (Mexico) must not appear on /markets/saudi-arabia.
 * Every market listing's project_country equals that market.
 * Keyword 'sec' is word-bounded, so it does not match "Secuencia".
 */
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

function wordBounded(text, kw) {
  const k = String(kw).toLowerCase().trim();
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp('(?:^|[^a-z0-9])' + esc + '(?:[^a-z0-9]|$)', 'i').test(String(text).toLowerCase());
}

const EQUIV = {
  'saudi arabia': ['saudi arabia'],
  'mexico': ['mexico'],
  'united arab emirates': ['united arab emirates', 'uae'],
  'uae': ['united arab emirates', 'uae'],
  'usa': ['usa', 'united states', 'u.s.'],
  'united states': ['usa', 'united states'],
  'türkiye': ['türkiye', 'turkey', 'turkiye'],
  'turkey': ['türkiye', 'turkey', 'turkiye']
};

function same(value, marketCountry) {
  const v = String(value || '').toLowerCase();
  const m = String(marketCountry || '').toLowerCase();
  if (!v || !m) return false;
  if (v === m) return true;
  const ev = EQUIV[v] || [];
  const em = EQUIV[m] || [];
  return ev.indexOf(m) >= 0 || em.indexOf(v) >= 0;
}

console.log('=== MARKET COUNTRY REGRESSION ===');
check('word-bounded sec does not match Secuencia', wordBounded('Central Fotovoltaica Puerto Peñasco Secuencia III', 'sec') === false);
check('word-bounded sec matches a standalone SEC', wordBounded('SEC tender for 380 kV transformers', 'sec') === true);

const marketsDir = 'markets';
const slugs = fs.readdirSync(marketsDir).filter(function (d) {
  return fs.existsSync(path.join(marketsDir, d, 'index.html'));
});
check('market pages exist', slugs.length > 0, String(slugs.length));

slugs.forEach(function (slug) {
  const html = fs.readFileSync(path.join(marketsDir, slug, 'index.html'), 'utf8');
  const market = (html.match(/data-market-country="([^"]*)"/) || [])[1] || '';
  const listings = [];
  const re = /data-listing="(tender|award|project)" data-project-country="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) listings.push({ kind: m[1], country: m[2] });
  listings.forEach(function (row) {
    check(slug + ' ' + row.kind + ' project_country equals market', same(row.country, market), row.country + ' vs ' + market);
  });
});

const saudi = fs.readFileSync('markets/saudi-arabia/index.html', 'utf8');
check('Puerto Peñasco absent from Saudi Arabia', !/Puerto Peñasco|Penasco|Secuencia III/i.test(saudi));
const mexicoPath = 'markets/mexico/index.html';
if (fs.existsSync(mexicoPath)) {
  const mexico = fs.readFileSync(mexicoPath, 'utf8');
  check('Puerto Peñasco present on Mexico', /Puerto Peñasco|Penasco/i.test(mexico));
}

if (failed) {
  console.error('MARKET COUNTRY REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('MARKET COUNTRY REGRESSION OK');
