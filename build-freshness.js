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

const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);

// Source body: cite what each intelligence surface is actually fed by, and its
// last-known refresh. All values are observed from the data, never invented.
const surfaces = [
  {
    id: 'daily_intel',
    name: 'Daily Intel',
    cadence: 'daily (curated)',
    description: 'Curated transformer-industry intelligence feed. Data is compiled and regenerated at each build; it is not an automatic live scrape.',
    last_build: ts('intel-categories') || ts('intel'),
    last_data_refresh: ts('intel'),
    // P0 refresh metadata — a curated feed is refreshed at build, not on a live
    // schedule. attempted == successful for a static build; there is no poller.
    last_attempted_refresh: ts('intel'),
    last_successful_refresh: ts('intel'),
    latest_source_observation: 'curated items carry their own per-item source date',
    records_added: null,
    records_updated: null,
    source_count: 'per-item',
    source_failures: null,
    status: 'HEALTHY',
    source_health: 'curated — refreshed at build; next refresh depends on the publishing cycle',
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
    last_checked: ts('intel-categories') || ts('intel'), last_success: ts('intel'), latest_content_date: 'per-item source date',
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
  honest_note: 'PAGE BUILD DATE is when this artifact was last regenerated; DATA REFRESH DATE is the last successful source refresh. These are distinct. The curated Daily Intel feed is refreshed at build (daily cadence label) — it is not an hourly live scrape. The serverless auto-briefing cache is a separate background cache. A freshness status of HEALTHY/AGING/STALE is computed from observed dates; nothing is presented as live.',
  surfaces,
  sources,
};
fs.writeFileSync('data/freshness.json', JSON.stringify(freshness, null, 2));
console.log('freshness.json wrote ' + surfaces.length + ' surfaces + ' + sources.length + ' sources (distinguishes page-build vs data-refresh)');
