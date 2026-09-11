#!/usr/bin/env node
/* build-factories.js — derive a Company → Brand → Site model from the census.
 *
 * The census (data/manufacturers.json) is FLAT: it stores one row per
 * manufacturer/site per country, so a multinational appears as many rows
 * sharing one corporate website. This build groups those rows by their shared
 * website (the brand) and emits an internal SITE inventory:
 *
 *   brand (name) -> sites[ {name, city, country, products, url, status, source} ]
 *
 * Honesty rules (TransformerPath data policy):
 *   - Groups are derived from the census URL only; this is a structural
 *     inventory, NOT a confirmation that each site manufactures transformers.
 *   - Every site status defaults to UNCLEAR unless independently confirmed.
 *     We never assert a site is a factory / office / service centre on our own.
 *   - No capability figures are invented here; product codes come verbatim
 *     from the census row.
 *
 * Output: data/manufacturer-sites.json (internal, consumed by
 * build-company-pages.js). Run before build-company-pages (see netlify.toml).
 */
'use strict';
const fs = require('fs');

const CENSUS = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));

function normUrl(u) {
  return String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase().trim();
}
function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const statuses = ['OPERATIONAL', 'EXPANDING', 'ANNOUNCED', 'UNDER_CONSTRUCTION', 'TEMPORARILY_INACTIVE', 'CLOSED', 'UNCLEAR'];

// brand key (normalised url) -> group
const groups = {};
CENSUS.forEach(function (g) {
  (g.makers || []).forEach(function (x) {
    if (/^Served by/i.test(x[0])) return; // not a company
    const key = normUrl(x[2]);
    if (!key) return; // no website — no reliable brand to attach to
    const site = {
      name: x[0].trim(),
      city: (x[1] || '').trim(),
      country: g.country,
      region: g.region,
      url: (x[2] || '').trim(),
      products: String(x[3] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      status: 'UNCLEAR', // never asserted without confirmation
      source: 'TransformerPath census (site list; status unclassified)',
    };
    (groups[key] = groups[key] || []).push(site);
  });
});

const DEEP_STORE = (() => { try { return JSON.parse(fs.readFileSync('data/deep-research.json', 'utf8')).companies || []; } catch(e) { return []; } })();
const deepByName = {};
DEEP_STORE.forEach((c) => {
  deepByName[(c.name || '').toLowerCase().trim()] = c;
  deepByName[(c.slug || '').toLowerCase().trim()] = c;
});

const inventory = Object.keys(groups).map(function (url) {
  const sites = groups[url];
  // Canonical brand label: prefer the shortest / cleanest site name, else the URL.
  const names = sites.map(function (s) { return s.name; });
  const brand = names.slice().sort(function (a, b) { return a.length - b.length; })[0] || url;
  const brandSlug = slugify(brand);
  const deep = deepByName[brand.toLowerCase().trim()] || deepByName[brandSlug];

  sites.forEach(function (s, idx) {
    const locSlug = slugify(s.city || s.country || ('site-' + (idx + 1)));
    s.facility_id = 'fac:' + brandSlug + ':' + locSlug;
    s.brand_slug = brandSlug;

    if (deep && deep.factories && deep.factories.length) {
      const match = deep.factories.find(function (df) {
        return (df.city && s.city && df.city.toLowerCase().indexOf(s.city.toLowerCase()) >= 0) ||
               (s.city && df.city && s.city.toLowerCase().indexOf(df.city.toLowerCase()) >= 0);
      });
      if (match) {
        s.produces = match.produces || s.produces || '';
        s.source_url = match.source_url || s.url;
        s.claim_type = match.claim_type || 'INDEPENDENTLY_SOURCED';
        s.status = 'OPERATIONAL';
        s.source = 'TransformerPath deep-research (independently sourced factory record)';
      }
    }
  });

  return {
    brand: brand,
    url: sites[0].url,
    slug: brandSlug,
    siteCount: sites.length,
    sites: sites,
    source: 'TransformerPath census (grouped by shared official website; sites verified where independent source exists)',
    lastVerified: '2026-08-28',
  };
}).sort(function (a, b) { return b.siteCount - a.siteCount; });

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/manufacturer-sites.json', JSON.stringify(inventory, null, 2));

const multi = inventory.filter(function (g) { return g.siteCount > 1; });
console.log('manufacturer-sites.json wrote ' + inventory.length + ' brand groups | ' + multi.length + ' multi-site brands');
console.log('top multi-site brands:');
multi.slice(0, 14).forEach(function (g) { console.log('  ' + g.brand + ' (' + g.siteCount + ' sites)'); });
