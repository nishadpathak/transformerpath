#!/usr/bin/env node
/* build-tenders.js — Transformer Tenders (first-class entity).
 *
 * Tenders are derived, NOT invented. TransformerPath does not republish
 * restricted tender documentation; it only surfaces PUBLIC metadata and links
 * to the official procurement source. A tender is created only when there is a
 * sourced procurement signal — either a project record in a pre-award stage
 * (tendering / evaluation / expected / planned) or an intel item that names a
 * bid/tender/deadline — and every tender carries its source.
 *
 * This builder:
 *   1. Builds data/tenders.json (first-class, canonical, source-backed).
 *   2. Generates /tenders/<slug>/ entity pages.
 *   3. Merges the curated intake in data/tender-notices.json. The daily Intel
 *      rebuild (functions/daily-rebuild.js, 06:00 UTC) runs this file, so the
 *      merge and the status recompute happen with that once-daily build.
 *   4. Generates /tenders.html. The default view is open bids. Pipeline /
 *      record keeps the regional grouping for everything that is not open.
 *
 * Status mapping (only ever derived from the source, never asserted):
 *   OPEN          — source names an open/deadline in the future
 *   CLOSING_SOON  — source names a deadline within ~14 days
 *   CLOSED        — source names a deadline that has passed
 *   EVALUATION    — source says bids are under evaluation / L1 notice
 *   AWARDED       — source confirms a contract award, with a named awardee
 *   PROCUREMENT_PLAN — source is a procurement plan or tender programme
 *   FRAMEWORK     — source is a framework or collaboration announcement
 *   MOU           — source is a memorandum of understanding
 *   EXPECTED      — source indicates a planned/upcoming tender
 *   UNKNOWN       — source does not pin the stage
 *
 * Honesty: a "vendor list" is never an award; a project is never a tender unless
 * it is at a pre-award stage; a technical capability is never an award. The
 * transformer scope is CONFIRMED / INFERRED / UNKNOWN from the source alone.
 *
 * Run: node build-tenders.js  (after build-projects.js).
 */
'use strict';
const fs = require('fs');
const { isoDateInText, countryFromText, usableSource } = require('./lib/tender-country');
const { parseDeadline, parseCloseInstant, deadlineLabel, classifyOpenDeadline } = require('./lib/deadline');
const { nonAwardKind, awardeeFromTitle } = require('./lib/award-classification');
const { isOfficialProcurementUrl } = require('./lib/tender-sources');
const { dualZoneLabel } = require('./lib/tender-time');
const intake = require('./lib/tender-notices');
const tenderSitemap = require('./lib/tender-sitemap');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
function isoDay(v) {
  if (!v) return null;
  const day = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}
function stampSourceDates(record, it) {
  if (!record || !it) return;
  const published = isoDay(it.publication_date);
  const captured = isoDay(it.captured_at || it.capture_date);
  if (published) record.publication_date = published;
  if (captured) record.captured_at = captured;
}
const ci = (s) => (s || '').toLowerCase();

const priorVerified = {};
try {
  (JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders || []).forEach(function (row) {
    if (row && row.title && row.last_verified) priorVerified[ci(row.title)] = row.last_verified;
  });
} catch (e) {}
const PROJECTS = JSON.parse(fs.readFileSync('data/projects.json', 'utf8')).projects || [];
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const INTEL_ITEMS = Object.keys(INTEL).flatMap((r) => (INTEL[r].items || []).map((it) => Object.assign({ _region: r }, it)));

// Region resolution (mirrors build-projects.js regionOf).
const REGION = {};
try {
  const rm = JSON.parse(fs.readFileSync('data/projects.json', 'utf8')).region_map || {};
  Object.keys(rm).forEach(function (region) { (rm[region] || []).forEach(function (c) { REGION[ci(c)] = region; }); });
} catch (e) {}
function regionOf(c) {
  if (REGION[ci(c)]) return REGION[ci(c)];
  return (/(UAE|Saudi|Oman|Qatar|Kuwait|Bahrain|Dubai|Abu Dhabi|Middle East)/i.test(c) ? 'Middle East' :
    /(India|China|Korea|Japan|Indonesia|Vietnam|Malaysia|Philippines|Thailand|Pakistan|Bangladesh|Asia)/i.test(c) ? 'Asia' :
    /(Germany|UK|France|Italy|Spain|Netherlands|Norway|Sweden|Poland|Austria|Belgium|Denmark|Europe)/i.test(c) ? 'Europe' :
    /(USA|United States|Canada|Mexico|North America)/i.test(c) ? 'North America' :
    /(Brazil|Chile|Argentina|Colombia|Peru|Latin America)/i.test(c) ? 'Latin America' :
    /(South Africa|Egypt|Morocco|Kenya|Nigeria|Africa|Algeria|Angola|Senegal|Tanzania|Zambia)/i.test(c) ? 'Africa' :
    /(Australia|New Zealand|Oceania)/i.test(c) ? 'Oceania' : 'Other');
}

