#!/usr/bin/env node
/* tests/check-provenance-labels.js
 * The provenance badge is the only public trust label. Old phrases must not
 * remain in pages or in the scripts that generate them.
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

console.log('=== PROVENANCE BADGE RULES ===');
check('no source url renders nothing', badge.provenanceBadge({ confidence: 'HIGH', source_type: 'organiser site' }) === '');
check('non-http url renders nothing', badge.eventBadge({ date_status: 'CONFIRMED', source_url: 'javascript:alert(1)', source_checked_at: '2026-10-14' }) === '');
check('projected date is not upgraded', badge.eventBadge({ date_status: 'PROJECTED', source_url: 'https://example.com/e', source_checked_at: '2026-10-14' }) === '');

const ev = badge.eventBadge({
  date_status: 'CONFIRMED',
  source_url: 'https://elecrama.com/',
  source_checked_at: '2026-10-14'
});
check('confirmed event names the tier', ev.indexOf('>Confirmed<') >= 0, ev);
check('confirmed event links the organiser site', ev.indexOf('href="https://elecrama.com/"') >= 0 && ev.indexOf('organiser site') >= 0);
check('confirmed event prints the real check date', ev.indexOf('checked 14 Oct 2026') >= 0);
check('confirmed event has a checkmark', ev.indexOf('tp-prov-mark') >= 0);

const limited = badge.evidenceBadge({
  source_url: 'https://powerpeakdigest.com/story',
  source_type: 'industry_news',
  confidence: 'LIMITED',
  claim_type: 'INDEPENDENTLY_SOURCED',
  last_verified: '2026-08-28'
});
check('limited news stays Listed', limited.indexOf('>Listed<') >= 0 && limited.indexOf('>Confirmed<') < 0 && limited.indexOf('>Supported<') < 0, limited);
check('limited news has no checkmark', limited.indexOf('tp-prov-mark') < 0);
check('limited news links trade press', limited.indexOf('trade press') >= 0 && limited.indexOf('https://powerpeakdigest.com/story') >= 0);
check('limited news keeps its check date', limited.indexOf('checked 28 Aug 2026') >= 0);

const newsHigh = badge.resolveTier({ confidence: 'HIGH', source_type: 'industry_news' });
check('trade press does not become Confirmed', newsHigh === 'Supported', newsHigh);

const primary = badge.intelBadge({ provenance: 'PRIMARY', url: 'https://www.dewa.gov.ae/en/supplier/services/list-of-tender-documents', sourceName: 'dewa open tenders' });
check('primary tender is Confirmed', primary.indexOf('>Confirmed<') >= 0 && primary.indexOf('official tender portal') >= 0);
check('intel item without a check date omits checked', primary.indexOf('checked ') < 0);

const secondary = badge.intelBadge({ provenance: 'SECONDARY', url: 'https://www.zawya.com/en/projects/example' });
check('secondary stays Supported', secondary.indexOf('>Supported<') >= 0 && secondary.indexOf('>Confirmed<') < 0);

const curated = badge.intelBadge({ provenance: 'CURATED', url: 'https://example.com/dir' });
check('curated stays Listed', curated.indexOf('tp-prov-listed') >= 0 && curated.indexOf('tp-prov-mark') < 0);

check('bare url with no grade renders nothing', badge.provenanceBadge({ source_url: 'https://example.com' }) === '');
check('rejected grade renders nothing', badge.provenanceBadge({ source_url: 'https://example.com', source_type: 'official source', evidence_grade: 'REJECTED' }) === '');

const listed = badge.directoryBadge({ website: 'https://example.com', verification_status: 'Listed — official website recorded', verification_date: '2026-09-13' });
check('directory listed is muted', listed.indexOf('tp-prov-listed') >= 0 && listed.indexOf('directory listing') >= 0);

const checked = badge.directoryBadge({ website: 'https://www.trench-group.com/', verification_status: 'WEBSITE_CHECKED', verification_date: '2026-09-14' });
check('website check is Confirmed official website', checked.indexOf('>Confirmed<') >= 0 && checked.indexOf('official website') >= 0 && checked.indexOf('checked 14 Sept 2026') >= 0);

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

if (failed) {
  console.error('\nPROVENANCE LABEL GATE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('\nPROVENANCE LABEL GATE PASS');
