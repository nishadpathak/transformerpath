#!/usr/bin/env node
/* merge-projects.js — merge source-backed global projects into data/projects.json.
 *
 * Reads an incoming array of project records (from region research) and merges
 * them into the existing projects.json project list. Rules:
 *   - Deduplicate by canonical project name (case/space-insensitive). A project
 *     already present is updated (fields merged, never a duplicate inserted).
 *   - Every new record must be source-backed (sources array). A record with no
 *     source is rejected (no fabricated data).
 *   - transformer_requirement must be CONFIRMED / INFERRED / UNKNOWN; a company
 *     manufacturer / award is only kept when the record explicitly gave one.
 *   - region is derived from country (region_map); last_verified is set to the
 *     run date.
 *
 * Usage: node merge-projects.js < incoming-projects.json > out.log
 *   (reads one JSON array from stdin; writes data/projects.json)
 */
'use strict';
const fs = require('fs');
const D = JSON.parse(fs.readFileSync('data/projects.json', 'utf8'));
const REGION = {};
Object.keys(D.region_map || {}).forEach(function (r) { (D.region_map[r] || []).forEach(function (c) { REGION[c.toLowerCase()] = r; }); });
function regionOf(c) {
  const exact = REGION[String(c || '').toLowerCase()];
  if (exact) return exact;
  return /(UAE|Saudi|Oman|Qatar|Kuwait|Bahrain|Dubai|Abu Dhabi|Middle East)/i.test(c) ? 'Middle East'
    : /(India|China|Korea|Japan|Indonesia|Vietnam|Malaysia|Philippines|Thailand|Pakistan|Bangladesh|Asia)/i.test(c) ? 'Asia'
    : /(Germany|UK|France|Italy|Spain|Netherlands|Norway|Sweden|Poland|Austria|Belgium|Denmark|Europe)/i.test(c) ? 'Europe'
    : /(USA|United States|Canada|Mexico|North America)/i.test(c) ? 'North America'
    : /(Brazil|Chile|Argentina|Colombia|Peru|Latin America)/i.test(c) ? 'Latin America'
    : /(South Africa|Egypt|Morocco|Kenya|Nigeria|Africa|Algeria|Angola|Senegal|Tanzania|Zambia)/i.test(c) ? 'Africa'
    : /(Australia|New Zealand|Oceania)/i.test(c) ? 'Oceania' : 'Other';
}
const canon = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const date = new Date().toISOString().slice(0, 10);

let incoming = [];
try { const raw = fs.readFileSync(0, 'utf8'); incoming = JSON.parse(raw); } catch (e) { console.error('read incoming failed: ' + e.message); process.exit(1); }
if (!Array.isArray(incoming)) { console.error('incoming must be a JSON array'); process.exit(1); }

const byName = {};
D.projects.forEach(function (p) { byName[canon(p.project)] = p; });

let added = 0, updated = 0, rejected = 0, dups = 0;
incoming.forEach(function (p) {
  if (!p.project || !p.sources || !p.sources.length) { rejected++; console.log('REJECTED (no name/source): ' + (p.project || '?')); return; }
  const req = (p.transformer_requirement || 'UNKNOWN').toUpperCase();
  if (!/^(CONFIRMED|INFERRED|UNKNOWN)$/.test(req)) { rejected++; console.log('REJECTED (bad scope): ' + p.project); return; }
  if (!p.country) { rejected++; console.log('REJECTED (no country): ' + p.project); return; }
  const key = canon(p.project);
  const rec = {
    project: p.project, country: p.country,
    region: regionOf(p.country),
    utility: p.utility || null, epc: p.epc || null,
    transformer_requirement: req, voltage: p.voltage || null,
    status: p.status || null, manufacturer: p.manufacturer || null,
    expected: p.expected || null, sources: p.sources, src_label: p.src_label || '',
    related_market: p.related_market || p.country, related_intel: p.related_intel || '',
    last_verified: date,
  };
  if (byName[key]) { // dedup: update existing, don't duplicate
    const ex = byName[key];
    Object.keys(rec).forEach(function (k) { if (rec[k] !== null && rec[k] !== '') ex[k] = rec[k]; });
    updated++; console.log('UPDATED: ' + p.project);
  } else {
    D.projects.push(rec); byName[key] = rec; added++; console.log('ADDED: ' + p.project);
  }
});
fs.writeFileSync('data/projects.json', JSON.stringify(D, null, 2) + '\n');
console.log('\nmerge done: ' + added + ' added, ' + updated + ' updated, ' + rejected + ' rejected (no/hold), total projects: ' + D.projects.length);
