#!/usr/bin/env node
/* build-manufacturer-intel.js — consolidated TransformerPath manufacturer
 * intelligence store. Aggregates the existing, separately-maintained data
 * sources into ONE structured per-company object so pages render from data
 * (never duplicated text) and the platform accumulates a durable research asset.
 *
 * Sources combined (all pre-existing, source-backed):
 *   - manufacturers.json (census: name/city/url/types/country)
 *   - company-slugs.json  (entity slug + indexable tier)
 *   - manufacturer-tiers.json (reported capability: voltage/MVA/certs/regions)
 *   - manufacturer-provenance.json (sourced capability facts w/ provenance)
 *   - company-developments.json (sourced orders/expansions/ownership/rebrands)
 *
 * RESEARCH COMPLETENESS (internal, NOT a quality score / ranking):
 *   A simple 0-10 count of how many verification fields a profile populates
 *   (identity, website, factory, products, voltage, MVA, testing, approvals,
 *   projects/orders, sources). It measures research coverage, not quality, and
 *   is never presented as a manufacturer ranking. Commercial status
 *   (LISTED/CLAIMED/VERIFIED) is a SEPARATE axis and never affects this score.
 *
 * Honesty: no capability is fabricated or combined here. Voltage and MVA are
 * kept as SEPARATE reported maxima. Company vs factory capability is not merged.
 * Output: data/manufacturer-intel.json
 *
 * Run: node build-manufacturer-intel.js  (after build-company-developments.js).
 */
'use strict';
const fs = require('fs');

