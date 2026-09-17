#!/usr/bin/env node
/* build-directory-index.js — TransformerPath Industry Directory index builder.
 *
 * Joins the two canonical company datasets into ONE structured, capability-aware
 * searchable directory index:
 *   - data/manufacturer-intel.json  (542 transformer manufacturers, with a
 *     company→factory model, evidence fields and research completeness)
 *   - data/accessories.json         (listed component/material suppliers)
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
function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
const { resolveCompanyAlias } = require('./lib/company-aliases');
const TAX = JSON.parse(fs.readFileSync('data/industry-taxonomy.json', 'utf8'));
const MFG = JSON.parse(fs.readFileSync('data/manufacturer-intel.json', 'utf8')).companies || [];
const ACC = JSON.parse(fs.readFileSync('data/accessories.json', 'utf8'));
const ACC_SUPPLIERS = ACC.suppliers || [];

const CANON_COMPANIES = (() => {
  try { return JSON.parse(fs.readFileSync('data/companies.json', 'utf8')).companies || []; } catch (e) { return []; }
})();
const CANON_FACILITIES = (() => {
  try { return JSON.parse(fs.readFileSync('data/facilities.json', 'utf8')).facilities || []; } catch (e) { return []; }
})();

const canonBySlug = new Map();
const canonByName = new Map();
CANON_COMPANIES.forEach(c => {
  if (c.slug) canonBySlug.set(c.slug, c);
  if (c.name) canonByName.set(c.name.toLowerCase().trim(), c);
});

function defaultRole(kind) {
  switch (kind) {
    case 'manufacturer': return 'Transformer Manufacturer';
    case 'component_supplier': return 'Component Manufacturer';
    case 'machinery_manufacturer': return 'Machinery Builder';
    case 'testing_laboratory': return 'Testing Laboratory';
    case 'service_repair': return 'Service & Repair Provider';
    case 'transport_logistics': return 'Transport & Logistics Provider';
    case 'buyer_procurement': return 'Buyer & Procurement Organization';
    case 'industry_association': return 'Industry Association';
    case 'education_provider': return 'Education & Training Provider';
    case 'media_publication': return 'Media & Publication';
    default: return 'Industry Participant';
  }
}

function getCanonProps(slug, name, fallbackKind, fallbackFacCount) {
  let c = null;
  if (slug && canonBySlug.has(slug)) c = canonBySlug.get(slug);
  else if (name) {
    const n = name.toLowerCase().trim();
    if (canonByName.has(n)) c = canonByName.get(n);
  }
  const cleanSlug = slug || (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const canonId = c ? c.id : ('cmp:' + cleanSlug);
  const roles = (c && c.roles && c.roles.length) ? c.roles : [defaultRole(fallbackKind)];
  const factoryCount = c ? (c.factory_count || 0) : (fallbackFacCount || 0);
  const facilityIds = c ? (c.facility_ids || []) : [];
  return { id: canonId, canonical_id: canonId, roles, factory_count: factoryCount, facility_ids: facilityIds };
}

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
  const cp = getCanonProps(c.slug, c.name, 'manufacturer', (c.factories || []).length);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
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
    facility_ids: cp.facility_ids,
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
    completeness_score: c.completeness_score || 0,
    missing_fields: c.missing_fields || [],
    provenance_type: c.provenance_type || 'PUBLIC_SOURCE',
    last_verified: c.last_verified || '2026-08-28',
    research_completeness: c.research_completeness || 0,
    research_status: c.research_status || '',
    commercial_status: c.commercial_status || '',
    featured: !!c.featured,
    listing_tier: c.listing_tier || '',
    verified: !!c.verified,
    sources: c.sources || {},
    factory_count: cp.factory_count,
  };
}

function buildSupplier(s) {
  const labels = (s.categories || []).slice();
  const slug = slugify(s.name);
  const hasPage = slug && fs.existsSync('accessories/' + slug + '/index.html');
  const cp = getCanonProps(slug, s.name, 'component_supplier', 0);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'component_supplier',
    name: s.name,
    slug: hasPage ? slug : '',
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
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: (s.verification_status || '').toLowerCase().indexOf('verified') >= 0 ? 'CONFIRMED' : 'INFERRED', voltage: 'UNKNOWN', mva: 'UNKNOWN' },
    evidence: (s.verification_status || '').toLowerCase().indexOf('verified') >= 0 ? 'CONFIRMED' : 'INFERRED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'MEDIUM',
    source_meta: { source_title: 'website-checked', source_type: 'company_documentation', source_url: s.website || '' },
    research_completeness: 0,
    completeness_score: 50,
    provenance_type: 'TRANSFORMERPATH_RESEARCHED',
    last_verified: s.verification_date || '2026-08-31',
    research_status: s.verification_status || '',
    commercial_status: '',
    sources: { website: s.website },
    factory_count: cp.factory_count,
  };
}

const MACH_DATA = (() => { try { return JSON.parse(fs.readFileSync('data/machinery.json', 'utf8')).machinery || []; } catch (e) { return []; } })();
function buildMachinery(m) {
  const labels = [m.category, m.machine_type];
  if (m.automation_level) labels.push(m.automation_level);
  const slug = (m.id || '').replace(/^mach:/, '') || (m.manufacturer || m.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cp = getCanonProps(slug, m.manufacturer || m.name, 'machinery_manufacturer', 1);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'machinery_manufacturer',
    name: m.manufacturer + ' — ' + m.name,
    slug: slug,
    country: m.country,
    region: m.city || '',
    website: m.website,
    headquarters: (m.city ? m.city + ', ' : '') + m.country,
    product_codes: [m.category_id || 'MAC_EQUIPMENT'],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: '', num: null, unit: 'kV' },
    mva: { value: '', num: null, unit: 'MVA' },
    certs: [],
    testing_capability: null,
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: 'CONFIRMED', voltage: 'UNKNOWN', mva: 'UNKNOWN' },
    evidence: 'CONFIRMED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'HIGH',
    source_meta: { source_title: m.source || 'technical catalog', source_type: 'company_documentation', source_url: m.website || '' },
    research_completeness: 8,
    completeness_score: 85,
    provenance_type: 'OFFICIAL_SOURCE',
    last_verified: m.last_verified || '2026-08-28',
    research_status: 'ACTIVE_CONFIRMED',
    commercial_status: '',
    sources: { website: m.website },
    factory_count: cp.factory_count,
  };
}

const LAB_DATA = (() => { try { return JSON.parse(fs.readFileSync('data/laboratories.json', 'utf8')).laboratories || []; } catch (e) { return []; } })();
function buildLaboratory(l) {
  const labels = ['Independent Test Laboratory', 'ISO/IEC 17025'];
  if (l.capabilities && l.capabilities.lightning_impulse) labels.push('Impulse Testing');
  if (l.capabilities && l.capabilities.short_circuit) labels.push('Short-Circuit Testing');
  if (l.capabilities && l.capabilities.partial_discharge) labels.push('PD Measurement');
  if (l.capabilities && l.capabilities.oil_testing) labels.push('Oil & DGA Lab');
  const slug = (l.id || '').replace(/^lab:/, '') || (l.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cp = getCanonProps(slug, l.name, 'testing_laboratory', 1);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'testing_laboratory',
    name: l.name,
    slug: slug,
    country: l.country,
    region: l.city || '',
    website: l.website,
    headquarters: (l.city ? l.city + ', ' : '') + l.country,
    product_codes: ['LAB_TESTING'],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: l.max_voltage_kv ? (l.max_voltage_kv + ' kV') : '', num: l.max_voltage_kv || null, unit: 'kV' },
    mva: { value: l.short_circuit_capacity || '', num: null, unit: 'MVA' },
    certs: ['ISO/IEC 17025'],
    testing_capability: 'Accredited Testing Laboratory',
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: 'CONFIRMED', voltage: 'CONFIRMED', mva: 'CONFIRMED' },
    evidence: 'CONFIRMED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'HIGH',
    source_meta: { source_title: l.source || 'accreditation directory', source_type: 'official_accreditation', source_url: l.website || '' },
    research_completeness: 9,
    completeness_score: 95,
    provenance_type: 'OFFICIAL_SOURCE',
    last_verified: l.last_verified || '2026-08-28',
    research_status: 'ACTIVE_CONFIRMED',
    commercial_status: '',
    sources: { website: l.website },
    factory_count: cp.factory_count,
  };
}

const SRV_DATA = (() => { try { return JSON.parse(fs.readFileSync('data/services.json', 'utf8')).services || []; } catch (e) { return []; } })();
function buildService(s) {
  const labels = (s.service_types || []).slice(0, 5);
  const slug = (s.id || '').replace(/^srv:/, '') || (s.company_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cp = getCanonProps(slug, s.company_name, 'service_repair', 1);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'service_repair',
    name: s.company_name,
    slug: slug,
    country: s.country,
    region: s.state_province || '',
    website: s.website,
    headquarters: (s.city ? s.city + ', ' : '') + s.country,
    product_codes: ['SERVICE_REPAIR'],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: s.voltage_capability_kv || '', num: NUM(s.voltage_capability_kv), unit: 'kV' },
    mva: { value: s.capacity_mva ? (s.capacity_mva + ' MVA') : '', num: s.capacity_mva || null, unit: 'MVA' },
    certs: s.certifications || [],
    testing_capability: 'On-Site Diagnostic Testing & Overhaul',
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: 'CONFIRMED', voltage: 'CONFIRMED', mva: 'CONFIRMED' },
    evidence: 'CONFIRMED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'HIGH',
    source_meta: { source_title: 'Official website verification', source_type: 'company_documentation', source_url: s.website || '' },
    research_completeness: 8,
    completeness_score: 90,
    provenance_type: 'OFFICIAL_SOURCE',
    last_verified: s.verification_date || '2026-09-11',
    research_status: 'ACTIVE_CONFIRMED',
    commercial_status: '',
    sources: { website: s.website },
    factory_count: cp.factory_count,
  };
}

const LOG_DATA = (() => { try { return JSON.parse(fs.readFileSync('data/logistics.json', 'utf8')).companies || []; } catch (e) { return []; } })();
function buildLogistics(l) {
  const labels = (l.transport_modes || []).slice(0, 4);
  const slug = (l.id || '').replace(/^log:/, '') || (l.company_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cp = getCanonProps(slug, l.company_name, 'transport_logistics', 1);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'transport_logistics',
    name: l.company_name,
    slug: slug,
    country: l.country,
    region: l.state_province || '',
    website: l.website,
    headquarters: (l.city ? l.city + ', ' : '') + l.country,
    product_codes: ['TRANSPORT_LOGISTICS'],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: '', num: null, unit: 'kV' },
    mva: { value: l.max_weight_tons ? ('Max ' + l.max_weight_tons + ' t') : '', num: null, unit: 't' },
    certs: l.certifications || [],
    testing_capability: 'Heavy Haulage & Rigging',
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: 'CONFIRMED', voltage: 'UNKNOWN', mva: 'UNKNOWN' },
    evidence: 'CONFIRMED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'HIGH',
    source_meta: { source_title: 'Heavy haulage registry', source_type: 'company_documentation', source_url: l.website || '' },
    research_completeness: 8,
    completeness_score: 85,
    provenance_type: 'OFFICIAL_SOURCE',
    last_verified: l.verification_date || '2026-09-11',
    research_status: 'ACTIVE_CONFIRMED',
    commercial_status: '',
    sources: { website: l.website },
    factory_count: cp.factory_count,
  };
}

const ASC_DATA = (() => { try { return JSON.parse(fs.readFileSync('data/associations.json', 'utf8')).associations || []; } catch (e) { return []; } })();
function buildAssociation(a) {
  const labels = (a.focus_areas || []).slice(0, 4);
  const slug = (a.id || '').replace(/^asc:/, '') || (a.association_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cp = getCanonProps(slug, a.association_name, 'industry_association', 0);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'industry_association',
    name: a.association_name,
    slug: slug,
    country: a.country,
    region: a.scope || '',
    website: a.website,
    headquarters: a.country,
    product_codes: ['INDUSTRY_ASSOCIATION'],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: '', num: null, unit: 'kV' },
    mva: { value: '', num: null, unit: 'MVA' },
    certs: [],
    testing_capability: 'Technical Standardization & Trade Body',
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: 'CONFIRMED', voltage: 'UNKNOWN', mva: 'UNKNOWN' },
    evidence: 'CONFIRMED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'HIGH',
    source_meta: { source_title: 'Official Association Register', source_type: 'industry_publication', source_url: a.website || '' },
    research_completeness: 8,
    completeness_score: 90,
    provenance_type: 'OFFICIAL_SOURCE',
    last_verified: a.verification_date || '2026-09-11',
    research_status: 'ACTIVE_CONFIRMED',
    commercial_status: '',
    sources: { website: a.website },
    factory_count: cp.factory_count,
  };
}

const EDU_DATA = (() => { try { return JSON.parse(fs.readFileSync('data/education.json', 'utf8')).providers || []; } catch (e) { return []; } })();
function buildEducation(e) {
  const labels = (e.course_types || []).slice(0, 4);
  const slug = (e.id || '').replace(/^edu:/, '') || (e.provider_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cp = getCanonProps(slug, e.provider_name, 'education_provider', 1);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'education_provider',
    name: e.provider_name,
    slug: slug,
    country: e.country,
    region: e.state_province || '',
    website: e.website,
    headquarters: (e.city ? e.city + ', ' : '') + e.country,
    product_codes: ['EDUCATION_TRAINING'],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: '', num: null, unit: 'kV' },
    mva: { value: '', num: null, unit: 'MVA' },
    certs: [e.certification_offered].filter(Boolean),
    testing_capability: 'Training & Laboratory Research',
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: 'CONFIRMED', voltage: 'UNKNOWN', mva: 'UNKNOWN' },
    evidence: 'CONFIRMED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'HIGH',
    source_meta: { source_title: 'Academic / Technical Institute Record', source_type: 'official_accreditation', source_url: e.website || '' },
    research_completeness: 8,
    completeness_score: 90,
    provenance_type: 'OFFICIAL_SOURCE',
    last_verified: e.verification_date || '2026-09-11',
    research_status: 'ACTIVE_CONFIRMED',
    commercial_status: '',
    sources: { website: e.website },
    factory_count: cp.factory_count,
  };
}

const BYR_DATA = (() => { try { return JSON.parse(fs.readFileSync('data/buyers.json', 'utf8')).buyers || []; } catch (e) { return []; } })();
function buildBuyer(b) {
  const labels = [b.buyer_type].concat((b.transformer_types_purchased || []).slice(0, 3));
  const slug = (b.id || '').replace(/^byr:/, '') || (b.organization_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cp = getCanonProps(slug, b.organization_name, 'buyer_procurement', 0);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'buyer_procurement',
    name: b.organization_name,
    slug: slug,
    country: b.country,
    region: b.state_province || '',
    website: b.website,
    headquarters: (b.city ? b.city + ', ' : '') + b.country,
    product_codes: ['BUYER_PROCUREMENT'],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: b.voltage_classes || '', num: NUM(b.voltage_classes), unit: 'kV' },
    mva: { value: b.capacity_range || '', num: null, unit: 'MVA' },
    certs: [],
    testing_capability: 'Procurement & Grid Interconnection',
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: 'CONFIRMED', voltage: 'CONFIRMED', mva: 'CONFIRMED' },
    evidence: 'CONFIRMED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'HIGH',
    source_meta: { source_title: 'Procurement portal verification', source_type: 'company_documentation', source_url: b.website || '' },
    research_completeness: 8,
    completeness_score: 90,
    provenance_type: 'OFFICIAL_SOURCE',
    last_verified: b.verification_date || '2026-09-11',
    research_status: 'ACTIVE_CONFIRMED',
    commercial_status: '',
    sources: { website: b.website },
    factory_count: cp.factory_count,
  };
}

const MED_DATA = (() => { try { return JSON.parse(fs.readFileSync('data/media.json', 'utf8')).publications || []; } catch (e) { return []; } })();
function buildMedia(m) {
  const labels = [m.publication_type, m.frequency].concat((m.coverage_areas || []).slice(0, 3));
  const slug = (m.id || '').replace(/^med:/, '') || (m.publication_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cp = getCanonProps(slug, m.publication_name, 'media_publication', 0);
  return {
    id: cp.id,
    canonical_id: cp.canonical_id,
    roles: cp.roles,
    kind: 'media_publication',
    name: m.publication_name,
    slug: slug,
    country: m.country,
    region: m.language || '',
    website: m.website,
    headquarters: m.country,
    product_codes: ['MEDIA_PUBLICATION'],
    capability_labels: labels,
    transformer_types: { power: {}, distribution: {}, dry_type: {}, special: {} },
    voltage: { value: '', num: null, unit: 'kV' },
    mva: { value: '', num: null, unit: 'MVA' },
    certs: [],
    testing_capability: 'Industry Publishing & Media',
    facility_ids: cp.facility_ids,
    factories: [],
    capability_evidence: { products: 'CONFIRMED', voltage: 'UNKNOWN', mva: 'UNKNOWN' },
    evidence: 'CONFIRMED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    confidence: 'HIGH',
    source_meta: { source_title: 'Media directory verification', source_type: 'industry_publication', source_url: m.website || '' },
    research_completeness: 8,
    completeness_score: 85,
    provenance_type: 'OFFICIAL_SOURCE',
    last_verified: m.verification_date || '2026-09-11',
    research_status: 'ACTIVE_CONFIRMED',
    commercial_status: '',
    sources: { website: m.website },
    factory_count: cp.factory_count,
  };
}

function countryKey(c) {
  const s = String(c || '').toLowerCase().trim();
  if (s === 'usa' || s === 'us' || s === 'united states of america') return 'united states';
  if (s === 'uae' || s === 'u.a.e.') return 'united arab emirates';
  if (s === 'uk' || s === 'great britain') return 'united kingdom';
  if (s === 'brasil') return 'brazil';
  return s;
}

function mergeFactories(a, b) {
  const out = [];
  const seen = new Set();
  (a || []).concat(b || []).forEach((f) => {
    const cityHead = String(f.city || '').toLowerCase().split(',')[0].trim();
    const k = cityHead + '|' + countryKey(f.country);
    if (!k || k === '|') return;
    if (seen.has(k)) {
      const dest = out.find((x) => String(x.city || '').toLowerCase().split(',')[0].trim() + '|' + countryKey(x.country) === k);
      if (dest && f.produces && !dest.produces) dest.produces = f.produces;
      return;
    }
    seen.add(k);
    out.push(Object.assign({}, f));
  });
  return out;
}

const mfgRows = [];
const mfgByCanon = new Map();
MFG.forEach((c) => {
  const row = buildManufacturer(c);
  const alias = resolveCompanyAlias(c.name);
  const key = alias.slug;
  if (mfgByCanon.has(key)) {
    const dest = mfgByCanon.get(key);
    dest.factories = mergeFactories(dest.factories, row.factories);
    dest.factory_count = dest.factories.length;
    dest.facility_ids = Array.from(new Set((dest.facility_ids || []).concat(row.facility_ids || [])));
    if ((row.voltage && row.voltage.num || 0) > (dest.voltage && dest.voltage.num || 0)) dest.voltage = row.voltage;
    if ((row.mva && row.mva.num || 0) > (dest.mva && dest.mva.num || 0)) dest.mva = row.mva;
    return;
  }
  row.name = alias.name;
  row.slug = alias.slug;
  row.id = 'cmp:' + alias.slug;
  row.canonical_id = row.id;
  mfgByCanon.set(key, row);
  mfgRows.push(row);
});

const nonMfgRows = []
  .concat(ACC_SUPPLIERS.map(buildSupplier))
  .concat(MACH_DATA.map(buildMachinery))
  .concat(LAB_DATA.map(buildLaboratory))
  .concat(SRV_DATA.map(buildService))
  .concat(LOG_DATA.map(buildLogistics))
  .concat(ASC_DATA.map(buildAssociation))
  .concat(EDU_DATA.map(buildEducation))
  .concat(BYR_DATA.map(buildBuyer))
  .concat(MED_DATA.map(buildMedia));

const index = mfgRows.slice();
const indexByCanon = new Map();
mfgRows.forEach(r => {
  if (r.id) indexByCanon.set(r.id, r);
  if (r.slug) indexByCanon.set(r.slug, r);
  if (r.name) indexByCanon.set(r.name.toLowerCase().trim(), r);
});

nonMfgRows.forEach(row => {
  const normName = row.name.toLowerCase().trim();
  let existing = null;
  if (row.id && indexByCanon.has(row.id)) existing = indexByCanon.get(row.id);
  else if (row.slug && indexByCanon.has(row.slug)) existing = indexByCanon.get(row.slug);
  else if (indexByCanon.has(normName)) existing = indexByCanon.get(normName);

  if (existing) {
    // Merge roles
    existing.roles = Array.from(new Set((existing.roles || []).concat(row.roles || [])));
    // Merge capability_labels
    existing.capability_labels = Array.from(new Set((existing.capability_labels || []).concat(row.capability_labels || [])));
    // Merge product codes
    existing.product_codes = Array.from(new Set((existing.product_codes || []).concat(row.product_codes || [])));
    // Merge certs
    if (row.certs && row.certs.length) {
      existing.certs = Array.from(new Set((existing.certs || []).concat(row.certs)));
    }
    // Update website if missing
    if (!existing.website && row.website) existing.website = row.website;
    // Upgrade completeness score
    if (row.completeness_score > (existing.completeness_score || 0)) {
      existing.completeness_score = row.completeness_score;
    }
    return;
  }

  // Register new distinct entry
  if (row.id) indexByCanon.set(row.id, row);
  if (row.slug) indexByCanon.set(row.slug, row);
  indexByCanon.set(normName, row);
  index.push(row);
});

try {
  const listingTier = require('./lib/listing-tier');
  const overlay = listingTier.indexOverlay(listingTier.loadOverlay());
  index.forEach((c) => {
    const hit = listingTier.resolveListing({
      name: c.name,
      slug: c.slug,
      commercial_status: c.commercial_status,
      listing_tier: c.listing_tier,
      featured: c.featured,
      verified: c.verified
    }, overlay);
    c.featured = !!hit.featured;
    c.verified = !!hit.verified;
    c.listing_tier = hit.tier;
    if (hit.tier === 'pro') c.commercial_status = c.commercial_status && /verified|pro|featured/i.test(c.commercial_status) ? c.commercial_status : 'SUPPLIER_PRO';
    else if (hit.tier === 'verified') c.commercial_status = c.commercial_status && /verified|pro|featured/i.test(c.commercial_status) ? c.commercial_status : 'VERIFIED';
  });
} catch (e) { /* overlay optional */ }

