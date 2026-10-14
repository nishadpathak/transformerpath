#!/usr/bin/env node
/* check-sourced-facilities.js — SOURCED plants require an official source.
 *
 * status=SOURCED is allowed only when source_type is OFFICIAL_COMPANY,
 * REGULATOR, or FREE_ZONE_REGISTRY, and the record carries facility_id,
 * company_id, site, city, country, source_url, source_checked_at, and
 * evidence_quote. THIRD_PARTY cannot set SOURCED. The research queue is
 * TO_RESEARCH only — this gate does not invent sourced plants.
 */
'use strict';
const fs = require('fs');

const OFFICIAL = ['OFFICIAL_COMPANY', 'REGULATOR', 'FREE_ZONE_REGISTRY'];
const REQUIRED = ['facility_id', 'company_id', 'site', 'city', 'country', 'status', 'source_url', 'source_type', 'source_checked_at', 'evidence_quote'];

let failed = 0;
function fail(msg) { console.error('SOURCED FACILITY GATE: ' + msg); failed++; }

function asSourced(rec) {
  if (!rec || rec.status !== 'SOURCED') return;
  const id = rec.facility_id || rec.id || '(no id)';
  REQUIRED.forEach(function (k) {
    if (rec[k] == null || String(rec[k]).trim() === '') fail(id + ' SOURCED missing ' + k);
  });
  if (rec.source_type && OFFICIAL.indexOf(rec.source_type) < 0) {
    fail(id + ' status=SOURCED with source_type ' + rec.source_type + ' (only ' + OFFICIAL.join(', ') + ')');
  }
}

const facilities = JSON.parse(fs.readFileSync('data/facilities.json', 'utf8')).facilities || [];
facilities.forEach(function (f) {
  if (f && f.status === 'SOURCED') {
    asSourced({
      facility_id: f.facility_id || f.id,
      company_id: f.company_id,
      site: f.site || f.facility_name,
      city: f.city,
      country: f.country,
      status: f.status,
      source_url: f.source_url,
      source_type: f.source_type,
      source_checked_at: f.source_checked_at,
      evidence_quote: f.evidence_quote
    });
  }
});

const queue = JSON.parse(fs.readFileSync('data/facility-research-queue.json', 'utf8'));
const companies = JSON.parse(fs.readFileSync('data/companies.json', 'utf8')).companies || [];
const companyIds = {};
companies.forEach(function (c) { companyIds[c.id] = c; });
const man = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const ksa = (man.find(function (g) { return g.country === 'Saudi Arabia'; }) || {}).makers || [];
const uae = (man.find(function (g) { return g.country === 'UAE'; }) || {}).makers || [];

if (!Array.isArray(queue.targets) || !queue.targets.length) fail('research queue empty');
if (queue.sourced_count !== 0) fail('research queue sourced_count must be 0');
if (queue.count !== queue.targets.length) fail('queue count does not match targets');

const names = {};
queue.targets.forEach(function (t) {
  if (!t || t.status !== 'TO_RESEARCH') fail((t && t.target_id) + ' status must be TO_RESEARCH');
  if (t && t.status === 'SOURCED') fail(t.target_id + ' must not be SOURCED');
  if (t.company_id && !companyIds[t.company_id]) fail(t.target_id + ' company_id not in companies.json');
  names[(t.company_name || '').toLowerCase()] = t;
});

['Emirates Transformer & Switchgear (ETS)', 'Eurogulf Transformers', 'Federal Power Transformers LLC', 'Crux Transformers', 'Tesar Gulf'].forEach(function (n) {
  if (!names[n.toLowerCase()]) fail('missing named research target ' + n);
});
ksa.forEach(function (m) {
  if (!names[String(m[0]).toLowerCase()]) fail('missing KSA directory maker ' + m[0]);
});
uae.forEach(function (m) {
  if (!names[String(m[0]).toLowerCase()]) fail('missing UAE directory maker ' + m[0]);
});

const sourced = facilities.filter(function (f) { return f && f.status === 'SOURCED'; }).length;
if (failed) {
  console.error('SOURCED FACILITY GATE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('SOURCED FACILITY GATE OK — facilities SOURCED=' + sourced + ', research queue TO_RESEARCH=' + queue.targets.length + ', sourced_count=' + queue.sourced_count);
