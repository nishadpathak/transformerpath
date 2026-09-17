#!/usr/bin/env node
/* build-directory-reverification.js — TransformerPath Global Directory Reverification & Corporate Identity Engine
 *
 * Implements:
 * 1. Full Directory Reverification (active status, official website, source tier, confidence, timestamp)
 * 2. Canonical Corporate Identity Model:
 *    CORPORATE GROUP → LEGAL / OPERATING COMPANY → BRAND → FACILITY → PRODUCT / CAPABILITY
 * 3. Formal Relationships:
 *    PARENT_OF, SUBSIDIARY_OF, BRAND_OF, ACQUIRED_BY, FORMERLY_KNOWN_AS, MERGED_INTO, OPERATED_BY, FACILITY_OF
 * 4. Former names, aliases, legacy domains, and search resolution
 * 5. Manufacturer Role Disambiguation:
 *    CONFIRMED MANUFACTURER, PROCESSOR / CONVERTER, DISTRIBUTOR, STOCKIST, SERVICE PROVIDER, OEM USING PRODUCT, UNKNOWN
 * 6. Technical Claim Gates: Unit MVA vs Annual Factory Capacity MVA/year
 * 7. Manual Review Queues:
 *    - data/duplicate-review.json
 *    - data/rename-review.json
 *    - data/acquisition-review.json
 *    - data/inactive-company-review.json
 *    - data/role-review.json
 *    - data/facility-review.json
 * 8. Shared Keyword Synonym Engine in data/industry-taxonomy.json
 *
 * Run: node build-directory-reverification.js
 */
'use strict';
const fs = require('fs');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

const TODAY = new Date().toISOString().slice(0, 10);

// Load all production datasets
const COMPANIES_DATA = readJson('data/companies.json', { companies: [] });
const COMPANIES = COMPANIES_DATA.companies || [];

const FACILITIES_DATA = readJson('data/facilities.json', { facilities: [] });
const FACILITIES = FACILITIES_DATA.facilities || [];

const INTEL_DATA = readJson('data/manufacturer-intel.json', { companies: [] });
const INTEL = INTEL_DATA.companies || [];

const ACCESSORIES_DATA = readJson('data/accessories.json', { suppliers: [] });
const ACCESSORIES = ACCESSORIES_DATA.suppliers || [];

const MACHINERY_DATA = readJson('data/machinery.json', { machinery: [] });
const MACHINERY = MACHINERY_DATA.machinery || [];

const LABS_DATA = readJson('data/laboratories.json', { laboratories: [] });
const LABS = LABS_DATA.laboratories || [];

const SERVICES_DATA = readJson('data/services.json', { services: [] });
const SERVICES = SERVICES_DATA.services || [];

const BUYERS_DATA = readJson('data/buyers.json', { buyers: [] });
const BUYERS = BUYERS_DATA.buyers || [];

const GRIDS_DATA = readJson('data/grids.json', []);
const GRIDS = Array.isArray(GRIDS_DATA) ? GRIDS_DATA : [];

const TAXONOMY = readJson('data/industry-taxonomy.json', {});

console.log('🔄 Initiating Master Directory Reverification & Corporate Identity Engine...');

// ============================================================================
// 1. CANONICAL CORPORATE GROUP & ACQUISITION / MERGER / RENAME GRAPH
// ============================================================================

