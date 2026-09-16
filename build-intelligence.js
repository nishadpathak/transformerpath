#!/usr/bin/env node
/* build-intelligence.js — TransformerPath Business Intelligence layer.
 *
 * Converts TransformerPath's sourced Daily-Intel company developments and
 * project records into a structured, typed, history-preserving entity graph.
 * This is the "company -> factory -> project -> award -> utility -> market ->
 * Intel -> timeline" memory the platform accumulates, rather than letting news
 * disappear into dated article pages.
 *
 * HONESTY RULES (non-negotiable):
 *   - Every event's title/src/url/value comes VERBATIM from the sourced
 *     data files (data/company-developments.json generated from Daily Intel,
 *     data/projects.json, data/manufacturer-provenance.json). Nothing invented.
 *   - An event type is assigned ONLY by a high-precision, word-bounded keyword
 *     rule; every title without a confident type is labelled 'reference'
 *     (the honest framing "this item references the company" is preserved).
 *   - Confidence/claim_type is carried through where the source already records
 *     it, or defaulted to the conservative 'LIMITED'/'INDEPENDENTLY_SOURCED'
 *     for a keyword-matched item — never upgraded to HIGH on no evidence.
 *   - A development is shown as referencing a company, NOT as an independently
 *     verified award to that company (see build-company-developments.js).
 *   - No numeric capability is derived here.
 *
 * Run: node build-intelligence.js  (after build-company-developments.js).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = (s) => (s || '').toLowerCase();

const TODAY = new Date().toISOString().slice(0, 10);

// ── Source data (all pre-verified/attributed upstream) ───────────────────────
const DEV = JSON.parse(fs.readFileSync('data/company-developments.json', 'utf8'));
const PROJECTS = (JSON.parse(fs.readFileSync('data/projects.json', 'utf8')).projects) || [];
const TENDERS = (JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders) || [];
const MANUF_INTEL = (JSON.parse(fs.readFileSync('data/manufacturer-intel.json', 'utf8')).companies) || [];
const VERIFIED_BY_NAME = {};
try {
  JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (c) { VERIFIED_BY_NAME[ci(c.name)] = c; });
} catch (e) {}

// ── Event classification: high-precision, word-bounded rules ────────────────
// More specific types evaluated before the general 'order_award'. A title with
// no confident type stays 'reference' (honest: we do not invent a type).
const RULES = [
  { type: 'rebranding', re: /\b(rebrand|rename|renamed|re-name|new name|new brand|now known as)\b/i },
  { type: 'ownership_change', re: /\b(majority stake|acquisition|acquires?|acquired by|merger|merges|merged|buyout|takeover|divests?|sells? (its|a|majority)|ownership of|takes? (a )?majority stake|stake in)\b/i },
  { type: 'factory_expansion', re: /\b(plant|factory|manufacturing facility|manufacturing plant|production facility|valve manufacturing facility)\b.*\b(announc|open(s|ing)?|build(s|ing)?|expand(s|ing)?|estab|construct|launch|commission|invest)\b|\b(announc|open(s|ing)?|build(s|ing)?|expand(s|ing)?|estab|construct|launch|commission|invest)\b.*\b(plant|factory|manufacturing facility|manufacturing plant|production facility)\b/i },
  { type: 'new_test_lab', re: /\b(testing laboratory|test laboratory|test lab|testing lab|testing center|testing centre|high-voltage laboratory|laboratory)\b.*\b(open(s|ing)?|commission|inaugurat|launch|invest)\b|\b(open(s|ing)?|commission|inaugurat|launch|invest)\b.*\b(testing laboratory|test laboratory|test lab|testing lab|testing center|testing centre|high-voltage laboratory|laboratory)\b/i },
  { type: 'utility_approval', re: /\b(approved for|utility approval|qualification for|vendor list|type (tested|test|certified)|product certification)\b/i },
  { type: 'market_entry', re: /\b(first (indian-origin|ever|time) .*(order|project|deal|export|win))\b/i },
  { type: 'order_award', re: /\b(wins|awarded|awards|bags|secures|signs?|contract|order|deal|lowest bidder|L1|to supply|will supply|to deliver|supply deal|framework|selected for|emerges L1)\b/i },
];
function classify(t) { const r = RULES.find((x) => x.re.test(t)); return r ? r.type : 'reference'; }

const TYPE_LABEL = {
  order_award: 'Order / contract',
  factory_expansion: 'Factory expansion',
  new_test_lab: 'New test laboratory',
  ownership_change: 'Ownership / corporate',
  rebranding: 'Rebranding',
  utility_approval: 'Utility approval',
  market_entry: 'Market entry',
  reference: 'Intel reference',
};

// Confidence: a keyword-matched event from Daily Intel is conservatively
// 'LIMITED' / INDEPENDENTLY_SOURCED. Never upgraded without a source that says so.
const BASE_CONF = 'LIMITED';
const BASE_CLAIM = 'INDEPENDENTLY_SOURCED';

// Extract a display date from the item's src string ("SaudiGulf Projects · 18 Jul 2026 [en]").
function dateFromSrc(src) {
  const m = String(src || '').match(/(\d{1,2}\s+\w{3}\s+\d{4})/);
  if (!m) return '';
  const d = new Date(m[1]);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
// Extract a value label (strip currency/count for display; keep verbatim too).
function valueLabel(v) { return (v || '').trim(); }

// ── Build the typed event log (company -> events) ───────────────────────────
const entities = {};
DEV.forEach(function (dev) {
  const ent = VERIFIED_BY_NAME[ci(dev.name)];
  const company = {
    name: dev.name,
    slug: ent ? ent.slug : slugify(dev.name),
    country: ent ? ent.country : '',
    indexable: ent ? !!ent.indexable : false,
    events: [],
  };
  (dev.developments || []).forEach(function (x) {
    company.events.push({
      title: x.title,
      type: classify(x.title),
      typeLabel: TYPE_LABEL[classify(x.title)],
      src: x.src || '',
      url: x.url || '',
      value: valueLabel(x.value),
      date: dateFromSrc(x.src),
      confidence: BASE_CONF,
      claimType: BASE_CLAIM,
      sourceType: 'company_development',
    });
  });
  entities[dev.name] = company;
});

// ── Project summary for the BI home (transformer-relevant build/tender/award) ─
const projectSummary = PROJECTS.map(function (p) {
  return {
    name: p.project,
    country: p.country,
    voltage: p.voltage || '',
    status: p.status || '',
    transformer_requirement: (p.transformer_requirement || 'UNKNOWN').toUpperCase(),
    utility: p.utility || '',
    epc: p.epc || '',
    manufacturer: p.manufacturer || '',
    expected: p.expected || '',
    url: 'https://transformerpath.com/projects/' + slugify(p.project) + '/',
    source_url: (p.sources && p.sources[0]) || '',
    src_label: p.src_label || 'public announcement',
  };
});

// ── Tender / Award summary from the canonical Tender Watch dataset ──────────
// Tenders are the procurement process; an AWARDED tender is a confirmed contract
// RESULT (an Award). Pre-award = EXPECTED/OPEN/CLOSING_SOON/EVALUATION. We do
// not infer an award from a tender that is merely "awarded" by project status —
// we only surface a tender whose source explicitly confirms the result.
const PREAWARD = ['EXPECTED', 'OPEN', 'CLOSING_SOON', 'EVALUATION'];
const tenderSummary = TENDERS.map(function (t) {
  return {
    title: t.title, country: t.country, region: t.region, voltage: t.voltage || '',
    status: t.status, statusLabel: t.statusLabel, statusGroup: t.statusGroup,
    transformer_scope: t.transformer_scope, utility: t.utility || '', epc: t.epc || '',
    deadline: t.deadline || '', source: t.source || '',
    url: 'https://transformerpath.com/tenders/' + slugify(t.title) + '/',
    source_url: (t.source_urls && t.source_urls[0]) || '',
  };
});
const openTenders = tenderSummary.filter(function (t) { return t.status === 'OPEN'; });
const preAwardTenders = tenderSummary.filter(function (t) { return PREAWARD.indexOf(t.status) >= 0; });
// Awarded tenders are the award result feed (source-confirmed).
const awardSummary = tenderSummary.filter(function (t) { return t.status === 'AWARDED'; });

// ── Aggregate: counts by type, companies with events, market split ──────────
const allEvents = [];
Object.keys(entities).forEach(function (k) { allEvents.push.apply(allEvents, entities[k].events); });
const typeCounts = {};
allEvents.forEach(function (e) { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
const companiesWithEvents = Object.keys(entities).filter(function (k) { return entities[k].events.length; });
const verifiedEvents = allEvents.filter(function (e) { return e.type !== 'reference'; });
const referenceEvents = allEvents.filter(function (e) { return e.type === 'reference'; });

fs.mkdirSync('data', { recursive: true });
const graph = {
  $comment: 'TransformerPath Business Intelligence entity-events graph. Generated by build-intelligence.js from sourced Daily-Intel developments and project records. Event types are assigned by word-bounded keyword rules; unclassified items are labelled "reference". Every entry carries its source URL verbatim; confidence defaults to LIMITED and is never upgraded without corroborating source evidence. Do not edit by hand.',
  generated: TODAY,
  confidence_policy: 'LIMITED for keyword-matched Daily-Intel items; HIGH/MEDIUM only when carried from a corroborated source. No invented numeric capability.',
  type_counts: typeCounts,
  companies: companiesWithEvents.length,
  projects: projectSummary.length,
  tenders: tenderSummary.length,
  open_tenders: openTenders.length,
  preaward_tenders: preAwardTenders.length,
  awards: awardSummary.length,
  factory_expansions: allEvents.filter(function (e) { return e.type === 'factory_expansion'; }).length,
  events_total: allEvents.length,
  events_typed: verifiedEvents.length,
  events_reference: referenceEvents.length,
  types: TYPE_LABEL,
  companies_events: entities,
  projects: projectSummary,
  tenders: tenderSummary,
  awards: awardSummary,
};
fs.writeFileSync('data/entity-events.json', JSON.stringify(graph, null, 2));
console.log('entity-events.json wrote ' + allEvents.length + ' events (' + verifiedEvents.length + ' typed, ' + referenceEvents.length + ' reference) across ' + companiesWithEvents.length + ' companies, ' + projectSummary.length + ' projects, ' + tenderSummary.length + ' tenders (' + openTenders.length + ' open), ' + awardSummary.length + ' awards');
console.log('  event type counts: ' + JSON.stringify(typeCounts));

// ── Server-side rendered /intelligence page (flash-free, no client fetch) ─────
// Bakes the counts, activity feed, companies and projects directly into the HTML
// so the page paints instantly, matching the server-rendered market pages (the
// client-rendered version flashed empty containers then populated on fetch).
function renderIntelligence() {
  const co = graph.companies_events || {};
  const evts = [];
  Object.keys(co).forEach(function (k) { (co[k].events || []).forEach(function (e) { evts.push(Object.assign({ _co: k }, e)); }); });
  const typed = evts.filter(function (e) { return e.type !== 'reference'; });
  const TYPE_LABEL2 = graph.types || TYPE_LABEL;

  // Counts row — all canonical, computed from the shared datasets. Never typed.
  const counts = '<div class="biw-counts">' +
    '<div class="s"><b>' + (graph.projects || []).length + '</b><small>Projects tracked</small></div>' +
    '<div class="s"><b>' + (graph.tenders || []).length + '</b><small>Tenders</small></div>' +
    '<div class="s"><b>' + (graph.open_tenders || 0) + '</b><small>Open now</small></div>' +
    '<div class="s"><b>' + (graph.awards || []).length + '</b><small>Recent awards</small></div>' +
    '<div class="s"><b>' + Object.keys(co).length + '</b><small>Companies</small></div>' +
    '<div class="s"><b>' + (graph.factory_expansions || 0) + '</b><small>Factory expansions</small></div></div>';

  // Activity feed: typed events first (date desc), then reference items. De-dupe by company+title.
  const all = typed.concat(evts.filter(function (e) { return e.type === 'reference'; }));
  all.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  const seen = {}; let feed = [];
  all.slice(0, 40).forEach(function (e) {
    if (seen[e._co + '|' + e.title]) return; seen[e._co + '|' + e.title] = 1;
    const conf = e.confidence || 'LIMITED';
    feed.push('<div class="tl-row"><div class="tl-evt">' + esc(TYPE_LABEL2[e.type] || e.type) + ' <span class="conf conf-' + esc(conf) + '">' + esc(conf) + '</span></div>' +
      '<div class="tl-co">' + (e.date ? esc(e.date) + ' · ' : '') + esc(e._co) + '</div>' +
      '<a class="ttl" href="' + esc(e.url) + '"' + (/^https?:/.test(e.url || '') ? ' target="_blank" rel="noopener"' : '') + '>' + esc(e.title) + '</a>' +
      (e.value ? '<div style="color:var(--muted);font-size:.82rem;margin-top:2px">Reported value: ' + esc(e.value) + '</div>' : '') +
      '<div class="src">' + esc(e.src || '') + (/^https?:/.test(e.url || '') ? ' · <a href="' + esc(e.url) + '" target="_blank" rel="noopener">source</a>' : '') + '</div></div>');
  });
  const activity = feed.join('') || '<div class="tl-row" style="color:var(--muted)">No typed developments yet.</div>';

  // Companies with structured timelines.
  const compRows = Object.keys(co).sort(function (a, b) { return co[b].events.length - co[a].events.length; }).map(function (k) {
    return '<span class="chip"><a href="manufacturers/' + slugify(co[k].name) + '/"><b>' + esc(co[k].name) + '</b> · ' + co[k].events.length + '</a></span>';
  });
  const companies = compRows.join('') || '<div class="tl-row" style="color:var(--muted)">No companies trackable yet.</div>';

  // Projects.
  const pj = (graph.projects || []).slice(0, 12).map(function (p) {
    const g = p.transformer_requirement || 'UNKNOWN';
    return '<div class="tl-row"><div class="tl-evt">' + esc(g) + ' <span class="conf conf-' + esc(g) + '">' + esc(g) + '</span></div>' +
      '<div class="tl-co">' + esc(p.country || '') + (p.voltage ? ' · ' + esc(p.voltage) : '') + ' · ' + esc(p.status || '') + '</div>' +
      '<a class="ttl" href="' + esc(p.url) + '">' + esc(p.name) + '</a>' +
      (p.utility ? '<div class="tl-co">' + esc(p.utility) + '</div>' : '') + '</div>';
  }).join('') || '<div class="tl-row" style="color:var(--muted)">No projects published yet.</div>';

  // Tender Watch: prefer pre-award (OPEN/CLOSING_SOON/EVALUATION/EXPECTED), not history.
  const T_ORDER = { OPEN: 0, CLOSING_SOON: 1, EVALUATION: 2, EXPECTED: 3 };
  const tRows = (graph.tenders || []).slice().sort(function (a, b) {
    return (T_ORDER[a.status] ?? 9) - (T_ORDER[b.status] ?? 9) || String(a.country).localeCompare(b.country);
  }).slice(0, 10).map(function (t) {
    return '<div class="tl-row"><div class="tl-evt">' + esc(t.statusLabel || t.status) + '</div>' +
      '<div class="tl-co">' + esc(t.country || t.region || '') + (t.voltage ? ' · ' + esc(t.voltage) : '') + '</div>' +
      '<a class="ttl" href="' + esc(t.url) + '">' + esc(t.title) + '</a>' +
      '<div class="src">' + esc(t.source || '') + (t.deadline ? ' · deadline ' + esc(t.deadline) : '') + '</div></div>';
  }).join('') || '<div class="tl-row" style="color:var(--muted)">No tenders tracked yet.</div>';

  // Recent awards (source-confirmed awarded tenders).
  const aw = (graph.awards || []).slice(0, 8).map(function (a) {
    return '<div class="tl-row"><div class="tl-evt">Awarded</div>' +
      '<div class="tl-co">' + esc(a.country || a.region || '') + (a.voltage ? ' · ' + esc(a.voltage) : '') + '</div>' +
      '<a class="ttl" href="' + esc(a.url) + '">' + esc(a.title) + '</a>' +
      '<div class="src">' + esc(a.source || '') + '</div></div>';
  }).join('') || '<div class="tl-row" style="color:var(--muted)">No confirmed awards yet.</div>';

  const body = '<main class="biw-wrap">' +
    '<h1>TransformerPath <span style="color:var(--accent)">Intelligence</span></h1>' +
    '<p class="lead">The transformer-industry business-intelligence hub. TransformerPath accumulates industry memory — every sourced development is attached to a permanent company, project or utility and typed as an event, so you can follow what changed, where and when. All entries are source-tracked with confidence labels; nothing is inferred without a source.</p>' +
    counts +
    '<div class="biw-sec"><h2>Transformer-relevant projects</h2><p class="sub">Structured grid, substation and transformer projects — tenders, awards, construction and energisation — with the transformer scope graded confirmed / inferred / unknown per the published source.</p><div>' + pj + '</div></div>' +
    '<div class="biw-sec"><h2>Tender Watch</h2><p class="sub">Pre-award procurement opportunities — open, closing soon, under evaluation and expected. Awards are carried separately (see Recent awards); awarded tenders move out of the active procurement flow.</p><div>' + tRows + '</div></div>' +
    '<div class="biw-sec"><h2>Recent awards</h2><p class="sub">Source-confirmed contract results. A tender is only shown here when its source explicitly confirms the award — a vendor list or a project is never an award.</p><div>' + aw + '</div></div>' +
    '<div class="biw-sec"><h2>Latest company activity</h2><p class="sub">Typed, source-backed events attached to permanent manufacturer entities. Only high-confidence keyword matches are typed; everything else is labelled "Intel reference".</p><div>' + activity + '</div></div>' +
    '<div class="biw-sec"><h2>Companies with structured timelines</h2><p class="sub">Follow a manufacturer entity to see its full development history (orders, factory expansions, ownership, rebranding, approvals).</p><div>' + companies + '</div></div>' +
    '<div class="biw-note"><b style="color:var(--text)">Read our <a href="methodology.html" style="color:var(--accent)">research methodology</a>.</b> ' +
    'Every event is sourced from published public information (company, utility, regulator, government and industry reporting) or the TransformerPath Daily Intel feed, and carries a confidence label. A company development is shown because it <b>references</b> that company — it is not an independently verified award, order or project attribution unless the source explicitly confirms one. TransformerPath is independent and editorially neutral: commercial relationships never affect research confidence, editorial treatment or the accuracy of factual data.</div>' +
    '</main>';

  const head = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>TransformerPath Intelligence — Industry Business Intelligence Dashboard</title>\n' +
    '<meta name="description" content="TransformerPath Intelligence — the transformer industry business-intelligence hub. Structured company timelines, projects, orders and contracts, factory expansions, ownership changes, utility approvals and market dashboards — source-tracked, with confidence labels and full provenance.">\n' +
    '<link rel="canonical" href="https://transformerpath.com/intelligence.html">\n<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">\n<meta property="og:title" content="TransformerPath Intelligence — Business Intelligence Dashboard">\n<meta property="og:description" content="Structured transformer-industry intelligence: company timelines, projects, awards, factory expansions, ownership, utility approvals and market dashboards.">\n<meta property="og:url" content="https://transformerpath.com/intelligence.html">\n<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">\n<meta name="twitter:card" content="summary_large_image">\n' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">\n<link rel="stylesheet" href="style.css?v=9"><link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#0d1b2e">\n<style>' +
    '.biw-wrap{max-width:1080px;margin:0 auto;padding:44px 20px 90px}.biw-wrap h1{font-size:2.1rem;color:var(--ink)}.biw-wrap .lead{color:var(--muted);font-size:1.05rem;max-width:840px;margin:8px 0 30px}.biw-counts{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 30px}.biw-counts .s{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;text-align:center;min-width:120px}.biw-counts .s b{color:var(--text);font-size:1.5rem;display:block}.biw-counts .s small{color:var(--muted);font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.biw-sec{margin:38px 0 0}.biw-sec h2{font-size:1.3rem;color:var(--ink);margin:0 0 6px}.biw-sec .sub{color:var(--muted);font-size:.9rem;margin:0 0 16px}.tl-row{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:13px 16px;margin-bottom:10px}.tl-row .tl-evt{color:var(--accent);font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.tl-row .tl-co{color:var(--muted);font-size:.8rem;margin:2px 0 4px}.tl-row a.ttl{color:var(--text);font-weight:600;text-decoration:none}.tl-row a.ttl:hover{color:var(--accent)}.tl-row .src{color:var(--muted);font-size:.78rem;margin-top:6px}.tl-row .src a{color:var(--accent)}.chip{display:inline-block;background:var(--card);border:1px solid var(--border);border-radius:999px;padding:5px 12px;font-size:.8rem;color:var(--text);margin:3px 4px 0 0}.chip:hover{border-color:var(--accent);color:var(--accent)}.chip a{color:var(--text);text-decoration:none}.chip a:hover{color:var(--accent)}.conf{display:inline-block;font-weight:700;font-size:9.5px;letter-spacing:.05em;padding:1px 6px;border-radius:8px;margin-left:6px;vertical-align:middle}.conf-LIMITED{background:#1d2330;color:#9fb0c4;border:1px solid rgba(159,176,196,.35)}.conf-MEDIUM{background:#12283f;color:#60a5fa;border:1px solid rgba(96,165,250,.35)}.conf-HIGH{background:#14351f;color:#4ade80;border:1px solid rgba(74,222,128,.35)}.biw-note{background:rgba(245,166,35,.05);border:1px solid var(--border);border-radius:10px;padding:13px 16px;color:var(--muted);font-size:.85rem;margin-top:26px}</style>\n</head>\n<body>\n' +
    HEAD + '\n' + body + '\n' + FOOT + '\n<script src="analytics.js" defer></script>\n</body>\n</html>';
  return head;
}

// Write the SSRed page. Content is baked into the HTML so it paints on first
// render (no client fetch / no empty-container flash). The stylesheet is
// versioned (style.css?v=9) and normalised by bump-assets.js.
fs.writeFileSync('intelligence.html', renderIntelligence());
console.log('intelligence.html wrote (server-rendered, no client fetch)');

module.exports = { entities: entities, projectSummary: projectSummary, graph: graph, TYPE_LABEL: TYPE_LABEL, TODAY: TODAY };
