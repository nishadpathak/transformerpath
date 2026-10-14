#!/usr/bin/env node
/* check-dist-provenance.js — every dist HTML page carries the same release
 * triple as dist/data/build-provenance.json. site-stats and freshness must
 * carry the same build_commit and data_version.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

const DIST = process.argv[2] || 'dist';
const prov = readJson(path.join(DIST, 'data', 'build-provenance.json'), null);
if (!prov || !prov.build_commit || !prov.build_at || !prov.data_version) {
  console.error('DIST PROVENANCE: ' + DIST + '/data/build-provenance.json incomplete');
  process.exit(1);
}

const htmlFiles = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
}
if (!fs.existsSync(DIST)) {
  console.error('DIST PROVENANCE: missing ' + DIST);
  process.exit(1);
}
walk(DIST);

const errors = [];
let stamped = 0;
htmlFiles.forEach(function (file) {
  const html = fs.readFileSync(file, 'utf8');
  const commit = (html.match(/name="tp-build-commit"\s+content="([^"]+)"/i) || [])[1];
  const buildAt = (html.match(/name="tp-build-at"\s+content="([^"]+)"/i) || [])[1];
  const dataVer = (html.match(/name="tp-data-version"\s+content="([^"]+)"/i) || [])[1];
  const attr = (html.match(/data-tp-build-commit="([^"]+)"/i) || [])[1];
  if (!commit || !buildAt || !dataVer || !attr) {
    errors.push(path.relative(DIST, file) + ': missing stamp');
    return;
  }
  if (commit !== prov.build_commit || attr !== prov.build_commit) {
    errors.push(path.relative(DIST, file) + ': build_commit mismatch');
    return;
  }
  if (buildAt !== prov.build_at) {
    errors.push(path.relative(DIST, file) + ': build_at mismatch');
    return;
  }
  if (dataVer !== prov.data_version) {
    errors.push(path.relative(DIST, file) + ': data_version mismatch');
    return;
  }
  stamped++;
});

['data/site-stats.json', 'data/freshness.json'].forEach(function (rel) {
  const doc = readJson(path.join(DIST, rel), null);
  if (!doc) {
    errors.push(rel + ': missing');
    return;
  }
  if (doc.build_commit !== prov.build_commit) errors.push(rel + ': build_commit mismatch');
  if (doc.data_version !== prov.data_version) errors.push(rel + ': data_version mismatch');
});

if (errors.length) {
  console.error('DIST PROVENANCE GATE FAILED — ' + stamped + '/' + htmlFiles.length + ' pages stamped');
  errors.slice(0, 30).forEach(function (e) { console.error('  - ' + e); });
  if (errors.length > 30) console.error('  … and ' + (errors.length - 30) + ' more');
  process.exit(1);
}

console.log('DIST PROVENANCE OK — ' + stamped + '/' + htmlFiles.length + ' pages stamped');
