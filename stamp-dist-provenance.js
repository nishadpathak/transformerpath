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

const metas =
  '<meta name="tp-build-commit" content="' + prov.build_commit + '">' +
  '<meta name="tp-build-at" content="' + prov.build_at + '">' +
  '<meta name="tp-data-version" content="' + prov.data_version + '">';
const comment =
  '<!-- tp-release build_commit=' + prov.build_commit +
  ' build_at=' + prov.build_at +
  ' data_version=' + prov.data_version + ' -->';

function stampHtml(file) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/\s*<meta name="tp-build-(?:commit|at)"[^>]*>/gi, '');
  html = html.replace(/\s*<meta name="tp-data-version"[^>]*>/gi, '');
  html = html.replace(/\s*<!-- tp-release [^>]*-->/g, '');
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
      .replace(/\sdata-tp-data-version="[^"]*"/gi, '');
    return '<html' + a +
      ' data-tp-build-commit="' + prov.build_commit + '"' +
      ' data-tp-build-at="' + prov.build_at + '"' +
      ' data-tp-data-version="' + prov.data_version + '">';
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
console.log('stamp-dist-provenance: ' + htmlFiles.length + '/' + htmlFiles.length + ' pages stamped');