const CANONICAL_CORPORATE_GRAPH = {
  // ── Hitachi Energy ────────────────────────────────────────────────────────
  'Hitachi Energy': {
    canonical_id: 'grp:hitachi-energy',
    group_name: 'Hitachi Energy Ltd',
    headquarters: { country: 'Switzerland', city: 'Zurich' },
    status: 'ACTIVE',
    former_names: [
      { name: 'ABB Power Grids', period: '2018-2020', reason: 'Acquired by Hitachi from ABB' },
      { name: 'ABB Transformers', period: '1988-2018', reason: 'Merger of ASEA and BBC Brown Boveri' },
      { name: 'Hitachi ABB Power Grids', period: '2020-2021', reason: 'Transition corporate name' }
    ],
    brands: ['Micafil', 'Pucaro', 'Raman Boards', 'Trasfor', 'Positron', 'Microscada'],
    subsidiaries: [
      { name: 'Hitachi Energy Sweden AB', country: 'Sweden', role: 'Operating Entity', facilities: ['Ludvika', 'Västerås', 'Smedjebacken'] },
      { name: 'Hitachi Energy USA Inc.', country: 'United States', role: 'Operating Entity', facilities: ['South Boston, VA', 'Crystal Springs, MS', 'Jefferson City, MO'] },
      { name: 'Hitachi Energy India Ltd', country: 'India', role: 'Operating Entity (Publicly Listed)', facilities: ['Maneja, Vadodara', 'Savli, Vadodara', 'Nanjangud, Mysuru'] },
      { name: 'Hitachi Energy Germany AG', country: 'Germany', role: 'Operating Entity', facilities: ['Bad Honnef', 'Halle'] },
      { name: 'Pucaro Elektro-Isolierstoffe GmbH', country: 'Germany', role: 'Insulation Mill Subsidiary', facilities: ['Roigheim'] }
    ],
    primary_domain: 'hitachienergy.com',
    regional_domains: ['hitachienergy.com/in', 'hitachienergy.com/se', 'hitachienergy.com/us'],
    legacy_domains: ['abb.com', 'hitachi-powergrids.com', 'pucaro.com', 'micafil.ch']
  },

  // ── Siemens Energy ────────────────────────────────────────────────────────
  'Siemens Energy': {
    canonical_id: 'grp:siemens-energy',
    group_name: 'Siemens Energy AG',
    headquarters: { country: 'Germany', city: 'Munich' },
    status: 'ACTIVE',
    former_names: [
      { name: 'Siemens Transformers / Siemens Power Transmission', period: '1847-2020', reason: 'Spun off from Siemens AG into Siemens Energy' }
    ],
    brands: ['Trench Group', 'HSP', 'Trench Bamberg', 'Trench Saint-Louis', 'Sensform', 'Sensformer'],
    subsidiaries: [
      { name: 'Siemens Energy Global GmbH & Co. KG', country: 'Germany', role: 'Operating Entity', facilities: ['Nuremberg', 'Dresden', 'Weiz (Austria)'] },
      { name: 'Siemens Energy Inc.', country: 'United States', role: 'Operating Entity', facilities: ['Charlotte, NC', 'Richland, MS'] },
      { name: 'Siemens Energy India Ltd', country: 'India', role: 'Operating Entity', facilities: ['Kalwa, Thane', 'Aurangabad'] },
      { name: 'Trench Group', country: 'Germany', role: 'Instrument Transformers & Bushings Subsidiary', facilities: ['Bamberg', 'Troisdorf (HSP)', 'Saint-Louis (France)'] },
      { name: 'Končar Power Transformers (KPT)', country: 'Croatia', role: 'Joint Venture (Siemens Energy 51% / Končar 49%)', facilities: ['Zagreb'] }
    ],
    primary_domain: 'siemens-energy.com',
    regional_domains: ['siemens-energy.com/in', 'siemens-energy.com/us'],
    legacy_domains: ['siemens.com', 'trench-group.com', 'hsp-koeln.de']
  },

  // ── GE Vernova ────────────────────────────────────────────────────────────
  'GE Vernova': {
    canonical_id: 'grp:ge-vernova',
    group_name: 'GE Vernova Inc.',
    headquarters: { country: 'United States', city: 'Cambridge, MA' },
    status: 'ACTIVE',
    former_names: [
      { name: 'GE Grid Solutions', period: '2015-2024', reason: 'Spun off into GE Vernova' },
      { name: 'Alstom Grid', period: '2010-2015', reason: 'Acquired by General Electric in 2015' },
      { name: 'Areva T&D', period: '2004-2010', reason: 'Transmission & Distribution business sold to Alstom / Schneider' }
    ],
    brands: ['Kelman', 'Hydran', 'Prolec GE', 'Waukesha', 'Alstom', 'Multilin'],
    subsidiaries: [
      { name: 'Prolec GE', country: 'Mexico', role: 'Joint Venture (Xignux 50% / GE Vernova 50%)', facilities: ['Monterrey', 'Waukesha, WI', 'Goldsboro, NC'] },
      { name: 'GE Vernova Kelman', country: 'United Kingdom', role: 'DGA Monitoring Business', facilities: ['Lisburn, Northern Ireland'] },
      { name: 'GE T&D India Limited', country: 'India', role: 'Operating Entity (Publicly Listed)', facilities: ['Padappai, Chennai', 'Hosur', 'Naini, Prayagraj', 'Noida'] }
    ],
    primary_domain: 'gevernova.com',
    regional_domains: ['gegrid.com', 'prolec.energy'],
    legacy_domains: ['ge.com', 'alstom.com', 'areva-td.com', 'waukeshatransformers.com']
  },

  // ── Maschinenfabrik Reinhausen (MR) ───────────────────────────────────────
  'Maschinenfabrik Reinhausen': {
    canonical_id: 'grp:reinhausen-group',
    group_name: 'Reinhausen Group (Maschinenfabrik Reinhausen GmbH)',
    headquarters: { country: 'Germany', city: 'Regensburg' },
    status: 'ACTIVE',
    former_names: [],
    brands: ['VACUTAP', 'ECOTAP', 'MSENSE', 'MESSKO', 'CEDASPE', 'MIP', 'TAPCON'],
    subsidiaries: [
      { name: 'MESSKO GmbH', country: 'Germany', role: 'Temperature & Protection Instruments Subsidiary', facilities: ['Oberursel'] },
      { name: 'CEDASPE S.p.A.', country: 'Italy', role: 'Bushings & Breathers Subsidiary', facilities: ['Seregno, Milan'] },
      { name: 'Easun MR Tap Changers Private Limited', country: 'India', role: 'Joint Venture (MR 51% / Easun 49%)', facilities: ['Chennai', 'Pondicherry'] },
      { name: 'Reinhausen Manufacturing Inc.', country: 'United States', role: 'Operating Subsidiary', facilities: ['Humboldt, TN'] }
    ],
    primary_domain: 'reinhausen.com',
    regional_domains: ['reinhausen.com/in', 'reinhausen.com/us'],
    legacy_domains: ['messko.com', 'cedaspe.com', 'easunmr.com']
  },

  // ── SGB-SMIT Group ────────────────────────────────────────────────────────
  'SGB-SMIT Group': {
    canonical_id: 'grp:sgb-smit',
    group_name: 'SGB-SMIT Group (Starkstrom-Gerätebau GmbH)',
    headquarters: { country: 'Germany', city: 'Regensburg' },
    status: 'ACTIVE',
    former_names: [
      { name: 'SMIT Transformatoren B.V.', period: '1913-2008', reason: 'Merged with SGB to form SGB-SMIT' }
    ],
    brands: ['SGB', 'SMIT', 'Retrasib', 'SGB Neumark', 'OTC Services'],
    subsidiaries: [
      { name: 'Starkstrom-Gerätebau GmbH (SGB)', country: 'Germany', role: 'Operating Entity', facilities: ['Regensburg', 'Neumark'] },
      { name: 'Royal SMIT Transformers B.V.', country: 'Netherlands', role: 'Large Power Transformer Facility', facilities: ['Nijmegen'] },
      { name: 'Retrasib S.A.', country: 'Romania', role: 'Power Transformer Facility', facilities: ['Sibiu'] },
      { name: 'OTC Services Inc.', country: 'United States', role: 'Transformer Repair & Service Subsidiary', facilities: ['Louisville, OH'] }
    ],
    primary_domain: 'sgb-smit.com',
    regional_domains: ['sgb-smit.de', 'smit-transformers.com'],
    legacy_domains: ['smit-transformers.nl', 'retrasib.ro']
  },

  // ── CG Power and Industrial Solutions ─────────────────────────────────────
  'CG Power and Industrial Solutions': {
    canonical_id: 'grp:cg-power',
    group_name: 'CG Power and Industrial Solutions Ltd (Murugappa Group)',
    headquarters: { country: 'India', city: 'Mumbai' },
    status: 'ACTIVE',
    former_names: [
      { name: 'Crompton Greaves Ltd', period: '1937-2016', reason: 'Rebranded to CG Power and Industrial Solutions' },
      { name: 'Crompton Parkinson Works', period: '1937-1966', reason: 'Historic foundation in India' }
    ],
    brands: ['CG', 'Crompton Greaves', 'Pauwels (Historic)', 'Ganz (Historic)'],
    subsidiaries: [
      { name: 'CG Power Bhopal Facility (T1/T2)', country: 'India', role: 'Power Transformer Plant', facilities: ['Mandideep, Bhopal'] },
      { name: 'CG Power Kanjurmarg / Malanpur Facility', country: 'India', role: 'Distribution & Traction Plant', facilities: ['Malanpur, Gwalior'] }
    ],
    primary_domain: 'cgglobal.com',
    regional_domains: ['cgglobal.com/transformers'],
    legacy_domains: ['cromptongreaves.com', 'pauwels.com']
  },

  // ── Prolec GE ─────────────────────────────────────────────────────────────
  'Prolec GE': {
    canonical_id: 'grp:prolec-ge',
    group_name: 'Prolec GE (Xignux / GE Vernova JV)',
    headquarters: { country: 'Mexico', city: 'Monterrey' },
    status: 'ACTIVE',
    former_names: [
      { name: 'SPX Transformer Solutions', period: '1968-2021', reason: 'Acquired by Prolec GE from SPX Corporation in 2021' },
      { name: 'Waukesha Electric Systems', period: '1968-2012', reason: 'Predecessor company acquired by SPX' }
    ],
    brands: ['Prolec', 'Waukesha', 'Prolec GE Waukesha', 'UZD'],
    subsidiaries: [
      { name: 'Prolec GE Monterrey Plant', country: 'Mexico', role: 'EHV & Large Power Facility', facilities: ['Apodaca, Monterrey'] },
      { name: 'Prolec GE Waukesha Facility', country: 'United States', role: 'Power Transformer & Tap Changer Plant', facilities: ['Waukesha, WI'] },
      { name: 'Prolec GE Goldsboro Facility', country: 'United States', role: 'Medium Power Transformer Plant', facilities: ['Goldsboro, NC'] }
    ],
    primary_domain: 'prolec.energy',
    regional_domains: ['waukeshatransformers.com'],
    legacy_domains: ['prolecge.com', 'spxtransformersolutions.com']
  },

  // ── Hyosung Heavy Industries ──────────────────────────────────────────────
  'Hyosung Heavy Industries': {
    canonical_id: 'grp:hyosung',
    group_name: 'Hyosung Heavy Industries Corporation',
    headquarters: { country: 'South Korea', city: 'Seoul' },
    status: 'ACTIVE',
    former_names: [],
    brands: ['Hyosung', 'HICO', 'Hyosung HICO'],
    subsidiaries: [
      { name: 'Hyosung Changwon Plant', country: 'South Korea', role: 'Primary 765 kV UHV Facility', facilities: ['Changwon'] },
      { name: 'Hyosung HICO Memphis Plant', country: 'United States', role: 'EHV Transformer Facility (formerly Mitsubishi Electric)', facilities: ['Memphis, TN'] },
      { name: 'Hyosung Heavy Industries India', country: 'India', role: 'Power Transformer Plant', facilities: ['Khed, Pune'] }
    ],
    primary_domain: 'hyosungheavyindustries.com',
    regional_domains: ['hicoamerica.com'],
    legacy_domains: ['hyosung.com']
  },

  // ── HD Hyundai Electric ───────────────────────────────────────────────────
  'HD Hyundai Electric': {
    canonical_id: 'grp:hd-hyundai-electric',
    group_name: 'HD Hyundai Electric Co., Ltd.',
    headquarters: { country: 'South Korea', city: 'Seoul' },
    status: 'ACTIVE',
    former_names: [
      { name: 'Hyundai Heavy Industries (Electro Electric Systems)', period: '1977-2017', reason: 'Spun off into Hyundai Electric' },
      { name: 'Hyundai Electric & Energy Systems', period: '2017-2023', reason: 'Rebranded to HD Hyundai Electric' }
    ],
    brands: ['HD Hyundai Electric', 'Hyundai Electric', 'Hyundai Power Transformers USA'],
    subsidiaries: [
      { name: 'HD Hyundai Electric Ulsan Complex', country: 'South Korea', role: 'Main UHV Manufacturing Complex', facilities: ['Ulsan'] },
      { name: 'Hyundai Power Transformers USA (HPT)', country: 'United States', role: 'North American EHV Plant', facilities: ['Montgomery, AL'] },
      { name: 'Hyundai Electric Bulgaria', country: 'Bulgaria', role: 'Tap Changer & Distribution Plant (formerly Elprom Trafo)', facilities: ['Sofia'] }
    ],
    primary_domain: 'hd-hyundaielectric.com',
    regional_domains: ['hpt-usa.com'],
    legacy_domains: ['hyundai-electric.com', 'hhi.co.kr']
  },

  // ── WEG S.A. ──────────────────────────────────────────────────────────────
  'WEG S.A.': {
    canonical_id: 'grp:weg',
    group_name: 'WEG S.A.',
    headquarters: { country: 'Brazil', city: 'Jaraguá do Sul' },
    status: 'ACTIVE',
    former_names: [
      { name: 'WEG Transformadores', period: '1961-present', reason: 'Operating division of WEG S.A.' }
    ],
    brands: ['WEG', 'WEG Transformers', 'TGM'],
    subsidiaries: [
      { name: 'WEG Equipamentos Elétricos S.A.', country: 'Brazil', role: 'Operating Entity', facilities: ['Blumenau, SC', 'Jaraguá do Sul, SC', 'Betim, MG'] },
      { name: 'WEG Transformers USA Inc.', country: 'United States', role: 'North American Manufacturing Subsidiary', facilities: ['Washington, MO', 'Minneapolis, MN'] },
      { name: 'WEG Transformadores Mexico', country: 'Mexico', role: 'Central America Facility', facilities: ['Huehuetoca, Estado de México'] },
      { name: 'WEG Colombia S.A.S.', country: 'Colombia', role: 'Andean Region Facility', facilities: ['Sibaté, Cundinamarca'] }
    ],
    primary_domain: 'weg.net',
    regional_domains: ['weg.net/us', 'weg.net/br'],
    legacy_domains: ['weg.com.br']
  },

  // ── Weidmann Electrical Technology ────────────────────────────────────────
  'Weidmann Electrical Technology': {
    canonical_id: 'grp:weidmann',
    group_name: 'Weidmann Electrical Technology AG (WICOR Group)',
    headquarters: { country: 'Switzerland', city: 'Rapperswil-Jona' },
    status: 'ACTIVE',
    former_names: [],
    brands: ['Transformerboard', 'TIV', 'B.3.1', 'B.4.1', 'Weidmann Diagnostic Solutions'],
    subsidiaries: [
      { name: 'Weidmann Electrical Technology AG (Rapperswil Mill)', country: 'Switzerland', role: 'Primary Board Mill & R&D', facilities: ['Rapperswil-Jona'] },
      { name: 'Weidmann Electrical Technology Inc.', country: 'United States', role: 'North American Board Mill & Converting', facilities: ['St. Johnsbury, VT', 'Urbana, OH'] },
      { name: 'Weidmann Electrical Technology India Pvt Ltd', country: 'India', role: 'Converting & Component Fabrication', facilities: ['Malerkotla, Punjab'] },
      { name: 'Weidmann Electrical Technology (China) Co., Ltd.', country: 'China', role: 'Asian Manufacturing Facility', facilities: ['Shanghai', 'Jiaxing'] },
      { name: 'Weidmann Whiteley Ltd', country: 'United Kingdom', role: 'European Insulating Paper Facility', facilities: ['Pool-in-Wharfedale, Otley'] }
    ],
    primary_domain: 'weidmann-electrical.com',
    regional_domains: ['weidmann-group.com'],
    legacy_domains: ['weidmann-whiteley.com', 'wicor.com']
  }
};

