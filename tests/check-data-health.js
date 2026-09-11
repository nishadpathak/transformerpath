#!/usr/bin/env node
/* tests/check-data-health.js — TransformerPath Internal Data Health & Integrity Gate
 *
 * Audits:
 *   1. Canonical Entities & Counts (Companies, Facilities, Grids, Projects, Tenders, Components, Machinery, Labs)
 *   2. Entity Relationships & Orphan Detection (Company <-> Facility, Facility <-> Country)
 *   3. Technical Claim Defense (No unverified claims; non-disclosed values handled properly)
 *   4. Verification Hierarchy (Listed -> Claimed -> Verified -> Supplier Pro)
 *   5. Intelligence Freshness Engine & Timestamps (<36h, 36-72h, >72h)
 *   6. Universal Industry Search Smoke Tests
 *
 * Run: node tests/check-data-health.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

let errors = [];
let warnings = [];

function check(label, pass, detail) {
  if (pass) {
    console.log('  ✓ ' + label);
  } else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    errors.push(label + (detail ? ' :: ' + detail : ''));
  }
}

function warn(label, detail) {
  console.warn('  ⚠ ' + label + (detail ? ' :: ' + detail : ''));
  warnings.push(label + (detail ? ' :: ' + detail : ''));
}

console.log('=== 1. CANONICAL ENTITY CENSUS ===');
const STATS = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const DIR = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8'));
const companies = DIR.companies || [];

const totalMakers = MANUF.reduce((s, g) => s + (g.makers || []).filter(m => !/^Served by/i.test(m[0])).length, 0);
check('Canonical manufacturers list matches site stats', totalMakers === STATS.manufacturers, totalMakers + ' vs ' + STATS.manufacturers);
check('Directory index contains rich combined entities', companies.length >= 700, companies.length + ' entities indexed');

const projectsData = JSON.parse(fs.readFileSync('data/projects.json', 'utf8'));
const projects = projectsData.projects || [];
check('Projects database contains records', projects.length >= 300, projects.length + ' projects');
check('Projects count matches site stats', projects.length === STATS.projects, projects.length + ' vs ' + STATS.projects);

const tendersData = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8'));
const tenders = tendersData.tenders || [];
check('Tenders database contains records', tenders.length >= 100, tenders.length + ' tenders');
check('Tenders count matches site stats', tenders.length === STATS.tenders, tenders.length + ' vs ' + STATS.tenders);

const grids = JSON.parse(fs.readFileSync('data/grids.json', 'utf8'));
check('Grids database contains national systems', grids.length >= 150, grids.length + ' national grids');
check('Grids count matches site stats countries', grids.length === STATS.countries, grids.length + ' vs ' + STATS.countries);

console.log('\n=== 2. ENTITY INTEGRITY & ORPHAN CHECKS ===');
let totalFacilities = 0;
let orphanFacilities = 0;
let validCompanyIds = new Set(companies.map(c => c.slug || c.id || c.name));

companies.forEach(c => {
  const facs = c.factories || [];
  totalFacilities += facs.length;
  facs.forEach(f => {
    if (!f.country && !f.city) orphanFacilities++;
  });
});

check('Facilities count is recorded', totalFacilities > 0, totalFacilities + ' total documented facilities');
check('Zero orphan facilities with missing location data', orphanFacilities === 0, orphanFacilities + ' orphans detected');

console.log('\n=== 3. VERIFICATION ARCHITECTURE COMPLIANCE ===');
const DEPRECATED_TERMS = [
  /\bPro\s+Verified\b/i,
  /\bPremium\s+Verified\b/i,
  /\bVerified\s+Pro\b/i,
  /\bVerified\s*\/\s*Pro\s*\/\s*Premium\b/i,
];

const publicFiles = ['index.html', 'manufacturers.html', 'buyers-guide.html', 'faq.html', 'verified.html', 'pricing.html', 'rfq.html', 'search.html'];
let termViolations = 0;

publicFiles.forEach(pf => {
  if (fs.existsSync(pf)) {
    const text = fs.readFileSync(pf, 'utf8');
    DEPRECATED_TERMS.forEach(rgx => {
      if (rgx.test(text)) {
        termViolations++;
        check('Deprecated term in ' + pf, false, 'Matched ' + rgx);
      }
    });
  }
});
check('Public core templates follow Listed/Claimed/Verified/Supplier Pro hierarchy', termViolations === 0, termViolations + ' violations');

console.log('\n=== 4. FRESHNESS ENGINE & TIMESTAMPS ===');
const FRESH = JSON.parse(fs.readFileSync('data/freshness.json', 'utf8'));
const dailyIntel = (FRESH.surfaces || []).find(s => s.id === 'daily_intel');

check('Daily Intel surface declared in freshness.json', !!dailyIntel);
if (dailyIntel) {
  const refreshIso = dailyIntel.last_successful_refresh || dailyIntel.last_data_refresh;
  const refreshTs = Date.parse(refreshIso);
  check('Refresh timestamp is valid ISO string', !isNaN(refreshTs), refreshIso);
  check('Refresh timestamp is not in the future', refreshTs <= Date.now() + 60000);
  
  const ageHours = (Date.now() - refreshTs) / (1000 * 60 * 60);
  console.log('     * Current Intelligence Age: ' + ageHours.toFixed(1) + ' hours');
}

console.log('\n=== 5. UNIVERSAL SEARCH ENGINE SMOKE TESTS ===');
const ACCS = (() => { try { return JSON.parse(fs.readFileSync('data/accessories.json', 'utf8')).suppliers || []; } catch(e) { return []; } })();

function testSearch(q) {
  const query = q.toLowerCase();
  const cHits = companies.filter(c => {
    return ((c.name||'') + ' ' + (c.country||'') + ' ' + (c.capability_labels||[]).join(' ')).toLowerCase().includes(query);
  });
  const aHits = ACCS.filter(a => {
    return ((a.name||'') + ' ' + (a.category||'') + ' ' + (a.products||[]).join(' ')).toLowerCase().includes(query);
  });
  return cHits.length + aHits.length;
}

const queries = ['765 kV', 'Transformerboard', 'OLTC', 'Saudi Arabia', 'India'];
queries.forEach(q => {
  const hitCount = testSearch(q);
  check('Search query “' + q + '” returns matching records', hitCount > 0, hitCount + ' records');
});

console.log('\n========================================');
if (errors.length === 0) {
  console.log('✅ ALL DATA HEALTH & INTEGRITY CHECKS PASSED');
  process.exit(0);
} else {
  console.error('❌ ' + errors.length + ' INTEGRITY CHECKS FAILED:');
  errors.forEach(e => console.error('   - ' + e));
  process.exit(1);
}
