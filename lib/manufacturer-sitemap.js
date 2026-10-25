/* Public company count and sitemap manufacturer URLs share one census.
 *
 * A sitemap company profile is a visible census company with an indexable
 * profile. Indexable means a public website and multiple sourced fields
 * (lib/listing-richness.js). Thin listings and companies with no public
 * website stay in the count and out of the sitemap. The pages stay reachable.
 * Country and product directories are not additional companies.
 * Redirects and plant aliases are omitted. A profile page that is not a
 * census company is a group or alias page and is left out of the sitemap.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const aliases = require('./company-aliases');
const publicCompanies = require('./public-company-count');
const { permanentMap } = require('./site-redirects');

const DIRECTORY_HUBS = new Set([
  'distribution-transformers',
  'dry-type-transformers',
  'power-transformers',
  'sourced',
  'specs'
]);

function readCensus(root) {
  root = root || path.join(__dirname, '..');
  const info = publicCompanies.read(root);
  const countries = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
  const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'));
  const slugMap = info.slugMap;
  const owned = aliases.ownedProfileSlugs(countries, slugMap);
  const bySlug = {};
  rows.forEach(function (row) {
    if (row && row.slug) bySlug[row.slug] = row;
  });
  const published = [];
  const noindex = [];
  const hidden = [];
  countries.forEach(function (group) {
    (group.makers || []).forEach(function (maker) {
      if (!maker || /^Served by/i.test(maker[0])) return;
      const name = maker[0];
      if (aliases.aliasRowHidden(name, slugMap, owned)) {
        hidden.push({ name: name, slug: aliases.directoryCompanySlug(name, slugMap) });
        return;
      }
      const slug = aliases.directProfileSlug(name, slugMap) || aliases.directoryCompanySlug(name, slugMap);
      const row = bySlug[slug];
      if (row && row.indexable) published.push(slug);
      else noindex.push(slug || name);
    });
  });
  return {
    root: root,
    publicCount: info.publicCount,
    published: published,
    noindex: noindex,
    hidden: hidden
  };
}

function profileSlug(rel) {
  const match = String(rel || '').match(/^manufacturers\/([^/]+)\/index\.html$/);
  return match ? match[1] : '';
}

function publishedSet(census) {
  return new Set(census.published);
}

/* profile: published census company. directory: country or product page.
 * group: an indexable profile that is not a census company. */
function kindForRel(rel, published) {
  if (String(rel || '').indexOf('manufacturers/') !== 0) return '';
  const slug = profileSlug(rel);
  if (!slug) return 'directory';
  if (DIRECTORY_HUBS.has(slug)) return 'directory';
  if (published.has(slug)) return 'profile';
  return 'group';
}

function isIndexable(filePath) {
  let html = '';
  try { html = fs.readFileSync(filePath, 'utf8'); } catch (e) { return false; }
  if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) return false;
  if (/http-equiv=["']refresh["']/i.test(html)) return false;
  return true;
}

function publicPath(rel) {
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel;
}

function relFromLoc(loc) {
  const pathname = decodeURIComponent(new URL(loc).pathname);
  if (pathname.endsWith('/')) return pathname.slice(1) + 'index.html';
  return pathname.replace(/^\//, '');
}

function walkManufacturerRels(root) {
  const dir = path.join(root, 'manufacturers');
  const out = [];
  function walk(current) {
    let names = [];
    try { names = fs.readdirSync(current); } catch (e) { return; }
    names.forEach(function (name) {
      if (name.charAt(0) === '_' || name.charAt(0) === '.') return;
      if (/ \d+\.[^/]+$/.test(name)) return;
      const full = path.join(current, name);
      let st;
      try { st = fs.statSync(full); } catch (e) { return; }
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && name.endsWith('.html') && isIndexable(full)) {
        out.push(path.relative(root, full).split(path.sep).join('/'));
      }
    });
  }
  walk(dir);
  return out;
}

function manufacturerRedirects(root) {
  const paths = [];
  permanentMap(root).forEach(function (item) {
    if (String(item).indexOf('/manufacturers/') === 0) paths.push(item);
  });
  return paths.sort();
}

function counts(root) {
  root = root || path.join(__dirname, '..');
  const census = readCensus(root);
  const published = publishedSet(census);
  const redirected = permanentMap(root);
  const directory = [];
  const profiles = [];
  const groups = [];
  walkManufacturerRels(root).forEach(function (rel) {
    if (redirected.has(publicPath(rel))) return;
    const kind = kindForRel(rel, published);
    if (kind === 'profile') profiles.push(rel);
    else if (kind === 'directory') directory.push(rel);
    else if (kind === 'group') groups.push(rel);
  });
  const uniquePublished = new Set(census.published);
  return {
    publicCount: census.publicCount,
    publishedProfiles: uniquePublished.size,
    publishedCompanies: census.published.length,
    noindexCompanies: census.noindex.length,
    directoryUrls: directory.length,
    groupPagesOmitted: groups.map(profileSlug).sort(),
    hiddenAliases: census.hidden.length,
    manufacturerRedirects: manufacturerRedirects(root).length,
    profileRels: profiles,
    directoryRels: directory
  };
}

function report(root) {
  const doc = counts(root);
  return {
    publicCount: doc.publicCount,
    publishedProfiles: doc.publishedProfiles,
    noindexCompanies: doc.noindexCompanies,
    directoryUrls: doc.directoryUrls,
    groupPagesOmitted: doc.groupPagesOmitted,
    hiddenAliases: doc.hiddenAliases,
    manufacturerRedirects: doc.manufacturerRedirects,
    explanation: 'The public company count and the sitemap use the same census. Published profiles are the indexable pages of those companies: a public website plus multiple sourced fields. Thin listings and companies with no public website stay in the count and out of the sitemap. Country and product directory URLs are not additional companies. Redirects and plant aliases are omitted. Group or alias pages that are not census companies are left out of the sitemap.'
  };
}

function writeReport(root) {
  root = root || path.join(__dirname, '..');
  const doc = report(root);
  fs.writeFileSync(path.join(root, 'data/manufacturer-sitemap.json'), JSON.stringify(doc, null, 2) + '\n');
  return doc;
}

module.exports = {
  DIRECTORY_HUBS: DIRECTORY_HUBS,
  readCensus: readCensus,
  profileSlug: profileSlug,
  kindForRel: kindForRel,
  publicPath: publicPath,
  relFromLoc: relFromLoc,
  counts: counts,
  report: report,
  writeReport: writeReport
};
