#!/usr/bin/env node
/**
 * GATE: search precision (Phase-2 §2, §11).
 *
 * For high-intent category/capability queries, independently re-classifies the
 * top-10 returned results and requires >= 80% to genuinely match the intended
 * canonical category or sourced capability (not location/keyword leakage).
 *
 * Honest zero/low-result queries (a real data gap, e.g. testing laboratory) are
 * reported as research gaps and do NOT fail the gate — they must not be papered
 * over with fuzzy matches.
 */
const { search, matchCategory, matchLocation, matchVoltage } = require('./search-index');

const TARGET = 0.8;
const TOPN = 10;

// kind: 'category' | 'capability' | 'location' | 'intent-gap'
const CASES = [
  { q: '400 kV transformer Europe', kind: 'capability' },
  { q: 'transformer pressboard India', kind: 'category' },
  { q: '765 kV', kind: 'capability' },
  { q: 'OLTC', kind: 'category' },
  { q: 'transformerboard', kind: 'category' },
  { q: 'Saudi Arabia', kind: 'location' },
  { q: 'testing laboratory', kind: 'intent-gap' }
];

function isRelevant(kind, parse, rec) {
  if (kind === 'category') return matchCategory(rec, parse.categoryEntries);
  if (kind === 'capability') return matchVoltage(rec, parse.voltages);
  if (kind === 'location') return matchLocation(rec, parse.location);
  return false;
}

const errors = [];
const report = [];
for (const c of CASES) {
  const res = search(c.q);
  const top = res.ranked.slice(0, TOPN);
  const relevant = top.filter((s) => isRelevant(c.kind, res.parse, s.rec)).length;
  const precision = top.length ? relevant / top.length : null;
  report.push({ q: c.q, kind: c.kind, returned: res.total, top: top.length, relevant, precision, candidates: res.locationCandidates.length });

  if (c.kind === 'intent-gap') {
    // must NOT fabricate: a data-gap query should return no confident answers
    if (res.total > 0) errors.push('"' + c.q + '": expected research-gap (0), got ' + res.total + ' — no fuzzy fabrication allowed');
    continue;
  }
  if (top.length === 0) continue; // honest zero/low — research gap, allowed
  if (precision < TARGET) {
    errors.push('"' + c.q + '": top-' + top.length + ' precision ' + (precision * 100).toFixed(0) + '% < ' + TARGET * 100 + '%');
  }
}

console.log('SEARCH PRECISION GATE');
report.forEach((r) =>
  console.log(
    '  ' + r.q + '  [' + r.kind + ']  returned=' + r.returned + ' top=' + r.top +
      ' relevant=' + r.relevant + (r.precision == null ? ' (no results / gap)' : ' precision=' + (r.precision * 100).toFixed(0) + '%') +
      ' candidates=' + r.candidates
  )
);

if (errors.length) {
  console.error('\nSEARCH PRECISION GATE: FAIL');
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log('\nSEARCH PRECISION GATE: OK (top-10 precision >= ' + TARGET * 100 + '% on high-intent queries; gaps reported honestly)');
