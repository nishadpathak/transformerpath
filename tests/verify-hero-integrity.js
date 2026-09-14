#!/usr/bin/env node
/* tests/verify-hero-integrity.js — Canonical stat consistency, freshness & search smoke test.
 *
 * Verifies:
 *   1. Canonical-stat consistency between homepage index.html and raw datasets.
 *   2. Freshness timestamps integrity.
 *   3. Universal search smoke testing against directory index.
 *
 * Run: node tests/verify-hero-integrity.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

let failures = [];
function check(label, pass, detail) {
  if (pass) {
    console.log('  ✓ ' + label);
  } else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failures.push(label + (detail ? ' :: ' + detail : ''));
  }
}

console.log('=== 1. CANONICAL STAT CONSISTENCY ===');
const STATS = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const CFG = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
const HOME = fs.readFileSync('index.html', 'utf8');

function dataStat(html, key) {
  const m = html.match(new RegExp('data-stat="' + key + '">\\s*(\\d+)'));
  return m ? +m[1] : null;
}

const homeMakers = dataStat(HOME, 'manufacturers');
const homeMkgCountries = dataStat(HOME, 'manufacturingCountries');
const homeGrids = dataStat(HOME, 'countries');
const homeProjects = dataStat(HOME, 'projects');
const homeTenders = dataStat(HOME, 'tenders');
const homeOpenTenders = dataStat(HOME, 'openTenders');
const homeAwards = dataStat(HOME, 'awards');
const homeEvents = dataStat(HOME, 'upcomingEvents');

check('Homepage manufacturers matches site-stats', homeMakers === STATS.manufacturers, homeMakers + ' vs ' + STATS.manufacturers);
check('Homepage manufacturers matches config', homeMakers === CFG.counters.manufacturers, homeMakers + ' vs ' + CFG.counters.manufacturers);
check('Homepage manufacturingCountries matches site-stats', homeMkgCountries === STATS.manufacturingCountries, homeMkgCountries + ' vs ' + STATS.manufacturingCountries);
check('Homepage manufacturingCountries matches config', homeMkgCountries === CFG.counters.manufacturingCountries, homeMkgCountries + ' vs ' + CFG.counters.manufacturingCountries);
check('Homepage grids matches site-stats', homeGrids === STATS.countries, homeGrids + ' vs ' + STATS.countries);
check('Homepage projects matches site-stats', homeProjects === STATS.projects, homeProjects + ' vs ' + STATS.projects);
check('Homepage tenders matches site-stats', homeTenders === STATS.tenders, homeTenders + ' vs ' + STATS.tenders);
check('Homepage openTenders matches site-stats', homeOpenTenders === STATS.openTenders, homeOpenTenders + ' vs ' + STATS.openTenders);
check('Homepage awards matches site-stats', homeAwards === STATS.awards, homeAwards + ' vs ' + STATS.awards);
check('Homepage upcomingEvents matches site-stats', homeEvents === STATS.upcomingEvents, homeEvents + ' vs ' + STATS.upcomingEvents);
check('Homepage uses the 3D hero stage', HOME.includes('class="hero-stage"') && HOME.includes('src="hero-3d.html"'));
check('Hero 3D page is present', fs.existsSync('hero-3d.html'));
check('Hero 3D core script is present', fs.existsSync('tp-3d-core.js'));
check('Hero 3D power assembly is present', fs.existsSync('tp-power-assembly.js'));
check('Hero tour video is present', fs.existsSync('media/power-transformer-3d-tour.mp4'));

console.log('\n=== 2. FRESHNESS INTEGRITY ===');
const FRESH = JSON.parse(fs.readFileSync('data/freshness.json', 'utf8'));
const now = Date.now();

check('Freshness generated timestamp is valid ISO', !isNaN(Date.parse(FRESH.generated)), FRESH.generated);
check('Freshness generated timestamp is not in the future', Date.parse(FRESH.generated) <= now + 60000);

const intelSurface = (FRESH.surfaces || []).find(s => s.id === 'daily_intel');
if (intelSurface) {
  check('Daily intel refresh timestamp is valid ISO', !isNaN(Date.parse(intelSurface.last_successful_refresh)), intelSurface.last_successful_refresh);
  check('Daily intel refresh is not newer than now', Date.parse(intelSurface.last_successful_refresh) <= now + 60000);
} else {
  check('Daily intel surface present in freshness.json', false);
}

console.log('\n=== 3. SEARCH SMOKE TESTING ===');
const DIR = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8'));
const dirCompanies = DIR.companies || [];
const ACCS = (() => { try { return JSON.parse(fs.readFileSync('data/accessories.json', 'utf8')).suppliers || []; } catch(e) { return []; } })();

function runSearch(query) {
  const q = String(query).toLowerCase().trim();
  const matchedCompanies = dirCompanies.filter(e => {
    const text = (
      (e.name || '') + ' ' +
      (e.country || '') + ' ' +
      (e.region || '') + ' ' +
      (e.headquarters || '') + ' ' +
      (e.product_codes || []).join(' ') + ' ' +
      (e.capability_labels || []).join(' ') + ' ' +
      (e.voltage && e.voltage.value ? e.voltage.value : '') + ' ' +
      ((e.factories || []).map(f => (f.city || '') + ' ' + (f.country || '')).join(' '))
    ).toLowerCase();
    return text.indexOf(q) >= 0;
  });

  const matchedSuppliers = ACCS.filter(s => {
    const text = (
      (s.name || '') + ' ' +
      (s.category || '') + ' ' +
      (s.country || '') + ' ' +
      (s.summary || '') + ' ' +
      (s.products || []).join(' ')
    ).toLowerCase();
    return text.indexOf(q) >= 0;
  });

  return matchedCompanies.concat(matchedSuppliers);
}

const testQueries = ['765 kV', 'India', 'Transformerboard', 'Saudi Arabia', 'OLTC'];
testQueries.forEach(q => {
  const results = runSearch(q);
  check('Search for "' + q + '" returns matches', results.length > 0, results.length + ' matches found');
});

console.log('\n=== SUMMARY ===');
if (failures.length === 0) {
  console.log('HERO & SEARCH INTEGRITY GATE: PASS (All checks passed)');
  process.exit(0);
} else {
  console.error('HERO & SEARCH INTEGRITY GATE: FAIL (' + failures.length + ' failure(s))');
  failures.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
