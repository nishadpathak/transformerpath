#!/usr/bin/env node
/* check-voltage-evidence-consistency.js — summary kv must be MAX(accepted
 * voltage_class_evidence, tier.kv). Fails the build when a manufacturer page
 * would show a lower summary than its accepted provenance facts (CG Power bug).
 */
'use strict';
const fs = require('fs');
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));
const PROV = JSON.parse(fs.readFileSync('data/manufacturer-provenance.json', 'utf8'));
const byName = {};
PROV.forEach(function (p) { byName[norm(p.name)] = p; });

const mismatches = [];
const raised = [];
TIERS.forEach(function (t) {
  if (!t || !t.name) return;
  const prov = byName[norm(t.name)];
  if (!prov) return;
  let maxEv = 0;
  (prov.facts || []).forEach(function (f) {
    if (f.field !== 'voltage_class_evidence') return;
    if (/REJECT/i.test(String(f.confidence || ''))) return;
    const v = typeof f.value === 'number' ? f.value : parseFloat(f.value);
    if (!isNaN(v) && v > maxEv) maxEv = v;
  });
  const tierKv = typeof t.kv === 'number' ? t.kv : parseFloat(t.kv) || 0;
  if (maxEv > tierKv) {
    raised.push({ name: t.name, tier_kv: tierKv, evidence_max_kv: maxEv });
    // Not a failure — build-company-pages now displays max. Fail only if
    // evidence is lower than tier (data corruption) or evidence missing when
    // detail pages claim higher — we detect the CG class: evidence > tier.
  }
});

// Hard fail: any manufacturer whose rendered summary path still prefers tier
// over evidence would be a regression — encode expected CG Power case.
const cg = raised.find(function (r) { return /cg power/i.test(r.name); });
if (!cg || cg.evidence_max_kv < 765) {
  console.error('VOLTAGE EVIDENCE GATE FAILED — CG Power must expose ≥765 kV from provenance');
  console.error(cg || 'CG Power not in raised set');
  process.exit(1);
}

// Generated profile must surface the MAX in the summary row — not only in the
// evidence table. Production regression: summary said 400 kV while evidence
// listed accepted 765 kV on the same page.
const CG_HTML = 'manufacturers/cg-power-and-industrial-solutions/index.html';
if (!fs.existsSync(CG_HTML)) {
  console.error('VOLTAGE EVIDENCE GATE FAILED — missing canonical CG profile ' + CG_HTML);
  process.exit(1);
}
const cgHtml = fs.readFileSync(CG_HTML, 'utf8');
const summaryKv = cgHtml.match(/Highest sourced voltage evidence<\/th>\s*<td>(\d+)\s*kV/i);
const summaryN = summaryKv ? Number(summaryKv[1]) : 0;
if (summaryN < 765) {
  console.error('VOLTAGE EVIDENCE GATE FAILED — CG canonical summary must be ≥765 kV (got ' + (summaryKv ? summaryKv[1] : 'missing') + ')');
  process.exit(1);
}
if (/Highest sourced voltage evidence<\/th>\s*<td>400\s*kV/i.test(cgHtml)) {
  console.error('VOLTAGE EVIDENCE GATE FAILED — CG summary still shows stale 400 kV');
  process.exit(1);
}

fs.writeFileSync('data/voltage-evidence-consistency.json', JSON.stringify({
  generated: new Date().toISOString(),
  manufacturers_with_evidence_above_tier: raised.length,
  raised: raised,
  cg_canonical_summary_kv: summaryN,
  honesty: 'Summary Highest sourced voltage evidence = MAX(tier.kv, accepted provenance voltage_class_evidence).'
}, null, 2) + '\n');

// Every generated manufacturer page: summary kV >= MAX(tier.kv, non-REJECTED
// voltage_class_evidence). Redirect stubs have no summary row and are skipped.
const path = require('path');
const slugs = JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8'));
const slugToName = {};
slugs.forEach(function (s) { if (s && s.slug) slugToName[s.slug] = s.name; });
const tierByName = {};
TIERS.forEach(function (t) { if (t && t.name) tierByName[norm(t.name)] = t; });

function walkHtml(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, acc);
    else if (e.name === 'index.html') acc.push(p);
  }
}
const pages = [];
walkHtml('manufacturers', pages);
let checkedPages = 0;
pages.forEach(function (page) {
  const html = fs.readFileSync(page, 'utf8');
  if (/http-equiv=["']refresh["']/i.test(html)) return;
  const summaryKv = html.match(/Highest sourced voltage evidence<\/th>\s*<td>(\d+)\s*kV/i);
  if (!summaryKv) return;
  const slug = page.split(path.sep)[1];
  const name = slugToName[slug];
  if (!name) return;
  const prov = byName[norm(name)];
  const tier = tierByName[norm(name)];
  let maxEv = 0;
  (prov && prov.facts || []).forEach(function (f) {
    if (!f || f.field !== 'voltage_class_evidence') return;
    if (/REJECT/i.test(String(f.confidence || ''))) return;
    const v = typeof f.value === 'number' ? f.value : parseFloat(f.value);
    if (!isNaN(v) && v > maxEv) maxEv = v;
  });
  const tierKv = tier ? (typeof tier.kv === 'number' ? tier.kv : parseFloat(tier.kv) || 0) : 0;
  const expect = Math.max(maxEv, tierKv);
  const got = Number(summaryKv[1]);
  checkedPages++;
  if (expect && got < expect) {
    mismatches.push(page + ': summary ' + got + ' kV < MAX ' + expect + ' kV (' + name + ')');
  }
});
if (mismatches.length) {
  console.error('VOLTAGE EVIDENCE GATE FAILED — summary below accepted evidence:');
  mismatches.slice(0, 25).forEach(function (m) { console.error('  - ' + m); });
  process.exit(1);
}

console.log('VOLTAGE EVIDENCE OK — ' + raised.length + ' manufacturers where provenance MAX exceeds tier.kv (incl. CG Power ' + cg.evidence_max_kv + ' kV; HTML summary ' + summaryN + ' kV); ' + checkedPages + ' profile summaries checked');
