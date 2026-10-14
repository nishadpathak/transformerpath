#!/usr/bin/env node
/* tests/gcc-discovery-regression.js — GCC Intel discovery regression fixture.
 *
 * Asserts the discovery/classification pipeline WOULD catch known official
 * examples (DEWA 24 Sep distribution-substation tender, Bahrain EWA 1,000 kVA
 * package-substation tender, Oman transformer-component localisation).
 *
 * Does NOT hardcode these as permanent published Intel substitutes for source
 * discovery — it checks registry coverage + candidate pipeline behavior.
 *
 * Run: node tests/gcc-discovery-regression.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const gcc = require('../lib/gcc-discovery');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

console.log('=== GCC DISCOVERY REGRESSION ===');

const registry = readJson(path.join('data', 'gcc-source-registry.json'));
const input = readJson(path.join('data', 'gcc-sep-2026-discovery-input.json'));
const dictionary = readJson(path.join('data', 'gcc-discovery-dictionary.json'));
const result = gcc.runPipeline(input.candidates, registry.sources, { checkedAt: '2026-09-25' });
const fx = gcc.assertFixtures(result, registry.sources);

check('GCC source registry has entries', (registry.sources || []).length >= 15, String((registry.sources || []).length));
check('EN discovery dictionary present', (dictionary.english.core || []).length >= 10);
check('AR discovery dictionary present', (dictionary.arabic.core || []).length >= 10);
check('AR includes محول التأريض (earthing transformer)',
  (dictionary.arabic.core || []).some(function (t) { return t.term === 'محول التأريض'; }));
check('AR includes منافسة (Etimad tender)',
  (dictionary.arabic.procurement || []).some(function (t) { return t.term === 'منافسة'; }));

check('DEWA open tenders registered', registry.sources.some(function (s) { return s.source_id === 'dewa-open-tenders'; }));
check('Etimad registered', registry.sources.some(function (s) { return s.source_id === 'etimad'; }));
check('Bahrain Tender Board registered', registry.sources.some(function (s) { return s.source_id === 'bahrain-tender-board'; }));
check('MEWRE Kuwait registered', registry.sources.some(function (s) { return s.source_id === 'mewre-kuwait'; }));
check('KAHRAMAA registered', registry.sources.some(function (s) { return s.source_id === 'kahramaa'; }));

check('Fixture suite PASS', fx.pass, fx.failures.join(' | '));

const dewa = result.candidates.find(function (c) { return c.tender_id === '2122600155'; });
check('DEWA 2122600155 discovered', !!dewa);
check('DEWA classified as tender/utility procurement',
  dewa && dewa.classifications.indexOf('TENDER') >= 0);

const bh = result.candidates.find(function (c) { return String(c.tender_id || '').indexOf('389/2026') >= 0; });
check('Bahrain EWA 389/2026/BTB discovered', !!bh);
check('Bahrain rating 1000 kVA extracted', bh && bh.key_values_extracted && bh.key_values_extracted.rating === '1000 kVA');

const om = result.candidates.find(function (c) { return c.candidate_id === 'om-localisation-aug12'; });
check('Oman localisation discovered', !!om);
check('Oman event_date is 2026-08-12 (not 19 Sep)', om && om.dates.event_date === '2026-08-12');
check('Oman update_date is 2026-09-19', om && om.dates.update_date === '2026-09-19');
check('Oman classified FACTORY_INVESTMENT', om && om.classifications.indexOf('FACTORY_INVESTMENT') >= 0);
check('Oman classified LOCALISATION', om && om.classifications.indexOf('LOCALISATION') >= 0);
check('Oman CONFIRMED', om && om.evidence_grade === 'CONFIRMED');

check('Date fields not collapsed to single date', gcc.DATE_FIELDS.indexOf('event_date') >= 0 && gcc.DATE_FIELDS.indexOf('publication_date') >= 0);
check('Procurement states include OPEN/AWARDED/CLOSED', gcc.PROCUREMENT_STATES.indexOf('OPEN') >= 0 && gcc.PROCUREMENT_STATES.indexOf('AWARDED') >= 0);

const qa = result.market_watch.find(function (r) { return r.country === 'Qatar'; });
check('Qatar present in market watch', !!qa);
check('Freshness refuses DATA CURRENT from build clock', result.freshness.data_current_claim_allowed === false);

check('Pipeline does not auto-publish', /must NOT automatically become Intel/i.test(result.publish_rule));

// Ensure built artifacts exist after a prior build (optional soft check)
const builtCandidates = path.join('data', 'gcc-discovery-candidates.json');
if (fs.existsSync(builtCandidates)) {
  const built = readJson(builtCandidates);
  check('Built candidates artifact has Oman date split',
    (built.candidates || []).some(function (c) {
      return c.candidate_id === 'om-localisation-aug12' && c.dates.event_date === '2026-08-12' && c.dates.update_date === '2026-09-19';
    }));
}

console.log(failed ? '\nFAIL (' + failed + ')' : '\nPASS');
process.exit(failed ? 1 : 0);
