#!/usr/bin/env node
/**
 * GATE: canonical stat consistency (P0.1 / P0.2).
 *
 * Fails the build if:
 *  1. data/platform-stats.json is stale vs. the canonical computation.
 *  2. The homepage manufacturer count is not bound via data-stat.
 *  3. Any public HTML hard-codes a platform manufacturer count as a raw literal
 *     (e.g. "519 transformer makers" or "census of 519") instead of binding it.
 *  4. The data-stat fallback literal disagrees with the canonical value.
 */
const fs = require('fs');
const path = require('path');
const { computeStats } = require('./build-stats');

const ROOT = path.join(__dirname, '..');
const errors = [];

function publicHtml() {
  return fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
}

const canonical = computeStats();

// 1) platform-stats.json must be current.
try {
  const onDisk = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'platform-stats.json'), 'utf8'));
  if (JSON.stringify(onDisk.stats) !== JSON.stringify(canonical)) {
    errors.push('data/platform-stats.json is STALE — run: node scripts/build-stats.js');
  }
} catch (e) {
  errors.push('data/platform-stats.json missing/unreadable — run: node scripts/build-stats.js');
}

const html = publicHtml();

// 2) + 3) No raw hard-coded manufacturer count in any public template.
const RAW_COUNT = /([\d,]{2,})\s*transformer makers/gi;
const RAW_CENSUS = /census of\s+[\d,]+/gi;
for (const { file, text } of html) {
  let m;
  while ((m = RAW_COUNT.exec(text))) {
    errors.push(file + ': hard-coded manufacturer count "' + m[0].trim() + '" — bind via data-stat="manufacturerListings".');
  }
  if (RAW_CENSUS.test(text)) {
    errors.push(file + ': hard-coded "census of <n>" — bind via data-stat="manufacturerListings".');
  }
}

// 4) Homepage must bind the count, and the fallback literal must match canonical.
const home = html.find((h) => h.file === 'index.html');
if (home) {
  const bind = /data-stat="manufacturerListings"[^>]*>\s*([\d,]+)\s*</.exec(home.text);
  if (!bind) {
    errors.push('index.html: manufacturer count is not bound via data-stat="manufacturerListings".');
  } else {
    const fallback = parseInt(bind[1].replace(/,/g, ''), 10);
    if (fallback !== canonical.manufacturerListings) {
      errors.push(
        'index.html: data-stat fallback ' + fallback + ' != canonical ' + canonical.manufacturerListings + '.'
      );
    }
  }
}

if (errors.length) {
  console.error('STAT CONSISTENCY GATE: FAIL');
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log('STAT CONSISTENCY GATE: OK (manufacturerListings=' + canonical.manufacturerListings +
  ', companies=' + canonical.manufacturerCompanies + ', countries=' + canonical.manufacturingCountries + ')');
