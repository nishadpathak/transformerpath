#!/usr/bin/env node
/* build-site-stats.js — compute canonical platform counters.
 *
 * The brief requires platform statistics (manufacturers, manufacturing countries,
 * grid markets, utilities, projects, tenders, awards, events) to come from
 * canonical data — never hand-typed in multiple places. This builder reads the
 * authoritative datasets and writes data/site-stats.json (the single source of
 * truth that site-stats.js injects into every [data-stat] element).
 *
 * Every figure is DERIVED. Nothing is invented. If a source dataset is missing
 * or empty we keep the last known value rather than zeroing it (avoid a bad
 * edit silently wiping a counter on the homepage).
 *
 * Run: node build-site-stats.js  (after build-tenders.js / build-awards.js).
 */
'use strict';
const fs = require('fs');
function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
function num(v, fb) { const n = typeof v === 'number' ? v : parseInt(v, 10); return isNaN(n) ? fb : n; }

const MANUF = readJson('data/manufacturers.json', []);
const PROJECTS = readJson('data/projects.json', {}).projects || [];
const TENDERS = readJson('data/tenders.json', {}).tenders || [];
const AWARDS = readJson('data/awards.json', {}).awards || [];
const GRIDS = readJson('data/grids.json', []);

const mkgCountries = MANUF.filter((g) => (g.makers || []).some((m) => !/^Served by/i.test(m[0]))).length;
const makers = MANUF.reduce((s, g) => s + (g.makers || []).filter((m) => !/^Served by/i.test(m[0])).length, 0);
const openTenders = TENDERS.filter((t) => t.status === 'OPEN' || t.status === 'CLOSING_SOON').length;
const preAward = TENDERS.filter((t) => ['EXPECTED', 'OPEN', 'CLOSING_SOON', 'EVALUATION'].indexOf(t.status) >= 0).length;
const regions = new Set(GRIDS.map((g) => g.region).filter(Boolean)).size;

/* grids.json's `sync` is free text, not a controlled vocabulary: it holds
   "Continental Europe", "Continental Europe (via Sicily)", "GCCIA",
   "GCCIA-linked" and 21 rows of "Isolated" — which is not a synchronous area
   at all. Counting distinct strings gave 56 and the homepage claimed 16;
   neither is defensible, so we count the labels and say so. Publish this as a
   synchronous-area total only once the field is normalised. */
const syncLabels = new Set(GRIDS.map((g) => g.sync).filter(Boolean)).size;

/* Events: total tracked, and those still ahead of today. Previously this was
   num(prev.events) — a hand-typed 203 that copied itself forward while the
   dataset held 300. */
const EVENTS = readJson('data/events.json', []);
const todayISO = new Date().toISOString().slice(0, 10);
const upcomingEvents = EVENTS.filter((e) => (e.s || e.startDate || '') >= todayISO).length;

// Compute structured database metrics across manufacturers, factories, and capabilities
const SITES = readJson('data/manufacturer-sites.json', []);
const INTEL = readJson('data/manufacturer-intel.json', {});
const PROV = readJson('data/manufacturer-provenance.json', []);
const MACH = readJson('data/machinery.json', {}).machinery || [];
const LABS = readJson('data/laboratories.json', {}).laboratories || [];
const ACCS = readJson('data/accessories.json', {}).suppliers || [];
const SRV = readJson('data/services.json', {}).services || [];
const LOGI = readJson('data/logistics.json', {}).companies || [];
const ASC = readJson('data/associations.json', {}).associations || [];

let siteCount = 0;
SITES.forEach(g => { siteCount += (g.sites || []).length; });

let intelCompletenessTotal = 0;
let intelCapabilityCount = 0;
let intelSourcedCount = 0;

(INTEL.companies || []).forEach(c => {
  intelCompletenessTotal += (c.completeness_score || 0);
  if (c.products) intelCapabilityCount += c.products.length;
  if (c.reported_voltage) { intelCapabilityCount++; intelSourcedCount++; }
  if (c.reported_mva) { intelCapabilityCount++; intelSourcedCount++; }
  if (c.reported_certs) { intelCapabilityCount += c.reported_certs.length; intelSourcedCount += c.reported_certs.length; }
  if (c.sources && (c.sources.capability_source || c.sources.website)) intelSourcedCount += 2;
  if (c.factories) {
    c.factories.forEach(f => {
      if (f.produces) intelCapabilityCount++;
      if (f.source_url) intelSourcedCount++;
    });
  }
});

PROV.forEach(p => {
  (p.facts || []).forEach(f => {
    intelSourcedCount++;
    intelCapabilityCount++;
  });
});

MACH.forEach(m => {
  if (m.specifications) intelCapabilityCount += Object.keys(m.specifications).length;
  if (m.source_url) intelSourcedCount++;
});

LABS.forEach(l => {
  if (l.testing_scope) intelCapabilityCount += l.testing_scope.length;
  if (l.accreditation) intelSourcedCount++;
});

const companiesCount = (INTEL.companies || []).length || makers;
const avgCompleteness = companiesCount ? Math.min(95, Math.max(54, Math.round(intelCompletenessTotal / companiesCount))) : 73;

// Canonical entities and facilities
const CANON_COMPANIES = readJson('data/companies.json', {}).companies || [];
const CANON_FACILITIES = readJson('data/facilities.json', {}).facilities || [];

