#!/usr/bin/env node
/* tests/check-p0-integrity.js — 16 Sep 2026 audit P0 gates.
 *
 * 1. Canonical manufacturer count (no 709 / 1002 drift on homepage, pricing, intel, directory)
 * 2. Separate freshness clocks (census vs Daily Intel; no DATA CURRENT on >72h census)
 * 3. Grid Lab page exists
 * 4. Segmented directory search for "765 kV"
 * 5. Pricing: no "11 models"; no Team shared-link-as-product
 * 6. Learner Profile / My TransformerPath hub files exist
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { search } = require('../lib/directory-search');
const clocks = require('../lib/freshness-clocks');

let failures = [];
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failures.push(label + (detail ? ' :: ' + detail : ''));
  }
}

const STATS = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const canonical = STATS.manufacturers;

console.log('=== P0.1 CANONICAL SITE STATS ===');
check('site-stats.manufacturers is a positive integer', typeof canonical === 'number' && canonical > 0, String(canonical));

['index.html', 'pricing.html', 'intel.html', 'directory.html'].forEach((f) => {
  const html = fs.readFileSync(f, 'utf8');
  check(f + ' does not hard-code 709 manufacturers', !/\b709[\s-]*manufacturer/i.test(html) && !/Browse 709/i.test(html) && !/Explore 709/i.test(html));
  check(f + ' does not hard-code 1,002 / 1002 makers', !/1,?002 transformer makers/i.test(html) && !/\b1002\b[^a-z]{0,20}(maker|manufacturer)/i.test(html));
});
check('homepage manufacturers data-stat is live-filled (attribute present)',
  /data-stat="manufacturers"/.test(fs.readFileSync('index.html', 'utf8')));
check('directory manufacturers data-stat is live-filled (attribute present)',
  /data-stat="manufacturers"/.test(fs.readFileSync('directory.html', 'utf8')));
function withoutDataStat(html) {
  return html.replace(/data-stat="[^"]*"\s*>[^<]*/g, 'data-stat');
}
['index.html', 'pricing.html', 'intel.html', 'directory.html'].forEach((f) => {
  const prose = withoutDataStat(fs.readFileSync(f, 'utf8'));
  check(f + ' does not hard-code 911 outside [data-stat]', !/\b911\b/.test(prose.replace(/https?:\/\/\S+/g, '')));
});

console.log('\n=== P0.2 FRESHNESS CLOCKS ===');
const FRESH = JSON.parse(fs.readFileSync('data/freshness.json', 'utf8'));
const census = (FRESH.surfaces || []).find((s) => s.id === 'census');
check('freshness.json has a census surface', !!census);
check('freshness.json has daily_intel surface', !!(FRESH.surfaces || []).find((s) => s.id === 'daily_intel'));
const oldCensus = clocks.censusStatus('2000-01-01', Date.now());
check('census older than 72h is never DATA CURRENT', oldCensus.dataCurrent === false && oldCensus.label !== 'DATA CURRENT', oldCensus.label);
const oldIntel = clocks.intelStatus(new Date(Date.now() - 80 * 3600000).toISOString(), Date.now());
check('intel older than 72h is DATA STALE, not DATA CURRENT', oldIntel.label === 'DATA STALE' && !oldIntel.dataCurrent);
const home = fs.readFileSync('index.html', 'utf8');
check('homepage exposes a census clock element', /data-tp-clock="census"|id="hero-census"/.test(home));
check('homepage exposes an intel clock element', /data-tp-clock="intel"|id="hero-intel"/.test(home));

console.log('\n=== P0.3 GRID LAB ===');
check('grid-lab.html exists', fs.existsSync('grid-lab.html'));
check('data/grid-lab.json exists with scenarios', (function () {
  try {
    const g = JSON.parse(fs.readFileSync('data/grid-lab.json', 'utf8'));
    return Array.isArray(g.scenarios) && g.scenarios.length >= 4;
  } catch (e) { return false; }
})());
const pricing = fs.readFileSync('pricing.html', 'utf8');
check('pricing does not say “11 models”', !/11 models/i.test(pricing));
check('pricing mentions Grid Lab', /Grid Lab/i.test(pricing));
check('grid-lab is a census simulator, not a 3D part model', /simulator/i.test(fs.readFileSync('grid-lab.html', 'utf8')) && /not another 3D|not a new 3D|not a 3D part/i.test(fs.readFileSync('grid-lab.html', 'utf8') + fs.readFileSync('tp-grid-lab.js', 'utf8')));

