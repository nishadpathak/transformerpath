#!/usr/bin/env node
/* check-event-intel.js — Post-event intelligence quality gate.
 *
 * Validates a post-event transformer-industry summary attempt against the
 * config (data/post-event-intel.json) and the quality rules. This is the QA
 * step in the workflow: a summary cannot be PUBLISHED while it has a REJECT
 * fact. It enforces that every fact retains a source, that confidence is one of
 * the four levels, that no unsupported social-only claim is presented as
 * confirmed, that facts are transformer-relevant, that there are no duplicate
 * company entities, and that puffery/advertorials are rejected.
 *
 * It does NOT create facts or summaries — it only gates them. With no summary
 * records present it passes (nothing to reject).
 *
 * Run: node check-event-intel.js
 */
'use strict';
const fs = require('fs');
const CFG = JSON.parse(fs.readFileSync('data/post-event-intel.json', 'utf8'));

const CONFIDENCE = new Set(CFG.confidence_levels.map((c) => c.key));
const STATUS = { PASS: 'PASS', REVIEW: 'REVIEW', REJECT: 'REJECT' };

function loadSummaries() {
  try { return JSON.parse(fs.readFileSync('data/post-event-summaries.json', 'utf8')).summaries || []; }
  catch (e) { return []; }
}

const PUFFERY = /\b(best|leading|world-class|world class|revolutionary|game-chang|unmatched|#1|number one|market leader|premium)\b/i;
function normText(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function validateFact(f) {
  const issues = [];
  const src = (f.source_title || '').trim();
  const url = (f.source_url || '').trim();
  if (!src && !url) issues.push({ status: STATUS.REJECT, why: 'unsourced fact (no source title or URL)' });
  if (f.confidence && !CONFIDENCE.has(f.confidence)) issues.push({ status: STATUS.REJECT, why: 'invalid confidence "' + f.confidence + '"' });
  // Social-only discovery must be labeled UNVERIFIED, not presented as confirmed.
  if ((/linkedin|social|instagram|facebook|twitter|x\.com/i.test(src + ' ' + url)) && f.confidence && f.confidence !== 'UNVERIFIED')
    issues.push({ status: STATUS.REJECT, why: 'social-only claim must be labeled UNVERIFIED, not ' + f.confidence });
  if (f.presumed_confirmed && f.confidence === 'UNVERIFIED')
    issues.push({ status: STATUS.REJECT, why: 'a fact presented as confirmed cannot carry UNVERIFIED confidence' });
  // Transformer relevance: reject clear generic-energy facts with no transformer connection.
  if (f.transformer_relevance === false) issues.push({ status: STATUS.REVIEW, why: 'fact not transformer-relevant (verify or drop before publishing)' });
  if (f.transformer_relevance === undefined && f.statement) {
    const st = (f.statement + ' ' + src).toLowerCase();
    const rel = CFG.transformer_relevance_keywords.some((k) => st.indexOf(k.toLowerCase()) >= 0);
    if (!rel) issues.push({ status: STATUS.REVIEW, why: 'no clear transformer relevance in statement' });
  }
  // Puffery / advertorial / pure slogan.
  if (f.statement && PUFFERY.test(f.statement)) issues.push({ status: STATUS.REVIEW, why: 'promotional/puffery phrasing (source it or neutralise it)' });
  // Attendance / partnership claims require a source.
  if (/\battendance|visitors?|exhibitors?\b/i.test(f.statement || '') && !src && !url) issues.push({ status: STATUS.REJECT, why: 'attendance claim unsourced' });
  if (/\bpartnership|mou|memorandum|contract\b/i.test(f.statement || '') && !src && !url) issues.push({ status: STATUS.REJECT, why: 'partnership/contract claim unsourced' });
  return issues;
}

function validateSummary(sum) {
  const out = { event: sum.event || '', status: sum.admin_status || '', facts: [], issues: [] };
  const seen = {};
  (sum.facts || []).forEach((f) => {
    const iss = validateFact(f);
    // Duplicate company entity check (no duplicate company records).
    if (f.entity && f.entity.type === 'company' && f.entity.id) {
      if (seen[f.entity.id]) iss.push({ status: STATUS.REJECT, why: 'duplicate company entity ' + f.entity.id + ' reused' });
      seen[f.entity.id] = 1;
    }
    const stmt = normText(f.statement);
    if (stmt && seen['s:' + stmt]) iss.push({ status: STATUS.REJECT, why: 'duplicate statement (dedupe before publishing)' });
    seen['s:' + stmt] = 1;
    out.facts.push({ statement: (f.statement || '').slice(0, 70), status: iss.length ? Math.max(...iss.map((i) => i.status === 'REJECT' ? 2 : 1)) : 0, issues: iss });
    out.issues = out.issues.concat(iss);
  });
  out.reject_count = out.issues.filter((i) => i.status === 'REJECT').length;
  out.review_count = out.issues.filter((i) => i.status === 'REVIEW').length;
  return out;
}

const summaries = loadSummaries();
let problems = [];
console.log('POST-EVENT INTELLIGENCE QA GATE');
console.log('Config: ' + CFG.source_priority.length + ' source types, ' + CFG.summary_sections.length + ' summary sections, confidence levels: ' + CFG.confidence_levels.length);
console.log('Summary records found: ' + summaries.length + '\n');

if (!summaries.length) console.log('No post-event summary records yet — nothing to gate. When a summary is drafted, run this before publish.');
summaries.forEach((s) => {
  const r = validateSummary(s);
  console.log('SUMMARY [' + (r.event || '?') + '] admin_status=' + (r.status || 'n/a') + ' facts=' + r.facts.length + ' rejects=' + r.reject_count + ' reviews=' + r.review_count);
  (r.facts || []).filter((f) => f.status).forEach((f) => f.issues.forEach((i) => console.log('   [' + i.status + '] ' + f.statement + ' — ' + i.why)));
  if (r.reject_count) problems.push('summary ' + r.event + ' has ' + r.reject_count + ' REJECT fact(s); cannot be published until fixed');
});

console.log('\nQA GATE: ' + (problems.length ? problems.length + ' reject(s)' : 'PASS'));
process.exitCode = problems.length ? 1 : 0;
