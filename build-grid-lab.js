#!/usr/bin/env node
/* build-grid-lab.js — TransformerPath Grid Lab scenarios from the live grid census.
 *
 * Grid Lab is a learning surface over data/grids.json. It is NOT a new 3D
 * model and it is NOT Country Grid Lab (that comes later). Scenarios are
 * derived from the census so answers stay truthful.
 *
 * Output: data/grid-lab.json
 * Run: node build-grid-lab.js  (after build-grids.js)
 */
'use strict';
const fs = require('fs');
function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

const GRIDS = readJson('data/grids.json', []);
const STATS = readJson('data/site-stats.json', {});

function maxKv(country) {
  let max = 0;
  (country.grids || []).forEach((g) => {
    const m = String(g[2] || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*kV/i);
    if (m) max = Math.max(max, parseFloat(m[1]));
  });
  return max;
}

function kvList(country) {
  const out = [];
  (country.grids || []).forEach((g) => {
    const m = String(g[2] || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*kV/i);
    if (m) out.push({ operator: g[0], kv: parseFloat(m[1]), label: g[2] });
  });
  return out;
}

const hz60 = GRIDS.filter((g) => String(g.freq) === '60').map((g) => g.country);
const hz50 = GRIDS.filter((g) => String(g.freq) === '50').map((g) => g.country);
const isolated = GRIDS.filter((g) => /isolated/i.test(String(g.sync || ''))).map((g) => g.country);
const gccia = GRIDS.filter((g) => /GCCIA/i.test(String(g.sync || ''))).map((g) => g.country);
const uhv = GRIDS.filter((g) => maxKv(g) >= 765).map((g) => ({ country: g.country, kv: maxKv(g), flag: g.flag }));
const kv400 = GRIDS.filter((g) => maxKv(g) >= 400 && maxKv(g) < 765).map((g) => g.country);

let highest = { country: '', kv: 0, flag: '' };
GRIDS.forEach((g) => {
  const k = maxKv(g);
  if (k > highest.kv) highest = { country: g.country, kv: k, flag: g.flag };
});

