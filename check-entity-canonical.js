#!/usr/bin/env node
/* check-entity-canonical.js — one preferred canonical profile per company.
 *
 * Guards the CG Power class of bug: two independently public manufacturer
 * profiles for the same operating company (/cg-power/ vs
 * /cg-power-and-industrial-solutions/). Alias short-slugs may exist only as
 * redirect stubs (meta refresh + noindex). Full competing profiles fail CI.
 *
 * Also sweeps the published company-slug set for pairs that collapse via
 * lib/company-aliases.js onto the same canonical slug.
 *
 * Run: node check-entity-canonical.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ALIASES, slugify, resolveCompanyAlias, norm } = require('./lib/company-aliases');

let failed = 0;
function fail(msg) {
  console.error('ENTITY CANONICAL FAIL — ' + msg);
  failed++;
}

const slugs = JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8'));
const bySlug = {};
slugs.forEach(function (r) {
  if (!r || !r.slug) return;
  bySlug[r.slug] = r;
});

// 1) Every alias source slug must not be a competing full profile.
const aliasPairs = {};
Object.keys(ALIASES).forEach(function (k) {
  const a = ALIASES[k];
  const src = slugify(k);
  if (src && src !== a.slug) aliasPairs[src] = a.slug;
});
[
  ['cg-power', 'cg-power-and-industrial-solutions'],
  ['prolec-ge-ge-vernova', 'prolec-ge'],
  ['prolec-ge-brasil', 'prolec-ge'],
  ['prolec-ge-waukesha', 'prolec-ge'],
  ['hico-america-hyosung', 'hyosung-heavy-industries']
].forEach(function (p) { aliasPairs[p[0]] = p[1]; });

Object.keys(aliasPairs).forEach(function (src) {
  const dest = aliasPairs[src];
  const page = path.join('manufacturers', src, 'index.html');
  if (!fs.existsSync(page)) return; // redirect may be generated at build; ok if absent when never published
  const html = fs.readFileSync(page, 'utf8');
  const isRedirect = /http-equiv=["']refresh["']/i.test(html) &&
    new RegExp('/manufacturers/' + dest + '/', 'i').test(html);
  const looksFull = /Highest sourced voltage evidence|Directory Completeness Score|Claim this profile/i.test(html);
  if (looksFull && !isRedirect) {
    fail(src + ' is a full public profile; must redirect to ' + dest);
  } else if (!isRedirect && fs.existsSync(path.join('manufacturers', dest, 'index.html'))) {
    fail(src + ' exists beside canonical ' + dest + ' without meta-refresh redirect');
  }
  // company-slugs must not list the alias short-name as a separate indexable OEM
  const listed = bySlug[src];
  if (listed && listed.indexable) {
    fail(src + ' is still indexable in company-slugs.json — collapse onto ' + dest);
  }
});

// 2) Sweep: any two published slugs that alias-resolve to the same canonical
const groups = {};
slugs.forEach(function (r) {
  if (!r || !r.name) return;
  const a = resolveCompanyAlias(r.name);
  const key = a.aliased ? a.slug : (r.slug || slugify(r.name));
  if (!groups[key]) groups[key] = [];
  groups[key].push(r);
});
const collisions = [];
Object.keys(groups).forEach(function (k) {
  const g = groups[k];
  const uniq = {};
  g.forEach(function (r) { uniq[r.slug] = r; });
  const keys = Object.keys(uniq);
  if (keys.length > 1) {
    // Allow exactly one canonical + redirect stubs not in company-slugs
    collisions.push({ canonical: k, slugs: keys, names: keys.map(function (s) { return uniq[s].name; }) });
  }
});
if (collisions.length) {
  collisions.forEach(function (c) {
    fail('alias collision on ' + c.canonical + ': ' + c.slugs.join(', ') + ' (' + c.names.join(' | ') + ')');
  });
}

// 3) Website-host heuristic across the 906 — same official host, different
//    indexable slugs, neither aliased together → review list (warn, not fail
//    unless both claim distinct completeness cards on disk as full profiles).
let hostDupWarn = 0;
try {
  const dir = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8'));
  const companies = dir.companies || dir.records || (Array.isArray(dir) ? dir : []);
  const byHost = {};
  companies.forEach(function (c) {
    const url = c.website || c.url || c.site || '';
    if (!url) return;
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return; }
    if (!host || host.length < 5) return;
    if (!byHost[host]) byHost[host] = [];
    byHost[host].push(c);
  });
  Object.keys(byHost).forEach(function (h) {
    const rows = byHost[h];
    if (rows.length < 2) return;
    const slugSet = {};
    rows.forEach(function (c) {
      const slug = c.slug || slugify(c.name);
      const a = resolveCompanyAlias(c.name || '');
      slugSet[a.aliased ? a.slug : slug] = true;
    });
    // Already collapsed via alias → ok
    if (Object.keys(slugSet).length <= 1) return;
    // Distinct canonicals sharing a host — often parents/subsidiaries; warn only
    hostDupWarn++;
  });
} catch (e) {
  console.warn('host sweep skipped:', e.message);
}

// 4) HTML must not link at a meta-refresh alias stub, or at a manufacturer
// slug that is neither in company-slugs.json nor a real non-company hub
// (category landings such as /manufacturers/distribution-transformers/).
const slugSet = {};
slugs.forEach(function (r) { if (r && r.slug) slugSet[r.slug] = true; });
const aliasStub = {};
Object.keys(aliasPairs).forEach(function (src) { aliasStub[src] = aliasPairs[src]; });

const pageCache = {};
function pageHtml(slug) {
  if (Object.prototype.hasOwnProperty.call(pageCache, slug)) return pageCache[slug];
  const page = path.join('manufacturers', slug, 'index.html');
  pageCache[slug] = fs.existsSync(page) ? fs.readFileSync(page, 'utf8') : '';
  return pageCache[slug];
}
function isRefreshStub(slug) {
  const html = pageHtml(slug);
  return !!html && /http-equiv=["']refresh["']/i.test(html);
}
function isCategoryHub(slug) {
  const html = pageHtml(slug);
  if (!html) return false;
  if (/http-equiv=["']refresh["']/i.test(html)) return false;
  if (/Highest sourced voltage evidence|Claim this profile/i.test(html)) return false;
  return true;
}

const roots = [];
if (process.argv.indexOf('--dist') >= 0) {
  if (!fs.existsSync('dist')) {
    console.error('ENTITY CANONICAL: --dist set but dist/ is missing');
    process.exit(1);
  }
  roots.push('dist');
} else {
  roots.push('.');
}

const SKIP = new Set(['.git', 'node_modules', 'dist', 'vendor', 'transformerpath', 'data']);
const hrefRe = /href=(["'])([^"']*\/manufacturers\/([a-z0-9-]+)\/)/gi;
let hrefChecked = 0;
function walkHref(dir, inDist) {
  let names;
  try { names = fs.readdirSync(dir); } catch (e) { return; }
  for (const name of names) {
    if (!inDist && SKIP.has(name)) continue;
    const p = path.join(dir, name);
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) walkHref(p, inDist);
    else if (name.endsWith('.html')) {
      const text = fs.readFileSync(p, 'utf8');
      let m;
      hrefRe.lastIndex = 0;
      while ((m = hrefRe.exec(text))) {
        const slug = m[3];
        hrefChecked++;
        if (aliasStub[slug] || isRefreshStub(slug)) {
          fail(path.relative('.', p) + ' links to alias stub /manufacturers/' + slug + '/');
          continue;
        }
        if (!slugSet[slug] && !isCategoryHub(slug)) {
          fail(path.relative('.', p) + ' links to /manufacturers/' + slug + '/ which is not in company-slugs.json');
        }
      }
    }
  }
}
roots.forEach(function (r) { walkHref(r, r === 'dist'); });

if (failed) {
  console.error('ENTITY CANONICAL: ' + failed + ' failure(s)');
  process.exit(1);
}
console.log('ENTITY CANONICAL OK — alias redirects clean; no competing canonical collisions across ' + slugs.length + ' company-slugs; ' + hrefChecked + ' manufacturer hrefs checked' + (hostDupWarn ? ' (host-share review notes: ' + hostDupWarn + ')' : ''));
