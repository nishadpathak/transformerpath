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
const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const slugOf = (name) => { const n = norm(name); const hit = SLUGS.find((c) => norm(c.name) === n); return hit ? hit.slug : null; };
const byName = (arr, key) => { const o = {}; arr.forEach((x) => { o[norm(x[key] || x.name || '')] = x; }); return o; };
let DEEP = []; try { DEEP = JSON.parse(fs.readFileSync('data/deep-research.json', 'utf8')).companies || []; } catch (e) {}
const DEEP_BY = {};
DEEP.forEach((x) => { DEEP_BY[norm(x.name)] = x; DEEP_BY[norm(x.slug)] = x; });
const TIER_BY = byName(TIERS, 'name');
// Additional tier matching: a multinational census record (e.g. "Hitachi Energy
// USA") should attach the group tier capability even when its name differs from
// the tier leader name. Match by shared website domain first, then by name.
function tierFor(name, website) {
  if (TIER_BY[norm(name)]) return TIER_BY[norm(name)];
  const dom = (website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (dom) {
    const hit = TIERS.find((x) => {
      const xs = (x.site || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      return xs === dom;
    });
    if (hit) return hit;
  }
  // loose: tier leader name is contained in census name (e.g. "GE Vernova (HVDC...)")
  if (!/usa|canada|brasil|india|japan|spain|italy|türkiye|turkey|finland|colombia|malaysia|thailand|vietnam|china|egypt|saudi|transformers transformer co$/i.test(name)) {
    const sub = TIERS.find((x) => norm(name).indexOf(norm(x.name)) >= 0 || norm(x.name).indexOf(norm(name)) >= 0);
    if (sub) return sub;
  }
  return null;
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

const out = [];
Object.keys(censusByName).forEach((name) => {
  const variants = censusByName[name];
  const tier = tierFor(name, variants[0].url);
  const prov = PROV_BY[name] || null;
  const dev = DEV_BY[name] || null;
  const primary = variants[0];

  // Reported capability — SEPARATE maxima, never combined.
  const reported_voltage = tier && tier.kv ? tier.kv + ' kV' : (prov && prov.facts && prov.facts.some((f) => f.unit === 'kV') ? prov.facts.filter((f) => f.unit === 'kV').map((f) => f.value + ' kV').join(', ') : '');
  const reported_mva = tier && tier.mva ? tier.mva.toLocaleString('en-US') + ' MVA' : (prov && prov.facts && prov.facts.some((f) => f.unit === 'MVA') ? prov.facts.filter((f) => f.unit === 'MVA').map((f) => f.value + ' MVA').join(', ') : '');
  const certs = (tier && tier.certs) || [];
  const testing = (tier && tier.note && /test/i.test(tier.note)) ? 'Reported' : '';
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
      capability_source: tier ? (tier.source || '') : (prov && prov.source ? prov.source : ''),
      capability_note: tier ? (tier.note || '') : '',
    },
    research_status: (audit && AUDIT_BY[norm(primary.name) + '|' + norm(primary.country)]) ? AUDIT_BY[norm(primary.name) + '|' + norm(primary.country)].status : 'ACTIVE_LIMITED_DATA',
    company_reported: false,
  };
  // Merge source-backed deep-research enrichment (factories, HQ, verified
  // products) where it exists. Capability maxima stay separate; factory
  // capability is not asserted from the group maximum.
  const deep = DEEP_BY[norm(primary.name)] || DEEP_BY[norm(primary.name).replace(/(group|worldwide|global|inc|ltd|limited|corporation|co ltd)$/i, '').trim()] || (tier ? (DEEP_BY[norm(tier.name)] || DEEP_BY[norm(tier.name.replace(/(group|worldwide|global|inc|ltd|limited|corporation|co ltd)$/i, '').trim())]) : null);
  if (deep) {
    if (deep.headquarters && !rec.headquarters) rec.headquarters = deep.headquarters.city;
    if (deep.transformer_products && deep.transformer_products.length) {
      const deepTypes = deep.transformer_products.map((p) => (p.type || '').toUpperCase()).filter(Boolean);
      // only add product categories we have not already normalised from census,
      // and only verified ones (never unsupported)
      rec.products = deepTypes.length ? [...new Set(rec.products.concat(deepTypes))] : rec.products;
    }
    if (deep.factories && deep.factories.length) {
      rec.factories = rec.factories.concat(deep.factories.map((f) => ({ city: f.city, country: f.country, produces: f.produces || '', source_url: f.source_url || '', claim_type: f.claim_type || 'UNKNOWN' })));
    }
    if (deep.notes) rec.research_notes = deep.notes;
  }
  rec.manufacturing_is_likely = !!rec.website && rec.products.length > 0;
  rec.research_completeness = completeness(rec);
  // Commercial status is a separate axis (always LISTED here; CLAIMED/VERIFIED
  // are set through the claim/verified workflow, never derived from research).
  rec.commercial_status = 'LISTED';
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
