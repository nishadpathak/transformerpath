#!/usr/bin/env node
/* Visible page text must not contain the tokens undefined, NaN or null.
 * Script and style blocks are not visible text. The standards national-grid
 * table must show a census voltage, or the words "Not available".
 */
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const SKIP = new Set(['node_modules', '.git', 'archive', '_private', 'functions', 'tests']);
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|nbsp|#\d+|#x[\da-f]+);/gi, ' ');
}

const bad = [];
walk('.', []).forEach(function (file) {
  const text = visibleText(fs.readFileSync(file, 'utf8'));
  const m = text.match(/\b(?:undefined|NaN|null)\b/g);
  if (m) bad.push(file + ' (' + m.slice(0, 3).join(', ') + ')');
});
check('no visible undefined, NaN or null in built HTML', bad.length === 0, bad.slice(0, 8).join('; '));

const standards = fs.readFileSync('standards.html', 'utf8');
const voltages = [];
const re = /st-v st-cell">([^<]*)</g;
let match;
while ((match = re.exec(standards))) voltages.push(match[1]);
check('national grid table has a voltage cell per country', voltages.length >= 150, String(voltages.length));
check('every voltage cell is a census figure or Not available', voltages.every(function (v) {
  return /^\d+ kV$/.test(v) || v === 'Not available';
}), voltages.filter(function (v) { return !/^\d+ kV$/.test(v) && v !== 'Not available'; }).slice(0, 5).join(', '));
check('at least one census voltage is shown', voltages.some(function (v) { return /^\d+ kV$/.test(v); }));

if (failed) {
  console.error('VISIBLE PLACEHOLDER TEXT FAILED (' + failed + ')');
  process.exit(1);
}
console.log('VISIBLE PLACEHOLDER TEXT OK');
