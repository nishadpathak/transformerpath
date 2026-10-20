#!/usr/bin/env node
/* Multi-event batch: uncertain matches stay separate, and each event page has its section. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failed++;
}

const badges = JSON.parse(fs.readFileSync(path.join(root, 'data/event-badges.json'), 'utf8'));
const directory = JSON.parse(fs.readFileSync(path.join(root, 'data/event-directory.json'), 'utf8')).sections;
const events = JSON.parse(fs.readFileSync(path.join(root, 'data/events.json'), 'utf8'));
function history(slug) {
  const row = badges.companies.find((company) => company.slug === slug);
  return row ? row.history.map((entry) => entry.event) : [];
}
function has(slug, event) { return history(slug).indexOf(event) >= 0; }

check('Siemens Energy is tagged for Enlit Europe only', history('siemens-energy').join(',') === 'enlit-europe-2026');
check('generic Siemens is its own listing for ADIPEC and CIGRE', has('siemens', 'adipec-2026') && has('siemens', 'gcc-power-2025') && !has('siemens-energy', 'adipec-2026'));
check('Al Fanar was not merged into either Alfanar profile', has('al-fanar', 'wetex-2025') && !has('alfanar-maroc', 'wetex-2025') && !has('alfanar', 'wetex-2025'));
check('HD Hyundai Electric uses the matching profile, not the USA plant', has('hd-hyundai-electric', 'wetex-2025') && !has('hd-hyundai-power-transformers-usa', 'wetex-2025'));
check('Hyosung Heavy Industries was not tagged from a name-only or India row', history('hyosung-heavy-industries').length === 0 && has('hyosung', 'gcc-power-2025') && has('hyosung-t-and-d-india-pvt-ltd', 'elecrama-2025'));
check('Hitachi Energy keeps WETEX and the floor-plan Hitachi stays separate', has('hitachi-energy', 'wetex-2025') && !has('hitachi-energy', 'gcc-power-2025') && has('hitachi', 'gcc-power-2025'));
check('Megger Group keeps the brand rows and not the sister companies', has('megger-group-limited', 'enlit-europe-2026') && has('megger-group-limited', 'gcc-power-2025') && !has('megger-group-limited', 'energetics-2026') && !has('megger-group-limited', 'elecrama-2025'));
check("Tian'an Smart Grid keeps EP Shanghai and the group profile does not", has('ningbo-tianan-smart-grid-technology-co-ltd', 'ep-shanghai-2026') && !has('ningbo-tianan-group-co-ltd', 'ep-shanghai-2026'));

const expected = {
  'ep-shanghai-2026': ['Exhibiting at EP Shanghai 2026', 174],
  'enlit-europe-2026': ['Exhibiting at Enlit Europe 2026', 38],
  'adipec-2026': ['Exhibiting at ADIPEC 2026', 2],
  'energetics-2026': ['Exhibiting at ENERGETICS 2026', 9],
  'elecrama-2025': ['Previous exhibitors (2025)', 100],
  'gcc-power-2025': ['Previous exhibitors (2025)', 13],
  'wetex-2025': ['Previous exhibitors (2025)', 40],
  'vietnam-energy-week-2025': ['Previous edition', 2]
};
Object.keys(expected).forEach((id) => {
  const block = directory[id];
  const event = events.find((row) => row.id === id);
  check(id + ' section has ' + expected[id][1] + ' rows', block && block.section === expected[id][0] && block.entries.length === expected[id][1], block && String(block.entries.length));
  check(id + ' edition is confirmed from an official source', event && event.date_status === 'CONFIRMED' && /^https:\/\//.test(event.source_url) && event.source_checked_at === '2026-10-20');
});
check('shipped batch files do not publish do_not_contact', !/do_not_contact/i.test(JSON.stringify(directory) + JSON.stringify(badges)));

const adipec = fs.readFileSync(path.join(root, 'events/adipec-2026/index.html'), 'utf8');
const elecrama = fs.readFileSync(path.join(root, 'events/elecrama-2025/index.html'), 'utf8');
const vietnam = fs.readFileSync(path.join(root, 'events/vietnam-energy-week-2025/index.html'), 'utf8');
check('ADIPEC page lists the exhibiting section', adipec.indexOf('Exhibiting at ADIPEC 2026') >= 0 && adipec.indexOf('/manufacturers/siemens/') >= 0 && adipec.indexOf('siemens-energy') < 0);
check('ELECRAMA page lists previous exhibitors', elecrama.indexOf('Previous exhibitors (2025)') >= 0);
check('Vietnam Energy Week uses Previous edition', vietnam.indexOf('Previous edition') >= 0 && vietnam.indexOf('Previous exhibitors (2025)') < 0);

if (failed) {
  console.error('EVENT BATCH FAILED (' + failed + ')');
  process.exit(1);
}
console.log('EVENT BATCH OK');
