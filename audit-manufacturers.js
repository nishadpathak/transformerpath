#!/usr/bin/env node
/* audit-manufacturers.js — TransformerPath manufacturer census audit.
 *
 * This is an INTERNAL data-quality tool, not a public page. It walks the
 * census (data/manufacturers.json) and the enrichment layer
 * (data/manufacturer-tiers.json) and flags records that need human review,
 * rather than deleting or "correcting" anything automatically.
 *
 * Rules honoured (per the TransformerPath data policy):
 *   - NEVER invent data; only flag.
 *   - A sales office / trading company / component maker is NOT proof of
 *     transformer manufacture.
 *   - Do not combine a separately-stated max MVA and max voltage into a
 *     single "X MVA, Y kV transformer" claim.
 *   - Tier 3/4 directory sources must not be the sole evidence for important
 *     technical capability claims.
 *   - Unknown is better than incorrect.
 *
 * Output: prints a summary and writes _private/census-audit.json (internal —
 * gitignored and 404'd at the edge, never rendered to the public site).
 * Run: node audit-manufacturers.js
 */
'use strict';
const fs = require('fs');

const CENSUS = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));

// Normalised forms for duplicate detection.
function norm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function normCountry(s) {
  const map = { 'türkiye': 'turkey', 'turkey': 'turkiye', 'uae': 'united arab emirates', 'united arab emirates': 'uae', 'usa': 'united states', 'united states': 'usa', 'united states of america': 'usa' };
  const k = String(s || '').toLowerCase().trim();
  return map[k] || k;
}

