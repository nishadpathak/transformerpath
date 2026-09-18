#!/usr/bin/env node
/* tests/check-account-schema.js — APPLY_SQL must name the Sprint 1–3 spine,
 * dynamically match all supabase.from('table') calls in application code,
 * and remain printable via `node apply-sql.js`.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const model = require('../functions/lib/account-model');

let failures = [];
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failures.push(label + (detail ? ' :: ' + detail : ''));
  }
}

console.log('=== APPLY_SQL SPINE ===');
check('APPLY_SQL is a non-empty string', typeof model.APPLY_SQL === 'string' && model.APPLY_SQL.length > 500);
(model.REQUIRED_TABLES || []).forEach((t) => {
  const re = new RegExp('create table if not exists public\\.' + t + '\\b', 'i');
  check('APPLY_SQL creates ' + t, re.test(model.APPLY_SQL));
});
check('organization_members is the seat table', /organization_members/.test(model.APPLY_SQL));
check('Team plan max_members=10', /max_members integer not null default 1/.test(model.APPLY_SQL) && /true, true, 10/.test(model.APPLY_SQL));
check('plans seed includes learning/professional/team', /'learning'/.test(model.APPLY_SQL) && /'professional'/.test(model.APPLY_SQL) && /'team'/.test(model.APPLY_SQL));
check('apply-sql.js runner exists', fs.existsSync('apply-sql.js'));
check('GET function apply-sql exists', fs.existsSync('functions/apply-sql.js'));
check('create-checkout function exists', fs.existsSync('functions/create-checkout.js'));
check('Learning plan grants learning only', model.PLANS.learning.grants.learning && !model.PLANS.learning.grants.professional);
check('Professional grants learning+professional', model.PLANS.professional.grants.learning && model.PLANS.professional.grants.professional);
check('Team max_members is 10', model.PLANS.team.max_members === 10);
check('onboarding roles include Design Engineer and Procurement',
  model.ONBOARDING_ROLES.some((r) => r.value === 'design_engineer') &&
  model.ONBOARDING_ROLES.some((r) => r.value === 'procurement'));
check('skill levels are Developing/Intermediate/Advanced',
  model.SKILL_LEVELS.indexOf('Developing') >= 0 && model.SKILL_LEVELS.indexOf('Advanced') >= 0);

console.log('\n=== DYNAMIC CODE & RLS VERIFICATION ===');
// Scan functions and client scripts for all supabase.from('<table>') references
const searchDirs = ['functions', 'functions/lib', '.'];
const discoveredTables = new Set();

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && dir !== '.' && f !== 'node_modules' && f !== '.git' && f !== 'dist') {
      scanDir(full);
    } else if (stat.isFile() && (f.endsWith('.js') || f.endsWith('.html'))) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.matchAll(/\b(?:supabase|client)\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g);
      for (const m of matches) {
        discoveredTables.add(m[1]);
      }
    }
  }
}

searchDirs.forEach(scanDir);
console.log('  Discovered tables in code:', Array.from(discoveredTables).join(', '));

discoveredTables.forEach((table) => {
  const createsTable = new RegExp('create table if not exists public\\.' + table + '\\b', 'i').test(model.APPLY_SQL);
  check(`Discovered table "${table}" exists in APPLY_SQL`, createsTable);
  
  const enablesRls = new RegExp('alter table public\\.' + table + ' enable row level security', 'i').test(model.APPLY_SQL);
  const hasPolicy = new RegExp('create policy [a-zA-Z0-9_]+ on public\\.' + table + '\\b', 'i').test(model.APPLY_SQL);
  check(`Discovered table "${table}" has RLS enabled or policy in APPLY_SQL`, enablesRls || hasPolicy);
});

const pathCat = JSON.parse(fs.readFileSync('data/learning-path.json', 'utf8'));
check('learning path has FOUNDATIONS / DISTRIBUTION / POWER',
  (pathCat.groups || []).some((g) => g.id === 'FOUNDATIONS') &&
  (pathCat.groups || []).some((g) => g.id === 'DISTRIBUTION') &&
  (pathCat.groups || []).some((g) => g.id === 'POWER'));
const assess = JSON.parse(fs.readFileSync('data/assessments.json', 'utf8'));
check('assessments include 100 MVA line-current item', (assess.items || []).some((i) => i.id === 'line-current-100mva-132kv'));
check('assessments include OLTC/AVR limitation', (assess.items || []).some((i) => i.id === 'oltc-avr-limitation'));
const answers = require('../functions/lib/assessment-answers');
check('line-current grades S-based 437 A as correct', answers.grade('line-current-100mva-132kv', 's-based-437a').correct);
check('line-current rejects P-based 393 A', !answers.grade('line-current-100mva-132kv', 'p-based-393a').correct);
check('OLTC/AVR grades tap-range stop as correct', answers.grade('oltc-avr-limitation', 'tap-range-stop').correct);

console.log('\n=== SUMMARY ===');
if (failures.length) {
  console.error('ACCOUNT SCHEMA GATE: FAIL (' + failures.length + ')');
  failures.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('ACCOUNT SCHEMA GATE: PASS');
process.exit(0);
