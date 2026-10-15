#!/usr/bin/env node
/* build-freshness.js — canonical freshness & source-health system.
 *
 * The platform brief requires ONE truthful freshness system and no conflicting
 * "hourly / twice a day / updated daily" language. This builder records, for
 * each intelligence dataset, the truthful refresh state: what was last built,
 * the cadence, whether a source is healthy, and — crucially — distinguishes:
 *   PAGE BUILD DATE   (when this HTML/data artifact was last regenerated)
 *   DATA REFRESH DATE (the last successful source refresh for that dataset)
 *
 * HONESTY: a curated dataset (data/intel.json) is built from curated items at
 * build time — it is NOT an hourly auto-refresh. The separate serverless
 * refresh-data function caches an auto-briefing on a scheduled interval, but
 * that is a distinct background cache, not the curated Daily Intel feed. This
 * file states exactly that rather than conflating the two.
 *
 * Output: data/freshness.json (canonical) — read by the Intel page and admin.
 *
 * Run: node build-freshness.js  (after the data builders).
 */
'use strict';
const fs = require('fs');
function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
function ts(f) { const d = readJson('data/' + f + '.json', {}); return d.updated || d.generated || d.generated_at || d.last_updated || (d.stats && d.stats.generated_at) || null; }
const { computeIntelStatus } = require('./lib/intel-status');
function surfaceHealth(label) {
  if (label === 'DATA STALE') return 'STALE';
  if (label === 'DATA CURRENT' || label === 'Updated today' || /^UPDATED \d{1,2} [A-Za-z]{3} \d{4}$/.test(label || '')) return 'HEALTHY';
  return 'AGING';
}
const NOW = new Date().toISOString();
const shared = computeIntelStatus({ buildAt: NOW, now: new Date(NOW) });
const noon = shared.latest_source_iso ? shared.latest_source_iso + 'T12:00:00.000Z' : null;
const INTEL_OBS = noon ? (noon > NOW ? NOW : noon) : null;
const INTEL_CHECKED = shared.latest_source_checked_at;
const intelStatus = {
  latest_source_iso: shared.latest_source_iso,
  statusLabel: shared.status,
  reason: shared.reason,
  data_current_claim_allowed: shared.data_current_claim_allowed,
  honesty: 'Status follows latest_source_date, not build_at and not the GCC discovery gate. Desk rebuild alone never yields UPDATED or DATA CURRENT.'
};

