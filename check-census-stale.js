#!/usr/bin/env node
/* check-census-stale.js — fail the build on stale manufacturer-count copy.
 *
 * Canonical transformer-company population: data/site-stats.json → manufacturers.
 * Public HTML/JS and live KPI JSON must not claim 709 / 911 / 1,002 makers.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const CANON = Number(stats.manufacturers);
if (!CANON || CANON < 100) {
  console.error('CENSUS GATE: site-stats.manufacturers missing/invalid');
  process.exit(1);
}

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'archive', 'transformerpath', 'transformerpath-site',
  '.git', 'vendor', 'media', 'backup-pre-sprint', 'tests',
  'accessories', 'manufacturers', 'markets', 'utilities', 'components',
  'materials', 'events', 'projects', 'tenders', 'knowledge', 'grids',
  'laboratories', 'machinery', 'services', 'logistics', 'associations',
  'buyers', 'education', 'applications', 'standards', 'books'
]);

const SKIP_FILES = new Set([
  'check-census-stale.js',
  'check-config.js',
  'data/census-reconciliation-911-to-906.json'
]);

const STALE = [
  { re: /\b1,?002\b/, label: '1002' },
  { re: /\b911\b/, label: '911' },
  { re: /\b709\b/, label: '709' }
];

const CONTEXT = /maker|manufacturer|companies|company census|directory of|transformer (?:makers|companies|OEMs)|OEM census|sourced directory|total_companies|"m"\s*:\s*911|"manufacturers"\s*:\s*911/i;

function isPhoneFalsePositive(line, label) {
  if (label !== '911') return false;
  // +49 911 … Nuremberg area codes etc.
  return /\+\d[\d\s]*911|\bext\.?\s*911|phone[^\n]{0,20}911/i.test(line);
}

const hits = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const rel = p.split(path.sep).join('/');
    if (e.isDirectory()) {
      if (rel === 'data/backup-pre-sprint') continue;
      walk(p);
    } else if (/\.(html|js|json)$/i.test(e.name)) {
      if (SKIP_FILES.has(e.name) || SKIP_FILES.has(rel)) continue;
      if (/intel-2026|freshness\.json$|intel\.json$|intel-feed|entity-|manufacturer-intel/.test(rel)) continue;
      if (/backup-pre-sprint/.test(rel)) continue;
      scan(rel);
    }
  }
}

function scan(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  if (text.length > 2e6) return;
  const lines = text.split(/\n/);
  lines.forEach((line, i) => {
    for (const s of STALE) {
      if (!s.re.test(line)) continue;
      if (isPhoneFalsePositive(line, s.label)) continue;
      // Reconciliation / migration docs
      if (/911\s*→\s*906|911-to-906|from_count.:\s*911|reconciliation/.test(line)) continue;
      // Must look like manufacturer-count context OR be a KPI field still at 911/709/1002
      const kpi = new RegExp('"(?:manufacturers|total_companies|m)"\\s*:\\s*' + s.label.replace(',', '\\,?'), 'i');
      if (!CONTEXT.test(line) && !kpi.test(line) && !/"manufacturers"\s*:\s*(709|911|1002|1,002)/.test(line)) continue;
      // Explicit forbid patterns in check scripts quoting stale numbers — already skipped files
      if (/forbidden hardcoded|stale 709|no stale 709/.test(line)) continue;
      hits.push({ file, line: i + 1, label: s.label, text: line.trim().slice(0, 160) });
    }
  });
}

// Live KPI files must match canonical census
function checkKpiFiles() {
  const checks = [
    ['data/directory-health.json', (j) => j.kpi_summary && j.kpi_summary.total_companies],
    ['data/map-points.json', (j) => j.counts && j.counts.m],
    ['data/site-stats.json', (j) => j.manufacturers]
  ];
  for (const [file, pick] of checks) {
    if (!fs.existsSync(file)) continue;
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const n = pick(j);
    if (n != null && Number(n) !== CANON) {
      hits.push({ file, line: 0, label: String(n), text: 'KPI ' + n + ' != canonical manufacturers ' + CANON });
    }
  }
}

walk('.');
checkKpiFiles();

if (hits.length) {
  console.error('CENSUS GATE FAILED — stale manufacturer-count copy (canonical is ' + CANON + '):');
  hits.slice(0, 40).forEach((h) => {
    console.error('  ' + h.file + ':' + h.line + ' [' + h.label + '] ' + h.text);
  });
  process.exit(1);
}

console.log('CENSUS GATE OK — canonical manufacturers=' + CANON + '; no stale 709/911/1002 manufacturer-count copy');
