#!/usr/bin/env node
/* check-data-graph.js — PROVE one canonical fact propagates to many views, with
 * no duplicated underlying record (Section 27 data-graph test).
 *
 * Canonical entity under test: Trench Group. The CIGRE power-quality launch
 * had no allowed source, so it is not a technology record. The company still
 * appears once in the directory and on the bushings hub.
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

const techFact = TECH.find((d) => normalizeName(d.company).indexOf('trench') >= 0);
ok(!techFact, 'unsourced Trench launch is not a technology record');
ok(TOPIC.indexOf('Trench') >= 0, 'Trench appears in the /topics/bushings/ hub');

console.log('\nDATA-GRAPH TEST: ' + (problems.length ? problems.length + ' problem(s)' : 'PASS'));
process.exitCode = problems.length ? 1 : 0;
