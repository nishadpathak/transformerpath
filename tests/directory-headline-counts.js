#!/usr/bin/env node
/* Headline company and country counts are derived from data/manufacturers.json.
 * site-stats and config.counters match the census. The manufacturers directory
 * hides plant-alias rows, so its SSR block, Showing line and Dataset size
 * match the rendered companies. A hand-typed 906/88 fails this check.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const aliases = require('../lib/company-aliases');
const census = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const makers = census.reduce((s, g) => s + (g.makers || []).filter((m) => !/^Served by/i.test(m[0])).length, 0);
const countries = census.filter((g) => (g.makers || []).some((m) => !/^Served by/i.test(m[0]))).length;
const slugMap = {};
JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (row) {
  if (row && row.name && row.slug) slugMap[row.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = row.slug;
});
const rendered = aliases.visibleMakerCount(census, slugMap);
const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
const html = fs.readFileSync('manufacturers.html', 'utf8');
const statsBlock = html.match(/<!--SSR:mfg-stats-->([\s\S]*?)<!--\/SSR:mfg-stats-->/);
const shown = html.match(/Showing (\d+) companies across (\d+) countries/);
const size = html.match(/"size"\s*:\s*(\d+)/);
const companiesB = statsBlock && statsBlock[1].match(/<b>(\d+)<\/b><small>Companies<\/small>/);
const countriesB = statsBlock && statsBlock[1].match(/<b>(\d+)<\/b><small>Countries<\/small>/);

console.log('=== DIRECTORY HEADLINE COUNTS ===');
console.log('  census ' + makers + ' companies / ' + countries + ' countries');
check('site-stats.manufacturers equals the census', stats.manufacturers === makers, String(stats.manufacturers));
check('site-stats.manufacturingCountries equals the census', stats.manufacturingCountries === countries, String(stats.manufacturingCountries));
check('database headline leads with the census', stats.databaseHeadline.indexOf(makers + ' manufacturers') === 0 && stats.databaseHeadline.indexOf(countries + ' manufacturing countries') > 0, stats.databaseHeadline);
check('config.counters.manufacturers equals the census', cfg.counters.manufacturers === makers, String(cfg.counters.manufacturers));
check('config.counters.manufacturingCountries equals the census', cfg.counters.manufacturingCountries === countries, String(cfg.counters.manufacturingCountries));
check('rendered directory hides the plant-alias rows', rendered === makers - 7, String(rendered));
check('SSR company count equals the rendered directory', !!companiesB && Number(companiesB[1]) === rendered, companiesB && companiesB[1]);
check('SSR country count equals the census', !!countriesB && Number(countriesB[1]) === countries, countriesB && countriesB[1]);
check('Showing line equals the rendered directory', !!shown && Number(shown[1]) === rendered && Number(shown[2]) === countries, shown && shown[0]);
check('Dataset size equals the rendered directory', !!size && Number(size[1]) === rendered, size && size[1]);
check('builder rewrites the directory SSR block from the census', /SSR:mfg-stats/.test(fs.readFileSync('build-site-stats.js', 'utf8')));

['index.html', 'directory.html', 'pricing.html', 'intel.html'].forEach((file) => {
  const page = fs.readFileSync(file, 'utf8');
  const hit = page.match(/data-stat="manufacturers">\s*(\d+)/);
  check(file + ' manufacturer fallback equals the census', !!hit && Number(hit[1]) === makers, hit && hit[1]);
});

if (failed) {
  console.error('DIRECTORY HEADLINE COUNTS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('DIRECTORY HEADLINE COUNTS PASS');
