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
const aliases = require('./lib/company-aliases');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

const norm = aliases.norm;
const slugify = aliases.slugify;
const cleanBrandName = aliases.cleanBrandName;
const resolveCompanyAlias = aliases.resolveCompanyAlias;
const locSlug = aliases.locSlug;

function normDom(u) {
  return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '')
    .split('/')[0].toLowerCase().trim();
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
  const resolved = resolveCompanyAlias(rawName);
  const dom = normDom(website);
  const canonicalName = resolved.name;
  const nKey = norm(canonicalName);
  let co = null;

  if (companiesMap.has('name:' + nKey)) {
    co = companiesMap.get('name:' + nKey);
  } else if (companiesMap.has('name:' + norm(rawName))) {
    co = companiesMap.get('name:' + norm(rawName));
  }

  if (!co) {
    let slug = resolved.slug || slugify(canonicalName);
    // Find pre-assigned canonical slug if exists (prioritize exact canonical name)
    const hitSlug = SLUGS.find((s) => norm(s.name) === nKey) || SLUGS.find((s) => norm(s.name) === norm(rawName));
    if (hitSlug && hitSlug.slug && !resolved.aliased) slug = hitSlug.slug;

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
    if (!resolved.aliased && website) co.website = website;
    else if (!co.website && website) co.website = website;
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
// Public facility count = explicit plant records only. Never clone a company HQ
// into a facility just because the company exists (that produced the 1:1 artifact).
const facilitiesList = [];
const facIdSet = new Set();

function isSourcedPlant(s) {
  if (!s) return false;
  if (s.claim_type === 'INDEPENDENTLY_SOURCED') return true;
  if (s.produces) return true;
  if (s.source_url) return true;
  return /independently sourced|deep-research/i.test(s.source || '');
}

function addFacility(opts) {
  const city = opts.city || '';
  const loc = locSlug(city) || slugify(opts.country || 'plant');
  const coSlug = opts.co ? opts.co.slug : opts.fallbackSlug;
  const facId = 'fac:' + coSlug + ':' + loc;
  if (facIdSet.has(facId)) {
    const existing = facilitiesList.find((f) => f.id === facId);
    if (existing && opts.produces && !existing.capabilities.produces) {
      existing.capabilities.produces = opts.produces;
    }
    if (existing && opts.claim_type === 'INDEPENDENTLY_SOURCED') {
      existing.claim_type = 'INDEPENDENTLY_SOURCED';
      existing.public_count = true;
    }
    return existing;
  }
  facIdSet.add(facId);
  const facility = {
    id: facId,
    company_id: opts.co ? opts.co.id : ('cmp:' + opts.fallbackSlug),
    company_name: opts.co ? opts.co.name : opts.fallbackName,
    facility_name: opts.facility_name || ((opts.co ? opts.co.name : opts.fallbackName) + ' — ' + (city || opts.country)),
    city: city,
    country: opts.country || '',
    region: opts.region || '',
    status: opts.status || 'UNCLEAR',
    claim_type: opts.claim_type || '',
    produces: opts.produces || '',
    public_count: !!opts.public_count,
    capabilities: {
      transformer_types: opts.plantTypes || [],
      max_voltage_kv: null,
      max_mva: null,
      annual_mva_capacity: null,
      annual_capacity_note: 'Not publicly disclosed',
      certifications: opts.certs || [],
      test_capabilities: [],
      produces: opts.produces || ''
    },
    source: opts.source || 'TransformerPath factory inventory',
    source_tier: opts.claim_type === 'INDEPENDENTLY_SOURCED' ? 'Tier A' : 'Tier C',
    source_url: opts.source_url || '',
    last_checked: opts.last_checked || '2026-08-28',
    confidence: opts.status === 'OPERATIONAL' ? 'HIGH' : 'LIMITED'
  };
  facilitiesList.push(facility);
  if (opts.co) opts.co.facility_ids.push(facId);
  return facility;
}

// Extract facilities from manufacturer-sites.json (explicit plant cities)
SITES.forEach((brandGroup) => {
  const resolved = resolveCompanyAlias(brandGroup.brand);
  const brandDom = normDom(brandGroup.url);
  const brandNorm = norm(resolved.name);
  const co = companiesMap.get('name:' + brandNorm)
    || (brandDom && companiesMap.get('dom:' + brandDom))
    || companiesMap.get('name:' + norm(cleanBrandName(brandGroup.brand)));

  (brandGroup.sites || []).forEach((s) => {
    if (!s.city && !s.country) return;
    const sourced = isSourcedPlant(s);
    addFacility({
      co: co,
      fallbackSlug: resolved.slug || brandGroup.slug,
      fallbackName: resolved.name || brandGroup.brand,
      city: s.city,
      country: s.country,
      region: s.region,
      status: s.status,
      facility_name: s.name || (resolved.name + ' — ' + (s.city || s.country)),
      plantTypes: (s.products || []).map((p) => CODE_MAP[String(p).toUpperCase()] || String(p)),
      produces: s.produces || '',
      claim_type: s.claim_type || '',
      source: s.source || 'TransformerPath factory inventory',
      source_url: s.source_url || s.url || '',
      public_count: sourced
    });
  });
});

// INTEL factory arrays are explicit plant records (city + optional produces/source).
// Do NOT create an HQ placeholder when a company has no factory list.
INTEL.forEach((c) => {
  const resolved = resolveCompanyAlias(c.name);
  const co = companiesMap.get('name:' + norm(resolved.name))
    || companiesMap.get('name:' + norm(cleanBrandName(c.name)));
  (c.factories || []).forEach((f) => {
    if (!f || !f.city) return;
    const sourced = isSourcedPlant(f);
    addFacility({
      co: co,
      fallbackSlug: resolved.slug,
      fallbackName: resolved.name,
      city: f.city,
      country: f.country || c.country,
      region: c.region,
      status: sourced ? 'OPERATIONAL' : 'UNCLEAR',
      facility_name: resolved.name + ' — ' + f.city,
      plantTypes: (c.products || []).map((p) => CODE_MAP[String(p).toUpperCase()] || String(p)),
      produces: f.produces || '',
      claim_type: f.claim_type || '',
      source: f.source_url ? 'Company intelligence store (sourced plant)' : 'Company intelligence store (listed plant city)',
      source_url: f.source_url || f.url || c.website || '',
      last_checked: c.last_verified || '2026-08-28',
      certs: c.reported_certs || [],
      public_count: sourced
    });
  });
});

// A plant on a multi-site company is an explicit facility even if the census
// row was only a city listing (Prolec Shreveport next to sourced Waukesha).
const facByCompany = {};
facilitiesList.forEach((f) => {
  (facByCompany[f.company_id] = facByCompany[f.company_id] || []).push(f);
});
Object.keys(facByCompany).forEach((id) => {
  const group = facByCompany[id];
  if (group.length < 2) return;
  group.forEach((f) => { if (f.city) f.public_count = true; });
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

const publicFacilities = facilitiesList.filter((f) => f.public_count);
const facilitiesPayload = {
  $schema: 'https://transformerpath.com/facilities.schema.json',
  generated_at: new Date().toISOString(),
  count: facilitiesList.length,
  public_count: publicFacilities.length,
  note: 'count = every explicit plant record (census city or sourced). public_count = plants with sourced evidence or belonging to a multi-site company. HQ-clone facilities are not created.',
  facilities: facilitiesList
};

fs.writeFileSync('data/companies.json', JSON.stringify(companiesPayload, null, 2));
fs.writeFileSync('data/facilities.json', JSON.stringify(facilitiesPayload, null, 2));

console.log('✅ Canonical entities built successfully:');
console.log('   Companies: ' + distinctCompanies.length + ' entities in data/companies.json');
console.log('   Facilities: ' + facilitiesList.length + ' plant records (' + publicFacilities.length + ' counted publicly) in data/facilities.json');
const multiRole = distinctCompanies.filter((c) => c.roles.length > 1);
console.log('   Multi-role companies consolidated:', multiRole.length);
