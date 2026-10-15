#!/usr/bin/env node
'use strict';
/**
 * Grid Lab's engine lives in js/, which build-dist.js does not copy as a
 * directory. If those script tags are not on the allowlist, production serves
 * the page with a 404 for the engine and the 3D canvas never starts.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'grid-lab.html'), 'utf8');
const dist = fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8');

function arrayAfter(name) {
  const m = dist.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
  if (!m) throw new Error('missing ' + name + ' in build-dist.js');
  return m[1];
}

const rootJs = arrayAfter('ROOT_JS');
const mixed = arrayAfter('FILES_FROM_MIXED_DIRS');
const dirs = arrayAfter('DIRS');

const srcs = [];
const re = /<script\b[^>]*\bsrc=["']([^"']+)["']/gi;
let m;
while ((m = re.exec(html))) {
  const src = m[1].split('#')[0].split('?')[0];
  if (!src || /^(https?:)?\/\//i.test(src)) continue;
  srcs.push(src.replace(/^\//, ''));
}

if (!srcs.length) {
  console.error('grid-lab.html has no local scripts');
  process.exit(1);
}

let failed = 0;
for (const src of srcs) {
  const exists = fs.existsSync(path.join(root, src));
  const top = src.split('/')[0];
  const published = src.indexOf('/') === -1
    ? rootJs.includes("'" + src + "'")
    : dirs.includes("'" + top + "'") || mixed.includes("'" + src + "'");
  if (!exists || !published) {
    console.error('NOT PUBLISHED ' + src + ' exists=' + exists + ' allowlisted=' + published);
    failed++;
  } else {
    console.log('ok ' + src);
  }
}

if (!dist.includes('published HTML references a script that was not copied')) {
  console.error('build-dist.js is missing the referenced-script gate');
  failed++;
}

if (failed) process.exit(1);
console.log('grid-lab publish: ' + srcs.length + ' local scripts are on the dist allowlist');
