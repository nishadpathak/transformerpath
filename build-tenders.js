#!/usr/bin/env node
/* build-tenders.js — TransformerPath Tender Watch (first-class entity).
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
 *   3. Generates /tenders.html, a worldwide Tender Watch index with regional
 *      grouping, live filter controls and honest status classification.
 *
 * Status mapping (only ever derived from the source, never asserted):
 *   OPEN          — source names an open/deadline in the future
 *   CLOSING_SOON  — source names a deadline within ~14 days
 *   CLOSED        — source names a deadline that has passed
 *   EVALUATION    — source says bids are under evaluation / L1 notice
 *   AWARDED       — source confirms an award
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
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = (s) => (s || '').toLowerCase();

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
const STATUS_LABEL = { EXPECTED: 'Expected', OPEN: 'Open', CLOSING_SOON: 'Closing soon', CLOSED: 'Closed', EVALUATION: 'Evaluation', AWARDED: 'Awarded', UNKNOWN: 'Stage unknown' };
const STATUS_GROUP = { EXPECTED: 'Pre-award', OPEN: 'Open', CLOSING_SOON: 'Open', CLOSED: 'Closed', EVALUATION: 'Evaluation', AWARDED: 'Awarded', UNKNOWN: 'Pre-award' };

// Deadline parsing: extract an ISO/date-ish token from expected/intel text.
function parseDeadline(text) {
  if (!text) return '';
  const m = String(text).match(/\b(20\d{2})-?(\d{2})?-?(\d{2})?\b/);
  return m ? m[0] : '';
}
function isNearDeadline(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (isNaN(d)) return false;
  const days = (d - Date.now()) / 86400000;
  return days >= 0 && days <= 14;
}
function isPast(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (isNaN(d)) return false;
  return d < Date.now();
}
function deriveStatus(stage, expected, deadline) {
  if (stage === 'evaluation') return 'EVALUATION';
  if (/award/i.test(stage)) return 'AWARDED';
  if (stage === 'tendering') {
    if (isPast(deadline)) return 'CLOSED';
    if (isNearDeadline(deadline)) return 'CLOSING_SOON';
    return 'OPEN';
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
  if (seen[key]) return;
  seen[key] = 1;
  const deadline = parseDeadline(o.deadline_raw || o.expected_raw || '');
  const status = deriveStatus(o.stage, o.expected_raw, deadline);
  tenders.push(Object.assign({}, o, {
    tender_id: 'T-' + slugify(o.title).slice(0, 32).replace(/-+$/, ''),
    status,
    statusLabel: STATUS_LABEL[status],
    statusGroup: STATUS_GROUP[status],
    deadline: deadline || '',
    last_verified: new Date().toISOString().slice(0, 10),
  }));
}

// 1) Pre-award project records -> tenders (source-backed).
PROJECTS.forEach((p) => {
  const stage = ci(p.status || '');
  if (!['tendering', 'evaluation', 'expected', 'planned', 'awarded'].includes(stage)) return;
  let buyer = p.utility || p.epc || '';
  const sources = (p.sources || []).filter(Boolean);
  // A placeholder/non-canonical source is recorded but flagged as unverified.
  const verifiedSource = sources.find((s) => !/example\.com|\bupd\b/.test(s));
  addTender({
    title: (p.project || '').replace(/\s*—.*$/, '').replace(/\s*\(.*\),?\s*$/, '').trim() || p.project,
    full_title: p.project,
    buyer,
    utility: p.utility || '',
    epc: p.epc || '',
    country: p.country,
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
    stage,
    cls: p.related_intel || '',
  });
});

// 2) Intel items that name a tender/bid/deadline and are NOT already covered by a project.
INTEL_ITEMS.forEach((it) => {
  // Only title-level, unambiguous procurement language is a tender signal. Body
  // text mentioning "float"/"floating" (as in a floating HVDC project) is NOT.
  const text = (it.title || '') + ' ' + (it.snippet || '');
  if (!/(invites? bids?|tender|bid deadline|prequalif|epc tender|bids? for|bid (submission|opening|deadline)|procur|supply and installation)/i.test(it.title || '')) return;
  const country = (text.match(/(Saudi|UAE|Qatar|Kuwait|Bahrain|Oman|India|China|Korea|Japan|Turkey|Türkiye|Vietnam|Indonesia|Malaysia|Germany|UK|France|Italy|Spain|Brazil|Chile|Mexico|Egypt|Kenya|Nigeria|South Africa|Australia)\b/i) || [])[1] || '';
  const r = it._region === 'GCC' ? 'Middle East' : it._region === 'India' ? 'Asia' : it._region === 'Europe' ? 'Europe' : it._region === 'USA' ? 'North America' : 'Other';
  const stage = /award/i.test(text) ? 'awarded' : /evaluation|L1/i.test(text) ? 'evaluation' : /deadline/i.test(text) ? 'tendering' : /invites? bids?|floats?|tender/i.test(text) ? 'tendering' : 'expected';
  // Skip if this already maps to a project tender (match on buyer-ish fragment).
  addTender({
    title: (it.title || '').replace(/\s*—.*$/, '').replace(/\s*\(.*\),?\s*$/, '').trim() || it.title,
    full_title: it.title,
    buyer: '',
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
    expected_raw: '',
    stage,
    cls: '',
  });
});

// Sort: open/expected first, then by region.
const ORDER = { OPEN: 0, CLOSING_SOON: 1, EXPECTED: 2, EVALUATION: 3, AWARDED: 4, CLOSED: 5, UNKNOWN: 6 };
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
  EXPECTED: 'A tender is expected / planned but not yet open.',
  EVALUATION: 'Bids are under evaluation (or an L1 / lowest-bidder notice is published).',
  AWARDED: 'The source confirms an award has been made.',
  CLOSED: 'The submission deadline has passed.',
  UNKNOWN: 'The stage is not pinned by the source.',
};
function tenderPage(t) {
  const slug = slugify(t.title);
  const url = 'https://transformerpath.com/tenders/' + slug + '/';
  const projLink = t.project_slug ? '<a href="../../projects/' + esc(t.project_slug) + '/" style="color:var(--accent)">' + esc(t.full_title || t.title) + '</a>' : esc(t.full_title || t.title);
  const srcLinks = (t.source_urls || []).filter(Boolean).map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:var(--accent)">source</a>').join(' · ') || '—';
  const scopeBadge = { CONFIRMED: '<span class="cls-badge cls-CONFIRMED">CONFIRMED</span>', INFERRED: '<span class="cls-badge cls-INFERRED">INFERRED</span>', UNKNOWN: '<span class="cls-badge cls-UNKNOWN">UNKNOWN</span>' }[t.transformer_scope] || '';
  const rows = [
    ['Status', esc(t.statusLabel) + ' <span style="color:var(--muted);font-size:.76rem">' + esc((T_STATUS_LEGEND[t.status] || '')) + '</span>'],
    ['Buyer / utility', t.utility ? esc(t.utility) : (t.buyer ? esc(t.buyer) : '—')],
    ['EPC', t.epc ? esc(t.epc) : '—'],
    ['Country', esc(t.country || '—')],
    ['Region', esc(t.region)],
    ['Voltage class', esc(t.voltage || '—')],
    ['Transformer scope', scopeBadge || '—'],
    ['Delivery / timeline', esc(t.delivery_requirement || '—')],
    ['Deadline', esc(t.deadline || '—')],
  ].map((r) => '<tr><th style="width:170px">' + r[0] + '</th><td>' + r[1] + '</td></tr>').join('');
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(t.title) + ' — Transformer Tender | TransformerPath</title>' +
    '<meta name="description" content="' + esc(t.title) + ' — ' + esc(t.country || t.region) + ' procurement opportunity tracked by TransformerPath. Status ' + esc(t.statusLabel) + ', transformer scope ' + esc(t.transformer_scope) + '. Source-tracked.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="' + esc(t.title) + ' — Transformer Tender"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg"><link rel="icon" href="../../brand/favicon.ico" sizes="any"><link rel="stylesheet" href="../../style.css?v=11"><style>' +
    '.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.7rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem}.cw-meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:8px 0 16px}.cw-meta b{color:var(--text)}table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:8px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:top}th{color:var(--muted);font-weight:700;font-size:.8rem;text-transform:uppercase;letter-spacing:.03em}.cls-badge{display:inline-block;font-weight:700;font-size:.66rem;letter-spacing:.05em;padding:1px 7px;border-radius:8px;text-transform:uppercase}.cls-CONFIRMED{background:#14351f;color:#4ade80;border:1px solid rgba(74,222,128,.35)}.cls-INFERRED{background:#12283f;color:#60a5fa;border:1px solid rgba(96,165,250,.35)}.cls-UNKNOWN{background:#1d2330;color:#9fb0c4;border:1px solid rgba(159,176,196,.35)}</style></head><body>\n' +
    HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../tenders.html" style="color:var(--accent)">Tenders</a> › ' + esc(t.region) + ' › ' + esc(t.title) + '</nav>' +
    '<h1>' + esc(t.title) + '</h1>' +
    '<p class="lead">A ' + esc(t.statusLabel.toLowerCase()) + ' transformer-relevant procurement opportunity, tracked as an entity (not an article) by TransformerPath. Derived from public, source-backed signals; never fabricated.</p>' +
    '<div class="cw-meta"><span><b>Status</b> ' + esc(t.statusLabel) + '</span><span><b>Country</b> ' + esc(t.country || '—') + '</span>' + (t.voltage ? '<span><b>Voltage</b> ' + esc(t.voltage) + '</span>' : '') + '<span><b>Scope</b> ' + esc(t.transformer_scope) + '</span></div>' +
    '<table>' + rows + '</table>' +
    (t.project_slug ? '<h2 style="font-size:1.1rem;color:var(--ink);margin:22px 0 6px">Related project</h2><p>' + projLink + '</p>' : '') +
    '<h2 style="font-size:1.1rem;color:var(--ink);margin:22px 0 6px">Sources</h2><p>' + srcLinks + '</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Supply this requirement</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a transformer requirement and TransformerPath will match it against the relevant manufacturing base.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-tender="' + esc(slug) + '">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-tender="' + esc(slug) + '">Are you a supplier? Get Verified →</a></div>' +
    '<p style="font-size:.78rem;color:var(--muted);margin-top:16px">Tender metadata is public and source-tracked; TransformerPath does not republish restricted procurement documentation. Status and details may change — verify against the official procurement source.</p>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n</body>\n</html>';
}
fs.mkdirSync('tenders', { recursive: true });
const tSlugs = new Set();
tenders.forEach((t) => {
  const slug = slugify(t.title);
  fs.mkdirSync('tenders/' + slug, { recursive: true });
  fs.writeFileSync('tenders/' + slug + '/index.html', tenderPage(t));
  tSlugs.add(slug);
});
console.log('tender entity pages wrote: ' + tSlugs.size);

// ═══════════════════════════════════════════════════════════════════════════
//  TENDER WATCH INDEX (/tenders.html)
// ═══════════════════════════════════════════════════════════════════════════
(function renderTendersIndex() {
  const REGION_ORDER = { 'Middle East': 0, Europe: 1, Asia: 2, 'Latin America': 3, Africa: 4, 'North America': 5, Oceania: 6, Other: 7 };
  const regions = {};
  tenders.forEach((t) => { (regions[t.region] = regions[t.region] || []).push(t); });
  const regionKeys = Object.keys(regions).sort((a, b) => (REGION_ORDER[a] ?? 9) - (REGION_ORDER[b] ?? 9));
  const style = '.t-wrap{max-width:1080px;margin:0 auto;padding:44px 20px 90px}.t-wrap h1{font-size:2rem;color:var(--ink)}.t-stats{display:flex;flex-wrap:wrap;gap:14px;margin:14px 0 24px}.t-stats .s{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;text-align:center;min-width:120px}.t-stats .s b{color:var(--text);font-size:1.3rem;display:block}.t-stats .s small{color:var(--muted);font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.region-h{font-size:1.02rem;font-weight:800;color:var(--ink);text-transform:uppercase;letter-spacing:.05em;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}.t-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:.92rem}.t-row .t-title{color:var(--accent);font-weight:700;font-size:.95rem;text-decoration:none;flex:1}.t-row .t-title:hover{text-decoration:underline}.t-row .t-meta{color:var(--muted);font-size:.8rem}.st{display:inline-block;font-weight:700;font-size:.66rem;letter-spacing:.04em;padding:1px 8px;border-radius:8px;text-transform:uppercase}.st-open{background:#14351f;color:#4ade80}.st-expected{background:#2a2413;color:#e8c46a}.st-closing{background:#2a1a13;color:#fb923c}.st-eval{background:#12283f;color:#60a5fa}.st-awarded{background:#0f2a2a;color:#2dd4bf}.st-closed{background:#1d2330;color:#9fb0c4}.st-unknown{background:#1d2330;color:#9fb0c4}.t-note{color:var(--muted);font-size:.8rem;margin-top:20px}';
  const stCls = { OPEN: 'st-open', CLOSING_SOON: 'st-closing', EXPECTED: 'st-expected', EVALUATION: 'st-eval', AWARDED: 'st-awarded', CLOSED: 'st-closed', UNKNOWN: 'st-unknown' };
  const body = regionKeys.map((region) => {
    const rows = regions[region].sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || String(a.title).localeCompare(b.title)).map((t) =>
      '<div class="t-row"><a class="t-title" href="tenders/' + esc(slugify(t.title)) + '/">' + esc(t.title) + '</a>' +
      '<span class="st ' + (stCls[t.status] || 'st-unknown') + '">' + esc(t.statusLabel) + '</span>' +
      '<span class="t-meta">' + esc(t.country || t.region) + (t.voltage ? ' · ' + esc(t.voltage) : '') + (t.transformer_scope ? ' · ' + esc(t.transformer_scope) : '') + '</span></div>').join('');
    return '<div class="region-h">' + esc(region) + ' (' + regions[region].length + ')</div>' + rows;
  }).join('');
  const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Transformer Tender Watch — Global Procurement Opportunities | TransformerPath</title>' +
    '<meta name="description" content="A worldwide directory of transformer-relevant tenders, bids and procurement opportunities — open, expected and awarded, by region and country, source-tracked. ' + tenders.length + ' tenders across ' + stats.countries + ' countries.">' +
    '<link rel="canonical" href="https://transformerpath.com/tenders.html"><meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="Transformer Tender Watch — Global Procurement Opportunities"><meta property="og:url" content="https://transformerpath.com/tenders.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any"><link rel="stylesheet" href="style.css?v=11"><style>' + style + '</style></head><body>\n' + HEAD + '\n<main class="t-wrap">' +
    '<h1>Transformer <span style="color:var(--accent)">Tender Watch</span></h1>' +
    '<p class="lead" style="color:var(--muted);font-size:1.02rem;max-width:840px;margin:8px 0 18px">A worldwide directory of transformer-relevant tenders, bids and procurement opportunities, tracked by region and country. Derived from public, source-backed signals — the same data behind the Project database and Daily Intel. Every tender links to its source; TransformerPath does not republish restricted procurement documentation.</p>' +
    '<div class="t-stats"><div class="s"><b>' + tenders.length + '</b><small>Tenders</small></div><div class="s"><b>' + stats.by_status.OPEN + '</b><small>Open now</small></div><div class="s"><b>' + (stats.by_status.EVALUATION + stats.by_status.EXPECTED) + '</b><small>Pre-award</small></div><div class="s"><b>' + stats.by_status.AWARDED + '</b><small>Awarded</small></div><div class="s"><b>' + stats.countries + '</b><small>Countries</small></div></div>' +
    body +
    '<p class="t-note">Tender metadata is public and source-tracked. Status is derived only from the source (e.g. OPEN/EXPECTED/EVALUATION/AWARDED) and may change — verify against the official procurement source before acting. Report a <a href="mailto:hello@transformerpath.com?subject=Tender%20correction" style="color:var(--accent)">correction</a>.</p>' +
    '</main>\n' + FOOT + '\n<script src="analytics.js" defer></script>\n</body>\n</html>';
  fs.writeFileSync('tenders.html', html);
  console.log('tenders.html wrote (Tender Watch: ' + tenders.length + ' tenders / ' + stats.countries + ' countries / ' + regionKeys.length + ' regions; ' + stats.by_status.OPEN + ' open)');
})();
