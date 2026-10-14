#!/usr/bin/env node
/* 14 Oct 2026 multilingual intel: only fetched items, and the coverage
 * claim stays disallowed. A same-day source does not mint DATA CURRENT.
 */
'use strict';
const fs = require('fs');
const { classifyIntelStatus } = require('../lib/intel-freshness');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

console.log('=== 14 OCT LANGUAGE INTEL ===');
const items = JSON.parse(fs.readFileSync('data/intel-news.json', 'utf8'));
const want = [
  {
    url: 'https://www.bidding.csg.cn/fzbgg/1200445701.jhtml',
    lang: 'zh',
    cls: 'PIPELINE'
  },
  {
    url: 'https://technews.tw/2026/10/14/delta-electronics-800-vdc-sst-debut-sofc-pilot-production-starts-year-end/',
    lang: 'zh-Hant',
    cls: 'INFERRED'
  },
  {
    url: 'https://m.ne21.com/news/show-231454.html',
    lang: 'zh',
    cls: 'INFERRED'
  },
  {
    url: 'https://www.yenicaggazetesi.com/turkiye-elektrik-dagitim-as-3-bolge-mudurlugunden-kamulastirma-ilani-1081278h.htm',
    lang: 'tr',
    cls: 'INFERRED'
  }
];
check('four fetched 14 Oct items', want.length === 4);
want.forEach(function (w) {
  const it = items.find(function (x) { return x.url === w.url; });
  check(w.lang + ' item present', !!it, w.url);
  if (!it) return;
  check(w.url + ' publication is 14 Oct 2026', it.publication_date === '2026-10-14' && it.date_iso === '2026-10-14');
  check(w.url + ' language noted', it.lang === w.lang && it.src.indexOf('[' + w.lang) !== -1, it.lang + ' ' + it.src);
  check(w.url + ' is English copy with an https source', /^https:\/\//.test(it.url) && it.title && it.snippet);
  check(w.url + ' is not marked CONFIRMED', it.cls === w.cls && it.cls !== 'CONFIRMED', it.cls);
});

const coverage = JSON.parse(fs.readFileSync('data/gcc-coverage-report.json', 'utf8'));
const claim = coverage.freshness && coverage.freshness.data_current_claim_allowed;
check('data-current claim stays disallowed', claim === false, String(claim));

const now = new Date('2026-10-14T18:00:00.000Z');
const status = classifyIntelStatus({
  latestSourceIso: '2026-10-14',
  latestCheckedAt: '2026-10-14',
  buildAt: now.toISOString(),
  dataCurrentClaimAllowed: false,
  now: now
});
check('same-day source stays INTEL COVERAGE DELAYED', status.statusLabel === 'INTEL COVERAGE DELAYED', status.statusLabel + ' ' + status.reason);

const builder = fs.readFileSync('build-intel-news.js', 'utf8');
check('builder stamps publication_date into the page', /publication_date/.test(builder) && /date_iso/.test(builder));

if (failed) {
  console.error('14 OCT LANGUAGE INTEL FAILED (' + failed + ')');
  process.exit(1);
}
console.log('14 OCT LANGUAGE INTEL OK — 4 items (zh, zh-Hant, tr); claim still disallowed');
