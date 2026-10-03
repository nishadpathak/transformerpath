#!/usr/bin/env node
/* tests/intel-date-order-regression.js */
'use strict';
const g = require('../lib/gcc-discovery');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('  ✓', m); };

console.log('=== INTEL DATE ORDER REGRESSION ===');

const omanStyle = g.normalizeCandidate({
  title: 'Oman localises transformer production',
  event_date: '2026-08-12',
  publication_date: '2026-07-02',
  classifications: ['CAPACITY', 'LOCALISATION'],
  sources: [{ role: 'SECONDARY', authority_class: 'INDUSTRY_MEDIA' }],
  key_values_extracted: true
});
assert(omanStyle.evidence_grade === 'REVIEW_REQUIRED', 'Oman-style pub<event → REVIEW_REQUIRED');

const explained = g.normalizeCandidate({
  title: 'Oman localises transformer production',
  event_date: '2026-08-12',
  publication_date: '2026-07-02',
  publication_before_event_reason: 'Earlier MoU coverage; agreements signed 12 Aug',
  allow_publication_before_event: true,
  classifications: ['CAPACITY'],
  sources: [{ role: 'PRIMARY', authority_class: 'OFFICIAL' }],
  key_values_extracted: true
});
assert(explained.evidence_grade === 'CONFIRMED', 'explicit explanation may stay CONFIRMED');

const tender = g.normalizeCandidate({
  title: 'MEWRE transformer replacement tender',
  event_date: '2026-09-12',
  publication_date: '2026-09-07',
  tender_id: 'CAPT-GOV-KW-12/2025/2026',
  classifications: ['PIPELINE'],
  sources: [{ role: 'SECONDARY' }],
  key_values_extracted: true
});
assert(tender.evidence_grade !== 'REVIEW_REQUIRED' || tender.evidence_grade === 'SUPPORTED' || tender.evidence_grade === 'CONFIRMED',
  'tender aggregator listing before float is not forced REVIEW_REQUIRED');

console.log('PASS — intel date order');