// Status label + filterable bucket.
const STATUS_LABEL = { UNDATED: 'Tendering (deadline not stated)', EXPECTED: 'Expected', OPEN: 'Open', CLOSING_SOON: 'Closing soon', CLOSED: 'Closed', EVALUATION: 'Evaluation', AWARDED: 'Awarded', UNKNOWN: 'Stage unknown', PROCUREMENT_PLAN: 'Procurement plan', FRAMEWORK: 'Framework', MOU: 'MoU' };
const STATUS_GROUP = { UNDATED: 'Pre-award', EXPECTED: 'Pre-award', OPEN: 'Open', CLOSING_SOON: 'Open', CLOSED: 'Closed', EVALUATION: 'Evaluation', AWARDED: 'Awarded', UNKNOWN: 'Pre-award', PROCUREMENT_PLAN: 'Procurement plan', FRAMEWORK: 'Framework', MOU: 'MoU' };

function deriveStatus(stage, expected, deadline) {
  if (stage === 'procurement_plan') return 'PROCUREMENT_PLAN';
  if (stage === 'framework') return 'FRAMEWORK';
  if (stage === 'mou') return 'MOU';
  if (stage === 'evaluation') return 'EVALUATION';
  if (/award/i.test(stage)) return 'AWARDED';
  if (stage === 'tendering') {
    // An offset instant is classified at that clock time. A calendar day with
    // no clock still uses the shared end-of-day rule. A year-only or missing
    // deadline is never shown as open.
    if (parseCloseInstant(deadline)) return classifyOpenDeadline(deadline);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(deadline || ''))) return classifyOpenDeadline(deadline);
    return classifyOpenDeadline(deadline) === 'CLOSED' ? 'CLOSED' : 'UNDATED';
  }
  if (stage === 'expected' || stage === 'planned') return 'EXPECTED';
  return 'UNKNOWN';
}
function trScope(x) {
  if (!x) return 'UNKNOWN';
  const s = String(x).toUpperCase();
  return s === 'CONFIRMED' ? 'CONFIRMED' : s === 'INFERRED' ? 'INFERRED' : 'UNKNOWN';
}

// ── Build tender records (derived, source-backed, deduped). ───────────────
const tenders = [];
const seen = {};
function addTender(o) {
  const key = ci(o.title + '|' + o.buyer + '|' + o.country);
  if (seen[key]) return null;
  seen[key] = 1;
  const closeAt = parseCloseInstant(o.close_at || o.deadline_raw || '');
  const deadline = parseDeadline(closeAt || o.deadline_raw || o.expected_raw || '');
  const status = deriveStatus(o.stage, o.expected_raw, closeAt || deadline);
  const projectCountry = (o.project_country != null && String(o.project_country).trim() !== '')
    ? o.project_country
    : ((o.country != null && String(o.country).trim() !== '') ? o.country : null);
  tenders.push(Object.assign({}, o, {
    tender_id: 'T-' + slugify(o.title).slice(0, 32).replace(/-+$/, ''),
    project_country: projectCountry,
    buyer_country: o.buyer_country != null ? o.buyer_country : null,
    supplier_country: o.supplier_country != null ? o.supplier_country : null,
    source_country: o.source_country != null ? o.source_country : null,
    status,
    statusLabel: STATUS_LABEL[status],
    statusGroup: STATUS_GROUP[status],
    deadline: deadline || '',
    last_verified: o.last_verified || priorVerified[ci(o.title)] || new Date().toISOString().slice(0, 10),
  }));
  if (closeAt) tenders[tenders.length - 1].close_at = closeAt;
  return tenders[tenders.length - 1];
}

// 1) Pre-award project records -> tenders (source-backed).
PROJECTS.forEach((p) => {
  const stage = ci(p.status || '');
  if (!['tendering', 'evaluation', 'expected', 'planned', 'awarded', 'framework', 'procurement_plan', 'mou'].includes(stage)) return;
  let buyer = p.utility || p.epc || '';
  const sources = (p.sources || []).filter(usableSource);
  // A placeholder URL (example.com) is not a source. No auditable URL, no tender.
  if (!sources.length) return;
  const verifiedSource = sources[0];
  addTender({
    title: (p.project || '').replace(/\s*—.*$/, '').replace(/\s*\(.*\),?\s*$/, '').trim() || p.project,
    full_title: p.project,
    buyer,
    utility: p.utility || '',
    epc: p.epc || '',
    country: p.country,
    project_country: (p.project_country != null && String(p.project_country).trim() !== '')
      ? p.project_country
      : ((p.country != null && String(p.country).trim() !== '') ? p.country : null),
    buyer_country: p.buyer_country != null ? p.buyer_country : null,
    supplier_country: p.supplier_country != null ? p.supplier_country : null,
    source_country: p.source_country != null ? p.source_country : null,
    region: regionOf(p.country),
    project_slug: slugify(p.project),
    transformer_scope: trScope(p.transformer_requirement),
    voltage: p.voltage || '',
    quantity: '',
    primary_voltage: '',
    secondary_voltage: '',
    rating: '',
    standard: '',
    delivery_requirement: p.expected || '',
    qualification_requirement: '',
    official_procurement_url: verifiedSource || sources[0] || '',
    source: p.src_label || 'TransformerPath project database',
    source_urls: sources,
    source_verified: !!verifiedSource,
    expected_raw: p.expected || '',
    deadline_raw: p.bid_deadline || '',
    stage,
    cls: p.related_intel || '',
    awardee: p.awardee || '',
    award_basis: p.award_basis || '',
    cross_border_links: Array.isArray(p.cross_border_links) ? p.cross_border_links : [],
  });
});

