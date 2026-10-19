#!/usr/bin/env node
/* Virginia Transformer specs must match the company About Us page
 * fetched 2026-10-15, and that URL has to stay on the record.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const URL = 'https://www.vatransformer.com/about-us/';
const tiers = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));
const tier = tiers.find((t) => t && t.name === 'Virginia Transformer Corp');
const prov = JSON.parse(fs.readFileSync('data/manufacturer-provenance.json', 'utf8'))
  .find((p) => p && p.name === 'Virginia Transformer Corp');
const html = fs.readFileSync('manufacturers/virginia-transformer-corp/index.html', 'utf8');
const kvFact = (prov && prov.facts || []).find((f) => f.field === 'voltage_class_evidence');
const mvaFact = (prov && prov.facts || []).find((f) => f.field === 'annual_capacity_mva');

console.log('=== VIRGINIA TRANSFORMER SPECS ===');
check('tier voltage is 525 kV', !!tier && tier.kv === 525, tier && tier.kv);
check('tier annual capacity is 67,000 MVA', !!tier && tier.mva === 67000, tier && tier.mva);
check('tier records the About Us URL', !!tier && tier.source_url === URL, tier && tier.source_url);
check('provenance voltage fact is 525 kV from that URL', !!kvFact && kvFact.value === 525 && kvFact.source_url === URL);
check('provenance annual capacity is 67,000 MVA from that URL', !!mvaFact && mvaFact.value === 67000 && mvaFact.source_url === URL);
check('provenance claim type is company-reported', kvFact && kvFact.claim_type === 'COMPANY_REPORTED' && mvaFact && mvaFact.claim_type === 'COMPANY_REPORTED');
check('provenance notes do not combine MVA and kV as one transformer capability', [kvFact, mvaFact].every(function (f) {
  return f && !/\b[\d,.]+\s*MVA\b[^\n]*\b[\d,.]+\s*kV\b[^\n]*transformer/i.test(f.note || '');
}));
check('profile summary shows 525 kV', /Highest sourced voltage evidence<\/th><td>525 kV<\/td>/.test(html));
check('profile summary shows 67,000 MVA/year', /~67,000 MVA/.test(html) && /67,000 MVA\/year/.test(html));
check('profile links the About Us URL', html.indexOf(URL) >= 0);
check('profile no longer states 230 kV or 30,000 MVA', html.indexOf('230 kV') < 0 && html.indexOf('30,000') < 0);

if (failed) {
  console.error('VIRGINIA TRANSFORMER SPECS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('VIRGINIA TRANSFORMER SPECS PASS');
