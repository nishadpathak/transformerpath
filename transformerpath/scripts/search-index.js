#!/usr/bin/env node
/**
 * Canonical search index (P0.7 core, Node-side).
 *
 * Builds a searchable index from the SAME canonical data model the rest of the
 * platform uses, groups results by entity type, and scores by how many query
 * tokens match. It never fabricates results: a query that matches nothing
 * returns an empty group, and zero-result queries can be recorded to the
 * internal research-demand queue (P0.8).
 *
 * Deliberate trust rules baked in:
 *  - Company results expose "highestSourcedVoltageEvidence" (a sourced kV range)
 *    and NEVER an annual-capacity MVA number on the same line (P0.6).
 *  - verificationStatus is only ever LISTED here (public-source records); it is
 *    never silently upgraded to VERIFIED / SUPPLIER PRO (P0.3/P0.4).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const isServedBy = (m) => /^Served by/i.test((m && m[0]) || '');
const clean = (s) => String(s || '').trim();

const SYNONYMS = {
  transformerboard: ['pressboard', 'transformerboard', 'insulation board'],
  pressboard: ['pressboard', 'transformerboard'],
  oltc: ['oltc', 'on-load tap-changer', 'tap changer', 'tap-changer'],
  detc: ['detc', 'de-energized tap changer', 'off-circuit tap'],
  ct: ['current transformer'],
  crgo: ['crgo', 'core steel', 'grain oriented'],
  ctc: ['ctc', 'continuously transposed conductor', 'transposed conductor'],
  rip: ['rip', 'resin impregnated', 'resin-impregnated'],
  rbp: ['rbp', 'resin bonded paper'],
  vpd: ['vpd', 'vacuum pressure drying', 'vapour phase'],
  radiator: ['radiator', 'cooling', 'cooler'],
  bushing: ['bushing', 'bushings'],
  winding: ['winding', 'winding machine'],
  repair: ['repair', 'service', 'reconditioning', 'rewinding'],
  laboratory: ['laboratory', 'lab', 'testing', 'test lab']
};

// Intent keywords → the entity type a query is really asking for.
const INTENT_TERMS = {
  laboratory: 'utility_or_lab',
  lab: 'utility_or_lab',
  repair: 'service',
  service: 'service',
  machine: 'machinery',
  machinery: 'machinery',
  equipment: 'machinery',
  line: 'machinery',
  supplier: 'company_or_component',
  manufacturer: 'company',
  maker: 'company'
};

const KNOWN_LOCATIONS = [
  'india', 'china', 'usa', 'united states', 'saudi', 'arabia', 'uae', 'emirates',
  'oman', 'turkey', 'türkiye', 'germany', 'italy', 'france', 'uk', 'britain',
  'brazil', 'mexico', 'indonesia', 'vietnam', 'malaysia', 'korea', 'japan',
  'australia', 'africa', 'egypt', 'europe', 'asia', 'gulf', 'americas'
];

// Canonical product/material/component/machinery lexicon. A query term only
// counts as a category if it appears here; a record only "matches" a category
// if its own content references it — location alone never establishes a match.
const CATEGORY_LEXICON = [
  { surfaces: ['transformerboard', 'pressboard'], canonical: 'transformerboard-pressboard', kind: 'material' },
  { surfaces: ['ddp'], canonical: 'ddp', kind: 'material' },
  { surfaces: ['dpe'], canonical: 'dpe', kind: 'material' },
  { surfaces: ['crepe'], canonical: 'crepe-paper', kind: 'material' },
  { surfaces: ['ctc', 'continuously transposed'], canonical: 'ctc', kind: 'material' },
  { surfaces: ['crgo', 'core steel', 'grain oriented'], canonical: 'crgo', kind: 'material' },
  { surfaces: ['amorphous'], canonical: 'amorphous-metal', kind: 'material' },
  { surfaces: ['kraft'], canonical: 'kraft-paper', kind: 'material' },
  { surfaces: ['aramid', 'nomex'], canonical: 'aramid-paper', kind: 'material' },
  { surfaces: ['densified wood', 'laminated wood'], canonical: 'laminated-densified-wood', kind: 'material' },
  { surfaces: ['transformer oil', 'insulating oil'], canonical: 'transformer-oil', kind: 'material' },
  { surfaces: ['natural ester', 'synthetic ester', 'ester'], canonical: 'ester', kind: 'material' },
  { surfaces: ['oltc', 'on-load tap', 'on load tap'], canonical: 'oltc', kind: 'component' },
  { surfaces: ['detc', 'de-energized tap', 'off-circuit tap'], canonical: 'detc', kind: 'component' },
  { surfaces: ['bushing'], canonical: 'bushings', kind: 'component' },
  { surfaces: ['radiator'], canonical: 'radiators', kind: 'component' },
  { surfaces: ['buchholz'], canonical: 'buchholz-relays', kind: 'component' },
  { surfaces: ['conservator'], canonical: 'conservators', kind: 'component' },
  { surfaces: ['breather'], canonical: 'breathers', kind: 'component' },
  { surfaces: ['arrester'], canonical: 'surge-arresters', kind: 'component' },
  { surfaces: ['monitoring', 'online dga', 'dga'], canonical: 'transformer-monitoring', kind: 'component' },
  { surfaces: ['winding machine', 'foil winding', 'vertical winding', 'horizontal winding'], canonical: 'winding', kind: 'machinery' },
  { surfaces: ['vpd', 'vacuum pressure drying', 'vapour phase'], canonical: 'vpd', kind: 'machinery' },
  { surfaces: ['core cutting', 'step-lap', 'step lap'], canonical: 'core-cutting-lines', kind: 'machinery' },
  { surfaces: ['oil filtration', 'oil filling'], canonical: 'oil-filtration', kind: 'machinery' }
];

function detectCategories(lower) {
  const found = [];
  for (const entry of CATEGORY_LEXICON) {
    if (entry.surfaces.some((s) => lower.includes(s))) {
      found.push(entry);
    }
  }
  return found;
}

/** Parse a query into PRODUCT/CATEGORY + CAPABILITY + LOCATION + INTENT (§15). */
function parseQuery(q) {
  const lower = String(q || '').toLowerCase();
  const voltages = (lower.match(/\b(\d{2,4})\s*kv\b/g) || []).map((s) => s.replace(/\s*kv/, ''));
  const location = KNOWN_LOCATIONS.filter((l) => new RegExp('\\b' + l + '\\b').test(lower));
  const categories = detectCategories(lower);
  let intent = null;
  for (const term of Object.keys(INTENT_TERMS)) {
    if (new RegExp('\\b' + term + '\\b').test(lower)) {
      intent = INTENT_TERMS[term];
      break;
    }
  }
  return { voltages, location, intent, categories: categories.map((c) => c.canonical), categoryEntries: categories };
}

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function loadComponents() {
  const src = fs.readFileSync(path.join(ROOT, 'components-catalog.js'), 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const cat = ctx.window.TP_COMPONENTS;
  return (cat && cat.items) || [];
}

function buildIndex() {
  const records = [];

  // Companies (manufacturer listings) — public-source, LISTED.
  const manufacturers = loadJson('data/manufacturers.json');
  for (const block of manufacturers) {
    for (const m of (block.makers || []).filter((x) => !isServedBy(x))) {
      records.push({
        type: 'company',
        name: clean(m[0]),
        country: clean(block.country),
        region: clean(block.region),
        city: clean(m[1]),
        transformerTypes: clean(m[3]),
        url: clean(m[2]),
        highestSourcedVoltageEvidence: null,
        verificationStatus: 'LISTED',
        source: 'data/manufacturers.json'
      });
    }
  }

  // Rich OEM profiles — add voltage evidence, capabilities, certifications.
  const profiles = loadJson('data/directory-profiles.json');
  for (const key of Object.keys(profiles)) {
    const p = profiles[key];
    records.push({
      type: 'company',
      name: key.replace(/\s*\(.*?\)\s*/g, ' ').trim() || key,
      displayName: key,
      country: null,
      region: null,
      highestSourcedVoltageEvidence: p.kvRange || null,
      capabilities: p.capabilities || [],
      certifications: p.certifications || [],
      componentCategories: p.componentCategories || [],
      plants: p.plants || [],
      utilityApprovals: p.utilityApprovals || [],
      verificationStatus: 'LISTED',
      source: 'data/directory-profiles.json'
    });
  }

  // Components / materials / machinery categories.
  for (const c of loadComponents()) {
    records.push({
      type: 'component',
      name: c.name,
      category: c.category,
      blurb: c.blurb,
      detail3d: c.detail3d || null,
      supplierCount: 0, // honest: no sourced supplier records yet
      source: 'components-catalog.js'
    });
  }

  // Utilities.
  const utilities = loadJson('data/utility-directory.json');
  const utilEntries = Array.isArray(utilities)
    ? utilities
    : Object.keys(utilities).map((k) => Object.assign({ name: k }, utilities[k]));
  for (const u of utilEntries) {
    records.push({
      type: 'utility',
      name: u.name || '',
      country: u.country || null,
      blurb: typeof u === 'object' ? JSON.stringify(u).slice(0, 200) : '',
      source: 'data/utility-directory.json'
    });
  }

  return records;
}

// Words that express intent/category, not searchable content — they must not
// match record metadata (e.g. the "manufacturers.json" source path).
const STOPWORDS = new Set([
  'kv', 'mva', 'transformer', 'transformers', 'manufacturer', 'manufacturers',
  'maker', 'makers', 'supplier', 'suppliers', 'equipment', 'machine', 'machinery',
  'and', 'for', 'the', 'in', 'of', 'a'
]);

function tokenize(q) {
  const base = String(q || '')
    .toLowerCase()
    .replace(/[^a-z0-9+.\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t.length > 1 && !STOPWORDS.has(t));
  const expanded = new Set(base);
  for (const t of base) (SYNONYMS[t] || []).forEach((s) => expanded.add(s));
  return [...expanded];
}

// Only meaningful content is searchable — never internal keys/paths/enums.
function haystack(rec) {
  const parts = [];
  const push = (v) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(push);
    else parts.push(String(v));
  };
  if (rec.type === 'company') {
    push(rec.displayName || rec.name);
    push([rec.country, rec.region, rec.city]);
    push(rec.highestSourcedVoltageEvidence);
    push(rec.capabilities);
    push(rec.certifications);
    push(rec.componentCategories);
    push(rec.plants);
    push(rec.utilityApprovals);
    // expand legacy type codes to words
    push((rec.transformerTypes || '').replace(/PT/g, 'power').replace(/DT/g, 'distribution').replace(/DRY/g, 'dry-type cast-resin').replace(/CT/g, 'current'));
  } else if (rec.type === 'component') {
    push([rec.name, rec.category, rec.blurb]);
  } else if (rec.type === 'utility') {
    push([rec.name, rec.country, rec.blurb]);
  } else {
    push(rec.name);
  }
  return parts.join(' | ').toLowerCase();
}

function categoryBlob(rec) {
  if (rec.type === 'company') {
    return []
      .concat(rec.componentCategories || [], rec.capabilities || [], [
        (rec.transformerTypes || '')
          .replace(/PT/g, 'power')
          .replace(/DT/g, 'distribution')
          .replace(/DRY/g, 'dry-type cast-resin')
          .replace(/CT/g, 'current')
      ])
      .join(' ')
      .toLowerCase();
  }
  if (rec.type === 'component') return [rec.name, rec.category, rec.blurb].join(' ').toLowerCase();
  return '';
}

function locationBlob(rec) {
  return [rec.country, rec.region, rec.city]
    .concat(rec.plants || [], rec.utilityApprovals || [], rec.capabilities || [])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function voltageBlob(rec) {
  return [rec.highestSourcedVoltageEvidence, rec.name, rec.blurb]
    .concat(rec.capabilities || [])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchCategory(rec, categoryEntries) {
  const blob = categoryBlob(rec);
  return categoryEntries.some(
    (e) => blob.includes(e.canonical) || e.surfaces.some((s) => blob.includes(s))
  );
}

function matchLocation(rec, locations) {
  const blob = locationBlob(rec);
  return locations.some((l) => new RegExp('\\b' + l + '\\b').test(blob));
}

function matchVoltage(rec, voltages) {
  const blob = voltageBlob(rec);
  return voltages.some((v) => new RegExp('\\b' + v + '\\b').test(blob));
}

/**
 * Precision-first search (§15). Category/capability queries return ONLY records
 * that genuinely match the canonical category/capability; a location term
 * refines/boosts but never stands in for a category or capability match.
 * Location-only near-misses on a capability query are separated into
 * `locationCandidates` (reported, never counted as confident answers).
 *
 * Each result carries `relevance`: CATEGORY | CAPABILITY | LOCATION.
 */
function search(query, index) {
  const idx = index || buildIndex();
  const p = parseQuery(query);
  const hasCat = p.categoryEntries.length > 0;
  const hasVolt = p.voltages.length > 0;
  const hasLoc = p.location.length > 0;
  const freeTokens = tokenize(query).filter((t) => !/^\d+$/.test(t));

  const scored = [];
  const locationCandidates = [];

  for (const rec of idx) {
    const cat = hasCat && matchCategory(rec, p.categoryEntries);
    const loc = hasLoc && matchLocation(rec, p.location);
    const volt = hasVolt && matchVoltage(rec, p.voltages);
    let relevance = null;
    let confidence = 0;

    if (hasCat) {
      if (!cat) continue; // precision: exclude non-category records entirely
      relevance = 'CATEGORY';
      confidence = 0.85 + (volt ? 0.1 : 0);
      if (hasLoc) confidence = loc ? confidence + 0.05 : 0.55; // location unknown => partial
    } else if (hasVolt) {
      if (volt && (!hasLoc || loc)) {
        relevance = 'CAPABILITY';
        confidence = hasLoc ? 0.95 : 0.9;
      } else if (volt && hasLoc && !loc) {
        // right capability, wrong location — a candidate, not a confident answer
        locationCandidates.push({ rec, relevance: 'CAPABILITY_ELSEWHERE', confidence: 0.4 });
        continue;
      } else {
        // capability query with no sourced capability match
        if (hasLoc && loc) locationCandidates.push({ rec, relevance: 'LOCATION', confidence: 0.4 });
        continue;
      }
    } else if (hasLoc) {
      if (!loc) continue;
      relevance = 'LOCATION';
      confidence = 0.8;
    } else {
      // free-text only — precision-first: require ALL terms to be present.
      if (freeTokens.length === 0) continue;
      const blob = haystack(rec);
      const hits = freeTokens.filter((t) => blob.includes(t)).length;
      if (hits < freeTokens.length) continue;
      relevance = 'TEXT';
      confidence = 0.7;
    }

    scored.push({ rec, relevance, confidence });
  }

  scored.sort((a, b) => b.confidence - a.confidence);
  locationCandidates.sort((a, b) => b.confidence - a.confidence);

  const groups = {};
  for (const s of scored) (groups[s.rec.type] ??= []).push(s);
  const byType = {};
  Object.keys(groups).forEach((t) => (byType[t] = groups[t].length));

  return {
    query,
    parse: p,
    total: scored.length,
    groups,
    byType,
    ranked: scored,
    locationCandidates
  };
}

module.exports = { buildIndex, search, tokenize, parseQuery, matchCategory, matchLocation, matchVoltage };

if (require.main === module) {
  const q = process.argv.slice(2).join(' ') || '765 kV';
  const res = search(q);
  console.log('Query:', q, '| parse:', JSON.stringify(res.parse.categories) + ' v=' + JSON.stringify(res.parse.voltages) + ' loc=' + JSON.stringify(res.parse.location));
  console.log('total:', res.total, '| byType:', JSON.stringify(res.byType), '| locationCandidates:', res.locationCandidates.length);
  Object.keys(res.groups).forEach((type) => {
    console.log('\n' + type.toUpperCase());
    res.groups[type].slice(0, 8).forEach((s) => {
      const r = s.rec;
      const extra =
        r.type === 'company'
          ? [r.country, r.highestSourcedVoltageEvidence ? 'kV evidence: ' + r.highestSourcedVoltageEvidence : null]
              .filter(Boolean)
              .join(' · ')
          : r.category || r.country || '';
      console.log('  [' + s.relevance + ' ' + (s.confidence * 100).toFixed(0) + '%] ' + (r.displayName || r.name) + (extra ? '  — ' + extra : ''));
    });
  });
}
