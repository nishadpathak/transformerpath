#!/usr/bin/env node
/* check-source-unstamped.js — a committed source file must not carry a
 * tp-build-commit stamp. Stamps belong on dist HTML, written after
 * build-dist.js. A stamp baked into git can pass for a release it is not.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['.git', 'node_modules', 'dist', 'vendor', '.netlify']);
const hits = [];

function walk(dir) {
  let names;
  try { names = fs.readdirSync(dir); } catch (e) { return; }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) walk(p);
    else if (name.endsWith('.html')) {
      const text = fs.readFileSync(p, 'utf8');
      if (text.includes('tp-build-commit')) hits.push(p);
    }
  }
}

walk('.');
if (hits.length) {
  console.error('SOURCE STAMP GATE FAILED — tp-build-commit is committed in source:');
  hits.forEach(function (h) { console.error('  ' + h); });
  process.exit(1);
}
console.log('SOURCE STAMP OK — no tp-build-commit in source HTML');
