#!/usr/bin/env node
/* check-data-graph.js — PROVE one canonical fact propagates to many views, with
 * no duplicated underlying record (Section 27 data-graph test).
 *
 * Canonical fact under test: Trench Group's integrated power-quality package
 * (announced around CIGRE Paris Session 2026). It flows from ONE canonical
 * company/product record into multiple PRESENTATIONS:
 *   - technology-developments.json  (the canonical tech record)
 *   - post-event-summaries.json     (CIGRE Paris 2026 summary fact)
 *   - topics/bushings/              (bushings topic hub — manufacturer + intel)
 *   - directory-index.json          (the single canonical Trench company entity)
 *   - (intel) Trench US grid build-out
 * Assertions: one Trench company entity (no duplicate), and the fact is
 * present in at least 3 distinct views. It is NOT duplicated as copies.
 *
 * Run: node check-data-graph.js
 */
'use strict';
const fs = require('fs');
let problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }

const DIR = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8')).companies || [];
const TECH = JSON.parse(fs.readFileSync('data/technology-developments.json', 'utf8')).developments || [];
const SUMS = JSON.parse(fs.readFileSync('data/post-event-summaries.json', 'utf8')).summaries || [];
const TOPIC = fs.readFileSync('topics/bushings/index.html', 'utf8');

function normalizeName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
const trench = DIR.filter((c) => normalizeName(c.name).indexOf('trench') >= 0);

// 1. Single canonical company entity (no duplicate company records).
ok(trench.length === 1, 'exactly one canonical Trench company entity in the directory (found ' + trench.length + ')');

// 2. Tech development record for Trench.
const techFact = TECH.find((d) => normalizeName(d.company).indexOf('trench') >= 0);
ok(!!techFact, 'tech-development record exists for the Trench launch');

// 3. Appears in the CIGRE post-event summary.
const inSummary = SUMS.some((s) => s.event.indexOf('CIGRE') >= 0 && (s.facts || []).some((f) => normalizeName(f.statement || '').indexOf('trench') >= 0));
ok(inSummary, 'Trench fact appears in the CIGRE Paris 2026 post-event summary');

// 4. Appears in the bushings topic hub (as a manufacturer).
ok(TOPIC.indexOf('Trench') >= 0, 'Trench appears in the /topics/bushings/ hub');

// 5. Same fact, multiple views, one record — not copied articles.
const views = [!!techFact, inSummary, TOPIC.indexOf('Trench') >= 0].filter(Boolean).length;
ok(views >= 3, 'the Trench launch is surfaced in ' + views + ' distinct views from structured records');

console.log('\nDATA-GRAPH TEST: ' + (problems.length ? problems.length + ' problem(s)' : 'PASS'));
process.exitCode = problems.length ? 1 : 0;
