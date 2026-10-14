#!/usr/bin/env node
/* check-gcc-intel-review.js — CI gate for the GCC Intel review ledger.
 *
 * Fails unless every discovery candidate has exactly one review row, PUBLISH
 * rows have reviewer and reviewed_at, and no HOLD/REJECT row is publishable.
 */
'use strict';
const fs = require('fs');
const reviewLib = require('./lib/gcc-intel-review');

let failed = 0;
function fail(msg) {
  console.error('GCC REVIEW GATE: ' + msg);
  failed++;
}

const schema = JSON.parse(fs.readFileSync('data/gcc-intel-review.schema.json', 'utf8'));
const doc = JSON.parse(fs.readFileSync('data/gcc-intel-review.json', 'utf8'));
const candidates = JSON.parse(fs.readFileSync('data/gcc-discovery-candidates.json', 'utf8')).candidates || [];

if (doc.$schema !== schema.$id) fail('ledger $schema must be ' + schema.$id);
if (!Array.isArray(doc.reviews) || !doc.reviews.length) fail('reviews array missing');

const seen = {};
(doc.reviews || []).forEach(function (r) {
  if (!r || !r.candidate_id) { fail('review missing candidate_id'); return; }
  if (seen[r.candidate_id]) fail('duplicate review ' + r.candidate_id);
  seen[r.candidate_id] = r;
  if (reviewLib.EVIDENCE.indexOf(r.evidence_status) < 0) fail(r.candidate_id + ' bad evidence_status ' + r.evidence_status);
  if (reviewLib.DECISIONS.indexOf(r.decision) < 0) fail(r.candidate_id + ' bad decision ' + r.decision);
  if (!Array.isArray(r.source_urls)) fail(r.candidate_id + ' source_urls must be an array');
  if (r.decision === 'PUBLISH') {
    if (!reviewLib.isPublishable(r)) fail(r.candidate_id + ' PUBLISH missing reviewer or reviewed_at');
    if (r.hold_reason != null) fail(r.candidate_id + ' PUBLISH must not carry a hold_reason');
  } else {
    if (reviewLib.isPublishable(r)) fail(r.candidate_id + ' non-PUBLISH row is publishable');
    if (!r.hold_reason || reviewLib.HOLD_REASONS.indexOf(r.hold_reason.code) < 0) {
      fail(r.candidate_id + ' hold_reason.code missing or unknown');
    }
    if (!r.hold_reason || typeof r.hold_reason.text !== 'string' || !r.hold_reason.text.trim()) {
      fail(r.candidate_id + ' hold_reason.text required');
    }
  }
  if (r.decision === 'HOLD' && r.reviewer != null) {
    fail(r.candidate_id + ' HOLD row must keep reviewer null until a person reviews it');
  }
  if (r.decision === 'REJECT' && !reviewLib.isPublishable({ decision: 'PUBLISH', reviewer: r.reviewer, reviewed_at: r.reviewed_at })) {
    fail(r.candidate_id + ' REJECT requires reviewer and reviewed_at');
  }
});

candidates.forEach(function (c) {
  if (!seen[c.candidate_id]) fail('candidate missing review row ' + c.candidate_id);
});
Object.keys(seen).forEach(function (id) {
  if (!candidates.some(function (c) { return c.candidate_id === id; })) fail('review for unknown candidate ' + id);
});

const totals = reviewLib.tally(candidates, doc.reviews);
const publishable = doc.reviews.filter(reviewLib.isPublishable);
if (publishable.length !== totals.published) fail('publishable count drifted from ledger tally');
publishable.forEach(function (r) {
  if (r.decision !== 'PUBLISH') fail('publishable non-PUBLISH ' + r.candidate_id);
});
const heldPublished = doc.reviews.filter(function (r) {
  return r.decision !== 'PUBLISH' && reviewLib.isPublishable(r);
});
if (heldPublished.length) fail('held candidates marked publishable: ' + heldPublished.map(function (r) { return r.candidate_id; }).join(', '));

// Oman was already in the Intel feed before this ledger (published_to_intel true,
// decision HOLD, duplicate of a curated card). No other held id may be flagged published.
const alreadyInFeed = { 'om-localisation-aug12': true };
function assertNotNewlyPublished(file) {
  if (!fs.existsSync(file)) return;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = rows.candidates || rows;
  (Array.isArray(list) ? list : []).forEach(function (c) {
    if (!c || !c.candidate_id || c.published_to_intel !== true) return;
    if (reviewLib.isPublishable(seen[c.candidate_id])) return;
    if (alreadyInFeed[c.candidate_id]) return;
    fail(file + ' marks held candidate published: ' + c.candidate_id);
  });
}
assertNotNewlyPublished('data/gcc-discovery-candidates.json');
assertNotNewlyPublished('data/gcc-sep-2026-discovery-input.json');

if (failed) {
  console.error('GCC REVIEW GATE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('GCC REVIEW GATE OK — ' + totals.candidates + ' candidates, ' + totals.published + ' publishable, ' + totals.held_for_review + ' held, ' + totals.rejected + ' rejected');
