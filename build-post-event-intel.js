#!/usr/bin/env node
/* build-post-event-intel.js — Post-event intelligence trigger / registry.
 *
 * Scans data/events.json, identifies COMPLETED events (end date before today),
 * and emits a registry (data/post-event-intel-events.json) of event editions
 * that are ready for post-event research. Each entry carries an honest
 * summary_status of RESEARCH_QUEUED — there is NO fabricated attendance,
 * exhibitor or announcement data. When a real, source-backed summary is
 * drafted it is written to data/post-event-summaries.json and gated by
 * check-event-intel.js before publication.
 *
 * Run: node build-post-event-intel.js
 */
'use strict';
const fs = require('fs');
const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }

const today = new Date('2026-09-03T00:00:00Z').getTime();
const completed = (EVENTS.events || EVENTS).filter((e) => {
  const end = e.e ? new Date(e.e + 'T00:00:00Z').getTime() : 0;
  return end && end < today;
}).map((e) => ({
  event: e.n, slug: slugify(e.n), start: e.s, end: e.e, city: e.c, country: e.co, region: e.r,
  venue: e.v, url: e.u,
  summary_route: '/events/' + slugify(e.n) + '/summary',
  summary_status: 'RESEARCH_QUEUED', // no source-backed summary drafted yet
}));

completed.sort((a, b) => a.end.localeCompare(b.end));
const out = { generated: new Date().toISOString(), config: 'data/post-event-intel.json', count: completed.length, events: completed };
fs.writeFileSync('data/post-event-intel-events.json', JSON.stringify(out, null, 2));
console.log('post-event-intel registry: ' + completed.length + ' COMPLETED event editions queued for research (no fabricated facts)');
