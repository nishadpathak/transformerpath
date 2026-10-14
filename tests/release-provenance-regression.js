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
execSync('node build-release-provenance.js', { stdio: 'pipe' });
const prov = JSON.parse(fs.readFileSync('data/build-provenance.json', 'utf8'));
assert(!!prov.build_commit, 'provenance has build_commit');
assert(!!prov.build_at, 'provenance has build_at');
assert(!!prov.data_version, 'provenance has data_version');
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

execSync('node stamp-dist-provenance.js', { stdio: 'pipe' });
const check = execSync('node check-dist-provenance.js', { encoding: 'utf8' });
assert(/DIST PROVENANCE OK — 2\/2 pages stamped/.test(check), 'both fixture pages stamped: ' + check.trim());

const stamped = fs.readFileSync(path.join(fixture, 'stub', 'index.html'), 'utf8');
assert(stamped.includes('name="tp-build-commit" content="' + prov.build_commit + '"'), 'stub carries build_commit');
const stats = JSON.parse(fs.readFileSync('dist/data/site-stats.json', 'utf8'));
assert(stats.build_commit === prov.build_commit && stats.data_version === prov.data_version, 'site-stats carries release identity');

const source = fs.readFileSync('index.html', 'utf8');
assert(!source.includes('tp-build-commit'), 'source homepage was not stamped');

console.log('PASS — release provenance');
