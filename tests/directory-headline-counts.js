#!/usr/bin/env node
/* Headline company and country counts come from one public company total.
 * That total is the rendered directory: census rows minus hidden plant aliases.
 * Homepage, directory, manufacturers, meta descriptions and JSON-LD use it.
 * A page that also prints the raw census row count fails this check.
 */
'use strict';
const fs = require('fs');
const { publicCountLabel } = require('../lib/public-count-label');

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
const shown = html.match(/Showing ([^<]*?) companies across (\d+) countries/);
const size = html.match(/"size"\s*:\s*(\d+)/);
const companiesB = statsBlock && statsBlock[1].match(/<b>([^<]+)<\/b><small>Companies<\/small>/);
const countriesB = statsBlock && statsBlock[1].match(/<b>(\d+)<\/b><small>Countries<\/small>/);
const makerLabel = publicCountLabel(rendered);

console.log('=== DIRECTORY HEADLINE COUNTS ===');
console.log('  public ' + rendered + ' companies / census rows ' + makers + ' / ' + countries + ' countries');
check('site-stats.manufacturers equals the public company count', stats.manufacturers === rendered, String(stats.manufacturers));
check('site-stats.manufacturingCountries equals the census', stats.manufacturingCountries === countries, String(stats.manufacturingCountries));
check('database headline leads with the public company count', stats.databaseHeadline.indexOf(rendered + ' manufacturers') === 0 && stats.databaseHeadline.indexOf(countries + ' manufacturing countries') > 0, stats.databaseHeadline);
check('config.counters.manufacturers equals the public company count', cfg.counters.manufacturers === rendered, String(cfg.counters.manufacturers));
check('config.counters.manufacturingCountries equals the census', cfg.counters.manufacturingCountries === countries, String(cfg.counters.manufacturingCountries));
check('rendered directory hides the plant-alias rows', rendered === makers - 7, String(rendered));
check('SSR company headline uses the public label', !!companiesB && companiesB[1] === makerLabel, companiesB && companiesB[1]);
check('SSR country count equals the census', !!countriesB && Number(countriesB[1]) === countries, countriesB && countriesB[1]);
check('Showing line uses the public label', !!shown && shown[1] === makerLabel && Number(shown[2]) === countries, shown && shown[0]);
check('Dataset size equals the rendered directory', !!size && Number(size[1]) === rendered, size && size[1]);
check('builder rewrites the directory SSR block from the census', /SSR:mfg-stats/.test(fs.readFileSync('build-site-stats.js', 'utf8')));

['index.html', 'directory.html', 'pricing.html', 'intel.html'].forEach((file) => {
  const page = fs.readFileSync(file, 'utf8');
  check(file + ' manufacturer headline is the public label', page.indexOf('data-stat="manufacturersPublicLabel">' + makerLabel) >= 0, makerLabel);
  check(file + ' does not publish the raw manufacturer count', !new RegExp('data-stat="manufacturers">\\s*' + rendered + '\\b').test(page));
});

const directory = fs.readFileSync('directory.html', 'utf8');
const kpi = directory.match(/kg-kpi-val"[^>]*>\s*([^<]+)<\/div><div class="kg-kpi-lbl">Manufacturers/);
const badge = directory.match(/Manufacturers <span class="badge-cnt">([^<]+)/);
check('directory stat and filter tag use the public label', !!kpi && kpi[1] === makerLabel && !!badge && badge[1] === makerLabel, (kpi && kpi[1]) + ' / ' + (badge && badge[1]));

function headlineCounts(html) {
  const found = [];
  const patterns = [
    /data-stat="manufacturers">\s*(\d+)/g,
    /Browse all (\d[\d,]*) transformer companies/g,
    /directory of (\d[\d,]*) transformer makers/g,
    /Manufacturer census:\s*(\d[\d,]*)/g,
    /kg-kpi-val"[^>]*data-stat="manufacturers">\s*(\d+)/g,
    /Manufacturers <span class="badge-cnt">(\d+)/g,
    /Transformer OEMs \((\d[\d,]*)\)/g,
    /Showing (\d[\d,]*) companies across/g,
    /<b>(\d+)<\/b><small>Companies<\/small>/g
  ];
  patterns.forEach(function (re) {
    let hit;
    while ((hit = re.exec(html))) found.push(Number(String(hit[1]).replace(/,/g, '')));
  });
  return found;
}

function countContexts(html) {
  const found = headlineCounts(html);
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
['index.html', 'directory.html', 'manufacturers.html', 'intelligence.html', 'vendors.html', 'pricing.html', 'intel.html'].forEach(function (file) {
  const page = fs.readFileSync(file, 'utf8');
  check(file + ' publishes the public manufacturer label', page.indexOf(makerLabel) >= 0, makerLabel);
  check(file + ' does not publish the raw manufacturer total in a headline', headlineCounts(page).indexOf(rendered) === -1, headlineCounts(page).join(','));
});

if (failed) {
  console.error('DIRECTORY HEADLINE COUNTS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('DIRECTORY HEADLINE COUNTS PASS');
