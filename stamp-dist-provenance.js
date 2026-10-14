#!/usr/bin/env node
/* stamp-dist-provenance.js — stamp EVERY dist HTML file with the release triple.
 *
 * Runs after build-dist.js. Meta-refresh stubs are included. Source files are
 * not touched. Also writes build_commit + data_version onto the dist copies
 * of site-stats.json and freshness.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

const DIST = process.argv[2] || 'dist';
const provPath = fs.existsSync(path.join(DIST, 'data', 'build-provenance.json'))
  ? path.join(DIST, 'data', 'build-provenance.json')
  : 'data/build-provenance.json';
const prov = readJson(provPath, null);
if (!prov || !prov.build_commit || !prov.build_at || !prov.data_version) {
  console.error('stamp-dist-provenance: missing build provenance (' + provPath + ')');
  process.exit(1);
}
if (!prov.latest_intel_date || typeof prov.manufacturer_count !== 'number') {
  console.error('stamp-dist-provenance: provenance is missing latest_intel_date or manufacturer_count');
  process.exit(1);
}

/* Public /build.json. Same commit, build time, data_version, latest Intel
 * date and manufacturer count the HTML stamps carry. */
const buildJson = {
  commit: prov.build_commit,
  commit_id: prov.commit_id || prov.build_commit,
  commit_source: prov.commit_source || '',
  main_head_at_build: prov.main_head_at_build || '',
  build_time: prov.build_at,
  data_version: prov.data_version,
  latest_intel_date: prov.latest_intel_date,
  manufacturer_count: prov.manufacturer_count
};

const metas =
  '<meta name="tp-build-commit" content="' + buildJson.commit + '">' +
  '<meta name="tp-build-at" content="' + buildJson.build_time + '">' +
  '<meta name="tp-data-version" content="' + buildJson.data_version + '">' +
  '<meta name="tp-latest-intel-date" content="' + buildJson.latest_intel_date + '">' +
  '<meta name="tp-manufacturer-count" content="' + buildJson.manufacturer_count + '">';
const comment =
  '<!-- build.json commit=' + buildJson.commit +
  ' build_time=' + buildJson.build_time +
  ' data_version=' + buildJson.data_version +
  ' latest_intel_date=' + buildJson.latest_intel_date +
  ' manufacturer_count=' + buildJson.manufacturer_count + ' -->';

function stampHtml(file) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/\s*<meta name="tp-build-(?:commit|at)"[^>]*>/gi, '');
  html = html.replace(/\s*<meta name="tp-data-version"[^>]*>/gi, '');
  html = html.replace(/\s*<meta name="tp-latest-intel-date"[^>]*>/gi, '');
  html = html.replace(/\s*<meta name="tp-manufacturer-count"[^>]*>/gi, '');
  html = html.replace(/\s*<!-- tp-release [^>]*-->/g, '');
  html = html.replace(/\s*<!-- build\.json [^>]*-->/g, '');
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1>\n' + metas + '\n' + comment);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/<html([^>]*)>/i, function (full) {
      return full + '\n' + metas + '\n' + comment;
    });
  } else {
    html = metas + '\n' + comment + '\n' + html;
  }
  html = html.replace(/<html([^>]*)>/i, function (_, attrs) {
    let a = attrs || '';
    a = a
      .replace(/\sdata-tp-build-commit="[^"]*"/gi, '')
      .replace(/\sdata-tp-build-at="[^"]*"/gi, '')
      .replace(/\sdata-tp-data-version="[^"]*"/gi, '')
      .replace(/\sdata-tp-latest-intel-date="[^"]*"/gi, '')
      .replace(/\sdata-tp-manufacturer-count="[^"]*"/gi, '');
    return '<html' + a +
      ' data-tp-build-commit="' + buildJson.commit + '"' +
      ' data-tp-build-at="' + buildJson.build_time + '"' +
      ' data-tp-data-version="' + buildJson.data_version + '"' +
      ' data-tp-latest-intel-date="' + buildJson.latest_intel_date + '"' +
      ' data-tp-manufacturer-count="' + buildJson.manufacturer_count + '">';
  });
  fs.writeFileSync(file, html);
}

const htmlFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
}
walk(DIST);
if (!htmlFiles.length) {
  console.error('stamp-dist-provenance: no HTML under ' + DIST);
  process.exit(1);
}
htmlFiles.forEach(stampHtml);

function stampJson(rel) {
  const p = path.join(DIST, rel);
  if (!fs.existsSync(p)) {
    console.warn('stamp-dist-provenance: missing ' + p);
    return false;
  }
  const doc = readJson(p, null);
  if (!doc || typeof doc !== 'object') return false;
  doc.build_commit = prov.build_commit;
  doc.data_version = prov.data_version;
  fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
  return true;
}
stampJson('data/site-stats.json');
stampJson('data/freshness.json');

const distProvPath = path.join(DIST, 'data', 'build-provenance.json');
prov.surfaces_stamped_count = htmlFiles.length;
prov.html_stamped = htmlFiles.length;
prov.stamp_pass_at = new Date().toISOString();
prov.stamp_root = DIST;
if (fs.existsSync(path.dirname(distProvPath))) {
  fs.writeFileSync(distProvPath, JSON.stringify(prov, null, 2) + '\n');
}
fs.writeFileSync(path.join(DIST, 'build.json'), JSON.stringify(buildJson, null, 2) + '\n');
console.log('stamp-dist-provenance: ' + htmlFiles.length + '/' + htmlFiles.length + ' pages stamped');
console.log('stamp-dist-provenance: wrote ' + path.join(DIST, 'build.json'));
