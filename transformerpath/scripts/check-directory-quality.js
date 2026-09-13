#!/usr/bin/env node
/**
 * GATE: directory depth & evidence integrity (sprint §13, §14, §23, §24).
 *
 * Fails the build if:
 *  1. The completeness scorer is broken (self-test: empty record must be STUB/0;
 *     a fully sourced record must reach STRONG+).
 *  2. Any record is scored above BASIC without at least one SOURCED field
 *     (guards against silently upgrading declared data to "verified/sourced").
 *  3. A facility evidence entry lacks parent_company_id + source + source_tier
 *     (§24: no orphan facilities; an office is not a facility).
 *  4. Critical technical capability (voltage / unit rating) is backed only by a
 *     Tier C source (§13: Tier C must not establish critical capability).
 *  5. Any production-facing transformer-type code is unmapped in the taxonomy (§23).
 */
const fs = require('fs');
const path = require('path');
const { buildIndex } = require('./search-index');
const schema = require('./lib/profile-schema');

const ROOT = path.join(__dirname, '..');
const errors = [];

function loadJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (e) {
    return fallback;
  }
}

// 1) Scorer self-test.
const emptyScore = schema.completeness({ name: '' }, {});
if (emptyScore.score !== 0 || emptyScore.band !== 'STUB') {
  errors.push('scorer self-test: empty record scored ' + emptyScore.score + '/' + emptyScore.band + ' (expected 0/STUB)');
}
const fullRaw = {
  name: 'Test OEM', url: 'https://x.example', country: 'India', parentGroup: 'Group',
  established: '1990', transformerTypes: 'PT,DT', componentCategories: ['bushings'],
  highestSourcedVoltageEvidence: '765 kV', certifications: ['ISO 9001'], utilityApprovals: ['X']
};
const fullEv = {
  name: { source: 'https://x', source_tier: 'A' },
  website: { source: 'https://x', source_tier: 'A' },
  hqCountry: { source: 'https://x', source_tier: 'A' },
  parentGroup: { source: 'https://x', source_tier: 'A' },
  established: { source: 'https://x', source_tier: 'A' },
  transformerTypes: { source: 'https://x', source_tier: 'A' },
  highest_sourced_voltage: { value: '765 kV', source: 'https://x', source_tier: 'A' },
  highest_sourced_unit_rating: { value: '500 MVA', source: 'https://x', source_tier: 'A' },
  standards: { source: 'https://x', source_tier: 'A' },
  markets: { source: 'https://x', source_tier: 'A' },
  test_capability: { source: 'https://x', source_tier: 'A' },
  facilities: [{ facility_id: 'f1', parent_company_id: 'test-oem', name: 'Plant', source: 'https://x', source_tier: 'A' }],
  claim_status: 'VERIFIED', verified_status: true, rfq_eligible: true, supplier_pro: true
};
const fullScore = schema.completeness(fullRaw, fullEv);
if (fullScore.score < 75) {
  errors.push('scorer self-test: fully-sourced record scored ' + fullScore.score + ' (expected STRONG >=75)');
}

// 2/3/4) Evidence overlay integrity.
const overlay = (loadJson('data/profile-evidence.json', {}) || {}).records || {};
const CRITICAL = ['highest_sourced_voltage', 'highest_sourced_unit_rating'];
for (const id of Object.keys(overlay)) {
  const ev = overlay[id];
  for (const f of ev.facilities || []) {
    if (!f.parent_company_id || !f.source || !f.source_tier) {
      errors.push('facility integrity: ' + id + ' facility "' + (f.name || f.facility_id || '?') + '" missing parent_company_id/source/source_tier');
    }
  }
  for (const key of CRITICAL) {
    if (ev[key] && ev[key].source_tier === 'C') {
      errors.push('source integrity: ' + id + '.' + key + ' relies on Tier C (must be Tier A/B for critical capability)');
    }
  }
}

// 2) No silent upgrade: score > BASIC requires sourced evidence.
const index = buildIndex();
for (const rec of index.filter((r) => r.type === 'company')) {
  const id = schema.slugId(rec.displayName || rec.name);
  const ev = overlay[id] || {};
  const c = schema.completeness(rec, ev);
  if (c.score >= 50) {
    const anySourced = Object.values(ev).some((v) => v && v.source && v.source_tier);
    const anyFacility = (ev.facilities || []).length > 0;
    if (!anySourced && !anyFacility) {
      errors.push('silent-upgrade guard: ' + rec.name + ' scored ' + c.score + ' (' + c.band + ') with no sourced evidence');
    }
  }
}

// 5) Taxonomy mapping.
const taxonomy = loadJson('data/taxonomy.json', { legacyTypeMap: {} });
const legacyMap = taxonomy.legacyTypeMap || {};
const unmapped = new Set();
for (const rec of index.filter((r) => r.type === 'company')) {
  String(rec.transformerTypes || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .forEach((code) => {
      if (!legacyMap[code]) unmapped.add(code);
    });
}
if (unmapped.size > 0) {
  errors.push('taxonomy: unmapped production-facing type codes: ' + [...unmapped].join(', '));
}

if (errors.length) {
  console.error('DIRECTORY QUALITY GATE: FAIL');
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log('DIRECTORY QUALITY GATE: OK (scorer sane; evidence overlay + taxonomy consistent; no silent upgrades)');