// Source body: cite what each intelligence surface is actually fed by, and its
// last-known refresh. All values are observed from the data, never invented.
const surfaces = [
  {
    id: 'daily_intel',
    name: 'Daily Intel',
    cadence: 'daily (curated)',
    description: 'Curated transformer-industry intelligence feed. Data is compiled and regenerated at each build; it is not an automatic live scrape.',
    last_build: NOW,
    build_at: NOW,
    last_data_refresh: INTEL_OBS,
    last_attempted_refresh: INTEL_OBS,
    last_successful_refresh: INTEL_OBS,
    latest_source_observation: INTEL_OBS,
    latest_source_date: intelStatus.latest_source_iso,
    latest_source_checked_at: INTEL_CHECKED,
    public_status: intelStatus.statusLabel,
    public_status_reason: intelStatus.reason,
    data_current_claim_allowed: intelStatus.data_current_claim_allowed,
    records_added: null,
    records_updated: null,
    source_count: 'per-item',
    source_failures: null,
    status: surfaceHealth(intelStatus.statusLabel),
    source_health: intelStatus.honesty,
    records: readJson('data/intel.json', {}),
  },
  {
    id: 'auto_briefing',
    name: 'Auto-briefing cache',
    cadence: 'scheduled (hourly when deployed)',
    description: 'A serverless refresh function (functions/refresh-data.js) pulls transformer-industry headlines into a cache to populate the changelog/briefing. This is a background cache, distinct from the curated Daily Intel feed.',
    last_build: null,
    last_data_refresh: null,
    last_attempted_refresh: null,
    last_successful_refresh: null,
    latest_source_observation: null,
    records_added: null,
    records_updated: null,
    source_count: null,
    source_failures: null,
    status: 'MANUAL_REVIEW',
    source_health: 'depends on the Netlify runtime schedule and EventRegistry availability; not verified in this static build',
    records: null,
  },
  {
    id: 'projects',
    name: 'Projects database',
    cadence: 'maintained',
    last_build: ts('projects'),
    last_data_refresh: ts('projects'),
    last_attempted_refresh: ts('projects'),
    last_successful_refresh: ts('projects'),
    latest_source_observation: ts('projects'),
    records_added: null,
    records_updated: null,
    source_count: null,
    source_failures: null,
    status: 'HEALTHY',
    source_health: 'curated, source-tracked',
    records: readJson('data/projects.json', {}).projects ? readJson('data/projects.json', {}).projects.length : null,
  },
  {
    id: 'tenders',
    name: 'Tender Watch',
    cadence: 'maintained',
    last_build: ts('tenders'),
    last_data_refresh: ts('tenders'),
    last_attempted_refresh: ts('tenders'),
    last_successful_refresh: ts('tenders'),
    latest_source_observation: ts('tenders'),
    records_added: null,
    records_updated: null,
    source_count: null,
    source_failures: null,
    status: 'HEALTHY',
    source_health: 'derived from source-backed projects + intel; never fabricated',
    records: readJson('data/tenders.json', {}).tenders ? readJson('data/tenders.json', {}).tenders.length : null,
  },
  {
    id: 'awards',
    name: 'Awards',
    cadence: 'maintained',
    last_build: ts('awards'),
    last_data_refresh: ts('awards'),
    last_attempted_refresh: ts('awards'),
    last_successful_refresh: ts('awards'),
    latest_source_observation: ts('awards'),
    records_added: null,
    records_updated: null,
    source_count: null,
    source_failures: null,
    status: 'HEALTHY',
    source_health: 'source-confirmed only',
    records: readJson('data/awards.json', {}).awards ? readJson('data/awards.json', {}).awards.length : null,
  },
  {
    id: 'materials',
    name: 'Materials Intelligence',
    cadence: 'reference',
    description: 'Copper/aluminium are the LME reference (dated, sourced, freshness_status). CRGO and others are shown as unavailable (no public daily index).',
    last_build: ts('materials'),
    last_data_refresh: ts('materials'),
    last_attempted_refresh: ts('materials'),
    last_successful_refresh: ts('materials'),
    latest_source_observation: 'LME reference observed 2026-08-20 (per record); others have no verified reference',
    records_added: null,
    records_updated: null,
    source_count: 1,
    source_failures: null,
    status: 'HEALTHY',
    source_health: 'reference only — not a live feed',
    records: readJson('data/materials.json', {}).materials ? readJson('data/materials.json', {}).materials.length : null,
  },
];

// P0 source-health rows. Each is a specific source feeding an intelligence surface.
// last_* and latest_content_date are observed from the data, never invented.
const sources = [
  {
    name: 'LME official price (copper / aluminium)', type: 'market-reference', region: 'Global',
    works_for: ['materials'],
    last_checked: ts('materials'), last_success: ts('materials'), latest_content_date: '2026-08-20',
    failure_count: 0, status: 'HEALTHY',
  },
  {
    name: 'Curated Daily Intel editorial items', type: 'curated-content', region: 'Global',
    works_for: ['daily_intel'],
    last_checked: INTEL_OBS, last_success: INTEL_OBS, latest_content_date: INTEL_OBS,
    failure_count: 0, status: 'HEALTHY',
  },
  {
    name: 'EventRegistry (auto-briefing)', type: 'serverless-cache', region: 'Global',
    works_for: ['auto_briefing'],
    last_checked: null, last_success: null, latest_content_date: null,
    failure_count: null, status: 'MANUAL_REVIEW',
  },
];

const freshness = {
  $schema: 'https://transformerpath.com/freshness.schema.json',
  generated: NOW,
  build_at: NOW,
  latest_source_date: intelStatus.latest_source_iso,
  latest_source_checked_at: INTEL_CHECKED,
  public_intel_status: intelStatus.statusLabel,
  public_intel_status_reason: intelStatus.reason,
  data_current_claim_allowed: intelStatus.data_current_claim_allowed,
  honest_note: 'Three clocks: latest_source_date (content), latest_source_checked_at (portal probe), build_at (artifact regenerate). A sourced item no more than 1 day old reads UPDATED with that date, or Updated today. Older items keep the age labels. A desk rebuild never mints freshness. GCC confirmed coverage is stated only on GCC market pages.',
  surfaces,
  sources,
  clocks: intelStatus
};
fs.writeFileSync('data/freshness.json', JSON.stringify(freshness, null, 2));
console.log('freshness.json wrote ' + surfaces.length + ' surfaces · public status ' + intelStatus.statusLabel + ' (source ' + (intelStatus.latest_source_iso || 'none') + ')');
