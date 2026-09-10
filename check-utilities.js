#!/usr/bin/env node
/* check-utilities.js — TransformerPath Grids/Utilities data-quality audit.
 *
 * PURPOSE (read-only; never writes the data, never infers missing values):
 *   The grid census "sync" (synchronous-area) field is uncontrolled free text.
 *   This audit
 *     1. normalises every per-country sync value against the canonical
 *        synchronous-area registry (data/synchronous-areas.json), classifying
 *        each as a canonical area OR "UNCLASSIFIED (research needed)";
 *     2. scores every utility / grid-operator record against the readiness
 *        fields the site promises (frequency, highest AC voltage, utility role,
 *        synchronous area, interconnections, official website, procurement
 *        link, vendor-registration link, source, last-verified), and flags
 *        weak / stale records — prioritising the commercially important
 *        operators first.
 *   It deliberately DOES NOT derive a public "synchronous areas" count from the
 *   free text. Public counts must come only from the curated registry
 *   (canonical entries), not from counting free-text tokens.
 *
 * Run: node check-utilities.js
 */
'use strict';
const fs = require('fs');

const grids = JSON.parse(fs.readFileSync('data/grids.json', 'utf8'));
const registry = JSON.parse(fs.readFileSync('data/synchronous-areas.json', 'utf8'));
let inter = [];
try { inter = (JSON.parse(fs.readFileSync('data/interconnectors.json', 'utf8'))).projects || []; } catch (e) { inter = []; }

const ci = (s) => String(s == null ? '' : s).toLowerCase();
const norm = (s) => ci(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

// Build a lookup: norm(alias) -> { key, name }
const CANON = {};
registry.canonical.forEach((c) => {
  c.aliases.forEach((a) => { CANON[norm(a)] = { key: c.key, name: c.name, freq: c.freq, canonical: true }; });
});
const ISO = new Set(registry.isolated_aliases.map(norm));
const COUNTRY_ISO = new Set(registry.country_isolated_aliases.map(norm));

// 1. Normalise a free-text sync value.
function classifySync(raw) {
  const r = norm(raw);
  if (!r) return { status: 'UNCLASSIFIED', canonical: null, label: 'not recorded', research: true };
  if (CANON[r]) return { status: 'CANONICAL', canonical: CANON[r].key, label: CANON[r].name, research: false, freq: CANON[r].freq };
  if (ISO.has(r)) return { status: 'ISOLATED', canonical: null, label: 'Isolated grid', research: false };
  if (COUNTRY_ISO.has(r)) return { status: 'COUNTRY_ISOLATED', canonical: null, label: 'Country grid (isolated / HVDC-tied)', research: false };
  return { status: 'UNCLASSIFIED', canonical: null, label: raw, research: true };
}

// 2. Score a utility operator record against the promised readiness fields.
function scoreOperator(op, countryRec) {
  // op = [name, role/desc, topVoltage, website]
  const name = op[0];
  const role = op[1] || '';
  const voltage = op[2] || '';
  const website = op[3] || '';
  const sync = classifySync(countryRec.sync);
  const fields = [
    { k: 'frequency', ok: !!(countryRec.freq), note: countryRec.freq ? countryRec.freq + ' Hz' : 'missing' },
    { k: 'highest_ac_voltage', ok: !!voltage, note: voltage || 'missing' },
    { k: 'utility_role', ok: !!role, note: role ? role.slice(0, 46) + (role.length > 46 ? '…' : '') : 'missing' },
    { k: 'synchronous_area', ok: !sync.research, note: sync.label + (sync.research ? ' (unclassified)' : '') },
    { k: 'interconnections', ok: true, note: inter.filter((p) => ci((p[1] || '') + (p[2] || '')).indexOf(ci(countryRec.country)) >= 0).length + ' link(s)' },
    { k: 'official_website', ok: !!website, note: website || 'missing' },
    { k: 'procurement_tender_link', ok: false, note: 'not recorded (add via research)' },
    { k: 'vendor_registration_link', ok: false, note: 'not recorded (add via research)' },
    { k: 'source', ok: false, note: 'recorded only at census level' },
    { k: 'last_verified', ok: false, note: 'recorded only at census level (generic date)' },
  ];
  const missing = fields.filter((f) => !f.ok);
  return { name, country: countryRec.country, region: countryRec.region, voltage, fields, missing, score: fields.length - missing.length, sync };
}

console.log('SYNCHRONOUS-AREA NORMALISATION');
console.log('Records scanned: ' + grids.length);
const stats = { CANONICAL: 0, ISOLATED: 0, COUNTRY_ISOLATED: 0, UNCLASSIFIED: 0 };
const unclassifiedList = [];
grids.forEach((g) => {
  const c = classifySync(g.sync);
  stats[c.status]++;
  if (c.status === 'UNCLASSIFIED') unclassifiedList.push({ country: g.country, raw: g.sync });
});
console.log('Canonical: ' + stats.CANONICAL + ' | Isolated: ' + stats.ISOLATED + ' | Country-isolated: ' + stats.COUNTRY_ISOLATED + ' | Unclassified (research needed): ' + stats.UNCLASSIFIED);
console.log('Distinct raw sync tokens: ' + (new Set(grids.map((g) => norm(g.sync))).size) + ' -> ' + Object.keys(CANON).length + ' canonical aliases.');
unclassifiedList.sort((a, b) => a.country.localeCompare(b.country)).forEach((u) => console.log('   - ' + u.country + ': "' + u.raw + '"'));

console.log('\nUTILITY RECORD SCORING (weak / stale first)');
console.log('Score = ' + 10 + ' readiness fields present (frequency, AC voltage, role, sync area, interconnections, website, procurement link, vendor link, source, last-verified).');
let ops = [];
grids.forEach((g) => {
  (g.grids || []).forEach((op) => ops.push(scoreOperator(op, g)));
});
ops.sort((a, b) => (a.score - b.score) || a.name.localeCompare(b.name));
const low = ops.filter((o) => o.score < 6);
console.log('Operators: ' + ops.length + ' | weak/stale (score < 6): ' + low.length);
low.forEach((o) => {
  const miss = o.missing.map((f) => f.k).join(',');
  console.log('   [' + o.score + '/10] ' + o.name + ' (' + o.country + ') — missing: ' + miss);
});

// 3. Fleet-level honestly label the public count source.
const canonicalAreas = registry.canonical.map((c) => c.name);
console.log('\nPUBLIC-COUNT SOURCE (for the grids page):');
console.log('Curated synchronous-area registry entries: ' + canonicalAreas.length);
console.log('These, not free-text tokens, are the only valid basis for a "synchronous areas" headline count.');

console.log('\nCHECK-UTILITIES DONE.');