const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
let SLUGS = []; try { SLUGS = JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')); } catch (e) {}
let TIERS = []; try { TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8')); } catch (e) {}
let PROV = []; try { PROV = JSON.parse(fs.readFileSync('data/manufacturer-provenance.json', 'utf8')); } catch (e) {}
let DEV = []; try { DEV = JSON.parse(fs.readFileSync('data/company-developments.json', 'utf8')); } catch (e) {}
const { canonicalCountry } = require('./lib/market-country');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').trim().replace(/\s+/g, ' ');
function sameCountry(a, b) {
  const left = canonicalCountry(a);
  const right = canonicalCountry(b);
  return !!(left && right && left === right);
}
/* A headquarters string that names a different country than the census row
 * is a copied group address. Do not store it on this site. */
const PLACE_WORDS = ['united arab emirates', 'saudi arabia', 'south korea', 'south africa', 'united kingdom', 'united states', 'new zealand', 'czech republic', 'switzerland', 'germany', 'france', 'india', 'china', 'japan', 'turkiye', 'turkey', 'vietnam', 'indonesia', 'malaysia', 'italy', 'spain', 'brazil', 'brasil', 'chile', 'mexico', 'egypt', 'nigeria', 'australia', 'canada', 'sweden', 'norway', 'finland', 'poland', 'netherlands', 'belgium', 'austria', 'hungary', 'qatar', 'kuwait', 'bahrain', 'oman', 'pakistan', 'colombia', 'argentina', 'portugal', 'greece', 'denmark', 'ireland', 'romania', 'algeria', 'ethiopia', 'thailand', 'singapore', 'czechia', 'usa', 'uae', 'uk'];
function countryNamedIn(text) {
  const folded = ' ' + norm(text) + ' ';
  const words = PLACE_WORDS.slice().sort(function (a, b) { return b.length - a.length; });
  for (let i = 0; i < words.length; i++) {
    if (folded.indexOf(' ' + words[i] + ' ') >= 0) return canonicalCountry(words[i]);
  }
  return '';
}
function foreignPlace(text, country) {
  const named = countryNamedIn(text);
  return !!(named && country && !sameCountry(named, country));
}
const EXHIBITOR_NEW = new Set((() => {
  try {
    const doc = JSON.parse(fs.readFileSync('data/ep-shanghai-2026-exhibitors.json', 'utf8'));
    return (doc.listings || []).filter((row) => row && row.action === 'added' && row.directory === 'manufacturers').map((row) => row.profile_name);
  } catch (e) { return []; }
})());
const slugOf = (name) => { const n = norm(name); const hit = SLUGS.find((c) => norm(c.name) === n); return hit ? hit.slug : null; };
const byName = (arr, key) => { const o = {}; arr.forEach((x) => { o[norm(x[key] || x.name || '')] = x; }); return o; };
let DEEP = []; try { DEEP = JSON.parse(fs.readFileSync('data/deep-research.json', 'utf8')).companies || []; } catch (e) {}
let SPEC_FIELDS = []; try { SPEC_FIELDS = JSON.parse(fs.readFileSync('data/sourced-spec-fields.json', 'utf8')).companies || []; } catch (e) {}
const SPEC_BY_SLUG = {};
SPEC_FIELDS.forEach(function (row) { if (row && row.slug) SPEC_BY_SLUG[row.slug] = row; });
const DEEP_BY = {};
DEEP.forEach((x) => { DEEP_BY[norm(x.name)] = x; DEEP_BY[norm(x.slug)] = x; });
[
  ['BHEL (Bharat Heavy Electricals)', 'BHEL'],
  ['CG Power and Industrial Solutions Limited', 'CG Power & Industrial Solutions'],
  ['CG Power and Industrial Solutions Limited', 'CG Power'],
  ['TBEA Co., Ltd.', 'TBEA Group (Changji HQ; Shenyang, Hengyang, Tianjin plants)'],
  ['WEG', 'WEG Equipamentos Elétricos'],
  ['Elsewedy Electric', 'Elsewedy Electric (Transformers)'],
  ['Hitachi Energy', 'Hitachi Energy (global HQ)']
].forEach(function (pair) {
  const row = DEEP.find((d) => norm(d.name) === norm(pair[0]));
  if (row) DEEP_BY[norm(pair[1])] = row;
});
const TIER_BY = byName(TIERS, 'name');
// A shared website can find the group filing, but that filing is not a sourced
// rating for a census row in another country. Exact name match keeps the
// figures. A domain or loose match keeps them only when the row's country is
// the tier country (the group record). Other countries get a note instead.
function tierAttachment(name, website) {
  if (TIER_BY[norm(name)]) return { tier: TIER_BY[norm(name)], how: 'name' };
  const dom = (website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (dom) {
    const hit = TIERS.find((x) => {
      const xs = (x.site || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      return xs === dom;
    });
    if (hit) return { tier: hit, how: 'domain' };
  }
  if (!/usa|canada|brasil|india|japan|spain|italy|türkiye|turkey|finland|colombia|malaysia|thailand|vietnam|china|egypt|saudi|transformers transformer co$/i.test(name)) {
    const sub = TIERS.find((x) => norm(name).indexOf(norm(x.name)) >= 0 || norm(x.name).indexOf(norm(name)) >= 0);
    if (sub) return { tier: sub, how: 'loose' };
  }
  return { tier: null, how: '' };
}
const PROV_BY = byName(PROV, 'name');
const DEV_BY = byName(DEV, 'name');
const audit = (() => { try { return JSON.parse(fs.readFileSync('data/census-audit.json', 'utf8')); } catch (e) { return null; } })();
const AUDIT_BY = {};
if (audit) audit.records.forEach((r) => { AUDIT_BY[norm(r.name) + '|' + norm(r.country)] = r; });

// Census records, keyed by name (normalised). A name may appear per country.
const censusByName = {};
MANUF.forEach((g) => {
  g.makers.forEach((x) => {
    if (/^Served by/i.test(x[0])) return;
    const key = norm(x[0]);
    censusByName[key] = censusByName[key] || [];
    censusByName[key].push({ name: x[0], city: x[1] || '', url: x[2] || '', types: x[3] || '', country: g.country, region: g.region });
  });
});

function hostOf(url) {
  return String(url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

/* The group filing stays on a census row in the tier's own country.
 * A different country loses the copy when that home row exists.
 * If no home row exists, a single other-country row keeps the figure
 * (it is the only place the filing is published). Several other-country
 * rows that only share the group domain do not each inherit it. */
function tierHasHomeCensus(tier) {
  if (!tier || !tier.country) return false;
  const tierHost = hostOf(tier.site);
  let found = false;
  Object.keys(censusByName).forEach(function (key) {
    (censusByName[key] || []).forEach(function (row) {
      if (!sameCountry(row.country, tier.country)) return;
      if (norm(row.name) === norm(tier.name)) found = true;
      const rowHost = hostOf(row.url);
      if (tierHost && rowHost && rowHost === tierHost) found = true;
    });
  });
  return found;
}

/* Census rows outside the tier country that match the group website.
 * A name match is the filing itself and is not counted. */
function foreignDomainSiblings(tier) {
  if (!tier) return 0;
  const tierHost = hostOf(tier.site);
  if (!tierHost) return 0;
  let n = 0;
  Object.keys(censusByName).forEach(function (key) {
    (censusByName[key] || []).forEach(function (row) {
      if (sameCountry(row.country, tier.country)) return;
      if (norm(row.name) === norm(tier.name)) return;
      if (hostOf(row.url) === tierHost) n++;
    });
  });
  return n;
}

// Research-completeness components (internal).
function completeness(rec) {
  let n = 0;
  if (rec.identity) n++;
  if (rec.website) n++;
  if (rec.manufacturing_is_likely) n++;
  if (rec.factories.length) n++;
  if (rec.products.length) n++;
  if (rec.reported_voltage) n++;
  if (rec.reported_mva) n++;
  if (rec.testing_capability) n++;
  if (rec.approvals.length) n++;
  if (rec.orders_projects.length) n++;
  return n; // 0-10 research-coverage components, not a quality score
}

function evaluateCompleteness(rec) {
  let score = 0;
  const missing = [];

  // 1. Identity & HQ (15 pts)
  if (rec.name && rec.country) {
    score += 10;
    if (rec.headquarters) score += 5;
    else missing.push('Headquarters address');
  }

  // 2. Official website (10 pts)
  if (rec.website) score += 10;
  else missing.push('Official corporate website');

  // 3. Documented product types (15 pts)
  if (rec.products && rec.products.length > 0) score += 15;
  else missing.push('Classified transformer product types');

  // 4. Technical specifications (20 pts)
  if (rec.reported_voltage) score += 10;
  else missing.push('Maximum voltage rating');
  if (rec.reported_mva) score += 10;
  else missing.push('Maximum unit MVA / rating');

  // 5. Documented manufacturing facilities (15 pts)
  if (rec.factories && rec.factories.length > 0) score += 15;
  else missing.push('Manufacturing facility locations');

  // 6. Standards & Certifications (15 pts)
  if (rec.reported_certs && rec.reported_certs.length > 0) score += 15;
  else missing.push('Standards compliance (IEC/IEEE) & ISO certifications');

  // 7. Testing / Engineering references (10 pts)
  if (rec.testing_capability || (rec.orders_projects && rec.orders_projects.length > 0)) score += 10;
  else missing.push('Test bay specifications & utility references');

  // Sourced cooling class. Census factories already award the facility
  // points; a factory with its own source URL and checked_at adds the rest.
  if (rec.cooling_classes && rec.cooling_classes.length) score += 10;
  if (rec.factories && rec.factories.some(function (f) { return f && f.source_url && f.checked_at; })) score += 5;
  if (score > 100) score = 100;

  return { score, missing };
}

function formatSpecNumber(n) {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n);
}

function applySourcedSpec(rec, spec) {
  if (!spec) return;
  let filledVoltage = false;
  let filledMva = false;
  if (!rec.reported_voltage && spec.max_kv && spec.max_kv.value != null) {
    rec.reported_voltage = formatSpecNumber(spec.max_kv.value) + ' kV';
    filledVoltage = true;
  }
  if (!rec.reported_mva && spec.max_mva && spec.max_mva.value != null) {
    rec.reported_mva = formatSpecNumber(spec.max_mva.value) + ' MVA';
    filledMva = true;
  }
  // A filled unit rating needs the page it was quoted from. The data-quality
  // gate rejects voltage or MVA with neither capability_source nor capability_note.
  if (filledVoltage || filledMva) {
    rec.sources = rec.sources || {};
    if (!rec.sources.capability_source && !rec.sources.capability_note) {
      const urls = [];
      if (filledMva && spec.max_mva.source_url) urls.push(spec.max_mva.source_url);
      if (filledVoltage && spec.max_kv.source_url && urls.indexOf(spec.max_kv.source_url) < 0) urls.push(spec.max_kv.source_url);
      if (urls.length) rec.sources.capability_source = urls[0];
      if (urls.length > 1) rec.sources.capability_note = 'Voltage quote: ' + urls[1];
    }
  }
  if ((!rec.reported_certs || !rec.reported_certs.length) && spec.standards && spec.standards.length) {
    const codes = [];
    spec.standards.forEach(function (row) {
      if (row && row.code && codes.indexOf(row.code) < 0) codes.push(row.code);
    });
    if (codes.length) rec.reported_certs = codes;
  }
  if (!rec.testing_capability) {
    const cats = [];
    (spec.tests || []).forEach(function (row) {
      if (row && row.category && cats.indexOf(row.category) < 0) cats.push(row.category);
    });
    if (cats.length) rec.testing_capability = cats.join(', ');
    else if (spec.testing_statement && spec.testing_statement.quote) rec.testing_capability = 'Reported';
  }
  const cooling = [];
  (spec.cooling || []).forEach(function (row) {
    if (row && row.code && cooling.indexOf(row.code) < 0) cooling.push(row.code);
  });
  if (cooling.length) rec.cooling_classes = cooling;
  if (spec.factory && spec.factory.city && spec.factory.source_url && spec.factory.checked_at) {
    rec.factories.push({
      city: spec.factory.city,
      country: spec.factory.country || rec.country,
      source_url: spec.factory.source_url,
      checked_at: spec.factory.checked_at
    });
  }
}

const out = [];
Object.keys(censusByName).forEach((name) => {
  const variants = censusByName[name];
  const attached = tierAttachment(name, variants[0].url);
  const tier = attached.tier;
  const prov = PROV_BY[name] || null;
  const dev = DEV_BY[name] || null;
  const primary = variants[0];

  // The CG Power tier is the Bhopal and Malanpur filing, not every
  // cgglobal.com census row. Any other group's filing is the same kind of
  // envelope: it stays on the tier country and is not copied onto a site in
  // a different country. A provenance row for this exact name can still fill
  // a figure the group filing does not.
  const cgOtherPlant = !!(tier && norm(tier.name) === 'cg power' && !sameCountry(primary.country, tier.country || ''));
  const repeatedAbroad = foreignDomainSiblings(tier) > 1;
  const groupCopy = !!(tier && attached.how !== 'name' && !sameCountry(primary.country, tier.country || '') && (tierHasHomeCensus(tier) || repeatedAbroad));
  const otherSite = cgOtherPlant || groupCopy;
  const plantPlace = String(primary.city || primary.country || 'this').split(',')[0].trim();
  const provVoltage = prov && prov.facts && prov.facts.some((f) => f.unit === 'kV') ? prov.facts.filter((f) => f.unit === 'kV').map((f) => f.value + ' kV').join(', ') : '';
  const provMva = prov && prov.facts && prov.facts.some((f) => f.unit === 'MVA') ? prov.facts.filter((f) => f.unit === 'MVA').map((f) => f.value + ' MVA').join(', ') : '';
  // Reported capability — SEPARATE maxima, never combined.
  const reported_voltage = otherSite ? provVoltage : (tier && tier.kv ? tier.kv + ' kV' : provVoltage);
  const reported_mva = otherSite ? provMva : (tier && tier.mva ? tier.mva.toLocaleString('en-US') + ' MVA' : provMva);
  const certs = otherSite ? [] : ((tier && tier.certs) || []);
  const testing = otherSite ? '' : ((tier && tier.note && /test/i.test(tier.note)) ? 'Reported' : '');
  const approvals = []; // not yet sourced; kept empty rather than invented
  const orders_dev = dev && dev.developments ? dev.developments.map((d) => ({ title: d.title, url: d.url, value: d.value || '', src: d.src || '' })) : [];

  const rec = {
    name: primary.name,
    slug: slugOf(primary.name),
    country: primary.country,
    region: primary.region,
    factories: variants.map((v) => ({ city: v.city, country: v.country, url: v.url })),
    website: primary.url,
    products: (primary.types || '').split(',').map((t) => t.trim()).filter(Boolean),
    reported_voltage: reported_voltage || null,
    reported_mva: reported_mva || null,
    reported_certs: certs,
    testing_capability: testing || null,
    approvals: approvals,
    orders_projects: orders_dev,
    ownership: null,
    corporate_events: orders_dev.length,
    sources: {
      website: primary.url || null,
      capability_source: otherSite ? ((provVoltage || provMva) && prov && prov.source ? prov.source : '') : (tier ? (tier.source || '') : (prov && prov.source ? prov.source : '')),
      capability_note: cgOtherPlant
        ? ('The CG Power annual report discloses the Bhopal and Malanpur, India plant figures. Those figures are not a sourced rating for the ' + plantPlace + ' plant, so they are not shown here.')
        : (groupCopy
          ? ('The ' + tier.name + ' source (' + (tier.source || 'group filing') + ') describes a group envelope. Those figures are not a sourced rating for this site, so they are not shown here.')
          : (tier ? (tier.note || '') : '')),
    },
    research_status: (audit && AUDIT_BY[norm(primary.name) + '|' + norm(primary.country)]) ? AUDIT_BY[norm(primary.name) + '|' + norm(primary.country)].status : 'ACTIVE_LIMITED_DATA',
    company_reported: false,
  };
  // Merge source-backed deep-research enrichment (factories, HQ, verified
  // products) where it exists. Capability maxima stay separate; factory
  // capability is not asserted from the group maximum.
  const strippedName = norm(primary.name).replace(/(group|worldwide|global|inc|ltd|limited|corporation|co ltd)$/i, '').trim();
  const nameMatch = DEEP_BY[norm(primary.name)] || (strippedName !== norm(primary.name) ? DEEP_BY[strippedName] : null);
  const tierMatch = !nameMatch && tier
    ? (DEEP_BY[norm(tier.name)] || DEEP_BY[norm(String(tier.name || '').replace(/(group|worldwide|global|inc|ltd|limited|corporation|co ltd)$/i, '').trim())])
    : null;
  const deep = nameMatch || tierMatch;
  if (deep) {
    // A tier-level research row carries the group head office. Copy it only
    // onto the group record, and never when the string names another country.
    const hqSource = nameMatch || (!groupCopy ? tierMatch : null);
    const hqCity = hqSource && hqSource.headquarters ? (hqSource.headquarters.city || '') : '';
    if (hqCity && !rec.headquarters && !foreignPlace(hqCity, rec.country)) rec.headquarters = hqCity;
    if (deep.transformer_products && deep.transformer_products.length) {
      const deepTypes = deep.transformer_products.map((p) => (p.type || '').toUpperCase()).filter(Boolean);
      // only add product categories we have not already normalised from census,
      // and only verified ones (never unsupported)
      rec.products = deepTypes.length ? [...new Set(rec.products.concat(deepTypes))] : rec.products;
    }
    if (nameMatch && nameMatch.factories && nameMatch.factories.length) {
      rec.factories = rec.factories.concat(nameMatch.factories.map((f) => ({ city: f.city, country: f.country, produces: f.produces || '', source_url: f.source_url || '', claim_type: f.claim_type || 'UNKNOWN' })));
    }
    if (nameMatch && nameMatch.notes) rec.research_notes = nameMatch.notes;
    else if (!groupCopy && tierMatch && tierMatch.notes) rec.research_notes = tierMatch.notes;
  }
  rec.manufacturing_is_likely = !!rec.website && rec.products.length > 0;
  if (rec.slug && SPEC_BY_SLUG[rec.slug]) applySourcedSpec(rec, SPEC_BY_SLUG[rec.slug]);
  rec.research_completeness = completeness(rec);
  const compEval = evaluateCompleteness(rec);
  rec.completeness_score = compEval.score;
  rec.missing_fields = compEval.missing;

  // Provenance & verification metadata
  if (rec.company_reported) {
    rec.provenance_type = 'MANUFACTURER_SUPPLIED';
  } else if (rec.sources && rec.sources.capability_source && /official|filing|doe|government|iso/i.test(rec.sources.capability_source)) {
    rec.provenance_type = 'OFFICIAL_SOURCE';
  } else if (rec.sources && rec.sources.capability_source) {
    rec.provenance_type = 'TRANSFORMERPATH_RESEARCHED';
  } else {
    rec.provenance_type = 'PUBLIC_SOURCE';
  }
  rec.last_verified = (rec.research_status === 'ACTIVE_CONFIRMED') ? '2026-08-28' : '2026-08-15';
  if (EXHIBITOR_NEW.has(rec.name)) rec.last_verified = '—';

  // Commercial status is a separate axis (always LISTED here unless a paid
  // overlay in data/listing-tiers.json marks Verified / Supplier Pro).
  // CLAIMED/VERIFIED are never derived from research or website-checked labels.
  rec.commercial_status = 'LISTED';
  rec.featured = false;
  rec.listing_tier = 'listed';
  try {
    const listingTier = require('./lib/listing-tier');
    const overlay = listingTier.indexOverlay(listingTier.loadOverlay());
    const hit = listingTier.resolveListing({ name: rec.name, slug: rec.slug }, overlay);
    if (hit.tier === 'pro') { rec.commercial_status = 'SUPPLIER_PRO'; rec.featured = true; rec.listing_tier = 'pro'; rec.verified = true; }
    else if (hit.tier === 'verified') { rec.commercial_status = 'VERIFIED'; rec.featured = true; rec.listing_tier = 'verified'; rec.verified = true; }
  } catch (e) { /* overlay optional */ }
  out.push(rec);
});

const scores = {};
out.forEach((r) => { scores[r.research_completeness] = (scores[r.research_completeness] || 0) + 1; });
const store = {
  $comment: 'TransformerPath consolidated manufacturer intelligence store. Generated by build-manufacturer-intel.js from existing source-backed data files. research_completeness is an INTERNAL research-coverage count (not a quality score or ranking) and is independent of commercial_status. Capability maxima are reported separately and never combined. Do not edit by hand.',
  generated: new Date().toISOString().slice(0, 10),
  count: out.length,
  research_completeness_distribution: scores,
  companies: out,
};
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/manufacturer-intel.json', JSON.stringify(store, null, 2));
console.log('manufacturer-intel.json wrote', out.length, 'company intelligence records');
console.log('  research-completeness distribution:', JSON.stringify(scores));
console.log('  with reported voltage:', out.filter((r) => r.reported_voltage).length, '| with reported MVA:', out.filter((r) => r.reported_mva).length);
module.exports = store;
