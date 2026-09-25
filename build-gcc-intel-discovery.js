#!/usr/bin/env node
/* build-gcc-intel-discovery.js — GCC Intel P0 source-discovery layer.
 *
 * Builds:
 *   data/gcc-discovery-candidates.json  — graded Sep backfill + pipeline output
 *   data/gcc-market-watch.json          — per-country coverage matrix
 *   data/gcc-coverage-report.json       — required report artifact
 *   merges P0 GCC sources into data/source-registry.json (additive)
 *   extends data/freshness.json with gcc_market_watch honesty block
 *
 * Discovery ≠ publication. Nothing here auto-injects Daily Intel cards.
 *
 * Run: node build-gcc-intel-discovery.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const gcc = require('./lib/gcc-discovery');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);

const registry = readJson('data/gcc-source-registry.json', { sources: [] });
const discoveryInput = readJson('data/gcc-sep-2026-discovery-input.json', { candidates: [] });
const dictionary = readJson('data/gcc-discovery-dictionary.json', {});

const result = gcc.runPipeline(discoveryInput.candidates || [], registry.sources || [], {
  checkedAt: TODAY
});

// Separate internal coverage facts (e.g. Qatar zero) from publishable candidate counts
const coverageFacts = result.candidates.filter(function (c) {
  return c.publish_decision === 'INTERNAL_COVERAGE_ONLY';
});
const publishable = result.candidates.filter(function (c) {
  return c.publish_decision !== 'INTERNAL_COVERAGE_ONLY';
});
const pubCounts = { CONFIRMED: 0, SUPPORTED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 };
publishable.forEach(function (c) { pubCounts[c.evidence_grade] = (pubCounts[c.evidence_grade] || 0) + 1; });
result.counts = {
  candidates: publishable.length,
  confirmed: pubCounts.CONFIRMED,
  supported: pubCounts.SUPPORTED,
  review_required: pubCounts.REVIEW_REQUIRED,
  rejected: pubCounts.REJECTED,
  internal_coverage_facts: coverageFacts.length
};

// Mark Qatar negative coverage honestly in market watch
result.market_watch = result.market_watch.map(function (row) {
  if (row.country !== 'Qatar') return row;
  var qa = (result.candidates || []).find(function (c) { return c.candidate_id === 'qa-sept-zero'; });
  if (qa) {
    row.coverage_status = 'NO_QUALIFYING_ACTIVITY_FOUND';
    row.note = 'Zero qualifying September transformer-supply / station-EPC opportunities under defined scope. Valid. Do not fabricate.';
    row.new_candidates = 0;
    // keep confirmed count for the coverage fact itself separately
    row.internal_coverage_fact = true;
  }
  return row;
});

const candidatesOut = {
  $schema: 'https://transformerpath.com/gcc-discovery-candidates.schema.json',
  generated: NOW,
  window: discoveryInput.window || { from: '2026-09-01', to: '2026-09-25' },
  purpose: 'Graded GCC discovery candidates. NOT auto-published Intel.',
  pipeline: result.pipeline,
  publish_rule: result.publish_rule,
  classifications_supported: result.classifications_supported,
  procurement_states: result.procurement_states,
  date_fields: result.date_fields,
  dictionary_ref: 'data/gcc-discovery-dictionary.json',
  registry_ref: 'data/gcc-source-registry.json',
  counts: result.counts,
  internal_coverage_facts: coverageFacts.map(function (c) {
    return { candidate_id: c.candidate_id, country: c.country, title: c.title, evidence_grade: c.evidence_grade };
  }),
  freshness: result.freshness,
  candidates: result.candidates
};
writeJson('data/gcc-discovery-candidates.json', candidatesOut);

const marketWatch = {
  $schema: 'https://transformerpath.com/gcc-market-watch.schema.json',
  generated: NOW,
  purpose: 'Internal GCC coverage matrix. No stories ≠ discovery succeeded.',
  columns: ['COUNTRY', 'SOURCES_CHECKED', 'SOURCES_REGISTERED', 'NEW_CANDIDATES', 'CONFIRMED', 'SUPPORTED', 'REVIEW_REQUIRED', 'REJECTED', 'LAST_CHECK', 'COVERAGE_STATUS'],
  markets: result.market_watch,
  freshness: result.freshness
};
writeJson('data/gcc-market-watch.json', marketWatch);

// ── Missed-record analysis ─────────────────────────────────────────────────
function missedAnalysis(c) {
  return {
    candidate_id: c.candidate_id,
    country: c.country,
    title: c.title,
    found: true,
    source: (c.sources || []).map(function (s) { return s.url || s.source_id; }),
    source_types: (c.sources || []).map(function (s) { return s.source_type; }),
    why_previously_missed: c.why_previously_missed,
    classification: c.classifications,
    evidence_grade: c.evidence_grade,
    published: c.published_to_intel,
    publish_decision: c.publish_decision,
    dates: c.dates,
    date_correction: (c.dates && c.dates.event_date && c.dates.update_date && c.dates.event_date !== c.dates.update_date)
      ? { event_date: c.dates.event_date, update_date: c.dates.update_date, publication_date: c.dates.publication_date }
      : (c.dates && c.dates.event_date && c.dates.publication_date && c.dates.event_date !== c.dates.publication_date)
        ? { event_date: c.dates.event_date, publication_date: c.dates.publication_date }
        : null
  };
}

const byCountry = {};
gcc.GCC_COUNTRIES.forEach(function (c) { byCountry[c] = []; });
result.candidates.forEach(function (c) {
  if (!byCountry[c.country]) byCountry[c.country] = [];
  byCountry[c.country].push(c.candidate_id);
});

const newPrimary = (registry.sources || []).filter(function (s) {
  return s.primary_or_secondary === 'PRIMARY' || s.authority_class === 'OFFICIAL';
}).map(function (s) { return s.source_id; });
const newArabic = (registry.sources || []).filter(function (s) {
  return String(s.language || '').indexOf('ar') >= 0;
}).map(function (s) { return s.source_id; });
const newProcurement = (registry.sources || []).filter(function (s) {
  return ['PROCUREMENT_PORTAL', 'TENDER_BOARD', 'UTILITY', 'WATER_AUTHORITY', 'ENERGY_MINISTRY'].indexOf(s.source_type) >= 0;
}).map(function (s) { return s.source_id; });

const dateCorrections = result.candidates
  .map(missedAnalysis)
  .filter(function (m) { return m.date_correction; });

const report = {
  $schema: 'https://transformerpath.com/gcc-coverage-report.schema.json',
  generated: NOW,
  title: 'INTEL P0 — GCC TRANSFORMER ACTIVITY COVERAGE',
  gcc_coverage: {
    UAE: {
      candidates: byCountry['United Arab Emirates'],
      status: 'DEWA portal registered; Sep distribution-substation/kiosk tender SUPPORTED pending live adapter',
      sources_registered: result.market_watch.find(function (r) { return r.country === 'United Arab Emirates'; }).sources_registered
    },
    Saudi: {
      candidates: byCountry['Saudi Arabia'],
      status: 'Etimad + SWA registered; multiple Sep transformer procurements SUPPORTED/CONFIRMED from portal mirrors',
      sources_registered: result.market_watch.find(function (r) { return r.country === 'Saudi Arabia'; }).sources_registered
    },
    Kuwait: {
      candidates: byCountry['Kuwait'],
      status: 'MEWRE + CAPT registered; 75 MVA replacement/relocation/stage-2 programme SUPPORTED',
      sources_registered: result.market_watch.find(function (r) { return r.country === 'Kuwait'; }).sources_registered
    },
    Oman: {
      candidates: byCountry['Oman'],
      status: 'CONFIRMED localisation/manufacturing investment with event_date 2026-08-12 and update_date 2026-09-19',
      sources_registered: result.market_watch.find(function (r) { return r.country === 'Oman'; }).sources_registered
    },
    Bahrain: {
      candidates: byCountry['Bahrain'],
      status: 'Tender Board + EWA registered; 1000 kVA package-substation CONFIRMED; AML follow-ups REVIEW_REQUIRED',
      sources_registered: result.market_watch.find(function (r) { return r.country === 'Bahrain'; }).sources_registered
    },
    Qatar: {
      candidates: [],
      status: 'NO_QUALIFYING_ACTIVITY_FOUND for September under defined scope — zero is valid',
      sources_registered: result.market_watch.find(function (r) { return r.country === 'Qatar'; }).sources_registered
    }
  },
  backfill: result.counts,
  missed_record_analysis: result.candidates
    .filter(function (c) { return c.candidate_id !== 'qa-sept-zero'; })
    .map(missedAnalysis),
  source_registry: {
    new_primary_sources: newPrimary,
    new_arabic_sources: newArabic,
    new_procurement_sources: newProcurement,
    total_gcc_sources: (registry.sources || []).length
  },
  date_corrections: dateCorrections,
  pipeline: {
    discovery: 'GCC source registry + EN/AR dictionary + Sep discovery input → candidates',
    deduplication: 'canonical_procurement_id merges status events onto one record',
    source_checking: 'per-candidate sources[] with PRIMARY/SECONDARY roles; official preferred',
    classification: result.classifications_supported.join(', '),
    publishing: 'HOLD_FOR_REVIEW / REVIEW_QUEUE / INTERNAL_COVERAGE_ONLY — never auto-publish'
  },
  freshness: result.freshness,
  root_cause: {
    over_relied_on: [
      'English-language news',
      'Google-indexed articles',
      'manufacturer press releases',
      'existing RSS/news feeds (tdworld, power-eng, transformers-magazine, etc. — no GCC portals)'
    ],
    under_covered: [
      'utility procurement portals (DEWA, SEWA, KAHRAMAA)',
      'government tender boards (Bahrain BTB, Kuwait CAPT, Etimad)',
      'water authorities (Saudi Water Authority)',
      'electricity authorities / ministries (MEWRE, EWA, SEC)',
      'Arabic-language sources and vocabulary (محول، محول التأريض، منافسة، توطين)',
      'regulators and investment authorities (APSR, Invest Oman)',
      'local business publications for update_date semantics',
      'procurement status changes on a single canonical ID'
    ]
  },
  tests: null,
  dictionary_term_counts: {
    english_core: (dictionary.english && dictionary.english.core || []).length,
    arabic_core: (dictionary.arabic && dictionary.arabic.core || []).length
  }
};

// Run fixture regression inline and attach
const fixture = gcc.assertFixtures(result, registry.sources || []);
report.tests = {
  gcc_discovery_regression: fixture.pass ? 'PASS' : 'FAIL',
  failures: fixture.failures
};
writeJson('data/gcc-coverage-report.json', report);

// ── Merge P0 GCC sources into global source-registry (additive) ─────────────
const globalReg = readJson('data/source-registry.json', { sources: [] });
const existingIds = new Set((globalReg.sources || []).map(function (s) { return s.source_id; }));
let added = 0;
(registry.sources || []).forEach(function (s) {
  if (existingIds.has(s.source_id)) return;
  // Map GCC-specific types onto global enum where needed
  var mappedType = s.source_type;
  var globalTypes = globalReg.source_type_enum || [];
  if (globalTypes.indexOf(mappedType) < 0) {
    if (mappedType === 'TENDER_BOARD' || mappedType === 'WATER_AUTHORITY' || mappedType === 'TRANSMISSION_OPERATOR' || mappedType === 'DISTRIBUTION_UTILITY' || mappedType === 'ENERGY_MINISTRY' || mappedType === 'INDUSTRY_MINISTRY' || mappedType === 'INVESTMENT_AUTHORITY') {
      // extend enum
      if (globalTypes.indexOf(mappedType) < 0) globalReg.source_type_enum.push(mappedType);
    } else if (mappedType === 'CREDIBLE_TRADE_PRESS') {
      mappedType = 'INDUSTRY_MEDIA';
    }
  }
  globalReg.sources.push({
    source_id: s.source_id,
    name: s.organization,
    domain: s.domain,
    canonical_domain: s.canonical_domain || s.domain,
    domains: s.domains || [],
    source_type: mappedType,
    country: s.country || '',
    region: 'GCC',
    language: s.language || 'en',
    authority_class: s.authority_class || 'OFFICIAL',
    primary_or_secondary: s.primary_or_secondary || 'PRIMARY',
    topics: s.topics || [],
    entities_followed: [],
    discovery_method: s.discovery_method || 'curated',
    active: s.status !== 'BLOCKED_AUTH',
    last_checked_at: s.last_checked,
    last_success_at: s.last_success,
    notes: (s.notes || '') + ' [via gcc-source-registry; priority=' + (s.priority || '') + '; crawl=' + (s.crawl_frequency || '') + '; status=' + (s.status || '') + ']'
  });
  added++;
});
globalReg.generated = TODAY;
globalReg.gcc_extension = {
  merged_at: NOW,
  added: added,
  registry_ref: 'data/gcc-source-registry.json'
};
writeJson('data/source-registry.json', globalReg);

// ── Freshness honesty block ────────────────────────────────────────────────
const freshness = readJson('data/freshness.json', {});
freshness.gcc_market_watch = {
  generated: NOW,
  statement: result.freshness.statement,
  markets_registered: result.freshness.markets_registered,
  markets_adapter_live: result.freshness.markets_adapter_live,
  latest_confirmed_event_date: result.freshness.latest_confirmed_event_date,
  data_current_claim_allowed: false,
  honesty: result.freshness.honesty,
  surface_id: 'gcc_discovery',
  status: result.freshness.markets_adapter_live === 6 ? 'HEALTHY' : 'MANUAL_REVIEW',
  source_health: 'GCC source registry populated; portal adapters NEEDS_ADAPTER until live crawl stamps last_checked'
};
// Add surface row if missing
freshness.surfaces = freshness.surfaces || [];
var gccSurfaceIdx = freshness.surfaces.findIndex(function (s) { return s.id === 'gcc_discovery'; });
var gccSurface = {
  id: 'gcc_discovery',
  name: 'GCC Intel discovery',
  cadence: 'daily (when adapters live)',
  description: 'GCC utility/tender-board/water-authority discovery layer. Distinct from curated Daily Intel. Discovery does not equal publication.',
  last_build: NOW,
  last_data_refresh: null,
  last_attempted_refresh: TODAY,
  last_successful_refresh: null,
  latest_source_observation: result.freshness.latest_confirmed_event_date,
  records_added: result.counts.candidates,
  records_updated: null,
  source_count: (registry.sources || []).length,
  source_failures: null,
  status: 'MANUAL_REVIEW',
  source_health: result.freshness.statement,
  records: result.counts.candidates
};
if (gccSurfaceIdx >= 0) freshness.surfaces[gccSurfaceIdx] = gccSurface;
else freshness.surfaces.push(gccSurface);

freshness.sources = freshness.sources || [];
var gccSrcIdx = freshness.sources.findIndex(function (s) { return s.name === 'GCC procurement & authority registry'; });
var gccSrc = {
  name: 'GCC procurement & authority registry',
  type: 'gcc-source-registry',
  region: 'GCC',
  works_for: ['gcc_discovery', 'daily_intel', 'tenders'],
  last_checked: null,
  last_success: null,
  latest_content_date: result.freshness.latest_confirmed_event_date,
  failure_count: null,
  status: 'MANUAL_REVIEW'
};
if (gccSrcIdx >= 0) freshness.sources[gccSrcIdx] = gccSrc;
else freshness.sources.push(gccSrc);
freshness.generated = NOW;
writeJson('data/freshness.json', freshness);

console.log('GCC discovery: ' + result.counts.candidates + ' candidates (' +
  result.counts.confirmed + ' confirmed, ' +
  result.counts.supported + ' supported, ' +
  result.counts.review_required + ' review, ' +
  result.counts.rejected + ' rejected)');
console.log('Freshness: ' + result.freshness.statement);
console.log('Regression: ' + (fixture.pass ? 'PASS' : 'FAIL') + (fixture.failures.length ? ' — ' + fixture.failures.join('; ') : ''));
console.log('Merged ' + added + ' GCC sources into source-registry.json');

if (!fixture.pass) process.exitCode = 1;
