#!/usr/bin/env node
/**
 * Smoke-test: every reg()-registered 3D part matches the ecosystem,
 * preferably to the explorer's intended family.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..');
const ecoSrc = fs.readFileSync(path.join(rootDir, 'part-ecosystem.js'), 'utf8');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(ecoSrc, ctx);
const TP = ctx.window.TP_PART_ECOSYSTEM;
if (!TP) {
  console.error('TP_PART_ECOSYSTEM missing');
  process.exit(1);
}

function extractRegNames(html) {
  const names = [];
  const re = /reg\s*\(\s*[^,]+,\s*(['"`])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(html))) names.push(m[2].replace(/\s+/g, ' ').trim());
  return names;
}

/** CRT/VPI parts live after crtRoot / vpiRoot markers in explorer & castresin */
function splitByRoots(html) {
  const oilIdx = html.indexOf('oilRoot');
  const crtIdx = html.indexOf('crtRoot');
  const vpiIdx = html.indexOf('vpiRoot');
  const all = extractRegNames(html);
  // crude: extract with line positions
  const named = [];
  const re = /reg\s*\(\s*[^,]+,\s*(['"`])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(html))) {
    named.push({ name: m[2].replace(/\s+/g, ' ').trim(), idx: m.index });
  }
  const oil = [], crt = [], vpi = [], other = [];
  for (const n of named) {
    if (vpiIdx >= 0 && n.idx > vpiIdx) vpi.push(n.name);
    else if (crtIdx >= 0 && n.idx > crtIdx) crt.push(n.name);
    else if (oilIdx >= 0 && n.idx > oilIdx) oil.push(n.name);
    else other.push(n.name);
  }
  return { oil, crt, vpi, other, all };
}

const suites = [
  { file: 'power3d.html', family: 'power', pick: (s) => s.all },
  { file: 'explorer.html', family: 'distribution', pick: (s) => s.oil },
  { file: 'explorer.html', family: 'castresin', pick: (s) => s.crt.concat(s.vpi), label: 'explorer CRT/VPI' },
  { file: 'castresin3d.html', family: 'castresin', pick: (s) => s.crt.concat(s.vpi), label: 'castresin3d CRT/VPI' },
  { file: 'ct3d.html', family: 'ct', pick: (s) => s.all }
];

let failed = 0;
const summary = [];

for (const suite of suites) {
  const html = fs.readFileSync(path.join(rootDir, suite.file), 'utf8');
  const split = splitByRoots(html);
  const names = suite.pick(split);
  const label = suite.label || suite.file;
  console.log('\n===', label, '| preferred family:', suite.family, '| parts:', names.length, '===');
  let ok = 0;
  let wrong = 0;
  const misses = [];
  const wrongList = [];
  for (const n of names) {
    const eco = TP.matchPartName(n, suite.family);
    if (!eco) {
      misses.push(n);
      console.log('  MISS', n);
      continue;
    }
    ok++;
    const famOk = eco.family === suite.family;
    if (!famOk) {
      wrong++;
      wrongList.push(n + ' => ' + eco.id + ' (' + eco.family + ')');
      console.log('  FAM?', n, '=>', eco.id, '(' + eco.family + ')');
    } else {
      console.log('  OK  ', n, '=>', eco.id);
    }
  }
  const row = {
    label,
    family: suite.family,
    total: names.length,
    matched: ok,
    wrongFamily: wrong,
    misses: misses.length
  };
  summary.push(row);
  if (misses.length) failed++;
  // Allow some shared-tech FAM? on CRT rollers etc., but flag if >25%
  if (names.length && wrong / names.length > 0.35) {
    console.log('  WARNING: high wrong-family rate', wrong + '/' + names.length);
    failed++;
  }
}

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
console.log(
  'ecosystem entries:',
  TP.parts.length,
  '| by family:',
  ['power', 'distribution', 'castresin', 'ct']
    .map((f) => f + ':' + TP.byFamily(f).length)
    .join(', ')
);

if (failed) {
  console.error('\nSMOKE FAILED');
  process.exit(1);
}
console.log('\nSMOKE OK');
