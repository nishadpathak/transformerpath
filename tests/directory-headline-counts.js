#!/usr/bin/env node
/* Headline company and country counts come from one public company total.
 * That total is the rendered directory: census rows minus hidden plant aliases.
 * Homepage, directory, manufacturers, meta descriptions and JSON-LD use it.
 * A page that also prints the raw census row count fails this check.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const counts = require('../lib/public-company-count').read(process.cwd());
const census = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const makers = counts.censusRows;
const countries = require('../lib/public-company-count').namedCountryCount(census);
const rendered = counts.publicCount;
const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
const html = fs.readFileSync('manufacturers.html', 'utf8');
const statsBlock = html.match(/<!--SSR:mfg-stats-->([\s\S]*?)<!--\/SSR:mfg-stats-->/);
const shown = html.match(/Showing (\d+) companies across (\d+) countries/);
const size = html.match(/"size"\s*:\s*(\d+)/);
const companiesB = statsBlock && statsBlock[1].match(/<b>(\d+)<\/b><small>Companies<\/small>/);
const countriesB = statsBlock && statsBlock[1].match(/<b>(\d+)<\/b><small>Countries<\/small>/);

console.log('=== DIRECTORY HEADLINE COUNTS ===');
console.log('  public ' + rendered + ' companies / census rows ' + makers + ' / ' + countries + ' countries');
check('site-stats.manufacturers equals the public company count', stats.manufacturers === rendered, String(stats.manufacturers));
check('site-stats.manufacturingCountries equals the census', stats.manufacturingCountries === countries, String(stats.manufacturingCountries));
check('database headline leads with the public company count', stats.databaseHeadline.indexOf(rendered + ' manufacturers') === 0 && stats.databaseHeadline.indexOf(countries + ' manufacturing countries') > 0, stats.databaseHeadline);
check('config.counters.manufacturers equals the public company count', cfg.counters.manufacturers === rendered, String(cfg.counters.manufacturers));
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
  check(file + ' manufacturer fallback equals the public company count', !!hit && Number(hit[1]) === rendered, hit && hit[1]);
});

const directory = fs.readFileSync('directory.html', 'utf8');
const kpi = directory.match(/kg-kpi-val"[^>]*>\s*(\d+)<\/div><div class="kg-kpi-lbl">Manufacturers/);
const badge = directory.match(/Manufacturers <span class="badge-cnt">(\d+)/);
check('directory stat and filter tag use the public company count', !!kpi && Number(kpi[1]) === rendered && !!badge && Number(badge[1]) === rendered, (kpi && kpi[1]) + ' / ' + (badge && badge[1]));

function countContexts(html) {
  const found = [];
  const patterns = [
    /data-stat="manufacturers">\s*(\d+)/g,
    /Browse all (\d+) transformer companies/g,
    /directory of (\d+) transformer makers/g,
    /Manufacturer census:\s*(\d+)/g,
    /kg-kpi-val"[^>]*>\s*(\d+)<\/div><div class="kg-kpi-lbl">Manufacturers/g,
    /Manufacturers <span class="badge-cnt">(\d+)/g,
    /Transformer OEMs \((\d+)\)/g
  ];
  patterns.forEach(function (re) {
    let hit;
    while ((hit = re.exec(html))) found.push(Number(hit[1]));
  });
  const metaRe = /<meta\b[^>]*(?:name|property)="(?:description|og:description|twitter:description)"[^>]*>/gi;
  let meta;
  while ((meta = metaRe.exec(html))) {
    const chunk = meta[0];
    if (!/manufacturer|companies|makers/i.test(chunk)) continue;
    const nums = chunk.match(/\b\d+\b/g) || [];
    nums.forEach(function (n) { found.push(Number(n)); });
  }
  const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let ld;
  while ((ld = ldRe.exec(html))) {
    if (!/manufacturer|Dataset/i.test(ld[1])) continue;
    const size = ld[1].match(/"size"\s*:\s*(\d+)/);
    if (size) found.push(Number(size[1]));
  }
  return found;
}

const path = require('path');
const mixed = [];
function walkPages(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'transformerpath' || ent.name === 'vendor') return;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walkPages(abs);
    else if (ent.isFile() && ent.name.endsWith('.html')) {
      const nums = countContexts(fs.readFileSync(abs, 'utf8'));
      if (nums.indexOf(makers) !== -1) mixed.push(path.relative(process.cwd(), abs));
    }
  });
}
walkPages(process.cwd());
check('public pages do not mix the census row count into the company total', mixed.length === 0, mixed.slice(0, 12).join(', '));
['index.html', 'directory.html', 'manufacturers.html', 'intelligence.html', 'vendors.html'].forEach(function (file) {
  const nums = countContexts(fs.readFileSync(file, 'utf8'));
  check(file + ' publishes the public company count', nums.indexOf(rendered) !== -1, nums.join(','));
});

if (failed) {
  console.error('DIRECTORY HEADLINE COUNTS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('DIRECTORY HEADLINE COUNTS PASS');
