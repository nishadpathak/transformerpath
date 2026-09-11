#!/usr/bin/env node
/* build-canonical-entities.js — Canonical Company & Facility Builder.
 *
 * Implements P0.1 (One Canonical Company Database) & P0.2 (Company ≠ Factory).
 *
 * Consolidates the disparate directory records across:
 *   - data/manufacturers.json (census)
 *   - data/manufacturer-intel.json (company intelligence, completeness, sources)
 *   - data/manufacturer-sites.json (brand-level facility inventory)
 *   - data/accessories.json (component & material suppliers)
 *   - data/machinery.json (machinery manufacturers)
 *   - data/laboratories.json (testing laboratories)
 *   - data/services.json (transformer service & repair specialists)
 *   - data/logistics.json (heavy haulage & transport)
 *   - data/buyers.json (utilities & procurement buyers)
 *
 * Outputs:
 *   - data/companies.json  (canonical company entities w/ multi-role assignment)
 *   - data/facilities.json (decoupled factory entities; NO auto-inheritance across sites)
 *
 * Run: node build-canonical-entities.js
 */
'use strict';
const fs = require('fs');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function normDom(u) {
  return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '')
    .split('/')[0].toLowerCase().trim();
}

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function cleanBrandName(name) {
  let s = String(name || '').trim();
  s = s.replace(/\s*\((global HQ|GE Vernova|Schneider|Grid Solutions|HVDC|T&D India|Changzhou|Wuhan|Transformers|Kingdom of Saudi Arabia)\)/gi, '');
  s = s.replace(/\s+(USA|Canada|Brasil|Brazil|Colombia|Italy|Spain|Finland|Türkiye|Turkey|India|Malaysia|Vietnam|Japan|Thailand|China|SAE|Transformers SAE)$/i, '');
  return s.trim();
}

// ── Load Input Datasets ──────────────────────────────────────────────────────
const CENSUS = readJson('data/manufacturers.json', []);
const INTEL = readJson('data/manufacturer-intel.json', {}).companies || [];
const SITES = readJson('data/manufacturer-sites.json', []);
const ACC = readJson('data/accessories.json', {}).suppliers || [];
const MACH = readJson('data/machinery.json', {}).machinery || [];
const LABS = readJson('data/laboratories.json', {}).laboratories || [];
const SRV = readJson('data/services.json', {}).services || [];
const LOG = readJson('data/logistics.json', {}).companies || [];
const BYR = readJson('data/buyers.json', {}).buyers || [];
const SLUGS = readJson('data/company-slugs.json', []);
const DEEP = readJson('data/deep-research.json', {}).companies || [];
const TIERS = readJson('data/manufacturer-tiers.json', []);

// Product code to controlled taxonomy ID map
const CODE_MAP = {
  'PT': 'TR_POWER',
  'POWER': 'TR_POWER',
  'DT': 'TR_DISTRIBUTION',
  'DISTRIBUTION': 'TR_DISTRIBUTION',
  'DRY': 'TR_DRY_CAST',
  'DRY_TYPE': 'TR_DRY_CAST',
  'CAST_RESIN': 'TR_DRY_CAST',
  'VPI': 'TR_DRY_VPI',
  'GSU': 'TR_GSU',
  'AUTOTRANSFORMER': 'TR_AUTO',
  'FURNACE': 'TR_FURNACE',
  'RECTIFIER': 'TR_RECTIFIER',
  'TRACTION': 'TR_TRACTION',
  'HVDC_CONVERTER': 'TR_POWER_HVDC',
  'EARTHING': 'TR_SPEC_EARTHING',
  'MOBILE': 'TR_SPEC_MOBILE',
  'RENEWABLE': 'TR_SPEC_RENEWABLE',
  'REACTOR': 'TR_SPEC_REACTOR',
  'SHUNT_REACTOR': 'TR_SPEC_REACTOR'
};

