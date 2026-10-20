#!/usr/bin/env node
/* build-sitemap.js — sitemap from published HTML on disk.
 * Skips noindex, refresh stubs, iCloud conflict copies, admin/_partials,
 * and the legacy /transformerpath/ copy (those URLs 301 or noindex).
 * lastmod is the content date from lib/sitemap-dates.js. Never the build clock.
 * Run: node build-sitemap.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const dates = require('./lib/sitemap-dates');
const { permanentMap } = require('./lib/site-redirects');
const manufacturerSitemap = require('./lib/manufacturer-sitemap');

const ROOT = __dirname;
const SKIP_DIR = new Set([
  '.git', 'node_modules', '.cursor', 'admin', '_partials', 'functions', 'dist',
  'transformerpath', 'transformerpath-site', 'archive', '_private', '_docs', 'tests'
]);
const SKIP_FILE = new Set(['404.html', 'offline.html', 'admin.html']);
const ICLOUD = / \d+\.[^/]+$/;

function shouldSkipFile(name) {
  if (!name.endsWith('.html')) return true;
  if (name.charAt(0) === '_' || name.charAt(0) === '.') return true;
  if (SKIP_FILE.has(name)) return true;
  if (ICLOUD.test(name)) return true;
  return false;
}

function isIndexable(filePath) {
  let html = '';
  try { html = fs.readFileSync(filePath, 'utf8'); } catch (e) { return false; }
  if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) return false;
  if (/http-equiv=["']refresh["']/i.test(html)) return false;
  return true;
}

function toUrl(rel) {
  const posix = rel.split(path.sep).join('/');
  if (posix === 'index.html') return 'https://transformerpath.com/';
  if (posix.endsWith('/index.html')) {
    return 'https://transformerpath.com/' + posix.slice(0, -'index.html'.length);
  }
  return 'https://transformerpath.com/' + posix;
}

function walk(dir, out) {
  let names;
  try { names = fs.readdirSync(dir); } catch (e) { return; }
  for (const name of names) {
    if (SKIP_DIR.has(name)) continue;
    const p = path.join(dir, name);
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && !shouldSkipFile(name) && isIndexable(p)) {
      out.push({ rel: path.relative(ROOT, p).split(path.sep).join('/'), loc: toUrl(path.relative(ROOT, p)) });
    }
  }
}

function publicPath(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel;
}

function rowDecision(rel, lastmod) {
  if (lastmod) return 'include';
  if (String(rel || '').indexOf('tenders/') === 0) return 'omit';
  return 'missing';
}

function writeSitemap() {
  const dated = dates.load();
  const redirected = permanentMap(ROOT);
  const census = manufacturerSitemap.readCensus(ROOT);
  const published = new Set(census.published);
  const rows = [];
  walk(ROOT, rows);
  const seen = new Set();
  const unique = [];
  const missing = [];
  const omitted = [];
  let redirectSkips = 0;
  let groupSkips = 0;
  rows.sort(function (a, b) { return a.loc.localeCompare(b.loc); }).forEach(function (r) {
    if (seen.has(r.loc)) return;
    if (r.loc.indexOf('/transformerpath/') !== -1) return;
    seen.add(r.loc);
    if (redirected.has(publicPath(r.rel))) {
      redirectSkips++;
      return;
    }
    if (manufacturerSitemap.kindForRel(r.rel, published) === 'group') {
      groupSkips++;
      return;
    }
    const lastmod = dates.dateFor(r.rel, dated, dated.pages);
    const decision = rowDecision(r.rel, lastmod);
    if (decision === 'omit') {
      omitted.push(r.rel);
      return;
    }
    if (decision === 'missing') {
      missing.push(r.rel);
      return;
    }
    unique.push({ rel: r.rel, loc: r.loc, lastmod: lastmod });
  });
  if (omitted.length) {
    console.log('sitemap omitted ' + omitted.length + ' undated tender pages:');
    omitted.forEach(function (m) { console.log('  ' + m); });
  }
  if (missing.length) {
    console.error('sitemap lastmod missing for ' + missing.length + ' pages (no source date, no cache):');
    missing.slice(0, 30).forEach(function (m) { console.error('  ' + m); });
    process.exit(1);
  }
  if (!dated.fromCache) {
    const cachePath = path.join(ROOT, 'data', 'sitemap-content-dates.json');
    const doc = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const pages = {};
    unique.forEach(function (r) { pages[r.rel] = r.lastmod; });
    doc.pages = pages;
    fs.writeFileSync(cachePath, JSON.stringify(doc, null, 2) + '\n');
  }
  const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    unique.map(function (r) {
      return '  <url><loc>' + r.loc + '</loc><lastmod>' + r.lastmod + '</lastmod></url>';
    }).join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm);
  const distinct = {};
  unique.forEach(function (r) { distinct[r.lastmod] = 1; });
  if (redirectSkips) console.log('sitemap skipped ' + redirectSkips + ' URLs that 301');
  if (groupSkips) console.log('sitemap skipped ' + groupSkips + ' group or alias profiles that are not census companies');
  manufacturerSitemap.writeReport(ROOT);
  console.log('sitemap.xml wrote ' + unique.length + ' URLs, ' + Object.keys(distinct).length + ' distinct lastmod dates');
  return unique.length;
}

if (require.main === module) writeSitemap();
module.exports = writeSitemap;
module.exports.rowDecision = rowDecision;