// ── Maker record extraction ────────────────────────────────────────────
const makers = [];
CENSUS.forEach(function (g) {
  (g.makers || []).forEach(function (x) {
    const isService = /^Served by/i.test(x[0]);
    makers.push({
      name: x[0].trim(),
      country: g.country,
      countryN: normCountry(g.country),
      region: g.region,
      city: (x[1] || '').trim(),
      url: (x[2] || '').trim(),
      types: String(x[3] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      isService,
      key: norm(x[0]) + '||' + normCountry(g.country),
    });
  });
});

// ── Heuristic keywords that suggest a record may NOT be a transformer
//    manufacturer (flag-only; never a deletion). ────────────────────────
const SUSPECT_KEYWORDS = [
  /\btrading\b/i, /\btrader\b/i, /\bagent(?:s)?\b/i, /\bdistributor\b/i, /\bimporter\b/i,
  /\bswitchgear\b/i, /\bswitchboard\b/i, /\bcable(?:s)?\b/i, /\bwire(?:s)?\b/i, /\bbreaker\b/i,
  /\bmeter(?:s)?\b/i, /\bservices?\b/i, /\brepair\b/i, /\bmaintenance\b/i, /\brewind(?:ing)?\b/i,
  /\btesting\b/i, /\bconsult(?:ancy|ing|ants)?\b/i, /\bEPC\b/i, /\bengineering\s+(?:services?|solutions)\b/i,
  /\bsolutions?\b/i, /\bsolar\b/i, /\bpv\b/i, /\bstorage\b/i, /\bvalve\b/i, /\bpump\b/i,
  /\bhigh[- ]voltage\s+(?:switchgear|breakers?)\b/i,
];
function suspectReason(name) {
  const reasons = [];
  for (const re of SUSPECT_KEYWORDS) {
    const m = name.match(re);
    if (m && !/transformer/i.test(name)) reasons.push(m[0]);
  }
  return reasons;
}

// ── Source authority classification (provenance) ──────────────────────
function sourceTier(src) {
  const s = String(src || '').toLowerCase();
  if (!s) return 4;
  if (/\bfortune business insights\b|\bdoe\b/i.test(s)) return 3; // market-research/study aggregates
  if (/ensun|iqs|sinovoltaics|industry directory|directory/i.test(s)) return 4; // scraped/low-authority directories
  if (/reuters|bloomberg/i.test(s)) return 2;
  return 3;
}

// ── Duplicate detection across the census (name-keyed, cross-country) ──
const nameGroups = {};
makers.forEach(function (m) {
  const k = norm(m.name);
  (nameGroups[k] = nameGroups[k] || []).push(m);
});
const dupNames = Object.entries(nameGroups).filter(function (e) { return e[1].length > 1; });

// ── Duplicate / neighbouring websites ──────────────────────────────────
const urlGroups = {};
makers.filter(function (m) { return m.url; }).forEach(function (m) {
  const u = m.url.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
  (urlGroups[u] = urlGroups[u] || []).push(m);
});
const dupUrls = Object.entries(urlGroups).filter(function (e) { return e[1].length > 1; });

// ── Collect audit rows ─────────────────────────────────────────────────
const rows = [];
makers.forEach(function (m) {
  rows.push({
    name: m.name, country: m.country, region: m.region, city: m.city,
    url: m.url, types: m.types,
    isService: m.isService,
    hasWebsite: !!m.url,
    suspect: suspectReason(m.name),
  });
});

const noWebsite = makers.filter(function (m) { return !m.url; });
const serviceRows = makers.filter(function (m) { return m.isService; });
const suspectRows = makers.filter(function (m) { return suspectReason(m.name).length && !m.isService; });

// ── Enrichment provenance review ───────────────────────────────────────
const tierRows = TIERS.map(function (t) {
  return {
    name: t.name, country: t.country, type: t.tier,
    mva: t.mva, kv: t.kv, cap: t.cap,
    source: t.source, sourceTier: sourceTier(t.source),
    // The two figures are stored/rendered separately; flag a note that
    // juxtaposes them as if a combined capability.
    noteJuxtaposes: /production\s*\/\s*\d+\s*kv/i.test(String(t.note || '')),
    // max unit ceiling disambiguates "max rating" from "annual capacity"
    hasMaxUnitCeiling: typeof t.cap === 'number' && t.cap > 0,
    // Capability figures resting only on a low-authority directory.
    lowAuthorityCapability: sourceTier(t.source) >= 4 && typeof t.mva === 'number',
  };
});

// ── Summaries ──────────────────────────────────────────────────────────
const byState = {};
function tally(list, label) { byState[label] = list.length; return list; }

const report = {
  generatedAt: new Date().toISOString(),
  census: {
    records: makers.length,
    countriesWithMakers: CENSUS.filter(function (g) { return (g.makers || []).some(function (m) { return !/^Served by/i.test(m[0]); }); }).length,
    makers, // normalized internal view (not for public render)
  },
  findings: {
    duplicateNames: dupNames.map(function (e) { return { name: e[1][0].name, count: e[1].length, countries: e[1].map(function (m) { return m.country; }) }; }),
    duplicateWebsites: dupUrls.map(function (e) { return { url: e[0], count: e[1].length, names: e[1].map(function (m) { return m.name; }) }; }),
    noWebsite: noWebsite.map(function (m) { return { name: m.name, country: m.country }; }),
    serviceRows: serviceRows.map(function (m) { return { name: m.name, country: m.country }; }),
    suspectNames: suspectRows.map(function (m) { return { name: m.name, country: m.country, reasons: suspectReason(m.name) }; }),
    tierProvenance: tierRows,
  },
  counts: {
    totalRecords: makers.length,
    serviceRows: serviceRows.length,
    hasWebsite: makers.filter(function (m) { return m.url; }).length,
    noWebsite: noWebsite.length,
    duplicateNameGroups: dupNames.length,
    duplicateWebsiteGroups: dupUrls.length,
    suspectNameRecords: suspectRows.length,
    tierRecords: TIERS.length,
    tierLowAuthorityCapability: tierRows.filter(function (t) { return t.lowAuthorityCapability; }).length,
  },
};

fs.mkdirSync('_private', { recursive: true });
fs.writeFileSync('_private/census-audit.json', JSON.stringify(report, null, 2));

console.log('CENSUS AUDIT');
console.log('Records: ' + makers.length + ' | Countries with makers: ' + report.census.countriesWithMakers);
console.log('Service/served-by rows: ' + serviceRows.length);
console.log('Has website: ' + report.counts.hasWebsite + ' | No website (Tier C): ' + report.counts.noWebsite);
console.log('Duplicate name groups: ' + dupNames.length + ' | Duplicate URL groups: ' + dupUrls.length);
console.log('Suspect (possibly not a transformer manufacturer): ' + suspectRows.length);
console.log('Tier enrichment records: ' + TIERS.length + ' | Low-authority capability sources: ' + report.counts.tierLowAuthorityCapability);
console.log('\n--- DUPLICATE NAMES ---');
dupNames.forEach(function (e) { console.log('  ' + e[1][0].name + ' (' + e[1].length + '): ' + e[1].map(function (m) { return m.country; }).join(', ')); });
console.log('\n--- DUPLICATE WEBSITES ---');
dupUrls.forEach(function (e) { console.log('  ' + e[0] + ' -> ' + e[1].map(function (m) { return m.name; }).join(' | ')); });
console.log('\n--- NO WEBSITE (Tier C) ---');
noWebsite.forEach(function (m) { console.log('  ' + m.name + ' (' + m.country + ')'); });
console.log('\n--- TIER LOW-AUTHORITY CAPABILITY ---');
tierRows.filter(function (t) { return t.lowAuthorityCapability; }).forEach(function (t) { console.log('  ' + t.name + ' [' + t.source + ' ' + (t.sourceTier) + ']'); });
console.log('\nWrote _private/census-audit.json (internal — gitignored and 404\'d, not rendered).');