// ── 1. Create Canonical Company Entities ─────────────────────────────────────
const companiesMap = new Map(); // key: domain or normName -> company object
const companyList = [];

function getOrCreateCompany(rawName, website, country, region) {
  const dom = normDom(website);
  const canonicalName = cleanBrandName(rawName);
  const nKey = norm(canonicalName);
  let co = null;

  if (dom && companiesMap.has('dom:' + dom)) {
    co = companiesMap.get('dom:' + dom);
  } else if (companiesMap.has('name:' + nKey)) {
    co = companiesMap.get('name:' + nKey);
  }

  if (!co) {
    let slug = slugify(canonicalName);
    // Find pre-assigned canonical slug if exists (prioritize exact canonical name)
    const hitSlug = SLUGS.find((s) => norm(s.name) === nKey) || SLUGS.find((s) => norm(s.name) === norm(rawName));
    if (hitSlug && hitSlug.slug) slug = hitSlug.slug;

    co = {
      id: 'cmp:' + slug,
      name: canonicalName,
      slug: slug,
      roles: new Set(),
      headquarters: {
        country: country || '',
        city: '',
        address: ''
      },
      website: website || '',
      facility_ids: [],
      factory_count: 0,
      capabilities: new Set(),
      commercial_status: 'LISTED',
      completeness_score: 50,
      provenance: {
        type: 'PUBLIC_SOURCE',
        last_verified: '2026-08-28'
      },
      sources: {
        website: website || null,
        capability_source: '',
        capability_note: ''
      }
    };

    if (dom) companiesMap.set('dom:' + dom, co);
    companiesMap.set('name:' + nKey, co);
    companiesMap.set('name:' + norm(rawName), co);
    companyList.push(co);
  } else {
    // If the new name is cleaner/shorter than the current company name, adopt it
    if (canonicalName.length < co.name.length && canonicalName.length > 2) {
      co.name = canonicalName;
      const hitSlug = SLUGS.find((s) => norm(s.name) === nKey);
      if (hitSlug && hitSlug.slug) {
        co.slug = hitSlug.slug;
        co.id = 'cmp:' + hitSlug.slug;
      }
    }
    if (!co.website && website) co.website = website;
    if (!co.headquarters.country && country) co.headquarters.country = country;
  }

  return co;
}

// Ingest Transformer OEMs from INTEL
INTEL.forEach((c) => {
  const co = getOrCreateCompany(c.name, c.website, c.country, c.region);
  co.roles.add('Transformer Manufacturer');
  if (c.headquarters && !co.headquarters.city) co.headquarters.city = c.headquarters;
  if (c.commercial_status) co.commercial_status = c.commercial_status;
  if (c.completeness_score && c.completeness_score > co.completeness_score) co.completeness_score = c.completeness_score;
  if (c.provenance_type) co.provenance.type = c.provenance_type;
  if (c.last_verified) co.provenance.last_verified = c.last_verified;
  if (c.sources) {
    co.sources.capability_source = c.sources.capability_source || co.sources.capability_source;
    co.sources.capability_note = c.sources.capability_note || co.sources.capability_note;
  }
  (c.products || []).forEach((p) => {
    const controlled = CODE_MAP[String(p).toUpperCase()] || String(p);
    co.capabilities.add(controlled);
  });
});

// Ingest Component & Material Suppliers from ACC
ACC.forEach((a) => {
  const co = getOrCreateCompany(a.name, a.website, a.country, '');
  const cats = a.categories || [];
  const isMaterial = cats.some((c) => /steel|crgo|conductor|copper|pressboard|wood|fluid|oil/i.test(c));
  if (isMaterial) co.roles.add('Material Supplier');
  const isComponent = cats.some((c) => /bushing|tap changer|oltc|relay|radiator|breather|valve|pump/i.test(c));
  if (isComponent || !isMaterial) co.roles.add('Component Manufacturer');

  if (a.city && !co.headquarters.city) co.headquarters.city = a.city;
  cats.forEach((cat) => co.capabilities.add(cat));
});

