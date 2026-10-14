#!/usr/bin/env node
/* check-sitemap.js — CI gate for sitemap.xml.
 * Fails when locs repeat, any path is under /transformerpath/, or every
 * lastmod is the same day (the build-clock stamp).
 * Run: node check-sitemap.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, 'sitemap.xml');
const xml = fs.readFileSync(file, 'utf8');
const locs = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
const mods = xml.match(/<lastmod>([^<]+)<\/lastmod>/g) || [];
const locVals = locs.map(function (s) { return s.replace(/<\/?loc>/g, ''); });
const modVals = mods.map(function (s) { return s.replace(/<\/?lastmod>/g, ''); });

const errors = [];
if (!locVals.length) errors.push('sitemap has no <loc>');
if (locVals.length !== modVals.length) errors.push('loc count ' + locVals.length + ' != lastmod count ' + modVals.length);

const seen = {};
const dups = [];
locVals.forEach(function (loc) {
  if (seen[loc]) dups.push(loc);
  seen[loc] = 1;
});
if (dups.length) errors.push(dups.length + ' duplicate locs, first: ' + dups[0]);

const legacy = locVals.filter(function (loc) {
  try { return new URL(loc).pathname.toLowerCase().indexOf('/transformerpath/') !== -1; }
  catch (e) { return loc.indexOf('/transformerpath/') !== -1; }
});
if (legacy.length) errors.push(legacy.length + ' /transformerpath/ locs, first: ' + legacy[0]);

const days = {};
modVals.forEach(function (d) { days[d] = (days[d] || 0) + 1; });
const distinct = Object.keys(days);
if (modVals.length && distinct.length < 2) {
  errors.push('lastmod is identical on every URL (' + (distinct[0] || 'none') + ')');
}
modVals.forEach(function (d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push('lastmod is not YYYY-MM-DD: ' + d);
});

if (errors.length) {
  console.error('SITEMAP CHECK FAILED');
  errors.forEach(function (e) { console.error('  ' + e); });
  process.exit(1);
}
console.log('SITEMAP CHECK OK — ' + locVals.length + ' URLs, ' + distinct.length + ' distinct lastmod dates, 0 duplicates, 0 /transformerpath/ paths');
