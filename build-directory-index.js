#!/usr/bin/env node
/* build-directory-index.js — TransformerPath Industry Directory index builder.
 *
 * Joins the two canonical company datasets into ONE structured, capability-aware
 * searchable directory index:
 *   - data/manufacturer-intel.json  (542 transformer manufacturers, with a
 *     company→factory model, evidence fields and research completeness)
 *   - data/accessories.json         (26 component/material suppliers)
 *
 * It does NOT add records. It reuses the canonical company entities, applies the
 * capability taxonomy (data/industry-taxonomy.json) to map recorded product codes
 * -> human capability labels, and derives a per-fact evidence status
 * (CONFIRMED / COMPANY_REPORTED / INFERRED / UNKNOWN). Nothing is assigned that
 * is not recorded in the source datasets; unrecorded subcategories stay UNKNOWN.
 *
 * Output: data/directory-index.json  (used by the directory search / filter /
 * compare / find-suppliers views).
 *
 * Run: node build-directory-index.js   (after build-manufacturer-intel)
 */
'use strict';
const fs = require('fs');
const TAX = JSON.parse(fs.readFileSync('data/industry-taxonomy.json', 'utf8'));
const MFG = JSON.parse(fs.readFileSync('data/manufacturer-intel.json', 'utf8')).companies || [];
const ACC = JSON.parse(fs.readFileSync('data/accessories.json', 'utf8'));
const ACC_SUPPLIERS = ACC.suppliers || [];

