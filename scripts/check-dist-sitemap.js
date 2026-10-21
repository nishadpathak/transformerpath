#!/usr/bin/env node
/* Every sitemap URL must be a file in dist/. Source pages that the publish
 * allowlist skips are production 404s even though check-sitemap.js passes.
 *
 * Run: node scripts/check-dist-sitemap.js [dist]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { fileForLoc } = require('../check-sitemap');
const { decodeXml } = require('../lib/sitemap-split');

const JOBS_PATH = '/commissioning-jobs/';
const JOBS_BUTTON = 'Post a job, $199';
const JOBS_BUY = 'https://buy.stripe.com/4gMeV62lO9xz9g4fdMfYY0U';

function locPath(loc) {
  return new URL(loc).pathname;
}

function rawLocs(xml) {
  return (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map(function (row) {
    return decodeXml(row.replace(/<\/?loc>/g, ''));
  });
}

function pageLocs(xml, distRoot) {
  const locs = rawLocs(xml);
  if (!/<sitemapindex[\s>]/.test(xml)) return locs;
  const pages = [];
  locs.forEach(function (loc) {
    const name = path.posix.basename(new URL(loc).pathname);
    const file = path.join(distRoot, name);
    if (!fs.existsSync(file)) return;
    pages.push.apply(pages, pageLocs(fs.readFileSync(file, 'utf8'), distRoot));
  });
  return pages;
}

function auditDistSitemap(distRoot, opts) {
  opts = opts || {};
  const requireJobs = opts.requireJobs !== false;
  const errors = [];
  const root = path.resolve(distRoot);
  const xmlPath = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(xmlPath)) return ['dist has no sitemap.xml'];
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const locs = pageLocs(xml, root);
  if (!locs.length) errors.push('dist sitemap has no <loc>');
  let jobsListed = false;
  let jobsFile = '';
  locs.forEach(function (loc) {
    let file = '';
    let pathname = '';
    try {
      file = fileForLoc(loc, root);
      pathname = locPath(loc);
    } catch (e) { errors.push('sitemap loc is not a URL: ' + loc); return; }
    if (pathname === JOBS_PATH) jobsListed = true;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      errors.push('sitemap URL missing from dist: ' + loc);
      return;
    }
    if (pathname === JOBS_PATH) jobsFile = file;
  });
  if (requireJobs && !jobsListed) {
    errors.push('sitemap does not publish ' + JOBS_PATH);
  }
  if (jobsFile) {
    const html = fs.readFileSync(jobsFile, 'utf8');
    if (html.indexOf(JOBS_BUTTON) === -1) errors.push('commissioning jobs page is missing the Post a job button');
    if (html.indexOf(JOBS_BUY) === -1) errors.push('commissioning jobs page is missing the $199 Payment Link');
  }
  return errors;
}

if (require.main === module) {
  const dist = path.resolve(process.argv[2] || 'dist');
  const errors = auditDistSitemap(dist);
  if (errors.length) {
    console.error('DIST SITEMAP CHECK FAILED — ' + errors.length);
    errors.slice(0, 40).forEach(function (e) { console.error('  ' + e); });
    if (errors.length > 40) console.error('  … and ' + (errors.length - 40) + ' more');
    process.exit(1);
  }
  const count = pageLocs(fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8'), dist).length;
  console.log('DIST SITEMAP CHECK OK — ' + count + ' URLs are files in dist');
}

module.exports = { auditDistSitemap, JOBS_BUTTON, JOBS_BUY, JOBS_PATH };
