#!/usr/bin/env node
/* The sitemap's manufacturer URLs and the public company count come from
 * one census. Published profiles match. Directories, redirects, aliases
 * and group pages are classified rather than counted as extra companies.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sitemap = require('../lib/manufacturer-sitemap');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const root = path.join(__dirname, '..');
const doc = sitemap.counts(root);
const report = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturer-sitemap.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(root, 'data/site-stats.json'), 'utf8'));
const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const locs = (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map(function (row) {
  return row.replace(/<\/?loc>/g, '');
});
const published = new Set(sitemap.readCensus(root).published);
const seen = { profile: [], directory: [], group: [], other: [] };
locs.forEach(function (loc) {
  if (loc.indexOf('/manufacturers/') === -1) return;
  const rel = sitemap.relFromLoc(loc);
  const kind = sitemap.kindForRel(rel, published) || 'other';
  (seen[kind] || seen.other).push(loc);
});

console.log('=== MANUFACTURER SITEMAP RECONCILIATION ===');
check('public count is published profiles plus noindex companies', doc.publicCount === doc.publishedCompanies + doc.noindexCompanies, doc.publicCount + ' vs ' + (doc.publishedCompanies + doc.noindexCompanies));
check('each published company has its own profile', doc.publishedCompanies === doc.publishedProfiles, doc.publishedCompanies + ' vs ' + doc.publishedProfiles);
check('sitemap profile URLs are the published profiles', seen.profile.length === doc.publishedProfiles, seen.profile.length + ' vs ' + doc.publishedProfiles);
check('sitemap has no group or alias profile', seen.group.length === 0, seen.group.join(', '));
check('sitemap manufacturer URLs are profiles plus directories', seen.profile.length + seen.directory.length === doc.publishedProfiles + doc.directoryUrls, (seen.profile.length + seen.directory.length) + ' vs ' + (doc.publishedProfiles + doc.directoryUrls));
check('every published profile is in the sitemap', doc.profileRels.every(function (rel) {
  return locs.indexOf('https://transformerpath.com' + sitemap.publicPath(rel)) !== -1;
}));
check('group pages are named and omitted', doc.groupPagesOmitted.length > 0 && doc.groupPagesOmitted.every(function (slug) {
  return locs.indexOf('https://transformerpath.com/manufacturers/' + slug + '/') === -1;
}), doc.groupPagesOmitted.join(', '));
check('report matches the census', report.publicCount === doc.publicCount && report.publishedProfiles === doc.publishedProfiles && report.noindexCompanies === doc.noindexCompanies && report.directoryUrls === doc.directoryUrls && report.hiddenAliases === doc.hiddenAliases && report.manufacturerRedirects === doc.manufacturerRedirects);
check('site-stats uses the same figures', stats.manufacturers === doc.publicCount && stats.manufacturerProfiles === doc.publishedProfiles && stats.manufacturerNoindex === doc.noindexCompanies && stats.manufacturerDirectories === doc.directoryUrls && stats.manufacturerRedirects === doc.manufacturerRedirects && stats.manufacturerHiddenAliases === doc.hiddenAliases);
const page = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
check('manufacturers page explains the sitemap gap', page.indexOf('id="sitemap-companies"') >= 0 && page.indexOf('data-stat="manufacturerProfiles">' + doc.publishedProfiles) >= 0 && page.indexOf('same census') >= 0 && page.indexOf('not additional companies') >= 0 && page.indexOf('plant aliases') >= 0);
check('builder keeps the same source', fs.readFileSync(path.join(root, 'build-sitemap.js'), 'utf8').indexOf("kindForRel(r.rel, published) === 'group'") >= 0 && fs.readFileSync(path.join(root, 'build-site-stats.js'), 'utf8').indexOf('manufacturerProfiles:') >= 0);

if (failed) {
  console.error('MANUFACTURER SITEMAP RECONCILIATION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('MANUFACTURER SITEMAP RECONCILIATION OK');