// Ingest Machinery Manufacturers from MACH
MACH.forEach((m) => {
  const mfgName = m.manufacturer || m.name;
  const co = getOrCreateCompany(mfgName, m.website, m.country, '');
  co.roles.add('Machinery Manufacturer');
  if (m.city && !co.headquarters.city) co.headquarters.city = m.city;
  if (m.category_id) co.capabilities.add(m.category_id);
});

// Ingest Testing Laboratories from LABS
LABS.forEach((l) => {
  const co = getOrCreateCompany(l.name, l.website, l.country, '');
  co.roles.add('Testing Laboratory');
  if (l.city && !co.headquarters.city) co.headquarters.city = l.city;
  co.capabilities.add('LAB_HIGH_VOLTAGE');
  if (l.accreditation && l.accreditation.standard) {
    co.capabilities.add(l.accreditation.standard);
  }
});

// Ingest Service & Repair Specialists from SRV
SRV.forEach((s) => {
  const name = s.company_name || s.name;
  const co = getOrCreateCompany(name, s.website, s.country, '');
  co.roles.add('Transformer Service Provider');
  if (s.city && !co.headquarters.city) co.headquarters.city = s.city;
  (s.service_types || []).forEach((st) => co.capabilities.add(st));
});

// Ingest Logistics Specialists from LOG
LOG.forEach((l) => {
  const name = l.company_name || l.name;
  if (!name) return;
  const co = getOrCreateCompany(name, l.website, l.country, '');
  co.roles.add('Logistics & Heavy Transport');
  if (l.city && !co.headquarters.city) co.headquarters.city = l.city;
});

// Ingest Buyers & Utilities from BYR
BYR.forEach((b) => {
  const name = b.organization_name || b.name;
  if (!name) return;
  const co = getOrCreateCompany(name, b.website, b.country, '');
  const bType = (b.buyer_type || '').toLowerCase();
  if (bType.includes('grid') || bType.includes('transmission')) {
    co.roles.add('Grid Operator');
  } else {
    co.roles.add('Utility');
  }
  if (b.city && !co.headquarters.city) co.headquarters.city = b.city;
});

// ── 2. Create Decoupled Facility Entities (P0.2) ─────────────────────────────
const facilitiesList = [];
const facIdSet = new Set();

// Extract facilities from manufacturer-sites.json
SITES.forEach((brandGroup) => {
  const brandDom = normDom(brandGroup.url);
  const brandNorm = norm(cleanBrandName(brandGroup.brand));
  const co = (brandDom && companiesMap.get('dom:' + brandDom)) || companiesMap.get('name:' + brandNorm);
  const coId = co ? co.id : ('cmp:' + brandGroup.slug);
  const coName = co ? co.name : brandGroup.brand;

  (brandGroup.sites || []).forEach((s, idx) => {
    const locSlug = slugify(s.city || s.country || ('plant-' + (idx + 1)));
    const facId = 'fac:' + (co ? co.slug : brandGroup.slug) + ':' + locSlug;
    if (facIdSet.has(facId)) return;
    facIdSet.add(facId);

    // Controlled transformer types evidenced at this plant
    const plantTypes = (s.products || []).map((p) => CODE_MAP[String(p).toUpperCase()] || String(p));

    const facility = {
      id: facId,
      company_id: coId,
      company_name: coName,
      facility_name: s.name || (coName + ' — ' + (s.city || s.country)),
      city: s.city || '',
      country: s.country || '',
      region: s.region || '',
      status: s.status || 'UNCLEAR',
      capabilities: {
        transformer_types: plantTypes,
        max_voltage_kv: null, // NOT automatically inherited from corporate maximum
        max_mva: null,        // NOT automatically inherited from corporate maximum
        annual_mva_capacity: null,
        annual_capacity_note: 'Not publicly disclosed',
        certifications: [],
        test_capabilities: [],
        produces: s.produces || ''
      },
      source: s.source || 'TransformerPath factory inventory',
      source_tier: s.claim_type === 'INDEPENDENTLY_SOURCED' ? 'Tier A' : 'Tier C',
      source_url: s.source_url || s.url || '',
      last_checked: '2026-08-28',
      confidence: s.status === 'OPERATIONAL' ? 'HIGH' : 'LIMITED'
    };

    facilitiesList.push(facility);
    if (co) {
      co.facility_ids.push(facId);
    }
  });
});

