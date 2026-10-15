#!/usr/bin/env node
/* tests/release-provenance-regression.js
 * Stamps a tiny dist and checks every HTML file, including a meta-refresh stub.
 * Does not write tp-build-commit into source.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('  ✓', m); };

console.log('=== RELEASE PROVENANCE REGRESSION ===');
const { filterPorcelain } = require('../scripts/capture-git-state');
assert(filterPorcelain(' M supabase-config.js') === '', 'generated supabase config is not source dirt');
assert(filterPorcelain('M supabase-config.js') === '', 'trimmed status line for the generated config is not source dirt');
assert(filterPorcelain(' M supabase-config.js\n M index.html') === ' M index.html', 'other dirty files still fail the snapshot');
execSync('node build-release-provenance.js', { stdio: 'pipe' });
const prov = JSON.parse(fs.readFileSync('data/build-provenance.json', 'utf8'));
assert(!!prov.build_commit, 'provenance has build_commit');
assert(!!prov.build_at, 'provenance has build_at');
assert(!!prov.data_version, 'provenance has data_version');
assert(!!prov.latest_intel_date, 'provenance has latest_intel_date');
assert(typeof prov.manufacturer_count === 'number', 'provenance has manufacturer_count');
assert(prov.latest_intel_date === prov.data_fingerprint.latest_source_date, 'latest Intel date is the freshness clock');
assert(prov.manufacturer_count === prov.data_fingerprint.manufacturers, 'manufacturer count is the census clock');
assert(Object.prototype.hasOwnProperty.call(prov, 'git_dirty'), 'provenance records git_dirty');
assert(prov.netlify && Object.prototype.hasOwnProperty.call(prov.netlify, 'COMMIT_REF'), 'provenance records Netlify COMMIT_REF');

const fixture = path.join('dist', '_prov_fixture');
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync(path.join(fixture, 'stub'), { recursive: true });
fs.mkdirSync(path.join('dist', 'data'), { recursive: true });
fs.copyFileSync('data/build-provenance.json', 'dist/data/build-provenance.json');
fs.writeFileSync('dist/data/site-stats.json', JSON.stringify({ manufacturers: 1 }) + '\n');
fs.writeFileSync('dist/data/freshness.json', JSON.stringify({ generated: prov.build_at }) + '\n');
fs.writeFileSync(path.join(fixture, 'page.html'), '<!DOCTYPE html><html lang="en"><head><title>t</title></head><body>ok</body></html>');
fs.writeFileSync(path.join(fixture, 'stub', 'index.html'), '<!DOCTYPE html><html lang="en"><head><meta http-equiv="refresh" content="0;url=/x/"></head><body>redirect</body></html>');
const comparePages = [
  'intel.html',
  'manufacturers.html',
  'manufacturers/hitachi-energy/index.html',
  'manufacturers/cg-power-and-industrial-solutions/index.html'
];
comparePages.forEach(function (rel) {
  const file = path.join('dist', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '<!DOCTYPE html><html lang="en"><head><title>' + rel + '</title></head><body>ok</body></html>');
});

execSync('node stamp-dist-provenance.js', { stdio: 'pipe' });
const check = execSync('node check-dist-provenance.js', { encoding: 'utf8' });
assert(/DIST PROVENANCE OK — 6\/6 pages stamped/.test(check), 'fixture pages stamped: ' + check.trim());

const buildJson = JSON.parse(fs.readFileSync('dist/build.json', 'utf8'));
assert(buildJson.commit === prov.build_commit, 'build.json commit matches provenance');
assert(buildJson.build_time === prov.build_at, 'build.json build_time matches provenance');
assert(buildJson.data_version === prov.data_version, 'build.json data_version matches provenance');
assert(buildJson.latest_intel_date === prov.latest_intel_date, 'build.json latest_intel_date matches provenance');
assert(buildJson.manufacturer_count === prov.manufacturer_count, 'build.json manufacturer_count matches provenance');
comparePages.forEach(function (rel) {
  const html = fs.readFileSync(path.join('dist', rel), 'utf8');
  assert(html.includes('name="tp-build-commit" content="' + buildJson.commit + '"'), rel + ' stamps the build.json commit');
  assert(html.includes('name="tp-latest-intel-date" content="' + buildJson.latest_intel_date + '"'), rel + ' stamps the latest Intel date');
  assert(html.includes('name="tp-manufacturer-count" content="' + buildJson.manufacturer_count + '"'), rel + ' stamps the manufacturer count');
  assert(html.includes('<!-- build.json commit=' + buildJson.commit), rel + ' carries the build.json comment');
});

const stamped = fs.readFileSync(path.join(fixture, 'stub', 'index.html'), 'utf8');
assert(stamped.includes('name="tp-build-commit" content="' + prov.build_commit + '"'), 'stub carries build_commit');
const stats = JSON.parse(fs.readFileSync('dist/data/site-stats.json', 'utf8'));
assert(stats.build_commit === prov.build_commit && stats.data_version === prov.data_version, 'site-stats carries release identity');

const source = fs.readFileSync('index.html', 'utf8');
assert(!source.includes('tp-build-commit'), 'source homepage was not stamped');

console.log('PASS — release provenance');
