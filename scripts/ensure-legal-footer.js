#!/usr/bin/env node
/* Write Privacy, Terms and Contact into every page footer that lacks them. */
'use strict';

const fs = require('fs');
const path = require('path');
const { ensureLegalFooter } = require('../lib/legal-footer');

const SKIP = new Set([
  '.git', 'node_modules', 'dist', 'archive', '_private', 'transformerpath-site', 'transformerpath'
]);

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let changed = 0;
walk('.', []).forEach(function (file) {
  const html = fs.readFileSync(file, 'utf8');
  const next = ensureLegalFooter(html);
  if (next !== html) {
    fs.writeFileSync(file, next);
    changed++;
  }
});
console.log('legal footer: updated ' + changed + ' page(s)');
