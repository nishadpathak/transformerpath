'use strict';
/* lib/gcc-intel-review.js — single review ledger for GCC discovery → Intel.
 *
 * Discovery candidates are not publication. A row is publishable only when
 * data/gcc-intel-review.json says decision=PUBLISH and a reviewer plus
 * reviewed_at are set. HOLD and REJECT never publish. There is no
 * evidence-grade bypass and no approve[] bypass.
 */
const fs = require('fs');
const path = require('path');

const EVIDENCE = ['CONFIRMED', 'SUPPORTED', 'WEAK', 'UNSOURCED'];
const DECISIONS = ['PUBLISH', 'HOLD', 'REJECT'];
const HOLD_REASONS = [
  'AWAITING_HUMAN_REVIEW',
  'REVIEW_REQUIRED',
  'INTERNAL_COVERAGE_ONLY',
  'DUPLICATE_OF_CURATED'
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}

function loadReview(rel) {
  const doc = readJson(rel || 'data/gcc-intel-review.json');
  return doc.reviews || [];
}

function byId(reviews) {
  const map = {};
  (reviews || []).forEach(function (r) {
    if (r && r.candidate_id) map[r.candidate_id] = r;
  });
  return map;
}

function isPublishable(review) {
  if (!review) return false;
  if (review.decision !== 'PUBLISH') return false;
  if (review.reviewer == null || String(review.reviewer).trim() === '') return false;
  if (review.reviewed_at == null || String(review.reviewed_at).trim() === '') return false;
  return true;
}

function tally(candidates, reviews) {
  const map = byId(reviews);
  const totals = { candidates: 0, published: 0, held_for_review: 0, rejected: 0, missing_review: 0 };
  (candidates || []).forEach(function (c) {
    if (!c || !c.candidate_id) return;
    totals.candidates++;
    const r = map[c.candidate_id];
    if (!r) {
      totals.missing_review++;
      totals.held_for_review++;
      return;
    }
    if (isPublishable(r)) totals.published++;
    else if (r.decision === 'REJECT') totals.rejected++;
    else totals.held_for_review++;
  });
  return totals;
}

module.exports = {
  EVIDENCE,
  DECISIONS,
  HOLD_REASONS,
  readJson,
  loadReview,
  byId,
  isPublishable,
  tally
};
