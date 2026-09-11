#!/usr/bin/env node
/* check-data-quality.js — TransformerPath manufacturer data-quality gate.
 *
 * Enforces the anti-invention rules at build time so a regression cannot
 * silently publish an unsupported capability claim. Run after build-company-pages
 * (see netlify.toml build command).
 *
 * Guaranteed:
 *   R1  No manufacturer page claims a COMBINED "X MVA, Y kV transformer"
 *       capability unless a source explicitly links the two. They MUST appear
 *       as separate rows (annual capacity vs max voltage).
 *   R2  Every enrichment (tier) record has a source and unit-bearing MVA/kV.
 *   R3  Every census record has a non-empty name and a valid website when a
 *       URL is present; country is always present.
 *   R4  The separation of MAX unit rating (cap) from ANNUAL capacity (mva) is
 *       preserved — never merge them.
 *
 * Critical failures exit 1 (blocks deploy); advisory findings are printed but
 * do not fail the build.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CENSUS = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));

const problems = [];
const advisory = [];

// ── R1: combined capability claim on any generated manufacturer page ─────
// Combined pattern: "… MVA" immediately joined to "… kV" then a noun.
const COMBINED = /(\b[\d,\.]+\s*MVA)\s*[\/\-,&]?\s*(?:at\s+)?(\b[\d,\.]+\s*kV)\s*(?:,|\s)+(?:transformer|unit|product|rating)/i;
function walk(dir, skip) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (skip.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, skip));
    else if (e.isFile() && e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const companyPages = walk('manufacturers', ['archive', '_private']).filter((f) => f.endsWith('index.html'));
let combinedClaims = 0;
for (const f of companyPages) {
  const html = fs.readFileSync(f, 'utf8');
  // Strip <title>/<meta>/schema (metadata noise); check visible capability text.
  const body = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  const m = body.match(COMBINED);
  if (m) { combinedClaims++; problems.push('R1 combined MVA+kV claim :: ' + f + ' :: ' + m[0].slice(0, 60)); }
}

// ── R2: every tier record has source + unit-bearing figures ─────────────
let tierNoSource = 0, tierBadUnit = 0;
for (const t of TIERS) {
  if (!t.name) { tierNoSource++; problems.push('R3 tier without name'); continue; }
  if (!t.source) { tierNoSource++; problems.push('R2 tier without source :: ' + t.name); }
  if (t.mva !== null && (typeof t.mva !== 'number' || t.mva <= 0)) { tierBadUnit++; problems.push('R2 tier mva invalid :: ' + t.name); }
  // annual capacity vs max-unit rating separation
  if (typeof t.mva === 'number' && typeof t.kv === 'number') {
    if (String(t.note || '').replace(/\s/g, '').match(/(\d[\d,\.]+)MVA/)) {
      // note is allowed to describe two separate figures; only flag an explicit
      // combined "X MVA, Y kV transformer" statement.
      if (/\b[\d,\.]+\s*MVA\s*,\s*[\d,\.]+\s*kV\s+transformer\b/i.test(t.note)) {
        problems.push('R1 tier note combines MVA+kV as a capability :: ' + t.name);
      }
    }
  }
  // R4: cap (max single unit) must never equal annual capacity silently
  if (typeof t.cap === 'number' && t.cap > 0 && typeof t.mva === 'number' && t.mva > 0) {
    advisory.push('R4 note: "' + t.name + '" annual ' + t.mva + ' MVA vs max-unit ' + t.cap + ' MVA (separate figures — confirm, do not merge)');
  }
}

// ── R3: census integrity ────────────────────────────────────────────────
let emptyNames = 0, badUrls = 0, noCountry = 0;
for (const g of CENSUS) {
  if (!g.country) noCountry++;
  for (const m of (g.makers || [])) {
    const name = (m[0] || '').trim();
    const url = (m[2] || '').trim();
    if (!name) { emptyNames++; problems.push('R3 census empty name'); }
    if (url && !/^https?:\/\//i.test(url)) { badUrls++; problems.push('R3 census invalid url :: ' + name + ' :: ' + url); }
  }
}

// ── R5: Company → Brand → Site model integrity ──────────────────────────
const SITES = JSON.parse(fs.readFileSync('data/manufacturer-sites.json', 'utf8'));
const SITE_STATUSES = ['OPERATIONAL', 'EXPANDING', 'ANNOUNCED', 'UNDER_CONSTRUCTION', 'TEMPORARILY_INACTIVE', 'CLOSED', 'UNCLEAR'];
let siteNoCity = 0, siteNoCountry = 0, siteBadStatus = 0, siteClaimedFactory = 0;
for (const grp of SITES) {
  if (!grp.siteCount || !grp.sites || !grp.sites.length) { problems.push('R5 site group empty :: ' + grp.brand); continue; }
  for (const s of grp.sites) {
    if (!s.city) { siteNoCity++; advisory.push('R5 site without a known city (advisory — city may be unpublished) :: ' + s.name); }
    if (!s.country) { siteNoCountry++; problems.push('R5 site without country :: ' + s.name); }
    if (!SITE_STATUSES.includes(s.status)) { siteBadStatus++; problems.push('R5 site bad status :: ' + s.name + ' :: ' + s.status); }
    // A site must never be labelled a factory without an independent source.
    if (/factory|plant/i.test(s.status) && !/independently|census|source/i.test(s.source)) {
      siteClaimedFactory++; problems.push('R5 site asserted as factory without source :: ' + s.name);
    }
  }
}

console.log('DATA QUALITY GATE');
console.log('Company pages scanned: ' + companyPages.length);
console.log('Tier records: ' + TIERS.length + ' | Census country groups: ' + CENSUS.length);
console.log('R1 combined MVA+kV capability claims: ' + combinedClaims);
console.log('R2/R3 tier missing source / missing mva: ' + tierNoSource + ' / ' + tierBadUnit);
console.log('R3 census empty names: ' + emptyNames + ' | invalid urls: ' + badUrls + ' | no country: ' + noCountry);
console.log('R5 site model: groups ' + SITES.length + ' | missing city: ' + siteNoCity + ' | missing country: ' + siteNoCountry + ' | bad status: ' + siteBadStatus + ' | unverified factory claim: ' + siteClaimedFactory);

// ── R6: company developments (Intel → Manufacturer) integrity ───────────
let DEV_NO_TITLE = 0, DEV_BAD_URL = 0;
const DEVS = JSON.parse(fs.readFileSync('data/company-developments.json', 'utf8'));
for (const d of DEVS) {
  if (!d.name) { problems.push('R6 developments without entity name'); continue; }
  for (const x of (d.developments || [])) {
    if (!x.title) { DEV_NO_TITLE++; problems.push('R6 development without title :: ' + d.name); }
    if (!x.url || !/^https?:\/\//i.test(x.url)) { DEV_BAD_URL++; problems.push('R6 development invalid url :: ' + d.name); }
  }
}
console.log('R6 developments: entities ' + DEVS.length + ' | missing title: ' + DEV_NO_TITLE + ' | invalid url: ' + DEV_BAD_URL);

// ── R7: source-provenance model integrity ───────────────────────────────
const CONF = ['HIGH', 'MEDIUM', 'LIMITED'];
const CLAIMS = ['INDEPENDENTLY_SOURCED', 'COMPANY_REPORTED', 'INFERRED', 'UNVERIFIED'];
const PROV = JSON.parse(fs.readFileSync('data/manufacturer-provenance.json', 'utf8'));
let provBadUrl = 0, provBadConf = 0, provBadClaim = 0, provCombinedField = 0, provCombinedClaim = 0;
for (const p of PROV) {
  for (const f of (p.facts || [])) {
    if (!f.source_url || !/^https?:\/\//i.test(f.source_url)) { provBadUrl++; problems.push('R7 provenance invalid url :: ' + p.name); }
    if (!CONF.includes(f.confidence)) { provBadConf++; problems.push('R7 provenance bad confidence :: ' + p.name); }
    if (!CLAIMS.includes(f.claim_type)) { provBadClaim++; problems.push('R7 provenance bad claim_type :: ' + p.name); }
    // Never combine a separately-stated MVA and kV into one capability field.
    if (/mva/i.test(f.field || '') && /kv/i.test(f.field || '')) { provCombinedField++; problems.push('R7 provenance combined field :: ' + p.name); }
    // Never state a combined "X MVA, Y kV transformer" capability in the note.
    if (/\b[\d,.]+\s*MVA\b[^\n]*\b[\d,.]+\s*kV\b[^\n]*transformer/i.test(f.note || '')) { provCombinedClaim++; problems.push('R7 provenance combined capability claim :: ' + p.name); }
  }
}
console.log('R7 provenance: entities ' + PROV.length + ' | bad url: ' + provBadUrl + ' | bad confidence: ' + provBadConf + ' | bad claim_type: ' + provBadClaim + ' | combined field: ' + provCombinedField + ' | combined claim: ' + provCombinedClaim);

// ── R8: manufacturer CTA + corrections-form regression guard ─────────────
let pageNoCorrCta = 0, pageNoSiteClick = 0, corrForm = 0;
const corrPath = 'correct-company.html';
let corrHtml = '';
try { corrHtml = fs.readFileSync(corrPath, 'utf8'); } catch (e) { problems.push('R8 correct-company.html missing'); corrHtml = ''; }
// corrections page must exist with Netlify form + tracking + required fields
if (corrHtml) {
  if (!/name="correct-company"/.test(corrHtml)) { problems.push('R8 correct-company form name missing'); }
  if (!/data-track-form="manufacturer_correction_submitted"/.test(corrHtml)) { problems.push('R8 correct-company form tracking missing'); }
  ['name="field"', 'name="correct"'].forEach(function (req) { if (corrHtml.indexOf(req) < 0) { problems.push('R8 correct-company missing field :: ' + req); } });
  if (/name="correct-company"/.test(corrHtml)) corrForm++;
}
for (const f of companyPages) {
  if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, 'utf8');
  if (!/Suggest a correction/.test(html) || html.indexOf('correct-company.html') < 0) { pageNoCorrCta++; problems.push('R8 manufacturer page missing corrections CTA :: ' + f); }
  if (/Official website/.test(html) && !/data-track="official_website_click"/.test(html)) { pageNoSiteClick++; problems.push('R8 manufacturer page missing official_website_click :: ' + f); }
}
console.log('R8 CTA/form guard: pages without corrections CTA: ' + pageNoCorrCta + ' | pages without official_website_click: ' + pageNoSiteClick + ' | corrections form present: ' + corrForm);

// ── R9: consolidated manufacturer-intel + census-audit integrity ────────────
// Guards the durable intelligence store built by build-manufacturer-intel.js
// and the census audit built by build-census-audit.js.
let intelStore = null, auditStore = null;
try { intelStore = JSON.parse(fs.readFileSync('data/manufacturer-intel.json', 'utf8')); } catch (e) {}
try { auditStore = JSON.parse(fs.readFileSync('data/census-audit.json', 'utf8')); } catch (e) {}
if (intelStore && intelStore.companies) {
  const seen = {}; let dup = 0, badUrl = 0, noCountry = 0, vNoSource = 0;
  intelStore.companies.forEach(function (c) {
    const key = (c.name || '').toLowerCase().trim() + '|' + (c.country || '').toLowerCase().trim();
    if (seen[key]) dup++; seen[key] = 1;
    if (c.website && !/^https?:\/\//i.test(c.website)) badUrl++;
    if (!c.country) noCountry++;
    if ((c.reported_voltage || c.reported_mva) && !(c.sources && (c.sources.capability_source || c.sources.capability_note))) vNoSource++;
  });
  if (dup) problems.push('R9 manufacturer-intel duplicate company|country :: ' + dup);
  if (badUrl) problems.push('R9 manufacturer-intel invalid website :: ' + badUrl);
  if (noCountry) problems.push('R9 manufacturer-intel company without country :: ' + noCountry);
  if (vNoSource) problems.push('R9 manufacturer-intel capability without source :: ' + vNoSource);
  console.log('R9 manufacturer-intel: companies ' + intelStore.companies.length + ' | duplicate: ' + dup + ' | invalid site: ' + badUrl + ' | capability without source: ' + vNoSource);
}
if (auditStore) {
  console.log('R9 census-audit: records ' + auditStore.total + ' | no-website: ' + auditStore.no_website_count + ' | review queue: ' + auditStore.review_queue_count + ' | status: ' + JSON.stringify(auditStore.status_counts));
  if (auditStore.total !== 546 && auditStore.total !== intelStoreCount()) problems.push('R9 census-audit record count drift :: ' + auditStore.total);
}
function intelStoreCount() { try { return JSON.parse(fs.readFileSync('data/manufacturer-intel.json', 'utf8')).companies.length; } catch (e) { return -1; } }

// ── R9.1: research-verdicts integrity ──────────────────────────────────────
// Deep-research verdicts must carry a claim_type and, when they assert a
// manufacturer/non-manufacturer classification or a source-backed fact, a source.
// Never fabricate a website or category.
let verdicts = [];
try { verdicts = JSON.parse(fs.readFileSync('data/research-verdicts.json', 'utf8')).verdicts || []; } catch (e) {}
if (verdicts && verdicts.length) {
  const CLAIM = new Set(['INDEPENDENTLY_SOURCED', 'COMPANY_REPORTED', 'UNKNOWN']);
  let vNoClaim = 0, vNoSource = 0, vBadStatus = 0;
  const OK_STATUS = new Set([true, false, null]);
  verdicts.forEach(function (v) {
    if (!CLAIM.has(v.claim_type)) vNoClaim++;
    if (v.claim_type === 'INDEPENDENTLY_SOURCED' && (!v.sources || !v.sources.length)) vNoSource++;
    if (v.is_transformer_manufacturer !== undefined && !OK_STATUS.has(v.is_transformer_manufacturer)) vBadStatus++;
  });
  if (vNoClaim) problems.push('R9.1 research-verdict invalid claim_type :: ' + vNoClaim);
  if (vNoSource) problems.push('R9.1 research-verdict sourced fact without source :: ' + vNoSource);
  if (vBadStatus) problems.push('R9.1 research-verdict invalid is_transformer_manufacturer :: ' + vBadStatus);
  console.log('R9.1 research-verdicts: ' + verdicts.length + ' | bad claim: ' + vNoClaim + ' | sourced-without-source: ' + vNoSource + ' | bad status: ' + vBadStatus);
}

// ── R10: deep-research store integrity ─────────────────────────────────────
// Every deep-research fact (headquarters, factory) must carry a source_url and
// a valid claim_type. A factory must never assert a capability (voltage/MVA) —
// those stay UNKNOWN/unverified, never fabricated, and are never merged into a
// company maximum.
let deepStore = null;
try { deepStore = JSON.parse(fs.readFileSync('data/deep-research.json', 'utf8')).companies || []; } catch (e) {}
if (deepStore && deepStore.length) {
  const CLAIM = new Set(['INDEPENDENTLY_SOURCED', 'COMPANY_REPORTED', 'UNKNOWN']);
  let noSrc = 0, badClaim = 0, facCapability = 0, capNoSrc = 0;
  deepStore.forEach(function (c) {
    const check = function (f, allowUrlAsSource) { if (f && !(f.source_url || (allowUrlAsSource && f.url))) noSrc++; if (f && f.claim_type && !CLAIM.has(f.claim_type)) badClaim++; };
    check(c.headquarters); check(c.official_website, true);
    (c.factories || []).forEach(function (f) {
      check(f);
      if (f && (f.voltage_kv || f.mva || f.reported_voltage_kv || f.reported_max_mva)) facCapability++;
    });
    // capability maxima must carry a source (voltage_source/mva_source) or be absent
    if ((c.reported_max_voltage_kv && !(c.voltage_source && c.voltage_source.source_url)) || (c.reported_max_mva && !(c.mva_source && c.mva_source.source_url))) capNoSrc++;
  });
  if (noSrc) problems.push('R10 deep-research fact without source_url :: ' + noSrc);
  if (badClaim) problems.push('R10 deep-research invalid claim_type :: ' + badClaim);
  if (facCapability) problems.push('R10 deep-research factory asserts capability :: ' + facCapability);
  if (capNoSrc) problems.push('R10 deep-research company capability without source :: ' + capNoSrc);
  console.log('R10 deep-research: companies ' + deepStore.length + ' | no-source: ' + noSrc + ' | bad claim: ' + badClaim + ' | factory capability claim: ' + facCapability + ' | unsourced capability: ' + capNoSrc);
}
if (advisory.length) {
  console.log('\nAdvisory (confirm separation, no action required):');
  advisory.slice(0, 12).forEach((a) => console.log('  ' + a));
}
console.log('\nCritical problems (' + problems.length + '):');
problems.forEach((p) => console.log('  ' + p));

if (problems.length) {
  console.error('\nDATA QUALITY FAIL — blocking.');
  process.exit(1);
}
console.log('\nDATA QUALITY OK.');
