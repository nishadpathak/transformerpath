#!/usr/bin/env node
/* tests/oct-intel-freshness-regression.js
 * Fetched 9-14 Oct 2026 items are in the feed, and GCC latest_sourced is not
 * stuck on the September candidate clock.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

console.log('=== OCT INTEL FRESHNESS ===');
const coverage = JSON.parse(fs.readFileSync('data/gcc-source-coverage.json', 'utf8'));
check('latest_sourced_overall is in October 2026', coverage.latest_sourced_overall >= '2026-10-09', coverage.latest_sourced_overall);

const candidates = JSON.parse(fs.readFileSync('data/gcc-discovery-candidates.json', 'utf8')).candidates || [];
const mou = candidates.find(function (c) { return c.candidate_id === 'gcc-uae-saudi-grid-mou-2026-10-09'; });
const sppc = candidates.find(function (c) { return c.candidate_id === 'sa-sppc-grid-scale-2026-10-13'; });
check('UAE-Saudi MoU candidate kept as grid news', !!(mou && mou.grid_news === true && mou.transformer_relevant === false));
check('MoU publication date is 9 Oct 2026', !!(mou && mou.dates && mou.dates.publication_date === '2026-10-09'));
check('SPPC grid item publication date is 13 Oct 2026', !!(sppc && sppc.dates && sppc.dates.publication_date === '2026-10-13'));

const feed = JSON.parse(fs.readFileSync('data/intel-feed-ui.json', 'utf8'));
check('feed latest source is 13 Oct 2026 or later', feed.honesty && feed.honesty.latest_source_iso >= '2026-10-13', feed.honesty && feed.honesty.latest_source_iso);
const headlines = (feed.posts || []).map(function (p) { return p.headline || ''; }).join('\n');
check('feed contains the UAE-Saudi interconnection item', /electricity interconnection/i.test(headlines));
check('feed contains the Hitachi Energy 13 Oct item', /Hitachi Energy/i.test(headlines) && /India investments/i.test(headlines));

const uae = fs.readFileSync('markets/uae/index.html', 'utf8');
const sourcedStat = (uae.match(/<div class="s"><b>(\d+)<\/b><span>sourced plants<\/span>/) || [])[1];
check('UAE sourced plants is 8', sourcedStat === '8', sourcedStat);
check('UAE page links a fetched company source', /beta-transformers\.ae/.test(uae) && /federalpowertransformers\.com/.test(uae));
check('Al Budoor stays in the research queue', /Al Budoor Transformers/.test(uae) && /data-research-status="TO_RESEARCH"/.test(uae));

if (failed) {
  console.error('OCT INTEL FRESHNESS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('OCT INTEL FRESHNESS OK — latest_sourced ' + coverage.latest_sourced_overall + ', feed ' + feed.honesty.latest_source_iso + ', UAE plants ' + sourcedStat);