// Also check single-site manufacturers in INTEL that might not have appeared in SITES
INTEL.forEach((c) => {
  const co = companiesMap.get('name:' + norm(cleanBrandName(c.name)));
  if (co && co.facility_ids.length === 0) {
    const locSlug = slugify(c.headquarters || c.country || 'hq');
    const facId = 'fac:' + co.slug + ':' + locSlug;
    if (!facIdSet.has(facId)) {
      facIdSet.add(facId);
      const plantTypes = (c.products || []).map((p) => CODE_MAP[String(p).toUpperCase()] || String(p));
      const facility = {
        id: facId,
        company_id: co.id,
        company_name: co.name,
        facility_name: co.name + ' — ' + (c.headquarters || c.country),
        city: c.headquarters || '',
        country: c.country || '',
        region: c.region || '',
        status: c.research_status === 'ACTIVE_CONFIRMED' ? 'OPERATIONAL' : 'UNCLEAR',
        capabilities: {
          transformer_types: plantTypes,
          max_voltage_kv: null,
          max_mva: null,
          annual_mva_capacity: null,
          annual_capacity_note: 'Not publicly disclosed',
          certifications: c.reported_certs || [],
          test_capabilities: [],
          produces: ''
        },
        source: 'TransformerPath company intelligence store',
        source_tier: 'Tier B',
        source_url: c.website || '',
        last_checked: c.last_verified || '2026-08-28',
        confidence: c.research_status === 'ACTIVE_CONFIRMED' ? 'HIGH' : 'LIMITED'
      };
      facilitiesList.push(facility);
      co.facility_ids.push(facId);
    }
  }
});

// ── 3. Finalize Companies List ──────────────────────────────────────────────
const distinctCompanies = Array.from(new Set(companyList)).map((co) => {
  co.roles = Array.from(co.roles).sort();
  co.capabilities = Array.from(co.capabilities).sort();
  co.facility_ids = Array.from(new Set(co.facility_ids)).sort();
  co.factory_count = co.facility_ids.length;
  return co;
}).sort((a, b) => a.name.localeCompare(b.name));

// Sort facilities deterministically
facilitiesList.sort((a, b) => a.company_name.localeCompare(b.company_name) || a.facility_name.localeCompare(b.facility_name));

// ── 4. Write Canonical Datasets ─────────────────────────────────────────────
fs.mkdirSync('data', { recursive: true });

const companiesPayload = {
  $schema: 'https://transformerpath.com/companies.schema.json',
  generated_at: new Date().toISOString(),
  count: distinctCompanies.length,
  companies: distinctCompanies
};

const facilitiesPayload = {
  $schema: 'https://transformerpath.com/facilities.schema.json',
  generated_at: new Date().toISOString(),
  count: facilitiesList.length,
  facilities: facilitiesList
};

fs.writeFileSync('data/companies.json', JSON.stringify(companiesPayload, null, 2));
fs.writeFileSync('data/facilities.json', JSON.stringify(facilitiesPayload, null, 2));

console.log('✅ Canonical entities built successfully:');
console.log('   Companies: ' + distinctCompanies.length + ' entities in data/companies.json');
console.log('   Facilities: ' + facilitiesList.length + ' factories in data/facilities.json');
const multiRole = distinctCompanies.filter((c) => c.roles.length > 1);
console.log('   Multi-role companies consolidated:', multiRole.length);