const NUM = (s) => { const m = String(s || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : null; };

// SOURCE > CLAIM. A capability fact is CONFIRMED only when a source is actually
// attributed; an in-census figure with no source is INFERRED (never CONFIRMED).
function hasCapSource(c) { return !!(c.sources && c.sources.capability_source); }

function evidence(c) {
  if (c.company_reported) return 'COMPANY_REPORTED';
  if (hasCapSource(c)) return 'CONFIRMED';
  if (c.research_status === 'ACTIVE_CONFIRMED') return 'INFERRED';
  if (c.research_status === 'ACTIVE_LIMITED_DATA' || c.research_status === 'RESEARCH_REQUIRED') return 'INFERRED';
  return 'UNKNOWN';
}

// Source-hierarchy classification (Section 6) from the real source string.
function sourceType(src) {
  const s = String(src || '');
  if (!s) return '';
  const t = s.toLowerCase();
  if (/doe|energy information|government|department|regulatory|official/.test(t)) return 'government_study';
  if (/lme|official price|official/.test(t)) return 'official_market';
  if (/magazine|business insights|fortune|industry publication|press/.test(t)) return 'industry_publication';
  if (/directory|iqs|ensun|yellow/.test(t)) return 'secondary_directory';
  return 'industry_publication';
}

function confidence(claimType, srcType, sourcePresent) {
  if (claimType === 'COMPANY_REPORTED') return 'LIMITED';
  if (!sourcePresent) return 'LIMITED';
  if (srcType === 'government_study' || srcType === 'official_market') return 'HIGH';
  if (srcType === 'industry_publication') return 'MEDIUM';
  return 'LIMITED'; // secondary / directory + discovery only
}

function mapProducts(codes) {
  const types = { power: {}, distribution: {}, dry_type: {}, special: {} };
  const labels = [];
  (codes || []).forEach((code) => {
    const m = TAX.product_code_map[String(code).toUpperCase()];
    if (!m) { labels.push(String(code)); return; }
    m.categories.forEach((cat) => {
      const top = cat.split('.')[0];
      const sub = cat.split('.')[1];
      if (top && types[top]) {
        if (sub) types[top][sub] = true;
        else types[top].__present = true;
      }
    });
    labels.push(m.label);
  });
  return { types, labels };
}

function buildManufacturer(c) {
  const p = mapProducts(c.products);
  const srcTitle = (c.sources && c.sources.capability_source) || '';
  const srcType = sourceType(srcTitle);
  const claimType = c.company_reported ? 'COMPANY_REPORTED' : (hasCapSource(c) ? 'INDEPENDENTLY_SOURCED' : 'INFERRED');
  const factEvidence = (hasVal) => {
    if (!hasVal) return 'UNKNOWN';
    if (c.company_reported) return 'COMPANY_REPORTED';
    return hasCapSource(c) ? 'CONFIRMED' : 'INFERRED';
  };
  return {
    id: 'mfg:' + c.slug,
    kind: 'manufacturer',
    name: c.name,
    slug: c.slug,
    country: c.country,
    region: c.region,
    website: c.website,
    headquarters: c.headquarters || '',
    product_codes: c.products || [],
    capability_labels: p.labels,
    transformer_types: p.types,
    voltage: { value: c.reported_voltage || '', num: NUM(c.reported_voltage), unit: 'kV' },
    mva: { value: c.reported_mva || '', num: NUM(c.reported_mva), unit: 'MVA' },
    certs: c.reported_certs || [],
    testing_capability: c.testing_capability || null,
    factories: (c.factories || []).map((f) => ({
      city: f.city || '', country: f.country || '', produces: f.produces || '',
      claim_type: f.claim_type || '', source_url: f.source_url || '',
    })),
    capability_evidence: {
      products: evidence(c),
      voltage: factEvidence(!!c.reported_voltage),
      mva: factEvidence(!!c.reported_mva),
    },
    evidence: evidence(c),
    claim_type: claimType,
    confidence: confidence(claimType, srcType, hasCapSource(c)),
    source_meta: { source_title: srcTitle, source_type: srcType, source_url: (c.sources && c.sources.website) || '' },
    research_completeness: c.research_completeness || 0,
    research_status: c.research_status || '',
    commercial_status: c.commercial_status || '',
    sources: c.sources || {},
    factory_count: (c.factories || []).length,
  };
}

function buildSupplier(s) {
  const labels = (s.categories || []).slice();
  return {
    id: 'sup:' + (s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    kind: 'component_supplier',
    name: s.name,
    slug: (s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    country: s.country,
    region: s.state || '',
    website: s.website,
    headquarters: (s.city ? s.city + ', ' : '') + s.country,
    product_codes: [],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: '', num: null, unit: 'kV' },
    mva: { value: '', num: null, unit: 'MVA' },
    certs: s.certifications || [],
    testing_capability: null,
    factories: [],
    capability_evidence: { products: (s.verification_status || '').toLowerCase().indexOf('verified') >= 0 ? 'CONFIRMED' : 'INFERRED', voltage: 'UNKNOWN', mva: 'UNKNOWN' },
    evidence: (s.verification_status || '').toLowerCase().indexOf('verified') >= 0 ? 'CONFIRMED' : 'INFERRED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'MEDIUM',
    source_meta: { source_title: 'website-checked', source_type: 'company_documentation', source_url: s.website || '' },
    research_completeness: 0,
    research_status: s.verification_status || '',
    commercial_status: '',
    sources: { website: s.website },
    factory_count: 0,
  };
}

const index = MFG.map(buildManufacturer).concat(ACC_SUPPLIERS.map(buildSupplier));

// Deterministic sort: manufacturers first, then by name.
index.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : (a.kind === 'manufacturer' ? -1 : 1)));

const summary = {
  $schema: 'https://transformerpath.com/directory.schema.json',
  generated: new Date().toISOString(),
  count: index.length,
  counts: {
    manufacturers: MFG.length,
    component_suppliers: ACC_SUPPLIERS.length,
  },
  evidence_notes: 'evidence = CONFIRMED | COMPANY_REPORTED | INFERRED | UNKNOWN. Independent of commercial/paid status. Derived from research_status + company_reported + presence of a capability source.',
  companies: index,
};

fs.writeFileSync('data/directory-index.json', JSON.stringify(summary, null, 2));
console.log('directory-index: ' + index.length + ' companies (' + MFG.length + ' manufacturers, ' + ACC_SUPPLIERS.length + ' component suppliers)');