// 2) Intel items that name a tender/bid/deadline and are NOT already covered by a project.
INTEL_ITEMS.forEach((it) => {
  // Only title-level, unambiguous procurement language is a tender signal. Body
  // text mentioning "float"/"floating" (as in a floating HVDC project) is NOT.
  const text = (it.title || '') + ' ' + (it.snippet || '');
  /* A policy story is not a bid. The record says so explicitly. */
  if (it.tender_watch === false) return;
  const titleHit = /(invites? bids?|tender|bid deadline|prequalif|epc tender|bids? for|bid (submission|opening|deadline)|procur|supply and installation)/i.test(it.title || '');
  /* "seeks …" contract notices (Sadales tīkls) name the deadline in the snippet, not the title. */
  const contractNotice = /contract notice/i.test(it.snippet || '') && /^\d{4}-\d{2}-\d{2}$/.test(String(it.tender_close_date || '').slice(0, 10));
  const awardNotice = /award notice/i.test(it.snippet || '') && /\bawards?\b/i.test(it.title || '');
  if (!titleHit && !contractNotice && !awardNotice) return;
  const country = it.country || countryFromText(text);
  const fallbackRegion = it._region === 'GCC' ? 'Middle East' : it._region === 'India' ? 'Asia' : it._region === 'Europe' ? 'Europe' : it._region === 'USA' ? 'North America' : 'Other';
  const r = country ? regionOf(country) : fallbackRegion;
  const namedDeadline = (it.tender_close_date && String(it.tender_close_date).slice(0, 10)) || isoDateInText(text);
  /* A plan, an invitation to bid, a framework or an MoU is not an award.
     "Awards expected" is not an award. Awarded / wins / won is.
     A completed allocation ("split among N firms") is a result even when
     the headline still contains the word "tender". */
  const announced = nonAwardKind(text, it.title);
  const stage = announced === 'procurement_plan' ? 'procurement_plan'
    : announced === 'framework' ? 'framework'
    : announced === 'mou' ? 'mou'
    : /awards?\s+expected|expected\s+to\s+award/i.test(text) ? 'evaluation'
    : /\b(awarded|wins?|won)\b/i.test(text) ? 'awarded'
    : /\bsplit among\b/i.test(text) ? 'awarded'
    : /evaluation|\bL1\b/i.test(text) ? 'evaluation'
    : /deadline/i.test(text) ? 'tendering'
    : /invites? bids?|floats?|tender/i.test(text) ? 'tendering'
    : 'expected';
  // Skip if this already maps to a project tender (match on buyer-ish fragment).
  addTender({
    title: (it.title || '').replace(/\s*—.*$/, '').replace(/\s*\(.*\),?\s*$/, '').trim() || it.title,
    full_title: it.title,
    buyer: it.buyer || '',
    utility: '',
    epc: '',
    country: country || '',
    region: r,
    project_slug: '',
    transformer_scope: trScope(undefined),
    voltage: '',
    quantity: it.value || '',
    primary_voltage: '',
    secondary_voltage: '',
    rating: '',
    standard: '',
    delivery_requirement: '',
    qualification_requirement: '',
    official_procurement_url: it.url || '',
    source: it.src || 'TransformerPath Daily Intel',
    source_urls: it.url ? [it.url] : [],
    source_verified: true,
    expected_raw: namedDeadline || '',
    deadline_raw: namedDeadline || '',
    stage,
    cls: '',
    awardee: it.awardee || awardeeFromTitle(it.title),
    award_basis: it.snippet || '',
    snippet: it.snippet || '',
  });
  const addedIntel = tenders[tenders.length - 1];
  if (addedIntel && addedIntel.full_title === it.title) stampSourceDates(addedIntel, it);
});

// 3) CONFIRMED / official-portal GCC procurement IDs.
// Republisher mirrors (tenderimpulse, bidsfactory, biddetail, MEED, …) are not
// official portals. The invented id KW-MEWRE-75MVA-RELOC is never promoted.
const INVENTED_PROCUREMENT_IDS = { 'KW-MEWRE-75MVA-RELOC': true };
const byProcurement = {};
tenders.forEach(function (t) {
  if (t.procurement_id) byProcurement[String(t.procurement_id)] = t;
});
let officialAdded = 0;
INTEL_ITEMS.forEach(function (it) {
  const pid = String(it.tender_id || '').trim();
  if (!pid || INVENTED_PROCUREMENT_IDS[pid]) return;
  const classes = it.classifications || [];
  const tenderClass = classes.indexOf('TENDER') >= 0;
  if (!tenderClass) return;
  if (!isOfficialProcurementUrl(it.url)) return;
  if (byProcurement[pid]) return;
  const country = (it.buyer && /DEWA|Dubai/i.test(it.buyer)) ? 'United Arab Emirates'
    : /Saudi/i.test(it.buyer || it.title || '') ? 'Saudi Arabia'
    : /Bahrain|EWA/i.test(it.buyer || it.title || '') ? 'Bahrain'
    : /Kuwait|MEWRE/i.test(it.buyer || it.title || '') ? 'Kuwait'
    : /Oman/i.test(it.buyer || it.title || '') ? 'Oman' : '';
  const events = [];
  if (it.tender_float_date) events.push({ type: 'floated', date: String(it.tender_float_date).slice(0, 10), source_url: it.url });
  if (it.publication_date && it.publication_date !== it.tender_float_date) {
    events.push({ type: 'published', date: String(it.publication_date).slice(0, 10), source_url: it.url });
  }
  if (it.tender_close_date) events.push({ type: 'submission_deadline', date: String(it.tender_close_date).slice(0, 10), source_url: it.url });
  const close = it.tender_close_date ? String(it.tender_close_date).slice(0, 10) : '';
  addTender({
    title: it.title,
    full_title: it.title,
    buyer: it.buyer || '',
    utility: it.buyer || '',
    epc: '',
    country: country,
    region: 'Middle East',
    project_slug: '',
    transformer_scope: (classes.indexOf('TRANSFORMER_REPLACEMENT') >= 0 || /transformer/i.test((it.title || '') + ' ' + (it.snippet || ''))) ? 'CONFIRMED' : 'UNKNOWN',
    voltage: '',
    quantity: it.value || '',
    primary_voltage: '',
    secondary_voltage: '',
    rating: '',
    standard: '',
    delivery_requirement: '',
    qualification_requirement: '',
    official_procurement_url: it.url || '',
    source: it.src || 'official procurement portal',
    source_urls: it.url ? [it.url] : [],
    source_verified: true,
    expected_raw: close,
    deadline_raw: close,
    stage: 'tendering',
    cls: it.cls || '',
    procurement_id: pid,
    status_events: events
  });
  const added = tenders[tenders.length - 1];
  if (added && added.procurement_id === pid) {
    stampSourceDates(added, it);
    byProcurement[pid] = added;
    officialAdded++;
  }
});
console.log('official-portal procurement IDs added: ' + officialAdded);

