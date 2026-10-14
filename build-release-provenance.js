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

function gitSha() {
  const env =
    process.env.COMMIT_REF ||
    process.env.GITHUB_SHA ||
    process.env.HEAD ||
    process.env.GIT_COMMIT ||
    '';
  if (env && /^[0-9a-f]{7,40}$/i.test(env.trim())) return env.trim().slice(0, 40);
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

const NOW = new Date().toISOString();
const commit = gitSha();
const stats = readJson('data/site-stats.json', {});
const fresh = readJson('data/freshness.json', {});
const materials = readJson('data/materials-latest.json', {});

const fingerprintPayload = JSON.stringify({
  manufacturers: stats.manufacturers,
  site_stats_updated: stats.updated,
  latest_source_date: fresh.latest_source_date || null,
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
  data_fingerprint: JSON.parse(fingerprintPayload),
  honest_note:
    'Every key public surface in this deploy must carry the same build_commit + build_at + data_version. Mixed generations on production are a release defect.',
  key_surfaces: KEY_SURFACES,
  stamped_at: NOW
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/build-provenance.json', JSON.stringify(out, null, 2));
console.log(
  'build-provenance: commit=' + commit.slice(0, 12) +
  ' data_version=' + data_version +
  ' build_at=' + NOW
);
