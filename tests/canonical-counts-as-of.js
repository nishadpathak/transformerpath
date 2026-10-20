#!/usr/bin/env node
/* Homepage, directory, tenders and awards publish the same derived counts,
 * and each page shows when those counts were last built.
 */
'use strict';
const fs = require('fs');
const asOf = require('../lib/data-as-of');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders || [];
const awards = JSON.parse(fs.readFileSync('data/awards.json', 'utf8')).awards || [];
const directory = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8'));

function countStatus(list, statuses) {
  return list.filter(function (row) { return statuses.indexOf(row.status) >= 0; }).length;
}

const expected = {
  tenders: tenders.length,
  openTenders: countStatus(tenders, ['OPEN', 'CLOSING_SOON']),
  preAward: countStatus(tenders, ['EXPECTED', 'OPEN', 'CLOSING_SOON', 'EVALUATION']),
  tendersPreAward: countStatus(tenders, ['EVALUATION', 'EXPECTED', 'UNDATED']),
  tendersAwarded: countStatus(tenders, ['AWARDED']),
  tendersCountries: new Set(tenders.map(function (row) { return row.country; }).filter(Boolean)).size,
  awards: awards.length,
  awardsConfirmed: awards.filter(function (row) { return row.transformer_scope === 'CONFIRMED'; }).length,
  awardsCountries: new Set(awards.map(function (row) { return row.country; }).filter(Boolean)).size,
  awardsRegions: Object.keys(awards.reduce(function (map, row) { map[row.region] = 1; return map; }, {})).length,
  indexedEntities: (directory.companies || []).length
};

console.log('=== CANONICAL COUNTS AND DATA AS OF ===');
Object.keys(expected).forEach(function (key) {
  check('site-stats.' + key + ' is derived from the dataset', stats[key] === expected[key], stats[key] + ' vs ' + expected[key]);
});
check('tenders page Pre-award is not the homepage pipeline total', stats.tendersPreAward !== stats.preAward, String(stats.tendersPreAward) + ' / ' + stats.preAward);

const date = asOf.asOfDate(stats.updated);
check('site-stats.updated is a calendar date', date !== '—', String(stats.updated));
check('invalid updated renders an em dash', asOf.asOfDate('soon') === '—' && asOf.html('').indexOf('>—</time>') >= 0);
check('valid updated is printed as data as of', asOf.html('2026-10-20').indexOf('data as of ') >= 0 && asOf.html('2026-10-20').indexOf('datetime="2026-10-20"') >= 0);

function pageStat(html, key) {
  const match = html.match(new RegExp('data-stat="' + key + '">\\s*([\\d,]+|—)'));
  if (!match) return null;
  if (match[1] === '—') return '—';
  return Number(String(match[1]).replace(/,/g, ''));
}

const pages = {
  'index.html': ['manufacturers', 'tenders', 'openTenders', 'awards', 'awardsConfirmed'],
  'directory.html': ['manufacturers', 'factories', 'capabilities', 'manufacturingCountries', 'indexedEntities'],
  'tenders.html': ['tenders', 'openTenders', 'tendersPreAward', 'tendersAwarded', 'tendersCountries'],
  'awards.html': ['awards', 'awardsCountries', 'awardsRegions', 'awardsConfirmed']
};

Object.keys(pages).forEach(function (file) {
  const html = fs.readFileSync(file, 'utf8');
  check(file + ' shows data as of', html.indexOf('data as of ') >= 0);
  check(file + ' dates the line from site-stats.updated', html.indexOf('data-stat="updated"' + (date === '—' ? '' : ' datetime="' + date + '"') + '>' + date + '</time>') >= 0, date);
  check(file + ' loads the canonical counter script', html.indexOf('site-stats.js') >= 0);
  pages[file].forEach(function (key) {
    check(file + ' ' + key + ' fallback matches site-stats', pageStat(html, key) === stats[key], pageStat(html, key) + ' vs ' + stats[key]);
  });
});

const home = fs.readFileSync('index.html', 'utf8');
if (stats.manufacturers !== 906) {
  check('homepage manufacturer fallback is not the stale 906', !/data-stat="manufacturers">\s*906\b/.test(home));
}
const builder = fs.readFileSync('build-site-stats.js', 'utf8');
check('builder publishes the tenders page Pre-award field', /tendersPreAward:/.test(builder) && /EVALUATION/.test(builder) && /UNDATED/.test(builder));
check('builder stamps tenders and awards pages', /tenders\.html/.test(builder) && /awards\.html/.test(builder));
const tendersBuilder = fs.readFileSync('build-tenders.js', 'utf8');
const awardsBuilder = fs.readFileSync('build-awards.js', 'utf8');
check('tender page generator binds the canonical tiles', /data-stat="tendersPreAward"/.test(tendersBuilder) && /dataAsOf\.html\(/.test(tendersBuilder));
check('award page generator binds the canonical tiles', /data-stat="awardsConfirmed"/.test(awardsBuilder) && /data-stat="awardsCountries"/.test(awardsBuilder) && /dataAsOf\.html\(/.test(awardsBuilder));

if (failed) {
  console.error('CANONICAL COUNTS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('CANONICAL COUNTS PASS');