const intakeReport = intake.mergeInto(tenders, {
  notices: intake.load('data/tender-notices.json'),
  addTender: addTender,
  regionOf: regionOf
});
console.log('tender intake added ' + intakeReport.added.length + ', merged ' + intakeReport.merged.length + ', skipped ' + intakeReport.skipped.length);
intakeReport.skipped.forEach(function (row) { console.log('  skipped ' + row.reference + ' (' + row.reason + ')'); });
tenders.forEach(function (row) {
  intake.finalizeRecord(row, {
    parseDeadline: parseDeadline,
    deriveStatus: deriveStatus,
    STATUS_LABEL: STATUS_LABEL,
    STATUS_GROUP: STATUS_GROUP
  });
});

// Sort: open/expected first, then by region.
const ORDER = { OPEN: 0, CLOSING_SOON: 1, UNDATED: 2, EXPECTED: 2, EVALUATION: 3, PROCUREMENT_PLAN: 4, FRAMEWORK: 5, MOU: 6, AWARDED: 7, CLOSED: 8, UNKNOWN: 9 };
tenders.sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || String(a.country).localeCompare(b.country));

const stats = {
  generated_at: new Date().toISOString(),
  total: tenders.length,
  by_status: tenders.reduce((m, t) => { m[t.status] = (m[t.status] || 0) + 1; return m; }, {}),
  by_region: tenders.reduce((m, t) => { m[t.region] = (m[t.region] || 0) + 1; return m; }, {}),
  countries: new Set(tenders.map((t) => t.country).filter(Boolean)).size,
  confirmed_scope: tenders.filter((t) => t.transformer_scope === 'CONFIRMED').length,
  by_pipeline_of_projects: PROJECTS.filter((p) => ['tendering', 'evaluation', 'expected'].includes(ci(p.status || ''))).length,
  source_verified: tenders.filter((t) => t.source_verified).length,
};
fs.writeFileSync('data/tenders.json', JSON.stringify({ schema: 'https://transformerpath.com/tenders.schema.json', $comment: 'First-class tenders. Derived from source-backed project/intel data; never fabricated. Public metadata + official links only.', updated: stats.generated_at.slice(0, 10), stats, tenders }, null, 2));
console.log('tenders.json wrote ' + tenders.length + ' tenders (' + stats.by_status.OPEN + ' open, ' + stats.by_status.EVALUATION + ' evaluation, ' + stats.by_status.AWARDED + ' awarded) / ' + stats.countries + ' countries / ' + Object.keys(stats.by_region).length + ' regions; ' + stats.source_verified + ' source-verified');