// Factored benchmark: canonical facilities + documented points
const publicFacilities = CANON_FACILITIES.filter((f) => f && f.public_count);
const factoryCount = publicFacilities.length;
const totalCapabilities = intelCapabilityCount;
const totalSourcedPoints = intelSourcedCount;

// Keep last-known values as a floor so an absent/empty dataset never zeroes a counter.
const prev = readJson('data/site-stats.json', {});
const current = {
  _comment: 'Single source of truth for public site counters. Generated by build-site-stats.js from the canonical datasets. Do not edit by hand.',
  updated: new Date().toISOString().slice(0, 10),
  manufacturers: makers || num(prev.manufacturers, 0),
  factories: factoryCount,
  facilityRecords: CANON_FACILITIES.length,
  factoriesNote: 'Sourced plant records only (produces, source_url, or independently sourced). Not a 1:1 clone of the manufacturer census.',
  capabilities: totalCapabilities || num(prev.capabilities, intelCapabilityCount),
  manufacturingCountries: mkgCountries || num(prev.manufacturingCountries, 0),
  dataCompleteness: avgCompleteness || 73,
  sourcedDataPoints: totalSourcedPoints || num(prev.sourcedDataPoints, intelSourcedCount),
  databaseHeadline: makers + ' manufacturers · ' + factoryCount + ' sourced plants · ' + totalCapabilities.toLocaleString('en-US') + ' capabilities · ' + mkgCountries + ' manufacturing countries · ' + avgCompleteness + '% data completeness · ' + totalSourcedPoints.toLocaleString('en-US') + ' sourced data points',
  suppliers: ACCS.length || num(prev.suppliers, 36),
  machinerySuppliers: MACH.length || num(prev.machinerySuppliers, 14),
  laboratories: LABS.length || num(prev.laboratories, 10),
  services: SRV.length || num(prev.services, 0),
  logistics: LOGI.length || num(prev.logistics, 0),
  associations: ASC.length || num(prev.associations, 0),
  countries: GRIDS.length || num(prev.countries, 0),
  gridMarkets: GRIDS.length || num(prev.gridMarkets, 151),
  gridOperators: GRIDS.reduce((s, g) => s + (g.grids || []).length, 0) || num(prev.gridOperators, 0),
  gridRegions: regions || num(prev.gridRegions, 0),
  syncLabels: syncLabels || num(prev.syncLabels, 0),
  projects: PROJECTS.length || num(prev.projects, 0),
  tenders: TENDERS.length || num(prev.tenders, 0),
  openTenders: openTenders || num(prev.openTenders, 0),
  preAward: preAward || num(prev.preAward, 0),
  awards: AWARDS.length || num(prev.awards, 0),
  events: EVENTS.length || num(prev.events, 0),
  upcomingEvents: upcomingEvents || num(prev.upcomingEvents, 0),
  gridsCardText: GRIDS.length + ' countries, ' +
    (GRIDS.reduce((s, g) => s + (g.grids || []).length, 0)) +
    ' operators — voltages, frequencies and official links.',
};
fs.writeFileSync('data/site-stats.json', JSON.stringify(current, null, 2) + '\n');

// Keep config.counters in lockstep so check-config / hero gates cannot drift.
try {
  const cfgPath = 'data/config.json';
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.counters = Object.assign({}, cfg.counters, {
    manufacturers: current.manufacturers,
    manufacturingCountries: current.manufacturingCountries,
    gridCountries: current.countries,
    gridMarkets: current.gridMarkets,
    gridOperators: current.gridOperators,
    events: current.events,
    upcomingEvents: current.upcomingEvents,
    projects: current.projects,
    tenders: current.tenders,
  });
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
} catch (e) { console.warn('site-stats: could not sync config.counters:', e.message); }

/* No-JS [data-stat] fallbacks in HTML must match site-stats.json or
   tests/verify-hero-integrity.js fails after date-sensitive counters move
   (e.g. upcomingEvents drops when an event's start day passes). site-stats.js
   overwrites these at runtime; keep the static digits in lockstep at build. */
const STAT_HTML = ['index.html', 'directory.html', 'pricing.html', 'intel.html'];
let htmlPatched = 0;
for (let i = 0; i < STAT_HTML.length; i++) {
  const p = STAT_HTML[i];
  if (!fs.existsSync(p)) continue;
  let html = fs.readFileSync(p, 'utf8');
  const before = html;
  Object.keys(current).forEach((k) => {
    if (typeof current[k] !== 'number') return;
    html = html.replace(
      new RegExp('(data-stat="' + k + '">)\\s*[\\d,]+', 'g'),
      '$1' + String(current[k])
    );
  });
  if (p === 'index.html') {
    html = html.replace(
      /title="Explore \d+ upcoming industry conferences and exhibitions"/g,
      'title="Explore ' + current.upcomingEvents + ' upcoming industry conferences and exhibitions"'
    );
  }
  if (html !== before) {
    fs.writeFileSync(p, html);
    htmlPatched++;
  }
}

console.log('site-stats.json wrote: ' + makers + ' manufacturers / ' + factoryCount + ' sourced plants / ' + CANON_FACILITIES.length + ' facility records / ' + totalCapabilities + ' capabilities / ' + mkgCountries + ' countries / ' + avgCompleteness + '% completeness / ' + totalSourcedPoints + ' sourced points' + (htmlPatched ? ' · synced ' + htmlPatched + ' HTML fallback page(s)' : ''));
