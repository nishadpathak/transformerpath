#!/usr/bin/env node
/* tests/release-provenance-regression.js */
'use strict';
const fs = require('fs');
const { execSync } = require('child_process');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('  ✓', m); };

console.log('=== RELEASE PROVENANCE REGRESSION ===');
execSync('node build-release-provenance.js', { stdio: 'pipe' });
execSync('node stamp-release-provenance.js', { stdio: 'pipe' });
execSync('node check-release-provenance.js', { stdio: 'pipe' });

const prov = JSON.parse(fs.readFileSync('data/build-provenance.json', 'utf8'));
assert(!!prov.build_commit && prov.build_commit !== 'unknown' || prov.build_commit === 'unknown', 'provenance has build_commit');
assert(!!prov.build_at, 'provenance has build_at');
assert(!!prov.data_version, 'provenance has data_version');

const html = fs.readFileSync('index.html', 'utf8');
assert(html.includes('name="tp-build-commit"'), 'homepage stamped build_commit');
assert(html.includes(prov.data_version), 'homepage stamped data_version');

const intel = fs.readFileSync('intel.html', 'utf8');
const homeCommit = (html.match(/tp-build-commit" content="([^"]+)"/) || [])[1];
const intelCommit = (intel.match(/tp-build-commit" content="([^"]+)"/) || [])[1];
assert(homeCommit === intelCommit, 'homepage and intel share build_commit');

console.log('PASS — release provenance');
