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

/* Pages that must carry the public /build.json identity, so a reader can
 * prove intel, the directory and two profiles are one release. */
const COMPARE_PAGES = [
  'intel.html',
  'manufacturers.html',
  'manufacturers/hitachi-energy/index.html',
  'manufacturers/cg-power-and-industrial-solutions/index.html'
];

function meta(html, name) {
  return (html.match(new RegExp('name="' + name + '"\\s+content="([^"]+)"', 'i')) || [])[1] || '';
}

function pageIdentity(html) {
  const count = meta(html, 'tp-manufacturer-count');
  return {
    commit: meta(html, 'tp-build-commit'),
    build_time: meta(html, 'tp-build-at'),
    data_version: meta(html, 'tp-data-version'),
    latest_intel_date: meta(html, 'tp-latest-intel-date'),
    manufacturer_count: count === '' ? null : Number(count)
  };
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
  const id = pageIdentity(html);
  const attr = (html.match(/data-tp-build-commit="([^"]+)"/i) || [])[1];
  const attrIntel = (html.match(/data-tp-latest-intel-date="([^"]+)"/i) || [])[1];
  const attrCount = (html.match(/data-tp-manufacturer-count="([^"]+)"/i) || [])[1];
  if (!id.commit || !id.build_time || !id.data_version || !id.latest_intel_date || id.manufacturer_count == null || !attr) {
    errors.push(path.relative(DIST, file) + ': missing stamp');
    return;
  }
  if (id.commit !== prov.build_commit || attr !== prov.build_commit) {
    errors.push(path.relative(DIST, file) + ': build_commit mismatch');
    return;
  }
  if (id.build_time !== prov.build_at) {
    errors.push(path.relative(DIST, file) + ': build_at mismatch');
    return;
  }
  if (id.data_version !== prov.data_version) {
    errors.push(path.relative(DIST, file) + ': data_version mismatch');
    return;
  }
  if (id.latest_intel_date !== prov.latest_intel_date || attrIntel !== prov.latest_intel_date) {
    errors.push(path.relative(DIST, file) + ': latest_intel_date mismatch');
    return;
  }
  if (id.manufacturer_count !== prov.manufacturer_count || attrCount !== String(prov.manufacturer_count)) {
    errors.push(path.relative(DIST, file) + ': manufacturer_count mismatch');
    return;
  }
  stamped++;
});

const buildPath = path.join(DIST, 'build.json');
const buildJson = readJson(buildPath, null);
if (!buildJson) {
  errors.push('build.json missing');
} else {
  const expected = {
    commit: prov.build_commit,
    build_time: prov.build_at,
    data_version: prov.data_version,
    latest_intel_date: prov.latest_intel_date,
    manufacturer_count: prov.manufacturer_count
  };
  Object.keys(expected).forEach(function (k) {
    if (buildJson[k] !== expected[k]) errors.push('build.json ' + k + ' mismatch');
  });
  if (buildJson.commit_id !== prov.build_commit) errors.push('build.json commit_id is not the built commit');
  if ((buildJson.main_head_at_build || '') !== (prov.main_head_at_build || '')) {
    errors.push('build.json main_head_at_build mismatch');
  }
  COMPARE_PAGES.forEach(function (rel) {
    const file = path.join(DIST, rel);
    if (!fs.existsSync(file)) {
      errors.push(rel + ': missing page for build.json comparison');
      return;
    }
    const id = pageIdentity(fs.readFileSync(file, 'utf8'));
    Object.keys(expected).forEach(function (k) {
      if (id[k] !== buildJson[k]) errors.push(rel + ': ' + k + ' does not match build.json');
    });
  });
}

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

console.log(
  'DIST PROVENANCE OK — ' + stamped + '/' + htmlFiles.length +
  ' pages stamped; build.json matches ' + COMPARE_PAGES.length + ' pages'
);
