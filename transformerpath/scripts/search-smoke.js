#!/usr/bin/env node
/**
 * Search smoke tests (P0.7) + zero-result research-demand capture (P0.8).
 *
 * Runs the required smoke queries against the canonical search index, prints
 * results / entity types / confidence / zero-result status, and records any
 * zero-high-confidence query into the internal research-demand queue at
 * data/research-demand.json (never exposed publicly).
 *
 * This gate does NOT fail on zero results (an honest empty answer is correct);
 * it fails only if the index cannot be built or a query throws.
 */
const fs = require('fs');
const path = require('path');
const { buildIndex, search } = require('./search-index');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'data', 'research-demand.json');
const HIGH_CONFIDENCE = 0.5;

const QUERIES = [
  '765 kV',
  'transformerboard',
  'OLTC',
  'Saudi Arabia',
  'testing laboratory',
  '400 kV transformer Europe',
  'transformer pressboard India'
];

function normalize(q) {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

function recordDemand(query, resultsReturned) {
  let queue = { updatedAt: null, queries: {} };
  try {
    queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
  } catch (e) {
    /* first run */
  }
  const key = normalize(query);
  const entry = queue.queries[key] || {
    query,
    normalized_query: key,
    search_count: 0,
    last_searched: null,
    entity_type_intent: null,
    country_intent: null,
    technical_intent: null,
    results_returned: 0,
    research_status: 'open'
  };
  entry.search_count += 1;
  entry.last_searched = new Date().toISOString();
  entry.results_returned = resultsReturned;
  queue.queries[key] = entry;
  queue.updatedAt = new Date().toISOString();
  fs.writeFileSync(QUEUE, JSON.stringify(queue, null, 2) + '\n');
}

function main() {
  const index = buildIndex();
  console.log('Search index built: ' + index.length + ' records\n');

  let failed = 0;
  const summary = [];
  for (const q of QUERIES) {
    let res;
    try {
      res = search(q, index);
    } catch (err) {
      console.error('QUERY ERROR "' + q + '":', err.message);
      failed++;
      continue;
    }
    const high = [];
    Object.keys(res.groups).forEach((t) =>
      res.groups[t].forEach((s) => {
        if (s.confidence >= HIGH_CONFIDENCE) high.push(s);
      })
    );
    const zero = res.total === 0;
    const lowOnly = !zero && high.length === 0;
    console.log(
      'SEARCH: ' + q + '  → total ' + res.total + ' | byType ' + JSON.stringify(res.byType) +
        ' | high-confidence ' + high.length + (zero ? '  [ZERO-RESULT]' : lowOnly ? '  [LOW-CONFIDENCE ONLY]' : '')
    );
    Object.keys(res.groups).forEach((t) => {
      const top = res.groups[t]
        .slice(0, 3)
        .map((s) => (s.rec.displayName || s.rec.name) + ' (' + (s.confidence * 100).toFixed(0) + '%)')
        .join(', ');
      console.log('    ' + t + ': ' + top);
    });
    if (zero || lowOnly) recordDemand(q, res.total);
    summary.push({ query: q, total: res.total, byType: res.byType, highConfidence: high.length, zero });
  }

  console.log('\n=== SEARCH SMOKE SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  const zeros = summary.filter((s) => s.zero).map((s) => s.query);
  console.log('\nZero-result queries recorded to research-demand queue: ' + (zeros.length ? zeros.join(', ') : 'none'));

  if (failed) {
    console.error('\nSEARCH SMOKE FAILED (' + failed + ' query errors)');
    process.exit(1);
  }
  console.log('\nSEARCH SMOKE OK');
}

main();
