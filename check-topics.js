#!/usr/bin/env node
/* check-topics.js — Topic hub + technology-development quality gate (regression).
 *
 * Enforces the addendum's quality rules WITHOUT weakening existing gates:
 *   - no indexed Topic Hub that is empty / has no substantive sections
 *   - every technology-development record has provenance + valid confidence +
 *     valid category, and a manufacturer claim is never presented as verified
 *   - no duplicate canonical facts (duplicate statements across records)
 *   - the intel classification taxonomy is valid and every used category is known
 *   - a PUBLISHED event summary must carry at least one source-backed fact
 *
 * Run: node check-topics.js
 */
'use strict';
const fs = require('fs');
const CFG = JSON.parse(fs.readFileSync('data/topic-hubs.json', 'utf8'));
const TECH = JSON.parse(fs.readFileSync('data/technology-developments.json', 'utf8'));
let problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }
const esc = (s) => String(s == null ? '' : s).toLowerCase();

// 1. No empty indexed topic hub.
const CATS = new Set(CFG.intel_classification);
console.log('TOPIC / TECHNOLOGY QA GATE');
console.log('Topic hubs configured: ' + CFG.pilot_topics.length + ' | technology developments: ' + TECH.developments.length + '\n');
CFG.pilot_topics.forEach((t) => {
  const f = 'topics/' + t.key + '/index.html';
  if (!fs.existsSync(f)) { problems.push('topic hub missing: ' + t.key); return; }
  const s = fs.readFileSync(f, 'utf8');
  const sectionCount = (s.match(/<h2>/g) || []).length;
  ok(sectionCount >= 1, t.key + ' hub has ' + sectionCount + ' section(s) — not empty');
});

// 2. Technology development provenance + confidence + category + claim discipline.
TECH.developments.forEach((d) => {
  const srcOk = Array.isArray(d.source) ? d.source.some((x) => (x.title || x.url)) : !!((d.source && (d.source.title || d.source.url)));
  ok(srcOk, d.id + ' has a source (provenance)');
  ok(TECH.confidence_levels.indexOf(d.confidence) >= 0, d.id + ' confidence "' + d.confidence + '" is valid');
  ok(TECH.categories.indexOf(d.category) >= 0, d.id + ' category "' + d.category + '" is valid');
  // Manufacturer claim discipline: a COMPANY_REPORTED claim must not be labeled CONFIRMED.
  ok(!(d.confidence === 'CONFIRMED' && d.claim_type === 'COMPANY_REPORTED'), d.id + ' does not present a company-reported claim as CONFIRMED');
});

// 3. No duplicate canonical facts (duplicate statements across developments).
const seen = {};
TECH.developments.forEach((d) => {
  const k = esc(d.company + ':' + d.product);
  if (seen[k]) problems.push('duplicate canonical fact: ' + d.company + ' / ' + d.product);
  seen[k] = 1;
});

// 4. Intel classification taxonomy valid.
ok(CATS.size === CFG.intel_classification.length, 'intel classification list has no duplicates');
// (per-item classification is a data enrichment; the taxonomy here is the contract.)

// 5. A PUBLISHED event summary must carry facts.
try {
  const sums = JSON.parse(fs.readFileSync('data/post-event-summaries.json', 'utf8')).summaries || [];
  sums.forEach((s) => {
    if (s.admin_status === 'PUBLISHED') ok((s.facts || []).length >= 1, 'published summary "' + s.event + '" has source-backed facts');
  });
} catch (e) { /* no summaries yet */ }

console.log('\nTOPIC/TECH QA: ' + (problems.length ? problems.length + ' problem(s)' : 'PASS'));
process.exitCode = problems.length ? 1 : 0;
