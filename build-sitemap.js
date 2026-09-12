#!/usr/bin/env node
/* build-sitemap.js — sitemap from published HTML on disk.
 * Skips noindex, refresh stubs, iCloud conflict copies, and admin/_partials.
 * lastmod is the file mtime (UTC date), not a synthetic stamp.
 * Run: node build-sitemap.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SKIP_DIR = new Set(['.git', 'node_modules', '.cursor', 'admin', '_partials', 'functions', 'dist']);
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

function lastmod(filePath) {
  try {
    return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
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
      out.push({ loc: toUrl(path.relative(ROOT, p)), lastmod: lastmod(p) });
    }
  }
}

function writeSitemap() {
  const rows = [];
  walk(ROOT, rows);
  const seen = new Set();
  const unique = [];
  rows.sort(function (a, b) { return a.loc.localeCompare(b.loc); }).forEach(function (r) {
    if (seen.has(r.loc)) return;
    seen.add(r.loc);
    unique.push(r);
  });
  const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    unique.map(function (r) {
      return '  <url><loc>' + r.loc + '</loc><lastmod>' + r.lastmod + '</lastmod></url>';
    }).join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm);
  console.log('sitemap.xml wrote', unique.length, 'URLs');
  return unique.length;
}

if (require.main === module) writeSitemap();
module.exports = writeSitemap;
