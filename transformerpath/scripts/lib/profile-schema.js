/**
 * Directory depth standard, weighted completeness score, and priority tiers.
 *
 * Implements the "minimum useful record standard" (sprint §1), the weighted
 * completeness score (§2) and priority classification (§3). Pure computation —
 * it never invents data. Every field is scored by evidence STATE:
 *
 *   UNKNOWN  (0.00) — no value
 *   DECLARED (0.35) — value present in directory data but without provenance
 *   SOURCED  (1.00) — value present AND backed by a source in the evidence
 *                     overlay (data/profile-evidence.json)
 *
 * So a record that is only "name + country + website" scores as a STUB, and a
 * record only climbs when real, sourced depth is added.
 */
'use strict';

const DECLARED = 0.35;
const SOURCED = 1.0;

// §2 weighting — trivial fields are NOT equally weighted.
const WEIGHTS = {
  identity: 10,
  facilities: 20,
  products: 15,
  technical: 20,
  standards: 10,
  markets: 5,
  evidence: 15,
  commercial: 5
};

const BANDS = [
  { min: 90, band: 'COMPREHENSIVE' },
  { min: 75, band: 'STRONG' },
  { min: 50, band: 'DEVELOPED' },
  { min: 25, band: 'BASIC' },
  { min: 0, band: 'STUB' }
];

const PRIORITY_MARKETS = [
  'India', 'China', 'USA', 'United States', 'Saudi Arabia', 'UAE',
  'United Arab Emirates', 'Oman', 'Türkiye', 'Turkey', 'Germany', 'Italy',
  'France', 'UK', 'United Kingdom', 'Brazil', 'Mexico', 'Indonesia', 'Vietnam',
  'Malaysia', 'South Korea', 'Japan', 'Australia', 'South Africa', 'Egypt'
];

function slugId(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function has(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim().length > 0;
}

/** state for a field given a declared value and whether the overlay sources it */
function state(declaredPresent, sourced) {
  if (sourced) return SOURCED;
  if (declaredPresent) return DECLARED;
  return 0;
}

function avg(states) {
  if (states.length === 0) return 0;
  return states.reduce((a, b) => a + b, 0) / states.length;
}

/**
 * Normalize a raw record (manufacturer listing OR OEM profile) into the schema.
 * evidence: optional entry from data/profile-evidence.json for this id.
 */
function normalize(raw, evidence) {
  const ev = evidence || {};
  const evSourced = (key) => Boolean(ev[key] && ev[key].source && ev[key].source_tier);

  const confirmedFacilities = Array.isArray(ev.facilities)
    ? ev.facilities.filter((f) => f && f.source && f.parent_company_id)
    : [];

  return {
    id: raw.id || slugId(raw.displayName || raw.name),
    name: raw.displayName || raw.name,
    source: raw.source,
    // declared values (no provenance implied)
    declared: {
      name: has(raw.name),
      website: has(raw.url) || has(raw.website),
      hqCountry: has(raw.country),
      parentGroup: has(raw.parentGroup),
      established: has(raw.established),
      aliases: has(raw.aliases),
      transformerTypes: has(raw.transformerTypes) || has(raw.capabilities),
      components: has(raw.componentCategories),
      materials: has(raw.materials),
      machinery: has(raw.machinery),
      services: has(raw.services),
      voltage: has(raw.highestSourcedVoltageEvidence) || has(raw.kvRange),
      unitRating: has(raw.highestSourcedUnitRatingMva),
      standards: has(raw.certifications) || has(raw.standards),
      testCapability: has(raw.testCapabilities),
      specialApps: has(raw.specialApplications),
      markets: has(raw.utilityApprovals) || has(raw.marketsServed) || has(raw.region),
      declaredPlants: Array.isArray(raw.plants) ? raw.plants.length : 0
    },
    confirmedFacilities,
    evidence: ev,
    evSourced
  };
}

function scoreGroups(n) {
  const d = n.declared;
  const s = n.evSourced;

  const identity = avg([
    state(d.name, s('name')),
    state(d.website, s('website')),
    state(d.hqCountry, s('hqCountry')),
    state(d.parentGroup, s('parentGroup')),
    state(d.established, s('established')),
    state(d.aliases, false)
  ]);

  // §1/§24: only evidence-backed confirmed facilities count. Declared plant
  // cities are NOT treated as confirmed facilities.
  const facilities = n.confirmedFacilities.length > 0 ? SOURCED : 0;

  const products = avg([
    state(d.transformerTypes, s('transformerTypes')),
    state(d.components, false),
    state(d.materials, false),
    state(d.machinery, false),
    state(d.services, false)
  ]);

  const technical = avg([
    state(d.voltage, s('highest_sourced_voltage')),
    state(d.unitRating, s('highest_sourced_unit_rating')),
    state(d.standards, s('standards')),
    state(d.testCapability, s('test_capability')),
    state(d.specialApps, false)
  ]);

  const standards = state(d.standards, s('standards'));
  const markets = state(d.markets, s('markets'));

  // §14 primary-source evidence: proportion of key facts that are sourced.
  const evidenceKeys = ['highest_sourced_voltage', 'highest_sourced_unit_rating', 'standards', 'markets', 'name', 'website'];
  const evidence = avg(evidenceKeys.map((k) => (s(k) ? 1 : 0)));

  const commercial = avg([
    n.evidence.claim_status ? 1 : 0,
    n.evidence.verified_status ? 1 : 0,
    n.evidence.rfq_eligible ? 1 : 0,
    n.evidence.supplier_pro ? 1 : 0
  ]);

  return { identity, facilities, products, technical, standards, markets, evidence, commercial };
}

function completeness(raw, evidence) {
  const n = normalize(raw, evidence);
  const g = scoreGroups(n);
  let score = 0;
  const breakdown = {};
  for (const key of Object.keys(WEIGHTS)) {
    const pts = g[key] * WEIGHTS[key];
    breakdown[key] = Math.round(pts * 10) / 10;
    score += pts;
  }
  score = Math.round(score);
  const band = BANDS.find((b) => score >= b.min).band;
  return { id: n.id, name: n.name, score, band, breakdown, confirmedFacilities: n.confirmedFacilities.length };
}

/** §3 priority tier. Returns { tier, target, reasons[] } */
function priorityTier(raw, evidence) {
  const reasons = [];
  const ev = evidence || {};
  const voltage = String(raw.highestSourcedVoltageEvidence || raw.kvRange || '');
  const isProfile = raw.source && raw.source.includes('directory-profiles');
  const highVoltage = /\b(765|800|1100|1200)\b/.test(voltage) || /\b400\b/.test(voltage);

  if (isProfile) reasons.push('major-OEM-profile');
  if (highVoltage) reasons.push('765/400kV-capability');
  if (ev.verified_status || ev.claim_status) reasons.push('claimed/verified');
  if (ev.rfq_eligible) reasons.push('rfq-active');
  if ((ev.projects || []).length || (ev.tenders || []).length) reasons.push('project/tender-linked');

  if (reasons.length > 0) return { tier: 'A', target: 85, reasons };

  const country = raw.country || '';
  if (PRIORITY_MARKETS.includes(country)) {
    return { tier: 'B', target: 70, reasons: ['priority-market:' + country] };
  }
  return { tier: 'C', target: 50, reasons: ['long-tail'] };
}

module.exports = {
  WEIGHTS,
  BANDS,
  PRIORITY_MARKETS,
  DECLARED,
  SOURCED,
  slugId,
  normalize,
  completeness,
  priorityTier
};
