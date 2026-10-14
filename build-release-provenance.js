#!/usr/bin/env node
/* build-release-provenance.js — single-release identity for every public surface.
 *
 * Writes data/build-provenance.json with:
 *   build_commit  — git SHA / Netlify COMMIT_REF of this artifact set
 *   build_at      — when this release was stamped
 *   data_version  — short fingerprint of canonical data clocks + census
 *
 * Downstream stamp-release-provenance.js injects the same triple into key HTML
 * so production audits can prove SOURCE → BUILD → GENERATED → DEPLOY identity.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

function gitOut(args) {
  try {
    return execSync('git ' + args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return '';
  }
}

function readGitState() {
  const snap = readJson('data/.release-git-state.json', null);
  if (snap && (snap.head || snap.error)) return snap;
  const head = gitOut('rev-parse HEAD');
  const porcelain = gitOut('status --porcelain');
  return {
    head: head,
    porcelain: porcelain,
    git_dirty: porcelain.length > 0,
    captured_at: null,
    error: head ? '' : 'git state snapshot missing and git rev-parse failed'
  };
}

function gitSha(state) {
  const env =
    process.env.COMMIT_REF ||
    process.env.GITHUB_SHA ||
    process.env.HEAD ||
    process.env.GIT_COMMIT ||
    '';
  if (env && /^[0-9a-f]{7,40}$/i.test(env.trim())) return env.trim().slice(0, 40);
  if (state && state.head) return state.head.slice(0, 40);
  return 'unknown';
}

const NOW = new Date().toISOString();
const gitState = readGitState();
const commit = gitSha(gitState);
const context = process.env.CONTEXT || '';
const commitRef = (process.env.COMMIT_REF || '').trim();
const head = (gitState.head || '').trim();
const stats = readJson('data/site-stats.json', {});
const fresh = readJson('data/freshness.json', {});
const materials = readJson('data/materials-latest.json', {});
const latestIntelDate = fresh.latest_source_date || null;
const manufacturerCount = (typeof stats.manufacturers === 'number') ? stats.manufacturers : null;

if (context === 'production') {
  const problems = [];
  if (!commitRef) problems.push('COMMIT_REF is missing');
  else if (!head) problems.push('git HEAD is missing');
  else if (commitRef !== head && !head.startsWith(commitRef) && !commitRef.startsWith(head)) {
    problems.push('COMMIT_REF ' + commitRef + ' does not match git HEAD ' + head);
  }
  if (gitState.git_dirty) problems.push('git tree is dirty:\n' + String(gitState.porcelain || '').slice(0, 2000));
  if (gitState.error) problems.push(gitState.error);
  if (!gitState.captured_at) problems.push('git state was not captured before generators ran');
  if (!latestIntelDate) problems.push('latest Intel date is missing');
  if (manufacturerCount == null) problems.push('manufacturer count is missing');
  if (problems.length) {
    console.error('RELEASE PROVENANCE: production deploy refused');
    problems.forEach(function (p) { console.error('  - ' + p); });
    process.exit(1);
  }
}
const fingerprintPayload = JSON.stringify({
  manufacturers: manufacturerCount,
  site_stats_updated: stats.updated,
  latest_source_date: latestIntelDate,
  latest_source_checked_at: fresh.latest_source_checked_at || null,
  public_intel_status: fresh.public_intel_status || null,
  materials_updated: materials.updated || null,
  copper_obs: ((materials.rows || []).find((r) => r.id === 'copper') || {}).observation_date || null,
  aluminium_obs: ((materials.rows || []).find((r) => r.id === 'aluminium') || {}).observation_date || null
});
const data_version = crypto.createHash('sha256').update(fingerprintPayload).digest('hex').slice(0, 12);

const KEY_SURFACES = [
  'index.html',
  'intel.html',
  'intelligence.html',
  'pricing.html',
  'manufacturers.html',
  'manufacturers/cg-power-and-industrial-solutions/index.html',
  'events/middle-east-energy/index.html',
  'jobs.html',
  'explorer.html',
  'power3d.html',
  'materials.html',
  'faq.html'
];

const out = {
  $schema: 'https://transformerpath.com/build-provenance.schema.json',
  build_commit: commit,
  build_at: NOW,
  data_version: data_version,
  latest_intel_date: latestIntelDate,
  manufacturer_count: manufacturerCount,
  data_fingerprint: JSON.parse(fingerprintPayload),
  honest_note:
    'Every HTML page in this deploy must carry the same build_commit + build_at + data_version. Mixed generations on production are a release defect.',
  key_surfaces: KEY_SURFACES,
  netlify: {
    CONTEXT: context,
    DEPLOY_ID: process.env.DEPLOY_ID || '',
    BUILD_ID: process.env.BUILD_ID || '',
    COMMIT_REF: commitRef
  },
  git_dirty: !!gitState.git_dirty,
  git_head: head,
  git_state_captured_at: gitState.captured_at || '',
  stamped_at: NOW
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/build-provenance.json', JSON.stringify(out, null, 2));
console.log(
  'build-provenance: commit=' + commit.slice(0, 12) +
  ' data_version=' + data_version +
  ' build_at=' + NOW
);
