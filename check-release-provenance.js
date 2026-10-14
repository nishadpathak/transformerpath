#!/usr/bin/env node
/* check-release-provenance.js — fail build if key surfaces disagree on release identity.
 *
 * Guarantees one intended release generated the audited public HTML set.
 */
'use strict';
const fs = require('fs');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

const prov = readJson('data/build-provenance.json', null);
if (!prov || !prov.build_commit || !prov.build_at || !prov.data_version) {
  console.error('RELEASE PROVENANCE: data/build-provenance.json incomplete');
  process.exit(1);
}

const errors = [];
const seen = [];

(prov.key_surfaces || []).forEach(function (file) {
  if (!fs.existsSync(file)) {
    errors.push('missing surface ' + file);
    return;
  }
  const html = fs.readFileSync(file, 'utf8');
  const commit = (html.match(/name="tp-build-commit"\s+content="([^"]+)"/i) || [])[1];
  const buildAt = (html.match(/name="tp-build-at"\s+content="([^"]+)"/i) || [])[1];
  const dataVer = (html.match(/name="tp-data-version"\s+content="([^"]+)"/i) || [])[1];
  if (!commit || !buildAt || !dataVer) {
    errors.push(file + ': missing tp-build-* / tp-data-version meta');
    return;
  }
  if (commit !== prov.build_commit) errors.push(file + ': build_commit mismatch (' + commit + ')');
  if (buildAt !== prov.build_at) errors.push(file + ': build_at mismatch (' + buildAt + ')');
  if (dataVer !== prov.data_version) errors.push(file + ': data_version mismatch (' + dataVer + ')');
  seen.push({ file: file, build_commit: commit, build_at: buildAt, data_version: dataVer });
});

if (errors.length) {
  console.error('RELEASE PROVENANCE GATE FAILED');
  errors.forEach(function (e) { console.error('  - ' + e); });
  process.exit(1);
}

const commits = new Set(seen.map(function (s) { return s.build_commit; }));
if (commits.size !== 1) {
  console.error('RELEASE PROVENANCE: mixed build_commit across surfaces');
  process.exit(1);
}

console.log(
  'RELEASE PROVENANCE OK — ' + seen.length + ' surfaces share commit=' +
  prov.build_commit.slice(0, 12) + ' data_version=' + prov.data_version
);
