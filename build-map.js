#!/usr/bin/env node
/* build-map.js — compact industry-map payload for /map.html
 *
 * One pin per directory organisation that has a country. Pins are country
 * centroids unless a source record already has lat/lng. Manufacturer-sites.json
 * and facilities.json have city/country only — they are NOT exploded into
 * invented plant coordinates. Event pins use a city coordinate only when the
 * event record already has one; otherwise the country centroid.
 *
 * Layers match the public directories:
 *   m manufacturers · u utilities/grid operators · b buyers
 *   a component & material suppliers · y machinery · l laboratories
 *   v services · g logistics · e events
 *
 * Run: node build-map.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveStatus, isDiscoverable } = require('./lib/event-status');
const { eventHref } = require('./lib/event-href');
const listingTier = require('./lib/listing-tier');

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function norm(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

const GEO = JSON.parse(fs.readFileSync('data/country-centroids.json', 'utf8'));
const ALIAS = GEO.aliases || {};
const CENTROIDS = GEO.centroids || {};

function canonicalCountry(raw) {
  const n = norm(raw);
  if (!n) return '';
  if (ALIAS[n]) return ALIAS[n];
  if (CENTROIDS[raw]) return raw;
  const hit = Object.keys(CENTROIDS).find((k) => norm(k) === n);
  return hit || raw;
}

function lookupCentroid(country) {
  const key = canonicalCountry(country);
  return CENTROIDS[key] || null;
}

function realCoord(rec) {
  const lat = rec.lat != null ? rec.lat : rec.latitude;
  const lng = rec.lng != null ? rec.lng : (rec.lon != null ? rec.lon : rec.longitude);
  if (typeof lat === 'number' && typeof lng === 'number' &&
      isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return [lat, lng];
  }
  return null;
}

function listingUrl(dir, name, fallback) {
  const slug = slugify(name);
  if (slug && fs.existsSync(path.join(dir, slug, 'index.html'))) {
    return dir + '/' + slug + '/';
  }
  return fallback || (dir + '.html?q=' + encodeURIComponent(name));
}

const SLUGS = JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8'));
const SLUG_BY_NAME = {};
SLUGS.forEach((c) => { SLUG_BY_NAME[norm(c.name)] = c.slug; });

const LISTING_OVERLAY = listingTier.loadOverlay();
const LISTING_INDEX = listingTier.indexOverlay(LISTING_OVERLAY);
const FEATURED_CTA = LISTING_OVERLAY.cta || 'verified.html';

function listingFor(rec) {
  return listingTier.resolveListing({
    name: rec.n || rec.name,
    slug: rec.slug || SLUG_BY_NAME[norm(rec.n || rec.name || '')] || '',
    listing_tier: rec.listing_tier,
    featured: rec.featured,
    verified: rec.verified,
    commercial_status: rec.commercial_status,
    flag: rec.flag,
    flagV: rec.flagV,
    _src: rec._src
  }, LISTING_INDEX);
}

function manufacturerUrl(name) {
  const slug = SLUG_BY_NAME[norm(name)] || slugify(name);
  return 'manufacturers/' + slug + '/';
}

function utilityUrl(name, country) {
  const uslug = slugify(name);
  if (uslug && fs.existsSync(path.join('utilities', uslug, 'index.html'))) {
    return 'utilities/' + uslug + '/';
  }
  const cslug = slugify(country);
  if (cslug && fs.existsSync(path.join('grids', cslug, 'index.html'))) {
    return 'grids/' + cslug + '/';
  }
  return 'grids.html';
}

const items = [];
const seen = new Set();
const missing = [];
const unmapped = [];
const listed = { m: 0, u: 0, b: 0, a: 0, y: 0, l: 0, v: 0, g: 0, e: 0 };
const listedNoCountry = { m: 0, u: 0, b: 0, a: 0, y: 0, l: 0, v: 0, g: 0, e: 0 };

function pushItem(rec) {
  listed[rec.t] = (listed[rec.t] || 0) + 1;
  if (!rec.c) {
    listedNoCountry[rec.t] = (listedNoCountry[rec.t] || 0) + 1;
    unmapped.push({ t: rec.t, n: rec.n, reason: 'no-country' });
    return;
  }
  const key = rec.t + '|' + norm(rec.n) + '|' + norm(rec.c) + '|' + norm(rec.city || '') + '|' + norm(rec._id || '');
  if (seen.has(key)) return;
  seen.add(key);
  const site = realCoord(rec._src || {});
  let ll = site;
  let p = 'site';
  if (!ll) {
    ll = lookupCentroid(rec.c);
    p = rec.c === 'Central America (SIEPAC)' ? 'regional' : 'country';
  }
  if (!ll) {
    missing.push(rec.c + ' — ' + rec.n);
    unmapped.push({ t: rec.t, n: rec.n, c: rec.c, reason: 'no-centroid' });
    return;
  }
  const out = { n: rec.n, c: rec.c, t: rec.t, u: rec.u, p: p, lat: +ll[0].toFixed(4), lng: +ll[1].toFixed(4) };
  if (rec.k) out.k = rec.k;
  if (rec.city) out.city = rec.city;
  if (rec.s) out.s = rec.s;
  if (rec.e) out.e = rec.e;
  if (rec.up) out.up = 1;
  const listing = listingFor(rec);
  if (listing.featured) out.f = 1;
  if (listing.verified) out.v = 1;
  if (listing.tier && listing.tier !== 'listed') out.lt = listing.tier;
  items.push(out);
}

const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
MANUF.forEach((g) => {
  (g.makers || []).forEach((m) => {
    const name = m[0];
    if (!name || /^Served by/i.test(name)) return;
    pushItem({
      n: name,
      c: g.country,
      city: m[1] || '',
      t: 'm',
      u: manufacturerUrl(name),
      slug: SLUG_BY_NAME[norm(name)] || slugify(name),
      flag: Array.isArray(m) ? m[4] : '',
      featured: m && m.featured,
      listing_tier: m && m.listing_tier,
      commercial_status: m && m.commercial_status,
      _src: m
    });
  });
});

const GRIDS = JSON.parse(fs.readFileSync('data/grids.json', 'utf8'));
GRIDS.forEach((g) => {
  (g.grids || []).forEach((row) => {
    const name = row[0];
    if (!name) return;
    pushItem({ n: name, c: g.country, t: 'u', u: utilityUrl(name, g.country), _src: row });
  });
});

const BUY = JSON.parse(fs.readFileSync('data/buyers.json', 'utf8'));
(BUY.buyers || []).forEach((s) => {
  const nm = s.organization_name || s.name;
  if (!nm) return;
  pushItem({
    n: nm,
    c: s.country,
    city: s.city || '',
    t: 'b',
    k: 'buyer',
    u: listingUrl('buyers', nm, 'buyers.html?q=' + encodeURIComponent(nm)),
    _src: s
  });
});

const ACC = JSON.parse(fs.readFileSync('data/accessories.json', 'utf8'));
(ACC.suppliers || []).forEach((s) => {
  if (!s.name) return;
  pushItem({
    n: s.name,
    c: s.country,
    city: s.city || '',
    t: 'a',
    k: 'accessory',
    u: listingUrl('accessories', s.name, 'accessories.html?q=' + encodeURIComponent(s.name)),
    _src: s
  });
});

const MACH = JSON.parse(fs.readFileSync('data/machinery.json', 'utf8'));
(MACH.machinery || []).forEach((s) => {
  const nm = s.manufacturer || s.name;
  if (!nm) return;
  pushItem({
    n: nm,
    c: s.country,
    city: s.city || '',
    t: 'y',
    k: 'machinery',
    u: listingUrl('machinery', nm, 'machinery.html?q=' + encodeURIComponent(nm)),
    _id: s.id || s.name || '',
    _src: s
  });
});

const LABS = JSON.parse(fs.readFileSync('data/laboratories.json', 'utf8'));
(LABS.laboratories || []).forEach((s) => {
  if (!s.name) return;
  pushItem({
    n: s.name,
    c: s.country,
    city: s.city || '',
    t: 'l',
    k: 'laboratory',
    u: listingUrl('laboratories', s.name, 'laboratories.html?q=' + encodeURIComponent(s.name)),
    _src: s
  });
});

const SRV = JSON.parse(fs.readFileSync('data/services.json', 'utf8'));
(SRV.services || []).forEach((s) => {
  const nm = s.company_name || s.name;
  if (!nm) return;
  pushItem({
    n: nm,
    c: s.country,
    city: s.city || '',
    t: 'v',
    k: 'service',
    u: listingUrl('services', nm, 'services.html?q=' + encodeURIComponent(nm)),
    _src: s
  });
});

const LOGI = JSON.parse(fs.readFileSync('data/logistics.json', 'utf8'));
(LOGI.companies || []).forEach((s) => {
  const nm = s.company_name || s.name;
  if (!nm) return;
  pushItem({
    n: nm,
    c: s.country,
    city: s.city || '',
    t: 'g',
    k: 'logistics',
    u: listingUrl('logistics', nm, 'logistics.html?q=' + encodeURIComponent(nm)),
    _src: s
  });
});

function shouldPinEvent(ev) {
  const st = resolveStatus(ev);
  if (!isDiscoverable(st)) return false;
  if (st.key === 'CANCELLED') return false;
  return true;
}

const today = new Date().toISOString().slice(0, 10);
const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
let upcomingDiscoverable = 0;
EVENTS.forEach((ev) => {
  if (!ev.n) return;
  const st = resolveStatus(ev);
  const upcoming = !!(ev.e && ev.e >= today && isDiscoverable(st));
  if (upcoming) upcomingDiscoverable += 1;
  if (!shouldPinEvent(ev)) return;
  pushItem({
    n: ev.n,
    c: ev.co,
    t: 'e',
    city: ev.c,
    s: ev.s,
    e: ev.e,
    up: upcoming ? 1 : 0,
    u: eventHref(ev, { fallbackListing: true }),
    _src: ev
  });
});

const counts = { m: 0, u: 0, b: 0, a: 0, y: 0, l: 0, v: 0, g: 0, e: 0, eUpcoming: 0, site: 0, country: 0, regional: 0, featured: 0, verified: 0 };
items.forEach((it) => {
  counts[it.t] = (counts[it.t] || 0) + 1;
  counts[it.p] = (counts[it.p] || 0) + 1;
  if (it.t === 'e' && it.up) counts.eUpcoming += 1;
  if (it.f) counts.featured += 1;
  if (it.v) counts.verified += 1;
});
counts.s = (counts.a || 0) + (counts.y || 0) + (counts.l || 0) + (counts.v || 0) + (counts.g || 0);
counts.customers = (counts.u || 0) + (counts.b || 0);

const china = { m: 0, a: 0, y: 0, l: 0, v: 0, g: 0, u: 0, b: 0, e: 0 };
items.forEach((it) => {
  if (norm(it.c) === 'china' && china[it.t] != null) china[it.t] += 1;
});

const payload = {
  generated: new Date().toISOString().slice(0, 10),
  note: 'Listed / growing census. Pins use country (or regional) centroids unless a source record already has lat/lng. Not a complete worldwide catalogue of every workshop or supplier. Manufacturer sites, facilities and event venues are listed with city/country only — those are not plotted as street addresses. Event legend default is the upcoming discoverable subset of data/events.json.',
  counts: counts,
  directory: {
    manufacturers: listed.m,
    utilities: listed.u,
    buyers: listed.b,
    accessories: listed.a,
    machinery: listed.y,
    laboratories: listed.l,
    services: listed.v,
    logistics: listed.g,
    eventsUpcoming: upcomingDiscoverable,
    eventsPinnedUpcoming: counts.eUpcoming,
    eventsUnpinnedUpcoming: Math.max(0, upcomingDiscoverable - counts.eUpcoming),
    featured: counts.featured,
    verified: counts.verified
  },
  featured: {
    count: counts.featured,
    verified: counts.verified,
    cta: FEATURED_CTA,
    note: 'Featured pins are paid Verified / Supplier Pro placements from data/listing-tiers.json or an existing V/P / commercial_status flag. Website-checked research labels do not create a pin. Default is none.'
  },
  unmapped: {
    total: unmapped.length,
    noCountry: listedNoCountry,
    rows: unmapped
  },
  china: china,
  items: items
};

fs.writeFileSync('data/map-points.json', JSON.stringify(payload));
const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
console.log('map-points.json wrote ' + items.length + ' pins (' + kb + ' KB)');
console.log('  listed→pinned  m ' + listed.m + '→' + counts.m +
  '  u ' + listed.u + '→' + counts.u +
  '  b ' + listed.b + '→' + counts.b +
  '  a ' + listed.a + '→' + counts.a +
  '  y ' + listed.y + '→' + counts.y +
  '  l ' + listed.l + '→' + counts.l +
  '  v ' + listed.v + '→' + counts.v +
  '  g ' + listed.g + '→' + counts.g +
  '  e ' + listed.e + '→' + counts.e + ' (upcoming pinned ' + counts.eUpcoming + '/' + upcomingDiscoverable + ')');
console.log('  featured ' + counts.featured + '  verified ' + counts.verified + '  cta ' + FEATURED_CTA);
console.log('  unmapped ' + unmapped.length + '  china m=' + china.m + ' a=' + china.a);
if (missing.length) {
  console.warn('  ! no centroid for ' + missing.length + ' row(s):');
  missing.slice(0, 20).forEach((m) => console.warn('      ' + m));
}
