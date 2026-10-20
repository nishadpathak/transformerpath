#!/usr/bin/env node
/* build-permanent-ids.js — immutable company and facility IDs.
 *
 * Assigns:
 *   TPM-000001 …  company (manufacturer census identity)
 *   TPF-000001 …  facility (sourced plant)
 *
 * IDs are stable across rebuilds via data/permanent-ids.json. New entities
 * append the next free integer; a retired ID is never reused. Assigning an
 * ID does not add a manufacturer to the census.
 *
 * Run: node build-permanent-ids.js
 */
'use strict';
const fs = require('fs');
const { resolveCompanyAlias, slugify } = require('./lib/company-aliases');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}
function pad(n, w) {
  let s = String(n);
  while (s.length < w) s = '0' + s;
  return s;
}
function fmtCompany(n) { return 'TPM-' + pad(n, 6); }
function fmtFacility(n) { return 'TPF-' + pad(n, 6); }

const store = readJson('data/permanent-ids.json', {
  $schema: 'https://transformerpath.com/permanent-ids.schema.json',
  version: 1,
  companies: {},
  facilities: {},
  next_company_n: 1,
  next_facility_n: 1
});
store.companies = store.companies || {};
store.facilities = store.facilities || {};
store.next_company_n = store.next_company_n || 1;
store.next_facility_n = store.next_facility_n || 1;

Object.keys(store.companies).forEach(function (slug) {
  const n = store.companies[slug] && store.companies[slug].n;
  if (n >= store.next_company_n) store.next_company_n = n + 1;
});
Object.keys(store.facilities).forEach(function (fid) {
  const n = store.facilities[fid] && store.facilities[fid].n;
  if (n >= store.next_facility_n) store.next_facility_n = n + 1;
});

const slugs = readJson('data/company-slugs.json', []);
const sites = readJson('data/manufacturer-sites.json', []);
const stats = readJson('data/site-stats.json', {});
const CANON_MFG = typeof stats.manufacturers === 'number' ? stats.manufacturers : slugs.length;

const companyRows = slugs.map(function (r) {
  return { slug: r.slug, name: r.name, country: r.country || '' };
});

const bySlug = {};
companyRows.forEach(function (r) {
  if (!r.slug) return;
  const a = resolveCompanyAlias(r.name || '');
  const slug = a.aliased ? a.slug : r.slug;
  if (!bySlug[slug]) {
    bySlug[slug] = {
      slug: slug,
      name: a.aliased ? a.name : r.name,
      country: r.country
    };
  }
});

const extras = readJson('data/permanent-id-extras.json', []);
(extras || []).forEach(function (row) {
  if (!row || !row.slug || bySlug[row.slug]) return;
  bySlug[row.slug] = { slug: row.slug, name: row.name || row.slug, country: row.country || '' };
});

let added = 0;
const ordered = Object.keys(bySlug).sort();
ordered.forEach(function (slug) {
  if (store.companies[slug]) return;
  added++;
  const n = store.next_company_n++;
  store.companies[slug] = {
    id: fmtCompany(n),
    n: n,
    name: bySlug[slug].name,
    country: bySlug[slug].country || '',
    assigned_at: new Date().toISOString().slice(0, 10)
  };
});

sites.forEach(function (brand) {
  const brandSlug = brand.slug || slugify(brand.name || brand.brand || '');
  const facs = brand.sites || brand.facilities || [];
  facs.forEach(function (f) {
    const fid = f.facility_id || ('fac:' + brandSlug + ':' + slugify(f.city || f.location || 'unknown'));
    if (store.facilities[fid]) return;
    added++;
    const n = store.next_facility_n++;
    store.facilities[fid] = {
      id: fmtFacility(n),
      n: n,
      facility_id: fid,
      brand_slug: brandSlug,
      city: f.city || f.location || '',
      country: f.country || brand.country || '',
      assigned_at: new Date().toISOString().slice(0, 10)
    };
  });
});

if (added || !store.generated) store.generated = new Date().toISOString();
store.counts = {
  companies: Object.keys(store.companies).length,
  facilities: Object.keys(store.facilities).length,
  next_company_n: store.next_company_n,
  next_facility_n: store.next_facility_n,
  canonical_manufacturers_target: CANON_MFG
};
store.honesty = 'TPM/TPF IDs label census manufacturers and directory listings that already have a page. Assigning an ID does not create a manufacturer or inflate the ' + CANON_MFG + ' census. Accessory, laboratory and service IDs are not manufacturer counts. Retire IDs by tombstone only — never reuse.';

fs.writeFileSync('data/permanent-ids.json', JSON.stringify(store, null, 2) + '\n');

const lookup = {
  generated: store.generated,
  by_slug: {},
  by_facility_id: {}
};
Object.keys(store.companies).forEach(function (slug) {
  lookup.by_slug[slug] = store.companies[slug].id;
});
Object.keys(store.facilities).forEach(function (fid) {
  lookup.by_facility_id[fid] = store.facilities[fid].id;
});
fs.writeFileSync('data/permanent-id-lookup.json', JSON.stringify(lookup, null, 2) + '\n');

console.log('permanent-ids: ' + store.counts.companies + ' TPM · ' + store.counts.facilities +
  ' TPF (next company ' + fmtCompany(store.next_company_n) +
  ', next facility ' + fmtFacility(store.next_facility_n) + ')');
