#!/usr/bin/env node
/* build-event-canonicalization.js
 * events.json (long keys) → data/events-canonical.json.
 * Status comes from lib/event-status.js. Nothing is invented here.
 */
'use strict';
const fs = require('fs');
const { loadEvents } = require('./lib/events-reader');
const status = require('./lib/event-status');
const { dubaiToday } = require('./lib/event-display');

const events = loadEvents();
const today = dubaiToday();
const editions = events.map((rec) => {
  const resolved = status.resolveStatus(Object.assign({}, rec, { tz: 'Asia/Dubai' }));
  return Object.assign({}, rec, {
    lifecycle_status: resolved.key,
    status_reason: resolved.reason,
  });
});

const dupes = [];
const seen = {};
editions.forEach((ed) => {
  if (seen[ed.id]) dupes.push({ id: ed.id, state: 'DUPLICATE_ID' });
  seen[ed.id] = ed.name;
});

const bySeries = {};
editions.forEach((ed) => {
  const k = ed.series_slug || ed.id;
  (bySeries[k] = bySeries[k] || []).push(ed.id);
});

const out = {
  generated_at: today,
  source: 'data/events.json',
  canonical_editions: editions,
  series: Object.keys(bySeries).sort().map((slug) => ({ series_slug: slug, edition_ids: bySeries[slug] })),
  possible_duplicates: dupes,
};
fs.writeFileSync('data/events-canonical.json', JSON.stringify(out, null, 2) + '\n');

const counts = {};
editions.forEach((e) => { const k = e.date_status || 'null'; counts[k] = (counts[k] || 0) + 1; });
console.log('Canonical editions: ' + editions.length + ' | series: ' + Object.keys(bySeries).length);
console.log('date_status ' + JSON.stringify(counts));
console.log('lifecycle ' + JSON.stringify(editions.reduce((a, e) => { a[e.lifecycle_status] = (a[e.lifecycle_status] || 0) + 1; return a; }, {})));
if (dupes.length) {
  console.error('DUPLICATE IDS: ' + dupes.map((d) => d.id).join(', '));
  process.exitCode = 1;
}
