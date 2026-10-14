#!/usr/bin/env node
/* stamp-release-provenance.js — inject release identity into key HTML surfaces.
 *
 * Adds / replaces:
 *   <meta name="tp-build-commit" content="…">
 *   <meta name="tp-build-at" content="…">
 *   <meta name="tp-data-version" content="…">
 * and data-tp-* attributes on <html>.
 *
 * Also refreshes data/build-provenance.json → surfaces_stamped[].
 */
'use strict';
const fs = require('fs');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

const prov = readJson('data/build-provenance.json', null);
if (!prov || !prov.build_commit) {
  console.error('stamp-release-provenance: missing data/build-provenance.json — run build-release-provenance.js first');
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
  if (!fs.existsSync(file)) {
    console.warn('stamp-release-provenance: skip missing ' + file);
    return false;
  }
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // Drop prior stamps
  html = html.replace(/\s*<meta name="tp-build-(?:commit|at)"[^>]*>/gi, '');
  html = html.replace(/\s*<meta name="tp-data-version"[^>]*>/gi, '');
  html = html.replace(/\s*<!-- tp-release [^>]*-->/g, '');

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1>\n' + metas + '\n' + comment);
  } else {
    html = metas + '\n' + comment + '\n' + html;
  }

  // Tag <html> for runtime/DOM audits
  html = html.replace(/<html([^>]*)>/i, function (_, attrs) {
    let a = attrs || '';
    a = a
      .replace(/\sdata-tp-build-commit="[^"]*"/gi, '')
      .replace(/\sdata-tp-build-at="[^"]*"/gi, '')
      .replace(/\sdata-tp-data-version="[^"]*"/gi, '');
    return (
      '<html' + a +
      ' data-tp-build-commit="' + prov.build_commit + '"' +
      ' data-tp-build-at="' + prov.build_at + '"' +
      ' data-tp-data-version="' + prov.data_version + '">'
    );
  });

  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log('stamped release provenance → ' + file);
    return true;
  }
  return false;
}

const stamped = [];
(prov.key_surfaces || []).forEach(function (f) {
  if (stampHtml(f)) stamped.push(f);
});

prov.surfaces_stamped = stamped;
prov.stamp_pass_at = new Date().toISOString();
fs.writeFileSync('data/build-provenance.json', JSON.stringify(prov, null, 2));
console.log('stamp-release-provenance: ' + stamped.length + ' surfaces');
