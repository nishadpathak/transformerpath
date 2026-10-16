#!/usr/bin/env node
/* check-sitemap.js — CI gate for sitemap.xml.
 * Fails when locs repeat, any path is under /transformerpath/, or every
 * lastmod is the same day (the build-clock stamp).
 * Every sitemap URL must be a self-canonical indexable page. No two
 * sitemap URLs may share a canonical, and a noindex page must not be listed.
 * Run: node check-sitemap.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

function normUrl(value) {
  try {
    const u = new URL(value);
    let p = u.pathname;
    if (p.endsWith('/index.html')) p = p.slice(0, -'index.html'.length);
    return u.origin + p;
  } catch (e) {
    return String(value || '');
  }
}

function fileForLoc(loc, root) {
  const u = new URL(loc);
  const pathname = decodeURIComponent(u.pathname);
  if (pathname === '/') return path.join(root, 'index.html');
  if (pathname.endsWith('/')) return path.join(root, pathname.slice(1), 'index.html');
  return path.join(root, pathname.replace(/^\//, ''));
}

function canonicalHref(html) {
  const relFirst = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (relFirst) return relFirst[1];
  const hrefFirst = html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return hrefFirst ? hrefFirst[1] : '';
}

function pageIsNoindex(html) {
  if (/http-equiv=["']refresh["']/i.test(html)) return true;
  const robots = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
  return !!(robots && /noindex/i.test(robots[0]));
}

/* Returns an array of error strings. root is the directory that holds the HTML. */
function auditCanonicals(locVals, root, readFile) {
  const errors = [];
  const byCanon = {};
  const reader = readFile || function (file) { return fs.readFileSync(file, 'utf8'); };
  locVals.forEach(function (loc) {
    let rel;
    try { rel = fileForLoc(loc, root); }
    catch (e) { errors.push('sitemap loc is not a URL: ' + loc); return; }
    let html = '';
    try { html = reader(rel); }
    catch (e) { errors.push('sitemap URL has no page: ' + loc); return; }
    if (pageIsNoindex(html)) errors.push('noindex page is in the sitemap: ' + loc);
    const canon = canonicalHref(html);
    if (!canon) {
      errors.push('sitemap URL has no canonical: ' + loc);
      return;
    }
    const key = normUrl(canon);
    if (key !== normUrl(loc)) errors.push('sitemap URL is not self-canonical: ' + loc + ' -> ' + canon);
    (byCanon[key] = byCanon[key] || []).push(loc);
  });
  Object.keys(byCanon).forEach(function (key) {
    const rows = byCanon[key];
    if (rows.length > 1) errors.push('canonical shared by ' + rows.length + ' sitemap URLs (' + key + '): ' + rows.slice(0, 3).join(', '));
  });
  return errors;
}

function checkSitemap(xml, root, readFile) {
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

  if (root) errors.push.apply(errors, auditCanonicals(locVals, root, readFile));
  /* A 301 is not a 200. Sitemap locs must be pages Netlify will serve. */
  if (root && !readFile) {
    const { permanentMap } = require('./lib/site-redirects');
    const redirected = permanentMap(root);
    locVals.forEach(function (loc) {
      let pathname = '';
      try { pathname = new URL(loc).pathname; } catch (e) { return; }
      if (redirected.has(pathname)) errors.push('sitemap URL is a 301, not a 200: ' + loc + ' -> ' + redirected.get(pathname));
    });
  }
  /* Netlify serves foo.html at /foo, which hides foo/index.html. A directory
   * URL in the sitemap must not have that sibling file. */
  if (root && !readFile) {
    locVals.forEach(function (loc) {
      let pathname = '';
      try { pathname = new URL(loc).pathname; } catch (e) { return; }
      if (!pathname.endsWith('/') || pathname === '/') return;
      const sibling = path.join(root, pathname.slice(1, -1) + '.html');
      if (fs.existsSync(sibling)) {
        errors.push('directory URL is shadowed by sibling html: ' + loc);
      }
    });
  }
  return { errors: errors, locVals: locVals, distinct: distinct };
}

if (require.main === module) {
  const file = process.argv[2] || path.join(__dirname, 'sitemap.xml');
  const root = path.dirname(path.resolve(file));
  const xml = fs.readFileSync(file, 'utf8');
  const result = checkSitemap(xml, root);
  if (result.errors.length) {
    console.error('SITEMAP CHECK FAILED');
    result.errors.forEach(function (e) { console.error('  ' + e); });
    process.exit(1);
  }
  console.log('SITEMAP CHECK OK — ' + result.locVals.length + ' URLs, ' + result.distinct.length + ' distinct lastmod dates, 0 duplicates, 0 shared canonicals, 0 noindex URLs');
}

module.exports = checkSitemap;
module.exports.auditCanonicals = auditCanonicals;
module.exports.normUrl = normUrl;
module.exports.pageIsNoindex = pageIsNoindex;