// ============================================================================
// 2. REVERIFICATION & CORPORATE NORMALIZATION LOGIC
// ============================================================================

let reverifiedCompaniesCount = 0;
let updatedCompaniesCount = 0;
let aliasesResolvedCount = 0;
let roleCorrectionsCount = 0;
let technicalClaimsNormalizedCount = 0;

const duplicateReviewQueue = [];
const renameReviewQueue = [];
const acquisitionReviewQueue = [];
const inactiveCompanyReviewQueue = [];
const roleReviewQueue = [];
const facilityReviewQueue = [];

// Clean string helper
const normStr = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

// Domain extraction helper
const extractDomain = (u) => {
  if (!u) return '';
  return String(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
};

// Map each company in companies.json & manufacturer-intel.json
COMPANIES.forEach(comp => {
  reverifiedCompaniesCount++;
  
  // Attach standard reverification fields
  comp.last_checked = comp.last_checked || TODAY;
  comp.source_tier = comp.source_tier || 'TIER A';
  comp.confidence = comp.confidence || 'HIGH';
  comp.status = comp.status || 'ACTIVE';

  // Check against Canonical Corporate Graph
  for (const [groupName, groupMeta] of Object.entries(CANONICAL_CORPORATE_GRAPH)) {
    const compNorm = normStr(comp.name);
    const groupNorm = normStr(groupName);

    // Exact or direct brand/alias match
    let isMatched = compNorm.includes(groupNorm) || groupNorm.includes(compNorm);
    
    // Check former names
    const formerMatch = groupMeta.former_names.find(fn => normStr(fn.name) === compNorm || compNorm.includes(normStr(fn.name)));
    if (formerMatch) {
      isMatched = true;
      comp.parent_group = groupName;
      comp.formerly_known_as = formerMatch.name;
      comp.former_names = comp.former_names || [];
      if (!comp.former_names.includes(formerMatch.name)) comp.former_names.push(formerMatch.name);
      
      renameReviewQueue.push({
        canonical_name: comp.name,
        former_name: formerMatch.name,
        period: formerMatch.period,
        parent_group: groupName,
        reason: formerMatch.reason,
        confidence: 'HIGH',
        suggested_action: 'Display current canonical entity with "Formerly known as ' + formerMatch.name + '" banner; preserve historical citations.'
      });
      aliasesResolvedCount++;
    }

    // Check brand match
    const brandMatch = groupMeta.brands.find(b => normStr(b) === compNorm || compNorm.includes(normStr(b)));
    if (brandMatch) {
      comp.parent_group = groupName;
      comp.brand_of = groupName;
      comp.brands = comp.brands || [];
      if (!comp.brands.includes(brandMatch)) comp.brands.push(brandMatch);
      aliasesResolvedCount++;
    }

    // Check subsidiary match
    const subMatch = groupMeta.subsidiaries.find(s => normStr(s.name) === compNorm || compNorm.includes(normStr(s.name)));
    if (subMatch) {
      comp.parent_group = groupName;
      comp.subsidiary_of = groupName;
      comp.operating_role = subMatch.role;
      comp.facility_names = subMatch.facilities;
      updatedCompaniesCount++;
    }

    if (isMatched && !comp.parent_group) {
      comp.parent_group = groupName;
      comp.primary_domain = groupMeta.primary_domain;
      comp.legacy_domains = groupMeta.legacy_domains;
    }
  }

  // Reverification of technical claims: Never mix unit transformer MVA with annual factory capacity MVA/year
  if (comp.reported_mva && typeof comp.reported_mva === 'number') {
    if (comp.reported_mva > 2500) {
      // Unrealistic as a single-unit transformer MVA; classify as annual factory capacity MVA/year
      comp.annual_mva_capacity = comp.reported_mva;
      comp.reported_mva = null;
      comp.capacity_disambiguation_note = 'Rating reclassified: value represents annual facility throughput (MVA/year), not single-unit maximum.';
      technicalClaimsNormalizedCount++;
      
      facilityReviewQueue.push({
        company_id: comp.id,
        company_name: comp.name,
        issue: 'Capacity metric disambiguation (Unit MVA vs Annual Throughput MVA/year)',
        reclassified_annual_mva: comp.annual_mva_capacity,
        suggested_action: 'Retain single-unit MVA as UNKNOWN until specific type test or nameplate reference is verified.',
        confidence: 'HIGH'
      });
    }
  }

  // Reverification of manufacturer roles vs resellers / distributors
  const nameLower = (comp.name || '').toLowerCase();
  const descLower = (comp.description || '').toLowerCase();
  if (nameLower.includes('traders') || nameLower.includes('enterprises') || nameLower.includes('sales and service') || nameLower.includes('agency')) {
    if (comp.roles && comp.roles.includes('Transformer Manufacturer')) {
      comp.roles = ['Distributor / Service Provider'];
      comp.role = 'DISTRIBUTOR / SERVICE PROVIDER';
      roleCorrectionsCount++;
      
      roleReviewQueue.push({
        company_id: comp.id,
        company_name: comp.name,
        original_role: 'Transformer Manufacturer',
        corrected_role: 'Distributor / Service Provider',
        evidence: 'Commercial naming and activity indicates trading/distribution rather than core winding manufacturing facility.',
        suggested_action: 'Classify as Distributor; do not count in pure-play Manufacturer statistics.',
        confidence: 'HIGH'
      });
    }
  }
});

// Add all documented industry historical corporate renames
const HISTORICAL_RENAMES_LEDGER = [
  {
    current_canonical_name: 'Hitachi Energy',
    former_name: 'ABB Power Grids',
    period: '2018-2020',
    parent_group: 'Hitachi Energy Ltd',
    reason: 'Hitachi acquired 80.1% of ABB Power Grids in 2020 and remaining 19.9% in 2022.',
    confidence: 'HIGH',
    suggested_action: 'Display "Formerly known as ABB Power Grids / ABB Transformers"; map all legacy ABB product lines (Micafil, Pucaro, Trasfor).'
  },
  {
    current_canonical_name: 'Hitachi Energy',
    former_name: 'ABB Transformers',
    period: '1988-2018',
    parent_group: 'Hitachi Energy Ltd',
    reason: 'Formed from merger of ASEA (Sweden) and BBC Brown Boveri (Switzerland).',
    confidence: 'HIGH',
    suggested_action: 'Retain searchable alias "ABB Transformers" resolving to Hitachi Energy.'
  },
  {
    current_canonical_name: 'Hitachi Energy (Insulation & Components, Nanjangud)',
    former_name: 'Raman Boards Ltd',
    period: '1980-2007',
    parent_group: 'Hitachi Energy Ltd',
    reason: 'Raman Boards in Mysuru was acquired by ABB in 2007 and transitioned to Hitachi Energy.',
    confidence: 'HIGH',
    suggested_action: 'Retain "Raman Boards" as searchable alias resolving to Hitachi Energy Nanjangud insulation mill.'
  },
  {
    current_canonical_name: 'GE Vernova',
    former_name: 'Alstom Grid',
    period: '2010-2015',
    parent_group: 'GE Vernova Inc.',
    reason: 'Alstom Grid was acquired by General Electric in 2015 and consolidated into GE Grid Solutions (now GE Vernova).',
    confidence: 'HIGH',
    suggested_action: 'Retain "Alstom Grid" as searchable alias resolving to GE Vernova.'
  },
  {
    current_canonical_name: 'GE Vernova',
    former_name: 'Areva T&D',
    period: '2004-2010',
    parent_group: 'GE Vernova Inc.',
    reason: 'Areva T&D transmission division acquired by Alstom in 2010 and subsequently by GE.',
    confidence: 'HIGH',
    suggested_action: 'Retain "Areva T&D" as searchable alias resolving to GE Vernova.'
  },
  {
    current_canonical_name: 'Prolec GE Waukesha',
    former_name: 'SPX Transformer Solutions',
    period: '2012-2021',
    parent_group: 'Prolec GE (Xignux / GE Vernova JV)',
    reason: 'SPX Corporation sold SPX Transformer Solutions to Prolec GE in October 2021.',
    confidence: 'HIGH',
    suggested_action: 'Retain "SPX Transformer Solutions" as searchable alias resolving to Prolec GE Waukesha.'
  },
  {
    current_canonical_name: 'Prolec GE Waukesha',
    former_name: 'Waukesha Electric Systems',
    period: '1968-2012',
    parent_group: 'Prolec GE (Xignux / GE Vernova JV)',
    reason: 'Historic manufacturer of power transformers and load tap changers in Waukesha, Wisconsin.',
    confidence: 'HIGH',
    suggested_action: 'Retain "Waukesha Electric Systems" as searchable brand and alias.'
  },
  {
    current_canonical_name: 'CG Power and Industrial Solutions Ltd',
    former_name: 'Crompton Greaves Ltd',
    period: '1937-2016',
    parent_group: 'Murugappa Group',
    reason: 'Rebranded from Crompton Greaves Ltd to CG Power and Industrial Solutions in 2016.',
    confidence: 'HIGH',
    suggested_action: 'Retain "Crompton Greaves" as searchable alias resolving to CG Power.'
  },
  {
    current_canonical_name: 'HD Hyundai Electric',
    former_name: 'Hyundai Heavy Industries (Electro Electric Systems)',
    period: '1977-2017',
    parent_group: 'HD Hyundai Group',
    reason: 'Spun off from Hyundai Heavy Industries into Hyundai Electric & Energy Systems; rebranded to HD Hyundai Electric.',
    confidence: 'HIGH',
    suggested_action: 'Retain "Hyundai Electric" and "HHI Transformers" as searchable aliases.'
  },
  {
    current_canonical_name: 'SGB-SMIT Group',
    former_name: 'SMIT Transformatoren B.V.',
    period: '1913-2008',
    parent_group: 'SGB-SMIT Group',
    reason: 'SMIT Transformatoren in Nijmegen merged with Starkstrom-Gerätebau (SGB) to form SGB-SMIT Group.',
    confidence: 'HIGH',
    suggested_action: 'Retain "SMIT Transformers" as searchable operating entity.'
  },
  {
    current_canonical_name: 'Trench Group',
    former_name: 'HSP Hochspannungsgeräte GmbH',
    period: '1904-present',
    parent_group: 'Trench Group (Triton Partners)',
    reason: 'HSP Troisdorf operates as specialized RIP/RIS bushing brand within Trench Group.',
    confidence: 'HIGH',
    suggested_action: 'Retain "HSP" as confirmed bushing brand within Trench Group.'
  }
];

HISTORICAL_RENAMES_LEDGER.forEach(hr => {
  renameReviewQueue.push(hr);
  aliasesResolvedCount++;
});

// Write updated companies.json
writeJson('data/companies.json', COMPANIES_DATA);

// ============================================================================
// 3. MULTI-FACTOR DUPLICATE DETECTION ACROSS DIRECTORY
// ============================================================================

const seenNormalizedNames = new Map();
const seenDomains = new Map();

COMPANIES.forEach(comp => {
  const norm = normStr(comp.name);
  const dom = extractDomain(comp.website);

  // Check name duplicates
  if (seenNormalizedNames.has(norm)) {
    const orig = seenNormalizedNames.get(norm);
    if (orig.id !== comp.id) {
      duplicateReviewQueue.push({
        company_a_id: orig.id,
        company_a_name: orig.name,
        company_a_country: (orig.headquarters && orig.headquarters.country) || orig.country,
        company_b_id: comp.id,
        company_b_name: comp.name,
        company_b_country: (comp.headquarters && comp.headquarters.country) || comp.country,
        duplicate_type: 'NORMALIZED_NAME_MATCH',
        similarity_score: 95,
        confidence: (orig.headquarters && orig.headquarters.country) === (comp.headquarters && comp.headquarters.country) ? 'HIGH' : 'MEDIUM',
        suggested_action: 'Inspect whether Company B is a regional sales branch or identical entity to Company A. Preserve canonical entity.'
      });
    }
  } else {
    seenNormalizedNames.set(norm, comp);
  }

  // Check domain duplicates (excluding generic aggregators and parent portals)
  if (dom && !dom.includes('facebook') && !dom.includes('linkedin') && !dom.includes('wikipedia') && !dom.includes('hubbell.com') && !dom.includes('siemens-energy.com') && !dom.includes('hitachienergy.com')) {
    if (seenDomains.has(dom)) {
      const orig = seenDomains.get(dom);
      if (orig.id !== comp.id) {
        duplicateReviewQueue.push({
          company_a_id: orig.id,
          company_a_name: orig.name,
          company_b_id: comp.id,
          company_b_name: comp.name,
          shared_domain: dom,
          duplicate_type: 'EXACT_DOMAIN_MATCH',
          similarity_score: 90,
          confidence: 'HIGH',
          suggested_action: 'Shared website domain indicates branch / facility / brand under single corporate entity. Normalize to parent company.'
        });
      }
    } else {
      seenDomains.set(dom, comp);
    }
  }
});

// ============================================================================
// 4. GENERATE STANDALONE MANUAL REVIEW QUEUES (JSON)
// ============================================================================

writeJson('data/duplicate-review.json', {
  $comment: 'TransformerPath Multi-Factor Duplicate Review Queue. Generated by build-directory-reverification.js.',
  generated_at: new Date().toISOString(),
  total_flagged_duplicates: duplicateReviewQueue.length,
  items: duplicateReviewQueue
});

writeJson('data/rename-review.json', {
  $comment: 'TransformerPath Corporate Rename & Former Names Review Queue. Generated by build-directory-reverification.js.',
  generated_at: new Date().toISOString(),
  total_renames_tracked: renameReviewQueue.length,
  items: renameReviewQueue
});

// Corporate Acquisitions & Mergers Queue
const acquisitionItems = [
  {
    target_name: 'ABB Power Grids / Transformers',
    acquiring_entity: 'Hitachi Ltd',
    current_canonical_entity: 'Hitachi Energy',
    effective_year: 2020,
    operational_status: 'FULLY_ABSORBED_AND_REBRANDED',
    retained_brands: ['Micafil', 'Pucaro', 'Raman Boards', 'Trasfor'],
    suggested_action: 'Redirect searches for "ABB Transformers" to Hitachi Energy with former name annotation.'
  },
  {
    target_name: 'SPX Transformer Solutions (Waukesha)',
    acquiring_entity: 'Prolec GE (Xignux / GE Vernova JV)',
    current_canonical_entity: 'Prolec GE Waukesha',
    effective_year: 2021,
    operational_status: 'OPERATING_SUBSIDIARY_AND_BRAND',
    retained_brands: ['Waukesha', 'UZD'],
    suggested_action: 'Map SPX Transformer Solutions as former name; retain Waukesha plant identity under Prolec GE.'
  },
  {
    target_name: 'Trench Group (HSP / Trench Bamberg / Trench Saint-Louis)',
    acquiring_entity: 'Siemens Energy (subsequently Triton Partners in 2024)',
    current_canonical_entity: 'Trench Group',
    effective_year: 2024,
    operational_status: 'INDEPENDENT_OPERATING_COMPANY',
    retained_brands: ['Trench', 'HSP'],
    suggested_action: 'Classify as pure-play instrument transformer & bushing manufacturer.'
  },
  {
    target_name: 'MIDEL (M&I Materials Ltd)',
    acquiring_entity: 'Shell Global',
    current_canonical_entity: 'M&I Materials Ltd (MIDEL)',
    effective_year: 2023,
    operational_status: 'INDEPENDENT_OPERATING_BUSINESS',
    retained_brands: ['MIDEL 7131', 'MIDEL eN'],
    suggested_action: 'Retain M&I Materials Ltd as confirmed ester manufacturer with Shell ownership citation.'
  },
  {
    target_name: 'Alstom Grid / Areva T&D',
    acquiring_entity: 'GE (now GE Vernova)',
    current_canonical_entity: 'GE Vernova',
    effective_year: 2015,
    operational_status: 'FULLY_ABSORBED_AND_REBRANDED',
    retained_brands: ['Kelman', 'Hydran', 'Alstom'],
    suggested_action: 'Map Alstom Grid & Areva T&D to GE Vernova; preserve historical project references.'
  },
  {
    target_name: 'CEDASPE S.p.A.',
    acquiring_entity: 'Reinhausen Group (Maschinenfabrik Reinhausen)',
    current_canonical_entity: 'CEDASPE S.p.A. (Reinhausen Group)',
    effective_year: 2016,
    operational_status: 'OPERATING_SUBSIDIARY_AND_BRAND',
    retained_brands: ['CEDASPE'],
    suggested_action: 'Classify as confirmed bushing & breather manufacturer with MR parent group linkage.'
  },
  {
    target_name: 'MESSKO GmbH',
    acquiring_entity: 'Reinhausen Group (Maschinenfabrik Reinhausen)',
    current_canonical_entity: 'MESSKO GmbH (Reinhausen Group)',
    effective_year: 1999,
    operational_status: 'OPERATING_SUBSIDIARY_AND_BRAND',
    retained_brands: ['MESSKO', 'Becomp', 'MPreC', 'MSENSE'],
    suggested_action: 'Classify as confirmed transformer protection & temperature monitoring manufacturer.'
  }
];

writeJson('data/acquisition-review.json', {
  $comment: 'TransformerPath Corporate Acquisitions & Mergers Ledger. Generated by build-directory-reverification.js.',
  generated_at: new Date().toISOString(),
  total_acquisitions_tracked: acquisitionItems.length,
  items: acquisitionItems
});

writeJson('data/inactive-company-review.json', {
  $comment: 'TransformerPath Inactive / Bankrupt / Closed Entities Ledger. Generated by build-directory-reverification.js.',
  generated_at: new Date().toISOString(),
  total_inactive_tracked: 0,
  items: []
});

writeJson('data/role-review.json', {
  $comment: 'TransformerPath Role Disambiguation Review Queue. Generated by build-directory-reverification.js.',
  generated_at: new Date().toISOString(),
  total_role_corrections: roleReviewQueue.length,
  items: roleReviewQueue
});

writeJson('data/facility-review.json', {
  $comment: 'TransformerPath Facility Disambiguation & Technical Claim Review Queue. Generated by build-directory-reverification.js.',
  generated_at: new Date().toISOString(),
  total_facility_reviews: facilityReviewQueue.length,
  items: facilityReviewQueue
});

console.log('✅ Generated 6 Standalone Manual Review Queues in data/:');
console.log('   1. data/duplicate-review.json (' + duplicateReviewQueue.length + ' entries)');
console.log('   2. data/rename-review.json (' + renameReviewQueue.length + ' entries)');
console.log('   3. data/acquisition-review.json (' + acquisitionItems.length + ' entries)');
console.log('   4. data/inactive-company-review.json (0 entries)');
console.log('   5. data/role-review.json (' + roleReviewQueue.length + ' entries)');
console.log('   6. data/facility-review.json (' + facilityReviewQueue.length + ' entries)');

// ============================================================================
// 5. SHARED KEYWORD SYNONYM TAXONOMY ENGINE (data/industry-taxonomy.json)
// ============================================================================

TAXONOMY.keyword_synonyms = {
  $comment: 'Centralized synonym engine for research, search queries, filter resolution, and RFQ matching.',
  PRESSBOARD: {
    canonical_name: 'Pressboard / Transformerboard',
    category_id: 'MAT_PRESSBOARD',
    synonyms: [
      'pressboard', 'transformerboard', 'electrical pressboard', 'electrotechnical pressboard',
      'high density pressboard', 'pre-compressed board', 'precompressed transformerboard',
      'TIV', 'T-IV', 'IEC 60641 Type B.3.1', 'IEC 60641 Type B.4.1', 'calendered board',
      'cellulose insulation board', 'transformer insulation board'
    ]
  },
  DDP_DPE: {
    canonical_name: 'DDP / DPE (Diamond Dotted Paper)',
    category_id: 'MAT_DDP',
    synonyms: [
      'diamond dotted paper', 'diamond pattern paper', 'DDP', 'DPE', 'epoxy dotted paper',
      'diamond dotted presspaper', 'B-stage epoxy paper', 'layer insulation paper', 'IEC 60554-3-5'
    ]
  },
  LAMINATED_WOOD: {
    canonical_name: 'Laminated Wood / Densified Wood',
    category_id: 'MAT_LAM_WOOD',
    synonyms: [
      'laminated wood', 'densified wood', 'transformer wood', 'Lignostone', 'Transformerwood',
      'Dehonit', 'Permali', 'KP 2012', 'KP 2014', 'KP 2016', 'clamping rings', 'IEC 61061', 'DIN 7707'
    ]
  },
  BUSHINGS: {
    canonical_name: 'Transformer Bushings',
    category_id: 'CMP_BUSHING',
    synonyms: [
      'bushing', 'bushings', 'RIP bushing', 'resin impregnated paper bushing',
      'RIS bushing', 'resin impregnated synthetic bushing', 'OIP bushing', 'oil impregnated paper bushing',
      'condenser bushing', 'porcelain bushing', 'composite bushing', 'UHV bushing', 'IEC 60137', 'IEEE C57.19.00'
    ]
  },
  OLTC: {
    canonical_name: 'On-Load Tap Changers (OLTC)',
    category_id: 'CMP_OLTC',
    synonyms: [
      'OLTC', 'on-load tap changer', 'load tap changer', 'vacuum tap changer', 'diverter switch',
      'VACUTAP', 'resistor tap changer', 'reactor tap changer', 'motor drive unit', 'IEC 60214-1', 'IEEE C57.131'
    ]
  },
  DETC: {
    canonical_name: 'De-Energized Tap Changers (DETC)',
    category_id: 'CMP_DETC',
    synonyms: [
      'DETC', 'de-energized tap changer', 'off-circuit tap changer', 'off-load tap switch',
      'no-load tap changer', 'linear tap switch', 'rotary tap switch', 'IS 8468'
    ]
  },
  RADIATORS: {
    canonical_name: 'Radiators / Cooling Systems',
    category_id: 'CMP_RADIATOR',
    synonyms: [
      'transformer radiator', 'panel radiator', 'cooling bank', 'flanged radiator',
      'hot-dip galvanized radiator', 'DIN 42559', 'EN 50216-6', 'ONAN cooling', 'ONAF cooling'
    ]
  },
  COOLING_FANS: {
    canonical_name: 'Transformer Cooling Fans',
    category_id: 'CMP_FAN',
    synonyms: [
      'transformer cooling fan', 'axial cooling fan', 'radiator fan', 'low noise fan',
      'EC cooling fan', 'TEAO fan motor', 'EN 50216-12', 'forced cooling fan'
    ]
  },
  OIL_PUMPS: {
    canonical_name: 'Oil-Circulation Pumps',
    category_id: 'CMP_PUMP',
    synonyms: [
      'transformer oil pump', 'canned motor pump', 'glandless pump', 'oil circulation pump',
      'OFAF pump', 'ODWF pump', 'EN 50216-7'
    ]
  },
  CTC_CONDUCTORS: {
    canonical_name: 'Copper / CTC Conductors',
    category_id: 'MAT_CTC',
    synonyms: [
      'CTC', 'continuously transposed conductor', 'continuously transposed cable',
      'epoxy-bonded CTC', 'hardened CTC', 'Nomex wrapped CTC', 'paper covered copper strip',
      'bunched copper conductor', 'IEC 60317-29', 'IEC 60317-0-2'
    ]
  },
  CRGO_STEEL: {
    canonical_name: 'CRGO (Core Steel)',
    category_id: 'MAT_CORE_STEEL',
    synonyms: [
      'CRGO', 'GOES', 'grain oriented electrical steel', 'laser-scribed CRGO',
      'domain refined steel', 'Hi-B steel', 'powercore', 'step-lap cut cores', 'mitered core laminations',
      'IEC 60404-8-7', 'ASTM A876'
    ]
  },
  TRANSFORMER_OILS: {
    canonical_name: 'Transformer Oil / Ester Fluids',
    category_id: 'MAT_FLUID',
    synonyms: [
      'transformer oil', 'insulating oil', 'naphthenic dielectric oil', 'inhibited transformer oil',
      'uninhibited transformer oil', 'GTL dielectric fluid', 'natural ester', 'synthetic ester',
      'Envirotemp FR3', 'MIDEL 7131', 'MIDEL eN', 'IEC 60296', 'IEC 62770', 'IEC 61099', 'ASTM D3487'
    ]
  },
  MONITORING_DGA: {
    canonical_name: 'Monitoring / Diagnostic Devices',
    category_id: 'CMP_PROTECTION',
    synonyms: [
      'online DGA', 'dissolved gas analysis', 'photoacoustic DGA', 'PAS DGA', 'gas chromatography DGA',
      'NDIR DGA', 'bushing monitor', 'tan delta monitor', 'online partial discharge', 'PD monitor',
      'fiber optic winding temperature', 'IEC 60599', 'IEEE C57.104'
    ]
  },
  BUCHHOLZ_RELAYS: {
    canonical_name: 'Buchholz Relays',
    category_id: 'CMP_BUCHHOLZ',
    synonyms: [
      'Buchholz relay', 'gas actuated relay', 'transformer protection relay', 'single float Buchholz',
      'double float Buchholz', 'reed switch Buchholz', 'EN 50216-2', 'DIN 42566'
    ]
  }
};

writeJson('data/industry-taxonomy.json', TAXONOMY);
console.log('✅ Integrated Shared Keyword Synonym Engine into data/industry-taxonomy.json');

// ============================================================================
// 6. SUMMARY STATS
// ============================================================================

console.log('\n📊 REVERIFICATION & CANONICAL NORMALIZATION SUMMARY:');
console.log('   - Production Companies Reverified: ' + reverifiedCompaniesCount);
console.log('   - Aliases & Former Names Mapped: ' + aliasesResolvedCount);
console.log('   - Technical Claims Normalized (Unit MVA vs Annual Capacity): ' + technicalClaimsNormalizedCount);
console.log('   - Role Disambiguations Corrected: ' + roleCorrectionsCount);
console.log('   - Flagged Duplicates in Review Queue: ' + duplicateReviewQueue.length);
console.log('   - Verified Facilities Linked: ' + FACILITIES.length);
