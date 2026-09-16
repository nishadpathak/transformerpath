#!/usr/bin/env node
/* Remove confirmed-defunct / merged-away manufacturers from data/manufacturers.json.
 *
 * Usage: node remove-manufacturers.js <verdicts.json>
 *   verdicts.json: [ { "name": "<exact or substring>", "country": "<group>", "reason": "..." } ]
 *
 * For each verdict, removes a maker whose name matches (case-insensitive substring)
 * within the named country group. Writes a log of removals to data/manufacturer-retirements.json
 * so the historical fact is retained (and can be surfaced as "formerly listed") rather than
 * silently lost, then rewrites data/manufacturers.json.
 */
'use strict';
const fs = require('fs');
const DB = 'data/manufacturers.json';
const data = JSON.parse(fs.readFileSync(DB, 'utf8'));

const verdicts = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const retirements = fs.existsSync('data/manufacturer-retirements.json')
  ? JSON.parse(fs.readFileSync('data/manufacturer-retirements.json', 'utf8'))
  : { retired: [] };

let removed = 0, notFound = 0;
for (const v of verdicts) {
  const g = data.find((x) => x.country.trim().toLowerCase() === String(v.country).toLowerCase());
  if (!g) { notFound++; console.log('NO GROUP:', v.country, '|', v.name); continue; }
  const before = g.makers.length;
  const keep = [];
  for (const m of g.makers) {
    const hit = !v.name || String(m[0]).toLowerCase().includes(String(v.name).toLowerCase());
    if (hit) {
      retirements.retired.push({
        name: m[0], country: g.country, city: m[1] || '', url: m[2] || '', types: m[3] || '',
        reason: v.reason || '', removed: new Date().toISOString(),
      });
    } else {
      keep.push(m);
    }
  }
  g.makers = keep;
  const n = before - keep.length;
  if (!n && !v.name) { notFound++; console.log('NOT FOUND:', v.country, '|', v.name); }
  removed += n;
}

fs.writeFileSync(DB, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync('data/manufacturer-retirements.json', JSON.stringify(retirements, null, 2) + '\n');

const real = data.reduce((a, g) => a + g.makers.filter((m) => !/^Served by/i.test(m[0])).length, 0);
console.log('removed:', removed, '| notFound:', notFound);
console.log('db now:', data.reduce((a, g) => a + g.makers.length, 0), 'rows /', real, 'real makers /', data.length, 'groups');
