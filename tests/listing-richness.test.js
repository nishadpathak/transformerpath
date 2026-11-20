#!/usr/bin/env node
/* Directory listings stay reachable. Thin or unclaimed ones are noindex and
 * out of the sitemap. Rich listings — sourced data, multiple fields — stay
 * index,follow. The keep set is about 100–300 profile URLs.
 * Criteria live in lib/listing-richness.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const rich = require('../lib/listing-richness');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const root = path.join(__dirname, '..');
function robots(rel) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const m = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
  return m ? m[0] : '';
}
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

const slugs = JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'));
const indexableMfr = slugs.filter(function (r) { return r.indexable; });
check('manufacturer keep set is inside 100–300', indexableMfr.length >= 100 && indexableMfr.length <= 300, String(indexableMfr.length));

const acme = slugs.find(function (r) { return r.slug === 'acme-electric-hubbell'; });
const siemens = slugs.find(function (r) { return r.slug === 'siemens-energy'; });
check('a one-product-class census row is not indexable', acme && acme.indexable === false);
check('Siemens Energy stays indexable', siemens && siemens.indexable === true);
check('thin manufacturer page still exists', exists('manufacturers/acme-electric-hubbell/index.html'));
check('thin manufacturer page is noindex', /noindex/.test(robots('manufacturers/acme-electric-hubbell/index.html')));
check('rich manufacturer page is index,follow', /content="index,follow"/.test(robots('manufacturers/siemens-energy/index.html')));

const accessories = JSON.parse(fs.readFileSync(path.join(root, 'data/accessories.json'), 'utf8')).suppliers;
const unclaimed = accessories.find(function (s) { return /unclaimed/i.test(s.verification_status || '') && s.name === '3M'; })
  || accessories.find(function (s) { return /unclaimed/i.test(s.verification_status || ''); });
check('an unclaimed accessory fails the richness bar', unclaimed && rich.accessoryIndexable(unclaimed) === false, unclaimed && unclaimed.name);
check('unclaimed accessory page still exists', exists('accessories/3m/index.html'));
check('unclaimed accessory page is noindex', /noindex/.test(robots('accessories/3m/index.html')));

const publish = JSON.parse(fs.readFileSync(path.join(root, 'data/directory-publish.json'), 'utf8'));
const approvedAcc = new Set(publish.accessories || []);
const richAcc = accessories.filter(rich.accessoryIndexable);
const sourcedAcc = richAcc.filter(function (row) { return !approvedAcc.has(row.slug); });
check('some accessory records clear the sourced-field bar', sourcedAcc.length > 0 && sourcedAcc.length < 80, String(sourcedAcc.length));
check('approved free accessory listings are indexable', (publish.accessories || []).every(function (slug) {
  const row = accessories.find(function (item) { return item.slug === slug; });
  return row && filledWebsite(row) && rich.accessoryIndexable(row);
}), String((publish.accessories || []).length));
check('approved manufacturers are indexable from the publish list', (publish.manufacturers || []).every(function (slug) {
  return rich.manufacturerIndexable({ slug: slug, url: 'https://example.com' });
}));
function filledWebsite(row) { return row && row.website && row.website !== '—'; }

check('service stub is not indexable', rich.stubProfileIndexable() === false);
check('service stub page still exists', exists('services/utb-transformers/index.html'));
check('service stub page is noindex', /noindex/.test(robots('services/utb-transformers/index.html')));
check('laboratory stub page still exists', exists('laboratories/zera-india-private-limited/index.html'));
check('laboratory stub page is noindex', /noindex/.test(robots('laboratories/zera-india-private-limited/index.html')));
check('service hub stays indexable', /content="index,follow"/.test(robots('services.html')));
check('laboratory hub stays indexable', /content="index,follow"/.test(robots('laboratories.html')));

function profileRobots(dir) {
  let index = 0;
  let noindex = 0;
  fs.readdirSync(path.join(root, dir)).forEach(function (name) {
    const file = path.join(root, dir, name, 'index.html');
    if (!fs.existsSync(file)) return;
    const tag = robots(path.join(dir, name, 'index.html'));
    if (/noindex/.test(tag)) noindex++;
    else if (/index,follow/.test(tag)) index++;
  });
  return { index: index, noindex: noindex };
}
const acc = profileRobots('accessories');
const svc = profileRobots('services');
const lab = profileRobots('laboratories');
const kept = indexableMfr.length + acc.index + svc.index + lab.index;
check('indexed directory profiles are about 100–300', kept >= 100 && kept <= 300, String(kept) + ' (mfr ' + indexableMfr.length + ', accessories ' + acc.index + ', services ' + svc.index + ', labs ' + lab.index + ')');
const approvedServices = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data/services.json'), 'utf8')).services.filter(function (row) {
  return row && row.directory_publish === true;
}).map(function (row) { return String(row.id || '').replace(/^srv:/, ''); }));
let serviceIndexErrors = [];
fs.readdirSync(path.join(root, 'services')).forEach(function (name) {
  const file = path.join(root, 'services', name, 'index.html');
  if (!fs.existsSync(file)) return;
  const tag = robots(path.join('services', name, 'index.html'));
  if (approvedServices.has(name)) {
    if (!/index,follow/.test(tag)) serviceIndexErrors.push(name + ' should be indexable');
  } else if (!/noindex/.test(tag)) {
    serviceIndexErrors.push(name + ' should stay noindex');
  }
});
check('approved service listings are indexable and other service profiles stay noindex', serviceIndexErrors.length === 0, serviceIndexErrors.slice(0, 8).join(', '));
const approvedLabs = new Set(JSON.parse(fs.readFileSync(path.join(root, 'data/laboratories.json'), 'utf8')).laboratories.filter(function (row) {
  return row && row.directory_publish === true;
}).map(function (row) { return String(row.id || '').replace(/^lab:/, ''); }));
let labIndexErrors = [];
fs.readdirSync(path.join(root, 'laboratories')).forEach(function (name) {
  const file = path.join(root, 'laboratories', name, 'index.html');
  if (!fs.existsSync(file)) return;
  const tag = robots(path.join('laboratories', name, 'index.html'));
  if (approvedLabs.has(name)) {
    if (!/index,follow/.test(tag)) labIndexErrors.push(name + ' should be indexable');
  } else if (!/noindex/.test(tag)) {
    labIndexErrors.push(name + ' should stay noindex');
  }
});
check('approved laboratory listings are indexable and other laboratory profiles stay noindex', labIndexErrors.length === 0, labIndexErrors.slice(0, 8).join(', '));

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
check('thin manufacturer is out of the sitemap', sitemap.indexOf('/manufacturers/acme-electric-hubbell/') === -1);
check('rich manufacturer stays in the sitemap', sitemap.indexOf('/manufacturers/siemens-energy/') !== -1);
check('unclaimed accessory is out of the sitemap', sitemap.indexOf('/accessories/3m/') === -1);
check('unclaimed service is out of the sitemap', sitemap.indexOf('/services/utb-transformers/') === -1);
check('directory hub stays in the sitemap', sitemap.indexOf('https://transformerpath.com/manufacturers.html') !== -1);

if (failed) {
  console.error('LISTING RICHNESS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('LISTING RICHNESS OK');
