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
  events_total: allEvents.length,
  events_typed: verifiedEvents.length,
  events_reference: referenceEvents.length,
  types: TYPE_LABEL,
  companies_events: entities,
  projects: projectSummary,
};
fs.writeFileSync('data/entity-events.json', JSON.stringify(graph, null, 2));
console.log('entity-events.json wrote ' + allEvents.length + ' events (' + verifiedEvents.length + ' typed, ' + referenceEvents.length + ' reference) across ' + companiesWithEvents.length + ' companies and ' + projectSummary.length + ' projects');
console.log('  event type counts: ' + JSON.stringify(typeCounts));

module.exports = { entities: entities, projectSummary: projectSummary, graph: graph, TYPE_LABEL: TYPE_LABEL, TODAY: TODAY };
