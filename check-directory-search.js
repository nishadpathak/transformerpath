#!/usr/bin/env node
/* check-directory-search.js — Directory search-quality test (Section 34).
 * Runs realistic transformer-sourcing queries against data/directory-index.json
 * and reports, per query: number of matches, whether it hit structured
 * capability data, the evidence of the top matches, and whether the current
 * data can honestly answer the query. It is a diagnostic, not a gate: empty /
 * weak results are a DATA limitation, reported honestly — never padded.
 *
 * Run: node check-directory-search.js
 */
'use strict';
const fs = require('fs');
const IDX = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8')).companies || [];

function searchText(c) {
  const types = [];
  ['power', 'distribution', 'dry_type', 'special'].forEach((t) => {
    Object.keys((c.transformer_types && c.transformer_types[t]) || {}).forEach((k) => { if (k !== '__present') types.push(k.replace(/_/g, ' ')); });
  });
  const fac = (c.factories || []).map((f) => (f.city + ' ' + f.country)).join(' ');
  return [c.name, c.country, c.region, c.headquarters,
    (c.product_codes || []).join(' '), (c.capability_labels || []).join(' '),
    types.join(' '), c.voltage && c.voltage.value, c.mva && c.mva.value,
    (c.certs || []).join(' '), fac].join(' ').toLowerCase();
}

const STOPWORDS = new Set(['manufacturer', 'manufacturers', 'supplier', 'suppliers', 'company', 'companies', 'transformer', 'transformers', 'factory', 'factories', 'for', 'the', 'a', 'an', 'and', 'make', 'makers', 'of', 'in', 'with', 'need']);

function search(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).filter((w) => !STOPWORDS.has(w));
  if (!words.length) return [];
  return IDX.filter((c) => words.every((w) => searchText(c).indexOf(w) >= 0));
}

const QUERIES = [
  // transformer-manufacturer queries (should have data)
  '100 MVA 220 kV transformer',
  '400 kV transformer Europe',
  '765 kV transformer factory',
  '400 kV transformer Middle East',
  'GSU manufacturer',
  'cast resin transformer UAE',
  '200 kV', 'autotransformer', 'traction transformer', 'reactor', 'earthing transformer',
  // component / material / equipment / lab queries (currently thin/empty)
  'RIP bushing 245 kV', 'OLTC vacuum', 'transformer pressboard India', 'CRGO Japan',
  'CTC supplier Europe', 'vertical winding machine', 'transformer impulse test laboratory',
  'bushing manufacturer', 'OLTC manufacturer', 'transformer oil supplier',
];

function evidenceBadge(e) { return ({ CONFIRMED: 'Confirmed', COMPANY_REPORTED: 'Company-reported', INFERRED: 'Inferred', UNKNOWN: 'Unknown' })[e] || e; }

console.log('DIRECTORY SEARCH-QUALITY TEST (' + IDX.length + ' companies indexed)\n');
QUERIES.forEach((q) => {
  const hits = search(q);
  const mfg = hits.filter((c) => c.kind === 'manufacturer');
  const sup = hits.filter((c) => c.kind === 'component_supplier');
  console.log('QUERY: "' + q + '"');
  if (!hits.length) { console.log('  0 matches — no record supports this query. UNKNOWN > GUESS: this is an honest data gap (research needed), not a ranking failure.'); }
  else {
    console.log('  matches: ' + hits.length + ' (manufacturers ' + mfg.length + ', component/material ' + sup.length + ')');
    hits.slice(0, 5).forEach((c) => {
      console.log('    - ' + c.name + ' [' + c.country + '] ' + (c.voltage && c.voltage.value || '') + ' ' + (c.mva && c.mva.value || '') + ' | evidence ' + evidenceBadge(c.evidence));
    });
    if (mfg.length > 1) {
      const dup = {};
      hits.forEach((c) => { const k = searchText(c).replace(/\d/g, ''); dup[k] = (dup[k] || 0) + 1; });
      const dupCount = Object.entries(dup).filter(([k, v]) => v > 1 && k.split(/\s+/).length > 4).length;
      if (dupCount) console.log('  ⚠ possible duplicate/same-capability rows in results: ' + dupCount + ' group(s)');
    }
  }
  console.log('');
});

// Honest coverage notes
const noCapSrc = IDX.filter((c) => c.kind === 'manufacturer' && c.evidence === 'INFERRED').length;
console.log('COVERAGE NOTES');
console.log('  manufacturers with an attributed capability source (CONFIRMED): ' + IDX.filter((c) => c.kind === 'manufacturer' && c.evidence === 'CONFIRMED').length);
console.log('  manufacturers whose capability is inferred (in-census, source not attributed): ' + noCapSrc);
const byKind = {}; IDX.forEach((c) => { byKind[c.kind] = (byKind[c.kind] || 0) + 1; });
console.log('  records by kind: ' + JSON.stringify(byKind));
console.log('  component/material suppliers: ' + byKind.component_supplier + ' — sparse; bushing/OLTC/pressboard/CRGO/CTC/equipment/lab company records are largely NOT yet in the directory.');
console.log('CHECK-DIRECTORY-SEARCH DONE.');
