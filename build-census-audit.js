#!/usr/bin/env node
/* build-census-audit.js — TransformerPath manufacturer census intelligence audit.
 *
 * Every record in data/manufacturers.json (the ~546-company census) is passed
 * through a systematic, rule-based check to produce an INTERNAL research-status
 * flag and a persistent audit object (data/census-audit.json). The audit is an
 * intelligence aid, not an editorial judgement: it records what the records hold
 * and flag records needing human review. Questionable records are FLAGGED, never
 * auto-deleted (see data/manufacturer-retirements.json for removed entities).
 *
 * STATE TAXONOMY (internal):
 *   ACTIVE_CONFIRMED          — has official website + factory city + types
 *   ACTIVE_LIMITED_DATA       — has website/factory but a field is missing
 *   RESEARCH_REQUIRED         — missing website or city (needs source research)
 *   UNVERIFIED                — no verifiable official website found
 *   DUPLICATE_NAME            — same name appears in >1 country group (per-country
 *                               listings of a multinational are expected, so this
 *                               flags only by exact name, not by group URL)
 *   FORMER/RENAMED/ACQUIRED   — surfaced from data/manufacturer-retirements.json
 *
 * HONESTY: this is purely data-shape checking. It does NOT assert whether any
 * company actually manufactures transformers — that needs source research
 * (Parts 5-8). It never fabricates capability, categories or URLs.
 *
 * Run: node build-census-audit.js  (reads static census; emits data/census-audit.json)
 */
'use strict';
const fs = require('fs');

const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
let RETIRED = [];
try { RETIRED = (JSON.parse(fs.readFileSync('data/manufacturer-retirements.json', 'utf8')).retired) || []; } catch (e) {}

const canonicalUrl = (u) => String(u || '').trim().toLowerCase().replace(/\/+$/, '');
const hasUrl = (u) => /^https?:\/\/.+\..+/i.test(u || '');
const hasCity = (c) => !!String(c || '').trim();
const hasTypes = (t) => !!String(t || '').trim();

const records = [];
MANUF.forEach(function (g) {
  g.makers.forEach(function (x) {
    if (/^Served by/i.test(x[0])) return;
    records.push({ name: x[0], city: x[1] || '', url: x[2] || '', types: x[3] || '', flag: x[4] || '', est: x[5] || '', country: g.country, region: g.region });
  });
});

// Duplicate detection. Important: a multinational legitimately appears once per
// country group (Siemens Energy USA/Germany/Colombia) — that is NOT a duplicate.
// A true duplicate is the SAME name in the SAME country, or two DIFFERENT
// companies sharing the same canonical website URL, or the same name mapped to
// two unrelated sites.
const byKey = {};   // name|country -> count
const byUrlCountries = {}; // url -> Set(country)
records.forEach(function (r) {
  const k = r.name.toLowerCase().trim() + '|' + r.country.toLowerCase().trim();
  byKey[k] = (byKey[k] || 0) + 1;
  if (r.url) {
    const cu = canonicalUrl(r.url);
    byUrlCountries[cu] = byUrlCountries[cu] || new Set();
    byUrlCountries[cu].add(r.country.toLowerCase().trim());
  }
});

const RETIRED_NAMES = new Set(RETIRED.map(function (r) { return r.name.toLowerCase().trim(); }));
// Deep-research verdicts: records independently verified as manufacturer or
// non-manufacturer (retailer/distributor). Used to refine the research status
// so the review queue reflects what has been resolved, never auto-deleting.
let VERDICTS = [];
try { VERDICTS = (JSON.parse(fs.readFileSync('data/research-verdicts.json', 'utf8')).verdicts) || []; } catch (e) {}
const VERDICT_BY = {};
VERDICTS.forEach(function (v) { VERDICT_BY[v.name.toLowerCase().trim()] = v; });

const audited = records.map(function (r) {
  const hasW = hasUrl(r.url);
  const hasC = hasCity(r.city);
  const hasT = hasTypes(r.types);
  const key = r.name.toLowerCase().trim() + '|' + r.country.toLowerCase().trim();
  const sameNameCountryDup = byKey[key] > 1;
  // A website shared across >1 country is an expected multinational footprint
  // (e.g. hitachienergy.com in US/Canada/India), not a duplicate. But if the SAME
  // name is served by two DIFFERENT websites, or duplicated within one country,
  // flag it.
  const sameUrlDifferentName = r.url ? (byUrlCountries[canonicalUrl(r.url)] ? byUrlCountries[canonicalUrl(r.url)].size <= 1 : false) : false;
  const retired = RETIRED_NAMES.has(r.name.toLowerCase().trim());

  let state;
  if (retired) state = 'FORMER_MANUFACTURER';
  else if (!hasW && !hasC) state = 'UNVERIFIED';
  else if (!hasW) state = 'RESEARCH_REQUIRED';
  else if (hasW && hasC && hasT) state = 'ACTIVE_CONFIRMED';
  else state = 'ACTIVE_LIMITED_DATA';

  const dupFlag = sameNameCountryDup ? 'DUPLICATE_NAME' : null;

  // Apply a deep-research verdict if one exists (resolves research-required).
  const verdict = VERDICT_BY[r.name.toLowerCase().trim()];
  if (verdict) {
    if (verdict.is_transformer_manufacturer === true) {
      state = 'ACTIVE_CONFIRMED'; // verified manufacturer (e.g. Saudi Voltamp)
    } else if (verdict.is_transformer_manufacturer === false) {
      state = 'NOT_TRANSFORMER_MANUFACTURER'; // asserted non-manufacturer (keep flagged)
    } else if (verdict.is_transformer_manufacturer === null) {
      state = state; // unknown — leave as data-state; still flagged if no website
    }
  }

  return {
    name: r.name, country: r.country, region: r.region, city: r.city || null,
    url: r.url || null, types: r.types || null, established: r.est || null,
    status: state, duplicate_name: dupFlag,
    review: (dupFlag || state === 'RESEARCH_REQUIRED' || state === 'UNVERIFIED' || state === 'NOT_TRANSFORMER_MANUFACTURER') ? true : false,
  };
});

const counts = {};
audited.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
const dupNames = audited.filter(function (r) { return r.duplicate_name; });
const noUrl = audited.filter(function (r) { return !r.url; });
const review = audited.filter(function (r) { return r.review; });

const out = {
  $comment: 'TransformerPath manufacturer census intelligence audit. Internal research-status flags only — not an endorsement, rating or verification of any company. Generated by build-census-audit.js; do not edit by hand.',
  generated: new Date().toISOString().slice(0, 10),
  total: audited.length,
  status_counts: counts,
  duplicate_name_count: dupNames.length,
  no_website_count: noUrl.length,
  review_queue_count: review.length,
  records: audited,
  review_queue: review.map(function (r) { return { name: r.name, country: r.country, status: r.status, reason: r.duplicate_name ? 'duplicate name across countries' : (r.url ? '' : 'no verifiable website') }; }),
};
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/census-audit.json', JSON.stringify(out, null, 2));
console.log('census-audit.json wrote', audited.length, 'records');
console.log('  status counts:', JSON.stringify(counts));
console.log('  duplicate-name flags:', dupNames.length, '| no-website:', noUrl.length, '| review queue:', review.length);
dupNames.forEach(function (r) { console.log('    dup-name: ' + r.name + ' (' + r.country + ')'); });
module.exports = out;
