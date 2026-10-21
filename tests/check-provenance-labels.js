#!/usr/bin/env node
/* tests/check-provenance-labels.js
 * A verified tick is the only public trust mark. Old phrases must not remain,
 * and a tick must carry a source URL and a real check date.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const badge = require('../lib/provenance-badge');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

console.log('=== VERIFIED TICK RULES ===');
const TITLE = /^Sourced · Source: .+ · checked \d{1,2} [A-Za-z]{3,9} \d{4}$/;
check('no source url renders nothing', badge.provenanceBadge({ confidence: 'HIGH', source_type: 'organiser site', checked_at: '2026-10-14' }) === '');
check('no check date renders nothing', badge.provenanceBadge({ confidence: 'HIGH', source_type: 'official source', source_url: 'https://example.com/official' }) === '');
check('non-http url renders nothing', badge.eventBadge({ date_status: 'CONFIRMED', source_url: 'javascript:alert(1)', source_checked_at: '2026-10-14' }) === '');
check('projected date is not upgraded', badge.eventBadge({ date_status: 'PROJECTED', source_url: 'https://example.com/e', source_checked_at: '2026-10-14' }) === '');
check('confirmed event without a check date renders nothing', badge.eventBadge({ date_status: 'CONFIRMED', source_url: 'https://elecrama.com/' }) === '');

const ev = badge.eventBadge({
  date_status: 'CONFIRMED',
  source_url: 'https://elecrama.com/',
  source_checked_at: '2026-10-14'
});
const evTitle = (ev.match(/title="([^"]*)"/) || [])[1];
check('confirmed event is a sourced tick', ev.indexOf('aria-label="Sourced"') >= 0 && ev.indexOf('aria-label="Verified"') < 0 && ev.indexOf('<svg') >= 0, ev);
check('confirmed event title names the source and date', TITLE.test(evTitle), evTitle);
check('confirmed event tooltip links the organiser site', ev.indexOf('href="https://elecrama.com/"') >= 0 && ev.indexOf('>organiser site</a>') >= 0);
check('confirmed event has no tier label', ev.indexOf('>Confirmed<') < 0 && ev.indexOf('tp-prov-tier') < 0);

const limited = badge.evidenceBadge({
  source_url: 'https://powerpeakdigest.com/story',
  source_type: 'industry_news',
  confidence: 'LIMITED',
  claim_type: 'INDEPENDENTLY_SOURCED',
  last_verified: '2026-08-28'
});
check('limited news renders nothing', limited === '', limited);

const supported = badge.provenanceBadge({
  provenance: 'SECONDARY',
  source_url: 'https://www.zawya.com/en/projects/example',
  source_label: 'trade press',
  checked_at: '2026-10-14'
});
check('supported source renders nothing', supported === '', supported);

const newsHigh = badge.resolveTier({ confidence: 'HIGH', source_type: 'industry_news' });
check('trade press does not become Confirmed', newsHigh === 'Supported', newsHigh);

const primary = badge.intelBadge({ provenance: 'PRIMARY', url: 'https://www.dewa.gov.ae/en/supplier/services/list-of-tender-documents', sourceName: 'dewa open tenders' });
check('intel item without a check date renders nothing', primary === '', primary);

const secondary = badge.intelBadge({ provenance: 'SECONDARY', url: 'https://www.zawya.com/en/projects/example', source_checked_at: '2026-09-12' });
check('secondary intel renders nothing', secondary === '');

const curated = badge.intelBadge({ provenance: 'CURATED', url: 'https://example.com/dir', source_checked_at: '2026-09-12' });
check('curated intel renders nothing', curated === '');

check('bare url with no grade renders nothing', badge.provenanceBadge({ source_url: 'https://example.com', checked_at: '2026-10-14' }) === '');
check('rejected grade renders nothing', badge.provenanceBadge({ source_url: 'https://example.com', source_type: 'official source', evidence_grade: 'REJECTED', checked_at: '2026-10-14' }) === '');

const listed = badge.directoryBadge({ website: 'https://example.com', verification_status: 'Listed — official website recorded', verification_date: '2026-09-13' });
check('directory listed renders nothing', listed === '');

const checked = badge.directoryBadge({ website: 'https://www.trench-group.com/', verification_status: 'WEBSITE_CHECKED', verification_date: '2026-09-14' });
const checkedTitle = (checked.match(/title="([^"]*)"/) || [])[1];
check('website check with a date is a sourced tick, not a Verified badge', checked.indexOf('aria-label="Sourced"') >= 0 && checked.indexOf('aria-label="Verified"') < 0 && checked.indexOf('href="https://www.trench-group.com/"') >= 0 && TITLE.test(checkedTitle), checkedTitle);

console.log('\n=== OLD LABEL STRINGS ===');
const FORBIDDEN = [
  { re: /Official Website Checked/, name: 'Official Website Checked' },
  { re: /SOURCE CHECKED/, name: 'SOURCE CHECKED' },
  { re: /Website checked/, name: 'Website checked' }
];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'data', 'archive', 'scratch', '.gemini', 'brain', 'vendor']);
const ALLOW = new Set([
  'lib/provenance-badge.js',
  'tests/check-provenance-labels.js'
]);

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  entries.forEach(function (ent) {
    if (ent.name.startsWith('.')) return;
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) return;
      walk(rel, out);
      return;
    }
    if (!/\.(html|js)$/.test(ent.name)) return;
    const norm = rel.replace(/\\/g, '/').replace(/^\.\//, '');
    if (ALLOW.has(norm)) return;
    out.push(norm);
  });
}

const files = [];
walk('.', files);
let hits = 0;
files.forEach(function (file) {
  const text = fs.readFileSync(file, 'utf8');
  FORBIDDEN.forEach(function (rule) {
    if (rule.re.test(text)) {
      console.error('  ✗ ' + file + ' still contains ' + rule.name);
      hits++;
      failed++;
    }
  });
});
check('no old trust labels in ' + files.length + ' html/js files', hits === 0, hits + ' hit(s)');

console.log('\n=== TICK REQUIRES SOURCE AND CHECK DATE ===');
const htmlFiles = files.filter(function (file) { return file.endsWith('.html'); });
const tickRe = /<button type="button" class="tp-prov-tick" title="([^"]*)"[^>]*>[\s\S]*?aria-label="Sourced"[\s\S]*?<a href="(https?:\/\/[^"]+)"/g;
let tickCount = 0;
let bareTicks = 0;
htmlFiles.forEach(function (file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/tp-prov-tier|tp-prov-confirmed|tp-prov-supported|tp-prov-listed/.test(text)) {
    console.error('  ✗ ' + file + ' still has a text provenance badge');
    bareTicks++;
    failed++;
  }
  const labels = text.match(/aria-label="Sourced"/g);
  if (/aria-label="Verified"/.test(text)) {
    console.error('  ✗ ' + file + ' still uses a Verified tick. Verified is only the paid manufacturer badge.');
    bareTicks++;
    failed++;
  }
  const n = labels ? labels.length : 0;
  if (!n) return;
  tickCount += n;
  let matched = 0;
  let m;
  tickRe.lastIndex = 0;
  while ((m = tickRe.exec(text))) {
    matched++;
    if (!TITLE.test(m[1]) || !m[2]) {
      console.error('  ✗ ' + file + ' tick is missing a source URL or check date :: ' + m[1]);
      bareTicks++;
      failed++;
    }
  }
  if (matched !== n) {
    console.error('  ✗ ' + file + ' has ' + n + ' verified tick(s) and ' + matched + ' with a source link and check date');
    bareTicks++;
    failed++;
  }
});
check('every verified tick has a source link and a check date (' + tickCount + ' ticks)', bareTicks === 0, bareTicks + ' problem(s)');

if (failed) {
  console.error('\nPROVENANCE LABEL GATE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('\nPROVENANCE LABEL GATE PASS');