// ═══════════════════════════════════════════════════════════════════════════
//  TENDER ENTITY PAGES (/tenders/<slug>/)
// ═══════════════════════════════════════════════════════════════════════════
const T_STATUS_LEGEND = {
  OPEN: 'The official sourcing event is open for submissions.',
  CLOSING_SOON: 'The submission deadline is within the next two weeks.',
  UNDATED: 'A tender was reported, but the source names no exact closing date, so it is not shown as open. Check the official source.',
  EXPECTED: 'A tender is expected / planned but not yet open.',
  EVALUATION: 'Bids are under evaluation (or an L1 / lowest-bidder notice is published).',
  AWARDED: 'The source confirms an award has been made.',
  PROCUREMENT_PLAN: 'The source describes a procurement plan or tender programme, not a contract award.',
  FRAMEWORK: 'The source describes a framework or collaboration announcement, not a contract award of the works.',
  MOU: 'The source describes a memorandum of understanding, not a contract award.',
  CLOSED: 'The submission deadline has passed.',
  UNKNOWN: 'The stage is not pinned by the source.',
};
const CATEGORY_LABEL = { supply: 'Supply', testing_equipment: 'Testing equipment', service: 'Service' };
function closeLabel(t) {
  if (t.close_at) return dualZoneLabel(t.close_at, t.portal_timezone);
  return deadlineLabel(t.deadline) || '';
}
function jsonLdScript(node) {
  return '<script type="application/ld+json">' + JSON.stringify(node).replace(/</g, '\\u003c') + '</script>';
}
function webpageNode(t, url) {
  const node = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url + '#webpage',
    url: url,
    name: t.title,
    isPartOf: 'https://transformerpath.com/tenders.html'
  };
  if (t.summary) node.description = t.summary;
  if (isOfficialProcurementUrl(t.official_procurement_url)) node.significantLink = t.official_procurement_url;
  return node;
}
function tenderPage(t) {
  const slug = slugify(t.title);
  const url = 'https://transformerpath.com/tenders/' + slug + '/';
  const closed = t.status === 'CLOSED';
  const projLink = t.project_slug ? '<a href="../../projects/' + esc(t.project_slug) + '/" style="color:var(--accent)">' + esc(t.full_title || t.title) + '</a>' : esc(t.full_title || t.title);
  const linkText = esc(t.source || 'Official notice');
  const srcLinks = (t.source_urls || []).filter(Boolean).map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + linkText + '</a>').join(' · ') || '—';
  const scopeBadge = { CONFIRMED: '<span class="cls-badge cls-CONFIRMED">CONFIRMED</span>', INFERRED: '<span class="cls-badge cls-INFERRED">INFERRED</span>', UNKNOWN: '<span class="cls-badge cls-UNKNOWN">UNKNOWN</span>' }[t.transformer_scope] || '';
  const statusNote = (T_STATUS_LEGEND[t.status] || '') + (t.open_withheld ? ' This record is not shown as open because the linked source is not a verified official procurement portal.' : '');
  const rows = [
    ['Status', esc(t.statusLabel) + ' <span style="color:var(--muted);font-size:.76rem">' + esc(statusNote) + '</span>'],
    ['Buyer / utility', t.utility ? esc(t.utility) : (t.buyer ? esc(t.buyer) : '—')],
    ['EPC', t.epc ? esc(t.epc) : '—'],
    ['Country', esc(t.country || '—')],
    ['Region', esc(t.region)],
    ['Category', esc(CATEGORY_LABEL[t.category] || '—')],
    ['Reference', esc(t.official_reference || t.procurement_id || '—')],
    ['Voltage class', esc(t.voltage || '—')],
    ['Transformer scope', scopeBadge || '—'],
    ['Delivery / timeline', esc(t.delivery_requirement || '—')],
    ['Close', esc(closeLabel(t) || '—')],
  ].map((r) => '<tr><th style="width:170px">' + r[0] + '</th><td>' + r[1] + '</td></tr>').join('');
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(t.title) + ' — Transformer Tender | TransformerPath</title>' +
    '<meta name="description" content="' + esc(t.title) + ' — ' + esc(t.country || t.region) + ' procurement opportunity tracked by TransformerPath. Status ' + esc(t.statusLabel) + ', transformer scope ' + esc(t.transformer_scope) + '. Source-tracked.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="' + esc(t.title) + ' — Transformer Tender"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="' + (closed ? 'noindex,follow' : 'index,follow') + '"><meta name="theme-color" content="#0d1b2e">' +
    jsonLdScript(webpageNode(t, url)) +
    '<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg"><link rel="icon" href="../../brand/favicon.ico" sizes="any"><link rel="stylesheet" href="../../style.css?v=13"><style>' +
    '.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.7rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem}.cw-meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:8px 0 16px}.cw-meta b{color:var(--text)}table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:8px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:top}th{color:var(--muted);font-weight:700;font-size:.8rem;text-transform:uppercase;letter-spacing:.03em}.cls-badge{display:inline-block;font-weight:700;font-size:.66rem;letter-spacing:.05em;padding:1px 7px;border-radius:8px;text-transform:uppercase}.cls-CONFIRMED{background:#14351f;color:#4ade80;border:1px solid rgba(74,222,128,.35)}.cls-INFERRED{background:#12283f;color:#60a5fa;border:1px solid rgba(96,165,250,.35)}.cls-UNKNOWN{background:#1d2330;color:#9fb0c4;border:1px solid rgba(159,176,196,.35)}.closed-banner{background:#2a1a13;color:#fb923c;border:1px solid rgba(251,146,60,.45);border-radius:10px;padding:10px 14px;font-weight:700;margin:0 0 14px}</style><link rel="stylesheet" href="../../tp-nav.css?v=14">\n</head><body>\n' +
    HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../tenders.html" style="color:var(--accent)">Transformer Tenders</a> › ' + esc(t.region) + ' › ' + esc(t.title) + '</nav>' +
    (closed ? '<p class="closed-banner" role="status">Closed. The submission deadline has passed.</p>' : '') +
    '<h1>' + esc(t.title) + ' <button class="follow-btn" data-follow-type="tender" data-follow-subject="' + esc(t.title) + '" data-follow-label="' + esc(t.title) + '" title="Follow this tender in My TransformerPath">Follow</button></h1>' +
    '<p class="lead">' + (t.summary ? esc(t.summary) : ('A ' + esc(t.statusLabel.toLowerCase()) + ' transformer-relevant procurement opportunity, tracked as an entity (not an article) by TransformerPath. Derived from public, source-backed signals; never fabricated.')) + '</p>' +
    '<div class="cw-meta"><span><b>Status</b> ' + esc(t.statusLabel) + '</span><span><b>Country</b> ' + esc(t.country || '—') + '</span>' + (t.voltage ? '<span><b>Voltage</b> ' + esc(t.voltage) + '</span>' : '') + '<span><b>Scope</b> ' + esc(t.transformer_scope) + '</span></div>' +
    '<table>' + rows + '</table>' +
    (t.project_slug ? '<h2 style="font-size:1.1rem;color:var(--ink);margin:22px 0 6px">Related project</h2><p>' + projLink + '</p>' : '') +
    '<h2 style="font-size:1.1rem;color:var(--ink);margin:22px 0 6px">Official source</h2><p>' + srcLinks + '</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Supply this requirement</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a transformer requirement and TransformerPath will match it against the relevant manufacturing base.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-tender="' + esc(slug) + '">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-tender="' + esc(slug) + '">Are you a supplier? Get Verified →</a></div>' +
    '<p style="font-size:.78rem;color:var(--muted);margin-top:16px">Tender metadata is public and source-tracked; TransformerPath does not republish restricted procurement documentation. Status and details may change — verify against the official procurement source.</p>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n<script src="../../follow-button.js" defer></script>\n</body>\n</html>';
}
fs.mkdirSync('tenders', { recursive: true });
const tSlugs = new Set();
tenders.forEach((t) => {
  const slug = slugify(t.title);
  fs.mkdirSync('tenders/' + slug, { recursive: true });
  fs.writeFileSync('tenders/' + slug + '/index.html', tenderPage(t));
  tSlugs.add(slug);
});
fs.readdirSync('tenders', { withFileTypes: true }).forEach(function (e) {
  if (e.isDirectory() && e.name !== 'country' && !tSlugs.has(e.name)) fs.rmSync('tenders/' + e.name, { recursive: true, force: true });
});
console.log('tender entity pages wrote: ' + tSlugs.size);
const sitemapDates = require('./lib/sitemap-dates');
const sitemapAdded = tenderSitemap.sync('sitemap.xml', tenders.map(function (row) {
  return tenderSitemap.entryFor(row, slugify, sitemapDates.tenderSourceDay);
}));
console.log('tender sitemap entries added: ' + sitemapAdded);

