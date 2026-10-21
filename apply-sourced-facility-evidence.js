#!/usr/bin/env node
/* apply-sourced-facility-evidence.js
 * Stamp facilities that were fetched from an official or company page.
 * Does not create facility ids. Run after build-canonical-entities.js.
 */
'use strict';
const fs = require('fs');

const { dedupePublicPlants } = require('./lib/public-plant-count');
const evidence = JSON.parse(fs.readFileSync('data/sourced-facility-evidence.json', 'utf8'));
const doc = JSON.parse(fs.readFileSync('data/facilities.json', 'utf8'));
const companies = JSON.parse(fs.readFileSync('data/companies.json', 'utf8')).companies || [];
const companyById = {};
companies.forEach(function (company) {
  companyById[company.id] = {
    name: company.name,
    website: company.website,
    country: company.headquarters && company.headquarters.country
  };
});
const byId = {};
(doc.facilities || []).forEach(function (f) { if (f && f.id) byId[f.id] = f; });

let applied = 0;
const missing = [];
(evidence.plants || []).forEach(function (p) {
  const row = byId[p.facility_id];
  if (!row) { missing.push(p.facility_id); return; }
  row.status = 'SOURCED';
  row.public_count = true;
  row.claim_type = row.claim_type || 'INDEPENDENTLY_SOURCED';
  row.site = p.site;
  row.city = p.city;
  row.country = p.country;
  row.source = 'Official company page fetched ' + p.source_checked_at;
  row.source_type = p.source_type;
  row.source_url = p.source_url;
  row.source_checked_at = p.source_checked_at;
  row.evidence_quote = p.evidence_quote;
  row.last_checked = p.source_checked_at;
  row.confidence = 'LIMITED';
  applied++;
});

if (missing.length) {
  console.error('sourced evidence ids missing from facilities.json: ' + missing.join(', '));
  process.exit(1);
}

const plantCopies = dedupePublicPlants(doc.facilities || [], companyById);
doc.public_count = (doc.facilities || []).filter(function (f) { return f && f.public_count; }).length;
fs.writeFileSync('data/facilities.json', JSON.stringify(doc, null, 2) + '\n');
console.log('apply-sourced-facility-evidence: ' + applied + ' plants, public_count=' + doc.public_count + (plantCopies ? ', sister copies uncounted ' + plantCopies : ''));
