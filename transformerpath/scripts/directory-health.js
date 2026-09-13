#!/usr/bin/env node
/**
 * Directory Health dashboard (§20) + Priority Research Queue (§21).
 *
 * Computes, from the canonical data model only, how deep the directory actually
 * is: completeness bands, missing-field tallies, per-priority-tier completeness,
 * taxonomy mapping, duplicate-name candidates, broken/missing websites, and a
 * demand-weighted "Top records to improve" list. Nothing is invented — honest
 * low scores are the whole point (they tell researchers what to enrich).
 *
 * Writes data/directory-health.json (internal, gitignored) and prints a report.
 */
const fs = require('fs');
const path = require('path');
const { buildIndex } = require('./search-index');
const schema = require('./lib/profile-schema');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'directory-health.json');

function loadJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function isHttpUrl(u) {
  return /^https?:\/\/[^\s]+\.[^\s]+/.test(String(u || '').trim());
}

function main() {
  const index = buildIndex();
  const evidence = (loadJson('data/profile-evidence.json', {}) || {}).records || {};
  const taxonomy = loadJson('data/taxonomy.json', {});
  const demand = (loadJson('data/research-demand.json', { queries: {} }) || {}).queries || {};

  const companies = index.filter((r) => r.type === 'company');
  const components = index.filter((r) => r.type === 'component');
  const utilities = index.filter((r) => r.type === 'utility');

  const bands = { STUB: 0, BASIC: 0, DEVELOPED: 0, STRONG: 0, COMPREHENSIVE: 0 };
  const missing = { website: 0, country: 0, facilities: 0, products: 0, technical: 0, standards: 0, sources: 0 };
  const tiers = { A: { n: 0, sum: 0 }, B: { n: 0, sum: 0 }, C: { n: 0, sum: 0 } };
  const nameSeen = {};
  const scored = [];
  let totalScore = 0;
  let brokenOrMissingWebsite = 0;

  for (const rec of companies) {
    const ev = evidence[schema.slugId(rec.displayName || rec.name)] || {};
    const c = schema.completeness(rec, ev);
    const pri = schema.priorityTier(rec, ev);
    bands[c.band]++;
    totalScore += c.score;
    tiers[pri.tier].n++;
    tiers[pri.tier].sum += c.score;

    if (!(isHttpUrl(rec.url) || isHttpUrl(rec.website))) {
      missing.website++;
      brokenOrMissingWebsite++;
    }
    if (!rec.country) missing.country++;
    if (c.confirmedFacilities === 0) missing.facilities++;
    if (c.breakdown.products === 0) missing.products++;
    if (c.breakdown.technical === 0) missing.technical++;
    if (c.breakdown.standards === 0) missing.standards++;
    if (c.breakdown.evidence === 0) missing.sources++;

    const key = (rec.displayName || rec.name).toLowerCase().replace(/[^a-z0-9]/g, '');
    (nameSeen[key] ??= []).push(rec.displayName || rec.name);

    scored.push({ id: c.id, name: c.name, score: c.score, band: c.band, tier: pri.tier, tierReasons: pri.reasons, source: rec.source });
  }

  // Duplicate-name candidates (flag only — never auto-merge).
  const duplicates = Object.values(nameSeen)
    .filter((arr) => arr.length > 1)
    .map((arr) => ({ name: arr[0], count: arr.length }));

  // Taxonomy mapping (§23): every listing transformer-type code must map.
  const legacyMap = taxonomy.legacyTypeMap || {};
  let mappedTypes = 0;
  let unmappedTypes = 0;
  const unmappedSamples = new Set();
  for (const rec of companies) {
    const codes = String(rec.transformerTypes || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    for (const code of codes) {
      if (legacyMap[code]) mappedTypes++;
      else {
        unmappedTypes++;
        unmappedSamples.add(code);
      }
    }
  }

  // Priority Research Queue (§21): demand-weighted incompleteness.
  const tierWeight = { A: 3, B: 2, C: 1 };
  const improve = scored
    .map((s) => {
      const dem = Object.values(demand).reduce((acc, q) => {
        const nm = (q.query || '').toLowerCase();
        return acc + (nm && s.name.toLowerCase().includes(nm) ? (q.search_count || 1) : 0);
      }, 0);
      const incompleteness = 100 - s.score;
      const priorityScore = incompleteness * tierWeight[s.tier] + dem * 20;
      return { ...s, demand: dem, priorityScore };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const report = {
    generatedAt: new Date().toISOString(),
    counts: {
      companies: companies.length,
      components: components.length,
      utilities: utilities.length,
      // Not yet modelled as sourced records:
      facilities: 0,
      materials: 0,
      machinery: 0,
      labs: 0,
      services: 0
    },
    averageCompleteness: companies.length ? Math.round(totalScore / companies.length) : 0,
    bands,
    priorityTiers: {
      A: { count: tiers.A.n, avgCompleteness: tiers.A.n ? Math.round(tiers.A.sum / tiers.A.n) : 0, target: 85 },
      B: { count: tiers.B.n, avgCompleteness: tiers.B.n ? Math.round(tiers.B.sum / tiers.B.n) : 0, target: 70 },
      C: { count: tiers.C.n, avgCompleteness: tiers.C.n ? Math.round(tiers.C.sum / tiers.C.n) : 0, target: 50 }
    },
    missingFields: missing,
    taxonomy: {
      mappedTypeOccurrences: mappedTypes,
      unmappedTypeOccurrences: unmappedTypes,
      unmappedSamples: [...unmappedSamples],
      mappedPct: mappedTypes + unmappedTypes ? Math.round((mappedTypes / (mappedTypes + unmappedTypes)) * 100) : 100
    },
    dataQuality: {
      duplicateNameCandidates: duplicates.length,
      brokenOrMissingWebsites: brokenOrMissingWebsite,
      zeroResultDemandQueries: Object.keys(demand).length
    },
    topToImprove: improve.slice(0, 100)
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

  // Human report
  console.log('=== DIRECTORY HEALTH ===');
  console.log('Companies:', report.counts.companies, '| Components:', report.counts.components, '| Utilities:', report.counts.utilities);
  console.log('Facilities/Materials/Machinery/Labs/Services (sourced records):', 0);
  console.log('Average completeness:', report.averageCompleteness + '%');
  console.log('Bands:', JSON.stringify(bands));
  console.log('Priority A:', JSON.stringify(report.priorityTiers.A));
  console.log('Priority B:', JSON.stringify(report.priorityTiers.B));
  console.log('Priority C:', JSON.stringify(report.priorityTiers.C));
  console.log('Missing fields:', JSON.stringify(missing));
  console.log('Taxonomy mapped:', report.taxonomy.mappedPct + '% (' + unmappedTypes + ' unmapped occurrences)');
  console.log('Duplicate-name candidates:', duplicates.length, '| Broken/missing websites:', brokenOrMissingWebsite);
  console.log('\nTop 25 records to improve (demand-weighted incompleteness):');
  report.topToImprove.slice(0, 25).forEach((r, i) => {
    console.log('  ' + String(i + 1).padStart(2) + '. [' + r.tier + '] ' + r.name + '  (' + r.score + '% ' + r.band + ')  ' + r.tierReasons.join(','));
  });
  console.log('\nWrote ' + path.relative(ROOT, OUT));
}

main();
