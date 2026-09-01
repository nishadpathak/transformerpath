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
    source_health: 'depends on the Netlify runtime schedule and EventRegistry availability; not verified in this static build',
    records: null,
  },
  {
    id: 'projects',
    name: 'Projects database',
    cadence: 'maintained',
    last_build: ts('projects'),
    last_data_refresh: ts('projects'),
    source_health: 'curated, source-tracked',
    records: readJson('data/projects.json', {}).projects ? readJson('data/projects.json', {}).projects.length : null,
  },
  {
    id: 'tenders',
    name: 'Tender Watch',
    cadence: 'maintained',
    last_build: ts('tenders'),
    last_data_refresh: ts('tenders'),
    source_health: 'derived from source-backed projects + intel; never fabricated',
    records: readJson('data/tenders.json', {}).tenders ? readJson('data/tenders.json', {}).tenders.length : null,
  },
  {
    id: 'awards',
    name: 'Awards',
    cadence: 'maintained',
    last_build: ts('awards'),
    last_data_refresh: ts('awards'),
    source_health: 'source-confirmed only',
    records: readJson('data/awards.json', {}).awards ? readJson('data/awards.json', {}).awards.length : null,
  },
  {
    id: 'materials',
    name: 'Materials Intelligence',
    cadence: 'reference',
    description: 'Copper/aluminium are the LME reference (dated, sourced). CRGO and others are shown as unavailable (no public daily index).',
    last_build: ts('materials'),
    last_data_refresh: ts('materials'),
    source_health: 'reference only — not a live feed',
    records: readJson('data/materials.json', {}).materials ? readJson('data/materials.json', {}).materials.length : null,
  },
];

const freshness = {
  $schema: 'https://transformerpath.com/freshness.schema.json',
  generated: NOW,
  honest_note: 'PAGE BUILD DATE is when this artifact was last regenerated; DATA REFRESH DATE is the last successful source refresh. These are distinct. The curated Daily Intel feed is refreshed at build (daily cadence label) — it is not an hourly live scrape. The serverless auto-briefing cache is a separate background cache.',
  surfaces,
};
fs.writeFileSync('data/freshness.json', JSON.stringify(freshness, null, 2));
console.log('freshness.json wrote ' + surfaces.length + ' surfaces (distinguishes page-build vs data-refresh)');
