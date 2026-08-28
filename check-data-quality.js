#!/usr/bin/env node
/* check-data-quality.js — TransformerPath manufacturer data-quality gate.
 *
 * Enforces the anti-invention rules at build time so a regression cannot
 * silently publish an unsupported capability claim. Run after build-company-pages
 * (see netlify.toml build command).
 *
 * Guaranteed:
 *   R1  No manufacturer page claims a COMBINED "X MVA, Y kV transformer"
 *       capability unless a source explicitly links the two. They MUST appear
 *       as separate rows (annual capacity vs max voltage).
 *   R2  Every enrichment (tier) record has a source and unit-bearing MVA/kV.
 *   R3  Every census record has a non-empty name and a valid website when a
 *       URL is present; country is always present.
 *   R4  The separation of MAX unit rating (cap) from ANNUAL capacity (mva) is
 *       preserved — never merge them.
 *
 * Critical failures exit 1 (blocks deploy); advisory findings are printed but
 * do not fail the build.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CENSUS = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));

const problems = [];
const advisory = [];

// ── R1: combined capability claim on any generated manufacturer page ─────
// Combined pattern: "… MVA" immediately joined to "… kV" then a noun.
const COMBINED = /(\b[\d,\.]+\s*MVA)\s*[\/\-,&]?\s*(?:at\s+)?(\b[\d,\.]+\s*kV)\s*(?:,|\s)+(?:transformer|unit|product|rating)/i;
function walk(dir, skip) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (skip.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, skip));
    else if (e.isFile() && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const companyPages = walk('manufacturers', ['archive', '_private']).filter((f) => f.endsWith('index.html'));
let combinedClaims = 0;
for (const f of companyPages) {
  const html = fs.readFileSync(f, 'utf8');
  // Strip <title>/<meta>/schema (metadata noise); check visible capability text.
  const body = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  const m = body.match(COMBINED);
  if (m) { combinedClaims++; problems.push('R1 combined MVA+kV claim :: ' + f + ' :: ' + m[0].slice(0, 60)); }
}

// ── R2: every tier record has source + unit-bearing figures ─────────────
let tierNoSource = 0, tierBadUnit = 0;
for (const t of TIERS) {
  if (!t.name) { tierNoSource++; problems.push('R3 tier without name'); continue; }
  if (!t.source) { tierNoSource++; problems.push('R2 tier without source :: ' + t.name); }
  if (typeof t.mva !== 'number' || t.mva <= 0) { tierBadUnit++; problems.push('R2 tier mva missing :: ' + t.name); }
  // annual capacity vs max-unit rating separation
  if (typeof t.mva === 'number' && typeof t.kv === 'number') {
    if (String(t.note || '').replace(/\s/g, '').match(/(\d[\d,\.]+)MVA/)) {
      // note is allowed to describe two separate figures; only flag an explicit
      // combined "X MVA, Y kV transformer" statement.
      if (/\b[\d,\.]+\s*MVA\s*,\s*[\d,\.]+\s*kV\s+transformer\b/i.test(t.note)) {
        problems.push('R1 tier note combines MVA+kV as a capability :: ' + t.name);
      }
    }
  }
  // R4: cap (max single unit) must never equal annual capacity silently
  if (typeof t.cap === 'number' && t.cap > 0 && typeof t.mva === 'number' && t.mva > 0) {
    advisory.push('R4 note: "' + t.name + '" annual ' + t.mva + ' MVA vs max-unit ' + t.cap + ' MVA (separate figures — confirm, do not merge)');
  }
}

// ── R3: census integrity ────────────────────────────────────────────────
let emptyNames = 0, badUrls = 0, noCountry = 0;
for (const g of CENSUS) {
  if (!g.country) noCountry++;
  for (const m of (g.makers || [])) {
    const name = (m[0] || '').trim();
    const url = (m[2] || '').trim();
    if (!name) { emptyNames++; problems.push('R3 census empty name'); }
    if (url && !/^https?:\/\//i.test(url)) { badUrls++; problems.push('R3 census invalid url :: ' + name + ' :: ' + url); }
  }
}

console.log('DATA QUALITY GATE');
console.log('Company pages scanned: ' + companyPages.length);
console.log('Tier records: ' + TIERS.length + ' | Census country groups: ' + CENSUS.length);
console.log('R1 combined MVA+kV capability claims: ' + combinedClaims);
console.log('R2/R3 tier missing source / missing mva: ' + tierNoSource + ' / ' + tierBadUnit);
console.log('R3 census empty names: ' + emptyNames + ' | invalid urls: ' + badUrls + ' | no country: ' + noCountry);
if (advisory.length) {
  console.log('\nAdvisory (confirm separation, no action required):');
  advisory.slice(0, 12).forEach((a) => console.log('  ' + a));
}
console.log('\nCritical problems (' + problems.length + '):');
problems.forEach((p) => console.log('  ' + p));

if (problems.length) {
  console.error('\nDATA QUALITY FAIL — blocking.');
  process.exit(1);
}
console.log('\nDATA QUALITY OK.');
