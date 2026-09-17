#!/usr/bin/env node
/* check-directory.js — TransformerPath Directory entity-resolution + data-quality
 * audit. Read-only. Does not modify any data; reports findings so the directory
 * stays SOUND before volume grows. It measures the DATABASE, not the companies.
 *
 * Run: node check-directory.js
 */
'use strict';
const fs = require('fs');
const MFG = JSON.parse(fs.readFileSync('data/manufacturer-intel.json', 'utf8')).companies || [];
const ACC = (JSON.parse(fs.readFileSync('data/accessories.json', 'utf8'))).suppliers || [];
const TAX = JSON.parse(fs.readFileSync('data/industry-taxonomy.json', 'utf8'));

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const NORMURL = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').trim();

let issues = [];
function add(sev, msg) { issues.push({ sev, msg }); }

// ── 1. Entity relationship review states ────────────────────────────────────
// Classify name/website relationships rather than merging. REVIEW_STATES mirror
// the directory's entity-resolution model: we never auto-merge.
const REVIEW_STATES = { CONFIRMED_DUPLICATE: 0, POSSIBLE_DUPLICATE: 0, PARENT_SUBSIDIARY: 0, BRAND_RELATIONSHIP: 0, SEPARATE_ENTITIES: 0, RESEARCH_REQUIRED: 0 };
const relationship = [];
const byCountry = {};
MFG.forEach((c) => { (byCountry[c.country] = byCountry[c.country] || []).push(c); });
Object.keys(byCountry).forEach((cty) => {
  const list = byCountry[cty];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = norm(list[i].name), b = norm(list[j].name);
      const siteA = NORMURL(list[i].website), siteB = NORMURL(list[j].website);
      if (!a || !b) continue;
      if (a === b && siteA && siteA === siteB) { REVIEW_STATES.CONFIRMED_DUPLICATE++; relationship.push({ state: 'CONFIRMED_DUPLICATE', a: list[i].name, b: list[j].name }); continue; }
      if (a.length > 6 && b.length > 6 && (a.includes(b) || b.includes(a))) {
        if (siteA && siteA === siteB) { REVIEW_STATES.BRAND_RELATIONSHIP++; relationship.push({ state: 'BRAND_RELATIONSHIP', a: list[i].name, b: list[j].name, site: siteA }); }
        else { REVIEW_STATES.POSSIBLE_DUPLICATE++; relationship.push({ state: 'POSSIBLE_DUPLICATE', a: list[i].name, b: list[j].name }); }
      } else { REVIEW_STATES.SEPARATE_ENTITIES++; }
    }
  }
});

// ── 2. Same corporate website across multiple entities (parent/subsidiary) ──
const bySite = {};
MFG.concat(ACC).filter((c) => c.website).forEach((c) => {
  (bySite[NORMURL(c.website)] = bySite[NORMURL(c.website)] || []).push(c.name);
});
Object.keys(bySite).forEach((site) => {
  const names = bySite[site];
  if (names.length > 1) { REVIEW_STATES.PARENT_SUBSIDIARY++; relationship.push({ state: 'PARENT_SUBSIDIARY', site: site, names: names.slice(0, 8).join(' | ') }); }
});

// ── 3. Sales office / site listed as a factory without capability evidence ──
let factoryNoEv = 0, factoryEv = 0;
MFG.forEach((c) => {
  (c.factories || []).forEach((f) => {
    if ((f.produces || '').trim()) factoryEv++;
    else factoryNoEv++;
  });
});
add('INFO', 'Factories with a recorded "produces" capability: ' + factoryEv + '; without: ' + factoryNoEv);

// ── 4. Incorrect / suspicious country vs factory country mismatch ──────────
let mismatch = 0;
MFG.forEach((c) => {
  (c.factories || []).forEach((f) => {
    if (f.country && c.country && norm(f.country).indexOf(norm(c.country)) < 0 && norm(c.country).indexOf(norm(f.country)) < 0) {
      if (norm(f.country) === 'united states' || norm(f.country) === 'usa') { /* common short-form */ }
      else mismatch++;
    }
  });
});
add('INFO', 'Factory-country != HQ-country mismatches: ' + mismatch + ' (verify: could be correct multinational, or wrong country)');

// ── 5. Unsupported / weak capability evidence (voltage or MVA with CONFIRMED
//       but a placeholder-ish source, or absent source) ──────────────────────
let weakSource = 0;
MFG.forEach((c) => {
  const src = (c.sources && c.sources.capability_source || '').trim();
  if ((c.reported_voltage || c.reported_mva) && (!src || /placeholder|tbd|n\/a|unknown|^$/.test(norm(src)))) weakSource++;
});
add('INFO', 'Companies with a voltage/MVA figure but no attributable capability source: ' + weakSource);

// ── 6. Unsupported product subcategory (should never happen if mapped cleanly)
let unmapped = 0;
MFG.forEach((c) => {
  (c.products || []).forEach((code) => { if (!TAX.product_code_map[String(code).toUpperCase()]) unmapped++; });
});
add(unmapped > 0 ? 'MED' : 'OK', 'Product codes not mapped by the taxonomy: ' + unmapped);

// ── 7. research_status with commercial status (payment must never = relevance)
let paidRelevance = MFG.filter((c) => c.commercial_status && /paid|verified|pro/.test(String(c.commercial_status).toLowerCase()));
add('OK', 'companies carrying a commercial_status label: ' + paidRelevance.length + ' (kept separate from technical capability evidence)');

// ── 8. Duplicate factories within a company ────────────────────────────────
let dupFactory = 0;
MFG.forEach((c) => {
  const seen = {};
  (c.factories || []).forEach((f) => {
    const k = norm((f.city || '') + ' ' + (f.country || ''));
    if (k && seen[k]) dupFactory++;
    seen[k] = 1;
  });
});
add('INFO', 'duplicate factory rows within a company (same city+country twice): ' + dupFactory);

// ── Report ─────────────────────────────────────────────────────────────────
console.log('DIRECTORY DATA-QUALITY AUDIT');
console.log('Companies scanned: ' + MFG.length + ' manufacturers + ' + ACC.length + ' component suppliers');
console.log('\nENTITY REVIEW STATES (never auto-merged):');
Object.keys(REVIEW_STATES).forEach((k) => { if (REVIEW_STATES[k]) console.log('  ' + k + ': ' + REVIEW_STATES[k]); });
relationship.forEach((r) => {
  console.log('   [' + r.state + '] ' + (r.names ? r.site + ' ← ' + r.names : r.a + ' ~ ' + r.b));
});
console.log('\nISSUES:');
const order = { HIGH: 0, MED: 1, INFO: 2, OK: 3 };
issues.sort((a, b) => (order[a.sev] - order[b.sev]));
issues.forEach((i) => { console.log('[' + i.sev + '] ' + i.msg); });
console.log('\nTotal findings: ' + issues.length + (issues.filter((i) => i.sev === 'HIGH').length ? ' (HIGH: ' + issues.filter((i) => i.sev === 'HIGH').length + ')' : ''));
console.log('CHECK-DIRECTORY DONE.');