// ═══════════════════════════════════════════════════════════════════════════
//  TRANSFORMER TENDERS INDEX (/tenders.html)
// ═══════════════════════════════════════════════════════════════════════════
(function renderTendersIndex() {
  const dataAsOf = require('./lib/data-as-of');
  let updated = '';
  try { updated = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8')).updated; } catch (e) { updated = ''; }
  const REGION_ORDER = { 'Middle East': 0, Europe: 1, Asia: 2, 'Latin America': 3, Africa: 4, 'North America': 5, Oceania: 6, Other: 7 };
  const PIPELINE = { EXPECTED: 1, EVALUATION: 1, AWARDED: 1, UNDATED: 1, PROCUREMENT_PLAN: 1, FRAMEWORK: 1, MOU: 1, UNKNOWN: 1 };
  function closeMs(t) {
    if (t.close_at) {
      const ms = Date.parse(t.close_at);
      if (!Number.isNaN(ms)) return ms;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(t.deadline || '')) {
      return Date.UTC(Number(t.deadline.slice(0, 4)), Number(t.deadline.slice(5, 7)) - 1, Number(t.deadline.slice(8, 10)), 23, 59, 59, 999);
    }
    return Number.MAX_SAFE_INTEGER;
  }
  const openRows = tenders.filter(function (t) { return t.status === 'OPEN' || t.status === 'CLOSING_SOON'; })
    .sort(function (a, b) { return closeMs(a) - closeMs(b) || String(a.title).localeCompare(b.title); });
  const pipelineRows = tenders.filter(function (t) { return PIPELINE[t.status]; });
  const regions = {};
  pipelineRows.forEach(function (t) { (regions[t.region] = regions[t.region] || []).push(t); });
  const regionKeys = Object.keys(regions).sort(function (a, b) { return (REGION_ORDER[a] ?? 9) - (REGION_ORDER[b] ?? 9); });
  const countries = {};
  tenders.forEach(function (t) { if (t.status !== 'CLOSED' && t.country) countries[t.country] = 1; });
  const countryOptions = Object.keys(countries).sort().map(function (name) {
    return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
  }).join('');
  const style = '.t-wrap{max-width:1080px;margin:0 auto;padding:44px 20px 90px}.t-wrap h1{font-size:2rem;color:var(--ink)}.t-disclaimer{color:var(--muted);font-size:.92rem;max-width:840px;margin:8px 0 4px}.t-stats{display:flex;flex-wrap:wrap;gap:14px;margin:14px 0 24px}.t-stats .s{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;text-align:center;min-width:120px}.t-stats .s b{color:var(--text);font-size:1.3rem;display:block}.t-stats .s small{color:var(--muted);font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.t-views{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.view-tab{font:inherit;font-weight:800;font-size:.95rem;padding:10px 16px;border-radius:999px;border:2px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}.view-tab[aria-pressed="true"]{border-color:var(--accent);background:var(--accent);color:#1a1203}.region-h{font-size:1.02rem;font-weight:800;color:var(--ink);text-transform:uppercase;letter-spacing:.05em;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}.t-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:.92rem}.t-row .t-title{color:var(--accent);font-weight:700;font-size:.95rem;text-decoration:none;flex:1}.t-row .t-title:hover{text-decoration:underline}.t-row .t-meta{color:var(--muted);font-size:.8rem}.st{display:inline-block;font-weight:700;font-size:.66rem;letter-spacing:.04em;padding:1px 8px;border-radius:8px;text-transform:uppercase}.st-open{background:#14351f;color:#4ade80}.st-expected{background:#2a2413;color:#e8c46a}.st-closing{background:#2a1a13;color:#fb923c}.st-eval{background:#12283f;color:#60a5fa}.st-awarded{background:#0f2a2a;color:#2dd4bf}.st-closed{background:#1d2330;color:#9fb0c4}.st-unknown{background:#1d2330;color:#9fb0c4}.t-note{color:var(--muted);font-size:.8rem;margin-top:20px}.t-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:0 0 18px}.t-filters label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;color:var(--muted);font-weight:700}.t-filters select,.t-filters input{font:inherit;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px 10px;min-width:160px}.scope-filter{font:inherit;font-weight:800;font-size:.95rem;padding:10px 16px;border-radius:999px;border:2px solid #4ade80;background:#14351f;color:#4ade80;cursor:pointer}.scope-filter[aria-pressed="true"]{background:#4ade80;color:#05210f}.scope-badge{display:inline-block;font-weight:800;font-size:.66rem;letter-spacing:.03em;padding:2px 8px;border-radius:8px;background:#14351f;color:#4ade80;border:1px solid rgba(74,222,128,.45)}';
  const stCls = { OPEN: 'st-open', CLOSING_SOON: 'st-closing', UNDATED: 'st-expected', EXPECTED: 'st-expected', EVALUATION: 'st-eval', AWARDED: 'st-awarded', CLOSED: 'st-closed', UNKNOWN: 'st-unknown', PROCUREMENT_PLAN: 'st-expected', FRAMEWORK: 'st-expected', MOU: 'st-expected' };
  function rowHtml(t) {
    const confirmed = t.transformer_scope === 'CONFIRMED';
    const ref = t.official_reference || t.procurement_id || '';
    const bits = [t.country || 'Country not stated'];
    if (CATEGORY_LABEL[t.category]) bits.push(CATEGORY_LABEL[t.category]);
    if (ref) bits.push(ref);
    if (t.voltage) bits.push(t.voltage);
    const when = closeLabel(t);
    if (when) bits.push(when);
    return '<div class="t-row" data-scope="' + esc(t.transformer_scope || '') + '" data-category="' + esc(t.category || '') + '" data-country="' + esc(t.country || '') + '" data-title="' + esc(t.title || '') + '" data-buyer="' + esc(t.buyer || t.utility || '') + '" data-ref="' + esc(ref) + '"><a class="t-title" href="tenders/' + esc(slugify(t.title)) + '/">' + esc(t.title) + '</a>' +
      '<span class="st ' + (stCls[t.status] || 'st-unknown') + '">' + esc(t.statusLabel) + '</span>' +
      (confirmed ? '<span class="scope-badge">Confirmed transformer scope</span>' : '') +
      '<span class="t-meta">' + esc(bits.join(' · ')) + '</span></div>';
  }
  const openBody = openRows.map(rowHtml).join('');
  const pipelineBody = regionKeys.map(function (region) {
    const rows = regions[region].sort(function (a, b) { return (ORDER[a.status] - ORDER[b.status]) || String(a.title).localeCompare(b.title); }).map(rowHtml).join('');
    return '<div class="region-h">' + esc(region) + ' (' + regions[region].length + ')</div>' + rows;
  }).join('');
  const listNode = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': 'https://transformerpath.com/tenders.html#open-bids',
    name: 'Open transformer tenders',
    numberOfItems: openRows.length,
    itemListElement: openRows.map(function (t, i) {
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: t.title,
        url: 'https://transformerpath.com/tenders/' + slugify(t.title) + '/'
      };
    })
  };
  const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Transformer Tenders — open bids | TransformerPath</title>' +
    '<meta name="description" content="Open transformer bids sorted by close time, each with an official notice link and the close shown in the portal zone and Asia/Dubai. The pipeline view holds expected, evaluation, awarded and undated records.">' +
    '<link rel="canonical" href="https://transformerpath.com/tenders.html"><meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="Transformer Tenders — open bids"><meta property="og:url" content="https://transformerpath.com/tenders.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    jsonLdScript(listNode) +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any"><link rel="stylesheet" href="style.css?v=13"><style>' + style + '</style><link rel="stylesheet" href="tp-nav.css?v=14">\n</head><body>\n' + HEAD + '\n<main class="t-wrap">' +
    '<h1>Transformer <span style="color:var(--accent)">Tenders</span></h1>' +
    '<p class="t-disclaimer">Open bids list public metadata and a verified official notice link. TransformerPath does not host bid documents.</p>' +
    dataAsOf.html(updated) +
    '<p class="lead" style="color:var(--muted);font-size:1.02rem;max-width:840px;margin:8px 0 18px">Open bids are sorted by close time. Pipeline / record keeps expected, evaluation, awarded and undated rows in regional groups. <a href="/tenders/countries.html" style="color:var(--accent)">Country tender pages</a> list each country’s records.</p>' +
    '<div class="t-stats"><div class="s"><b data-stat="tenders">' + tenders.length + '</b><small>Tenders</small></div><div class="s"><b data-stat="openTenders">' + openRows.length + '</b><small>Open now</small></div><div class="s"><b data-stat="tendersPreAward">' + ((stats.by_status.EVALUATION || 0) + (stats.by_status.EXPECTED || 0) + (stats.by_status.UNDATED || 0)) + '</b><small>Pre-award</small></div><div class="s"><b data-stat="tendersAwarded">' + (stats.by_status.AWARDED || 0) + '</b><small>Awarded</small></div><div class="s"><b data-stat="tendersCountries">' + stats.countries + '</b><small>Countries</small></div></div>' +
    '<div class="t-views" role="tablist"><button type="button" id="viewOpen" class="view-tab" aria-pressed="true" aria-controls="openView">Open bids</button><button type="button" id="viewPipeline" class="view-tab" aria-pressed="false" aria-controls="pipelineView">Pipeline / record</button></div>' +
    '<div class="t-filters"><label>Category <select id="categoryFilter"><option value="">All categories</option><option value="supply">Supply</option><option value="testing_equipment">Testing equipment</option><option value="service">Service</option></select></label>' +
    '<label>Country <select id="countryFilter"><option value="">All countries</option>' + countryOptions + '</select></label>' +
    '<label>Keyword <input id="keywordFilter" type="search" placeholder="Title, buyer or reference" autocomplete="off"></label>' +
    '<button type="button" id="scopeFilter" class="scope-filter" aria-pressed="false">Confirmed transformer scope</button></div>' +
    '<div id="openView">' + (openBody || '') + '<p id="openEmpty" hidden>No open bids match these filters.</p></div>' +
    '<div id="pipelineView" hidden>' + pipelineBody + '</div>' +
    '<p class="t-note">Status is recomputed when the page is built. A past close leaves the Open bids view. Verify the official notice before acting. Report a <a href="mailto:hello@transformerpath.com?subject=Tender%20correction" style="color:var(--accent)">correction</a>.</p>' +
    '</main>\n' + FOOT + '\n<script src="site-stats.js?v=9" defer></script>\n<script src="analytics.js" defer></script>\n<script>(function(){var openBtn=document.getElementById("viewOpen"),pipeBtn=document.getElementById("viewPipeline"),openView=document.getElementById("openView"),pipeView=document.getElementById("pipelineView"),scope=document.getElementById("scopeFilter"),category=document.getElementById("categoryFilter"),country=document.getElementById("countryFilter"),keyword=document.getElementById("keywordFilter");function viewName(){return pipeBtn.getAttribute("aria-pressed")==="true"?"pipeline":"open";}function apply(){var name=viewName();var root=name==="pipeline"?pipeView:openView;var on=scope.getAttribute("aria-pressed")==="true";var cat=category.value;var cty=country.value;var q=(keyword.value||"").toLowerCase().trim();root.querySelectorAll(".t-row").forEach(function(el){var hay=((el.getAttribute("data-title")||"")+" "+(el.getAttribute("data-buyer")||"")+" "+(el.getAttribute("data-ref")||"")).toLowerCase();var show=(!on||el.getAttribute("data-scope")==="CONFIRMED")&&(!cat||el.getAttribute("data-category")===cat)&&(!cty||el.getAttribute("data-country")===cty)&&(!q||hay.indexOf(q)!==-1);el.style.display=show?"":"none";});root.querySelectorAll(".region-h").forEach(function(h){var el=h.nextElementSibling,any=false;while(el&&!el.classList.contains("region-h")){if(el.classList.contains("t-row")&&el.style.display!=="none")any=true;el=el.nextElementSibling;}h.style.display=any?"":"none";});var empty=document.getElementById("openEmpty");if(empty){var visible=0;openView.querySelectorAll(".t-row").forEach(function(el){if(el.style.display!=="none")visible++;});empty.hidden=name!=="open"||visible>0;}}function showView(name){var pipe=name==="pipeline";openBtn.setAttribute("aria-pressed",pipe?"false":"true");pipeBtn.setAttribute("aria-pressed",pipe?"true":"false");if(pipe){pipeView.removeAttribute("hidden");openView.setAttribute("hidden","");}else{openView.removeAttribute("hidden");pipeView.setAttribute("hidden","");}apply();}openBtn.addEventListener("click",function(){showView("open");});pipeBtn.addEventListener("click",function(){showView("pipeline");});scope.addEventListener("click",function(){scope.setAttribute("aria-pressed",scope.getAttribute("aria-pressed")==="true"?"false":"true");apply();});category.addEventListener("change",apply);country.addEventListener("change",apply);keyword.addEventListener("input",apply);if(/[?&]scope=confirmed(?:&|$)/.test(location.search))scope.setAttribute("aria-pressed","true");if(/[?&]view=pipeline(?:&|$)/.test(location.search))showView("pipeline");else apply();})();</script>\n</body>\n</html>';
  fs.writeFileSync('tenders.html', html);
  console.log('tenders.html wrote (Transformer Tenders: ' + tenders.length + ' tenders / ' + openRows.length + ' open / ' + pipelineRows.length + ' pipeline / ' + regionKeys.length + ' pipeline regions)');
})();
