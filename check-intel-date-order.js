#!/usr/bin/env node
/* check-intel-date-order.js — publication_date must not predate event_date unmarked.
 *
 * If publication_date < event_date without an explicit allow flag / explanation,
 * the record is REVIEW_REQUIRED (or the build fails for already-published cards).
 */
'use strict';
const fs = require('fs');
const path = require('path');

function day(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function earlier(a, b) {
  const da = day(a);
  const db = day(b);
  if (!da || !db) return false;
  return da < db;
}

const errors = [];
const reviews = [];

function checkRecord(rec, where) {
  const pub = rec.publication_date || (rec.dates && rec.dates.publication_date) || null;
  const ev = rec.event_date || (rec.dates && rec.dates.event_date) || null;
  if (!earlier(pub, ev)) return;
  const allowed =
    rec.allow_publication_before_event === true ||
    (rec.dates && rec.dates.allow_publication_before_event === true) ||
    !!(rec.publication_before_event_reason || (rec.dates && rec.dates.publication_before_event_reason));
  const cls = rec.classifications || rec.cls || [];
  const clsArr = Array.isArray(cls) ? cls : [cls];
  const tenderish =
    !!(rec.tender_id || rec.canonical_procurement_id) ||
    clsArr.some(function (c) {
      return /PIPELINE|TENDER|PROCUREMENT/i.test(String(c || ''));
    });
  const id = rec.candidate_id || rec.id || rec.title || '(untitled)';
  if (allowed || tenderish) {
    reviews.push({ where: where, id: id, publication_date: pub, event_date: ev, allowed: true, tenderish: !!tenderish });
    return;
  }
  // Non-tender news/capacity stories: hard fail if still graded CONFIRMED/SUPPORTED
  // or already published without an explanation (Oman-style source-before-event bug).
  if (rec.evidence_grade && rec.evidence_grade !== 'REVIEW_REQUIRED' && rec.evidence_grade !== 'REJECTED') {
    errors.push(where + ': ' + id + ' publication_date ' + pub + ' < event_date ' + ev + ' but grade=' + rec.evidence_grade);
    return;
  }
  if (rec.published_to_intel || rec.publish_decision === 'PUBLISH') {
    errors.push(where + ': published card ' + id + ' has publication_date ' + pub + ' < event_date ' + ev + ' without explanation');
    return;
  }
  reviews.push({ where: where, id: id, publication_date: pub, event_date: ev, allowed: false });
}

function load(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

const candidates = load('data/gcc-discovery-candidates.json');
if (candidates) {
  const list = candidates.candidates || candidates.items || [];
  list.forEach(function (c) { checkRecord(c, 'gcc-discovery-candidates'); });
}

const feed = load('data/intel-feed-ui.json');
if (feed) {
  const items = feed.items || feed.posts || [];
  items.forEach(function (it) { checkRecord(it, 'intel-feed-ui'); });
  // Regional packs
  Object.keys(feed.records || {}).forEach(function (k) {
    const block = feed.records[k];
    (block.items || []).forEach(function (it) { checkRecord(it, 'intel-feed-ui.records.' + k); });
  });
}

// Soft: also scan freshness daily_intel GCC items
const fresh = load('data/freshness.json');
const di = ((fresh && fresh.surfaces) || []).find(function (s) { return s.id === 'daily_intel'; });
if (di && di.records) {
  Object.keys(di.records).forEach(function (region) {
    const block = di.records[region];
    (block.items || []).forEach(function (it) { checkRecord(it, 'freshness.daily_intel.' + region); });
  });
}

if (errors.length) {
  console.error('INTEL DATE ORDER GATE FAILED — publication_date < event_date without explanation');
  errors.slice(0, 40).forEach(function (e) { console.error('  - ' + e); });
  if (errors.length > 40) console.error('  … +' + (errors.length - 40) + ' more');
  process.exit(1);
}

console.log(
  'INTEL DATE ORDER OK — flagged review rows=' + reviews.filter(function (r) { return !r.allowed; }).length +
  ' explicitly allowed=' + reviews.filter(function (r) { return r.allowed; }).length
);