const scenarios = [
  {
    id: 'freq-50-60',
    title: '50 Hz and 60 Hz worlds',
    family: 'Grid systems',
    minutes: 6,
    skill: 'grid-frequency',
    summary: 'The census records national frequency. Most of the world is 50 Hz; a smaller set — including North America, parts of the Americas, Saudi Arabia, Japan (split), South Korea and the Philippines — is 60 Hz.',
    prompt: 'Which of these census countries is recorded as 60 Hz?',
    options: pickOptions(hz60, hz50, ['Saudi Arabia', 'United States', 'Canada', 'South Korea', 'Philippines'], ['Germany', 'India', 'France', 'United Kingdom', 'Egypt']),
    answer_hint: '60 Hz countries in this census include ' + hz60.slice(0, 8).join(', ') + (hz60.length > 8 ? '…' : '') + '.',
    census_count: hz60.length,
    next: 'uhv-765',
  },
  {
    id: 'uhv-765',
    title: 'UHV and 765 kV class',
    family: 'Grid systems',
    minutes: 8,
    skill: 'uhv-systems',
    summary: 'A 765 kV class grid is uncommon. The census records transmission voltage per operator — UHV / 765 kV is a structured voltage match, not a marketing label.',
    prompt: 'Open the directory for 765 kV manufacturers after this scenario. First: which census countries show a grid voltage of 765 kV or above?',
    options: uhv.slice(0, 8).map((u) => u.country).concat(['Iceland', 'Malta']).filter(uniq).slice(0, 6),
    answer_hint: uhv.length
      ? ('Census countries at ≥765 kV: ' + uhv.map((u) => u.country + ' (' + u.kv + ' kV)').join('; ') + '.')
      : 'No country in the current census records ≥765 kV — treat that as a data gap, not a guess.',
    census_count: uhv.length,
    directory_query: '765 kV',
    next: 'sync-areas',
  },
  {
    id: 'sync-areas',
    title: 'Synchronous areas',
    family: 'Grid systems',
    minutes: 6,
    skill: 'sync-areas',
    summary: 'grids.json records a free-text `sync` label (Continental Europe, GCCIA, Isolated, …). It is not yet a controlled vocabulary — Grid Lab therefore asks you to read the label, not to invent a “synchronous-area total”.',
    prompt: 'Which of these countries is labelled GCCIA in the census?',
    options: pickOptions(gccia, GRIDS.map((g) => g.country), ['United Arab Emirates', 'Saudi Arabia', 'Kuwait', 'Qatar'], ['Brazil', 'Australia', 'Japan', 'Norway']),
    answer_hint: 'GCCIA-labelled countries: ' + gccia.join(', ') + '.',
    census_count: gccia.length,
    next: 'kv-400',
  },
  {
    id: 'kv-400',
    title: '400 kV class grids',
    family: 'Grid systems',
    minutes: 6,
    skill: 'transmission-class',
    summary: '400 kV (and nearby 380 / 400 / 420 kV) is the common extra-high-voltage transmission class outside UHV systems.',
    prompt: 'The census maps ' + STATS.countries + ' national grids. Which of these reaches at least 400 kV but below 765 kV?',
    options: pickOptions(kv400, GRIDS.map((g) => g.country), ['United Kingdom', 'Germany', 'France', 'United Arab Emirates'], ['Maldives', 'Iceland']),
    answer_hint: kv400.length + ' census countries reach 400–764 kV class.',
    census_count: kv400.length,
    next: 'isolated',
  },
  {
    id: 'isolated',
    title: 'Isolated systems',
    family: 'Grid systems',
    minutes: 5,
    skill: 'isolated-grids',
    summary: 'An Isolated sync label means the census does not record a continental synchronous tie — islands, remote systems, or unlinked national grids.',
    prompt: 'Which of these is labelled Isolated in the census?',
    options: pickOptions(isolated, GRIDS.map((g) => g.country), ['Iceland', 'New Zealand', 'Australia', 'Japan'], ['France', 'Germany', 'Belgium']),
    answer_hint: isolated.length + ' census rows carry an Isolated (or similar) sync label.',
    census_count: isolated.length,
    next: 'highest-voltage',
  },
  {
    id: 'highest-voltage',
    title: 'Highest voltage in the census',
    family: 'Grid systems',
    minutes: 4,
    skill: 'highest-voltage',
    summary: 'The highest transmission voltage in this census is derived from operator voltage strings — never invented.',
    prompt: 'What is the highest transmission voltage currently recorded in the grid census, and where?',
    options: highest.kv
      ? [highest.country + ' · ' + highest.kv + ' kV', 'United States · 765 kV only', 'Germany · 400 kV', 'A figure we do not have']
      : ['Not recorded in this census'],
    answer_hint: highest.kv
      ? (highest.flag + ' ' + highest.country + ' records ' + highest.kv + ' kV as the highest operator voltage in this census.')
      : 'No numeric kV could be parsed.',
    census_count: 1,
    next: null,
  },
];

function uniq(v, i, a) { return a.indexOf(v) === i; }

function pickOptions(yes, no, preferYes, preferNo) {
  const y = preferYes.filter((c) => yes.indexOf(c) >= 0);
  const n = preferNo.filter((c) => no.indexOf(c) >= 0 && yes.indexOf(c) < 0);
  const extraY = yes.filter((c) => y.indexOf(c) < 0);
  const extraN = no.filter((c) => n.indexOf(c) < 0 && yes.indexOf(c) < 0);
  const opts = y.concat(extraY).slice(0, 3).concat(n.concat(extraN).slice(0, 3));
  return opts.filter(uniq).slice(0, 6);
}

const out = {
  _comment: 'TransformerPath Grid Lab. Derived from data/grids.json. Not a 3D model. Country Grid Lab is later.',
  generated: new Date().toISOString().slice(0, 10),
  countries: GRIDS.length,
  operators: GRIDS.reduce((s, g) => s + (g.grids || []).length, 0),
  note: 'Country Grid Lab (per-country engineering models) is scheduled later — not the next 3D model.',
  scenarios: scenarios,
};
fs.writeFileSync('data/grid-lab.json', JSON.stringify(out, null, 2) + '\n');
console.log('grid-lab.json: ' + scenarios.length + ' scenarios from ' + GRIDS.length + ' census countries');