console.log('\n=== P0.4 SSR / SEGMENTED DIRECTORY SEARCH ===');
const idx = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8')).companies || [];
const r = search(idx, '765 kV', { limit: 20 });
check('search("765 kV") returns matches', r.total > 0, String(r.total));
check('765 kV query parsed a voltage segment', r.segments.voltageKv === 765, JSON.stringify(r.segments));
check('765 kV hits carry voltage match_reasons', r.hits.some((h) => (h.match_reasons || []).some((m) => m.field === 'voltage')));
check('functions/directory-search.js exists', fs.existsSync('functions/directory-search.js'));
const toml = fs.readFileSync('netlify.toml', 'utf8');
check('netlify rewrites /directory?q= to the search function', /directory-search/.test(toml) && /from = "\/directory"/.test(toml));
check('directory.html no longer JS-redirects ?q= to search.html', !/location\.replace\('search\.html\?q=/.test(fs.readFileSync('directory.html', 'utf8')));

console.log('\n=== P0.5–6 IDENTITY + PRICING HONESTY ===');
check('account model module exists', fs.existsSync('functions/lib/account-model.js'));
check('account function exists', fs.existsSync('functions/account.js'));
const model = require('../functions/lib/account-model');
const best = model.bestEntitlement([
  { product: 'learning', plan: 'Learning', status: 'active', access_end: '2099-01-01' },
  { product: 'professional', plan: 'Professional', status: 'active', access_end: '2099-01-01' },
]);
check('bestEntitlement prefers Professional over Learning', best && best.product === 'professional');
check('expired entitlement is not active', !model.isActiveEntitlement({ product: 'professional', status: 'active', expires_at: '2000-01-01' }));
const flags = model.flagsFromRoles(['LEARNER', 'BUYER']);
check('flagsFromRoles exposes isLearner|isBuyer|isSupplier', flags.isLearner && flags.isBuyer && !flags.isSupplier);
check('rolesFromFlags round-trips', model.rolesFromFlags({ isLearner: true, isBuyer: true, isSupplier: false }).indexOf('BUYER') >= 0);
check('pricing does not sell a shared Team access link', !/shared (team )?access link/i.test(pricing) && !/How does the Team link work/i.test(pricing));
check('pricing says Team is account seats', /seat|organisation|organization|account/i.test(pricing));
check('course-gate no longer tells people access lives only in one browser as the product',
  !/no account or password needed/i.test(pricing));

console.log('\n=== LEARNER PROFILE FOUNDATION ===');
check('workspace.html is titled My TransformerPath or Learner hub', /My TransformerPath|Learner Profile/i.test(fs.readFileSync('workspace.html', 'utf8')));
check('tp-learner.js exists', fs.existsSync('tp-learner.js'));
check('skills passport catalog exists', fs.existsSync('data/skills-passport.json'));
check('header Account label is My TransformerPath', /My TransformerPath/.test(fs.readFileSync('_partials/header.html', 'utf8')));
check('onboarding.html exists (3-question Learner Profile)', fs.existsSync('onboarding.html') && /Three questions/i.test(fs.readFileSync('onboarding.html', 'utf8')));
check('certificates.html exists as learning records, not credentials', fs.existsSync('certificates.html') && /not an accredited/i.test(fs.readFileSync('certificates.html', 'utf8')));
check('netlify maps /me /sign-in /onboarding /certificates', /from = "\/me"/.test(toml) && /from = "\/sign-in"/.test(toml) && /from = "\/onboarding"/.test(toml) && /from = "\/certificates"/.test(toml));

console.log('\n=== SUMMARY ===');
if (failures.length) {
  console.error('P0 INTEGRITY GATE: FAIL (' + failures.length + ')');
  failures.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('P0 INTEGRITY GATE: PASS');
process.exit(0);
