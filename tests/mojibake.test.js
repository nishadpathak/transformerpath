#!/usr/bin/env node
/* Fail when a published file still contains UTF-8 text saved as Latin-1.
 * The patterns live as escapes here so this test is not a match of itself.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { repairText, mojibakeRuns } = require('../lib/mojibake');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const timoteo = 'Tim' + repairText('\u00C3\u00B3') + 'teo';
check('Timoteo repairs to the accented city', timoteo === 'Tim\u00f3teo', timoteo);
check('degree sign repairs', repairText('360\u00C2\u00B0C') === '360\u00B0C');
check('umlaut repairs', repairText('L\u00C3\u00BCgde') === 'L\u00fcgde');
check('clean text is unchanged', repairText('São Paulo') === 'São Paulo' && mojibakeRuns('São Paulo').length === 0);

const skip = new Set(['.git', 'node_modules', 'dist', 'archive', '_private']);
const root = path.join(__dirname, '..');
const hits = [];
function walk(dir) {
  fs.readdirSync(dir).forEach(function (name) {
    if (skip.has(name)) return;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs);
    else if (/\.(html|js|json|md|css|txt|yml|xml|csv)$/.test(name)) {
      const runs = mojibakeRuns(fs.readFileSync(abs, 'utf8'));
      if (runs.length) hits.push(path.relative(root, abs) + ' (' + runs.slice(0, 3).join(', ') + ')');
    }
  });
}
walk(root);
check('published files have no remaining mojibake', hits.length === 0, hits.slice(0, 12).join('; '));

if (failed) {
  console.error('MOJIBAKE CHECK FAILED (' + failed + ')');
  process.exit(1);
}
console.log('MOJIBAKE CHECK PASS');