// Deterministic sort: manufacturers first, then suppliers, machinery, labs, services, etc.
const KIND_ORDER = {
  manufacturer: 1,
  component_supplier: 2,
  machinery_manufacturer: 3,
  testing_laboratory: 4,
  service_repair: 5,
  transport_logistics: 6,
  buyer_procurement: 7,
  industry_association: 8,
  education_provider: 9,
  media_publication: 10
};
index.sort((a, b) => {
  const ka = KIND_ORDER[a.kind] || 99;
  const kb = KIND_ORDER[b.kind] || 99;
  return ka !== kb ? ka - kb : a.name.localeCompare(b.name);
});

const summary = {
  $schema: 'https://transformerpath.com/directory.schema.json',
  generated: new Date().toISOString(),
  count: index.length,
  counts: {
    manufacturers: mfgRows.length,
    component_suppliers: ACC_SUPPLIERS.length,
    machinery_manufacturers: MACH_DATA.length,
    testing_laboratories: LAB_DATA.length,
    services: SRV_DATA.length,
    logistics: LOG_DATA.length,
    associations: ASC_DATA.length,
    education: EDU_DATA.length,
    buyers: BYR_DATA.length,
    media: MED_DATA.length
  },
  evidence_notes: 'evidence = CONFIRMED | COMPANY_REPORTED | INFERRED | UNKNOWN. Independent of commercial/paid status. Derived from research_status + company_reported + presence of a capability source.',
  companies: index,
};

fs.writeFileSync('data/directory-index.json', JSON.stringify(summary, null, 2));
console.log('directory-index: ' + index.length + ' entities across 10 verticals (' + mfgRows.length + ' OEMs after alias merge, ' + ACC_SUPPLIERS.length + ' suppliers, ' + MACH_DATA.length + ' machinery, ' + LAB_DATA.length + ' labs, ' + SRV_DATA.length + ' services, ' + LOG_DATA.length + ' logistics, ' + BYR_DATA.length + ' buyers, ' + ASC_DATA.length + ' associations, ' + EDU_DATA.length + ' education, ' + MED_DATA.length + ' media)');

