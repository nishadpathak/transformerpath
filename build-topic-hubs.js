#!/usr/bin/env node
/* build-topic-hubs.js — Topic Hub aggregator + renderer.
 *
 * Aggregates EXISTING structured records (directory, intel, knowledge, projects,
 * tenders, events, materials) into /topics/<slug>/ hub pages per
 * data/topic-hubs.json. A hub is an interface over the industry graph: it links
 * to canonical entities, it does NOT write new articles. Sections with no
 * existing data are OMITTED. Nothing is invented.
 *
 * Also emits data/topic-index.json (the aggregated, machine-readable graph) so
 * search and cross-linking can reuse it (ONE fact -> MANY views).
 *
 * Run: node build-topic-hubs.js
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const CFG = JSON.parse(fs.readFileSync('data/topic-hubs.json', 'utf8'));
const DIR = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8')).companies || [];
const INTEL = flattenIntel(JSON.parse(fs.readFileSync('data/intel.json', 'utf8')));
const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8')).events || JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const PROJECTS = (JSON.parse(fs.readFileSync('data/projects.json', 'utf8'))).projects || [];
const TENDERS = (JSON.parse(fs.readFileSync('data/tenders.json', 'utf8'))).tenders || [];
let MATERIALS = []; try { MATERIALS = (JSON.parse(fs.readFileSync('data/materials.json', 'utf8'))).latest_rows || []; } catch (e) {}
let TECH = []; try { TECH = (JSON.parse(fs.readFileSync('data/technology-developments.json', 'utf8'))).developments || []; } catch (e) {}

function flattenIntel(obj) {
  if (Array.isArray(obj)) return obj;
  const out = [];
  Object.keys(obj).forEach((k) => { (obj[k] && obj[k].items || []).forEach((it) => out.push(it)); });
  return out;
}
const hasWords = (text, keywords) => String(text || '').toLowerCase().split(/\s+/).some((w) => keywords.some((kw) => kw.toLowerCase().indexOf(w) >= 0 || w.indexOf(kw.toLowerCase()) >= 0));
const hasAny = (text, keywords) => keywords.some((kw) => String(text || '').toLowerCase().indexOf(kw.toLowerCase()) >= 0);

function matchDirectory(topic) {
  const dir = topic.match_directory; if (!dir) return [];
  return DIR.filter((c) => {
    if (dir.transformer_type) {
      const t = c.transformer_types && c.transformer_types[dir.transformer_type];
      if (!t) return false;
      return t.__present || Object.keys(t).some((k) => k !== '__present');
    }
    if (dir.supplier_label) return (c.capability_labels || []).some((l) => String(l).toLowerCase() === String(dir.supplier_label).toLowerCase());
    return false;
  }).map((c) => ({ name: c.name, slug: c.slug, country: c.country, evidence: c.evidence, voltage: c.voltage && c.voltage.value || '', mva: c.mva && c.mva.value || '', kind: c.kind })).slice(0, 24);
}
function matchIntel(topic) { return INTEL.filter((it) => hasAny(it.title + ' ' + it.snippet, topic.intel_keywords)).map((it) => ({ title: it.title, snippet: (it.snippet || '').slice(0, 140), src: it.src || '', url: it.url || '' })).slice(0, 12); }
function matchProjects(topic) { return PROJECTS.filter((p) => hasAny((p.project || '') + ' ' + (p.transformer_requirement || ''), topic.project_keywords)).map((p) => ({ project: p.project, country: p.country, status: p.status, transformer_requirement: p.transformer_requirement || '', slug: slugify(p.project) })).slice(0, 12); }
function matchTenders(topic) { return TENDERS.filter((t) => hasAny((t.title || '') + ' ' + (t.full_title || ''), topic.tender_keywords)).map((t) => ({ title: t.title || t.full_title, country: t.country, status: t.statusLabel || t.status || '', scope: t.transformer_scope || '', slug: slugify(t.title) })).slice(0, 12); }
function matchEvents(topic) { return EVENTS.filter((e) => hasAny((e.n || '') + ' ' + (e.d || '') + ' ' + (e.r || ''), topic.event_keywords)).map((e) => ({ n: e.n, s: e.s, e: e.e, c: e.c, co: e.co, r: e.r, url: e.u || '' })).slice(0, 8); }
function matchMaterials(topic) { return MATERIALS.filter((m) => hasAny(m.name || '', topic.intel_keywords)).map((m) => ({ name: m.name, value: m.value_display, status: m.status, obs: m.observation_date })).slice(0, 6); }

function buildHub(topic) {
  const manufacturers = matchDirectory(topic);
  const intel = matchIntel(topic);
  const projects = matchProjects(topic);
  const tenders = matchTenders(topic);
  const events = matchEvents(topic);
  const knowledge = (topic.knowledge_slugs || []).filter((s) => fs.existsSync('knowledge/' + s + '.html'));
  const materials = topic.type === 'material' ? matchMaterials(topic) : [];
  const tech = TECH.filter((d) => (d.related_topic || []).indexOf(topic.key) >= 0 || (d.related_company || []).some((c) => manufacturers.some((m) => normalize(m.name).indexOf(normalize(c)) >= 0))).map((d) => ({ company: d.company, product: d.product, confidence: d.confidence, event: d.event || '', src: (d.source || []).map((s) => s.title).join('; ') }));

  const bits = [];
  bits.push('<h1>' + esc(topic.label) + '</h1><p class="lead">' + esc(topic.description) + '</p>');

  if (tech.length) bits.push('<h2>Technology / product developments</h2><ul>' + tech.map((d) => '<li><b>' + esc(d.company) + ':</b> ' + esc(d.product) + ' <span style="color:var(--muted);font-size:.8rem">· ' + esc(d.confidence) + (d.event ? ' · ' + esc(d.event) : '') + '</span></li>').join('') + '</ul>');

  if (manufacturers.length) bits.push('<h2>Manufacturers &amp; suppliers</h2><ul>' + manufacturers.map((m) => '<li><a href="' + (m.kind === 'manufacturer' ? '/manufacturers/' + m.slug + '/' : '/directory.html') + '" style="color:var(--accent)">' + esc(m.name) + '</a> <span style="color:var(--muted);font-size:.82rem">' + esc(m.country) + ' ' + esc(m.voltage) + ' ' + esc(m.mva) + ' · ' + esc(m.evidence) + '</span></li>').join('') + '</ul>');
  if (intel.length) bits.push('<h2>Latest intelligence</h2><ul>' + intel.map((i) => '<li style="margin:6px 0"><a href="' + esc(i.url || 'intel.html') + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(i.title) + '</a><div style="color:var(--muted);font-size:.84rem">' + esc(i.src || '') + '</div></li>').join('') + '</ul>');
  if (materials.length) bits.push('<h2>Material intelligence</h2><ul>' + materials.map((m) => '<li><b>' + esc(m.name) + '</b> <span style="color:var(--muted)">' + esc(m.value) + ' · ' + esc(m.status) + (m.obs ? ' · observed ' + esc(m.obs) : '') + '</span></li>').join('') + '</ul>');
  if (projects.length) bits.push('<h2>Related projects</h2><ul>' + projects.map((p) => '<li><a href="/projects/' + esc(p.slug) + '/" style="color:var(--accent)">' + esc(p.project) + '</a> <span style="color:var(--muted)">' + esc(p.country) + ' · ' + esc(p.status) + ' · ' + esc(p.transformer_requirement) + '</span></li>').join('') + '</ul>');
  /* build-tenders.js names each directory slugify(t.title). Linking on any other
     key (project_slug is a /projects/ identifier) produced 404s; guard anyway so a
     future divergence degrades to plain text instead of a dead link. */
  const tendersLive = tenders.filter((t) => t.slug && fs.existsSync('tenders/' + t.slug + '/index.html'));
  if (tendersLive.length) bits.push('<h2>Tender signals</h2><ul>' + tendersLive.map((t) => '<li><a href="/tenders/' + esc(t.slug) + '/" style="color:var(--accent)">' + esc(t.title) + '</a> <span style="color:var(--muted)">' + esc(t.country) + ' · ' + esc(t.status) + ' · scope ' + esc(t.scope) + '</span></li>').join('') + '</ul>');
  if (knowledge.length) bits.push('<h2>Engineering &amp; knowledge</h2><ul>' + knowledge.map((k) => '<li><a href="/knowledge/' + esc(k) + '.html" style="color:var(--accent)">' + esc(k.replace(/-/g, ' ')) + '</a></li>').join('') + '</ul>');
  if (events.length) bits.push('<h2>Events</h2><ul>' + events.map((e) => '<li><a href="' + esc(e.url || 'events.html') + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(e.n) + '</a> <span style="color:var(--muted)">' + esc(e.c || '') + ', ' + esc(e.co || '') + ' · ' + esc((e.s || '').slice(0, 10)) + '</span></li>').join('') + '</ul>');

  bits.push('<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px;text-align:center;margin-top:20px"><b style="color:var(--text)">Sourcing for ' + esc(topic.label.toLowerCase()) + '</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 10px">Find suppliers, compare and RFQ.</p><a class="btn btn-amber" href="/directory.html">Search the directory</a> <a class="btn btn-outline btn-sm" href="/rfq.html">Create an RFQ</a></div>');
  bits.push('<p style="font-size:.78rem;color:var(--muted);margin-top:14px">Topic Hub — an interface over existing TransformerPath records. Only sections with structured data are shown; nothing here is inferred or invented.</p>');

  const head = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + esc(topic.label) + ' — Transformer Industry Intelligence | TransformerPath</title>' +
    '<meta name="description" content="' + esc(topic.label) + ' — transformer-industry intelligence hub: manufacturers, latest intelligence, projects, tenders, knowledge and sourcing.">' +
    '<link rel="canonical" href="https://transformerpath.com/topics/' + esc(topic.key) + '/"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg"><link rel="stylesheet" href="/style.css?v=12"><link rel="stylesheet" href="/tp-nav.css?v=12">' +
    '<style>.t-wrap{max-width:980px;margin:0 auto;padding:42px 20px 90px}.t-wrap h1{font-size:2rem;color:var(--ink)}.t-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px;margin:6px 0 20px}.t-wrap h2{font-size:1.18rem;color:var(--ink);margin-top:26px;border-bottom:1px solid var(--border);padding-bottom:6px}.t-wrap ul{padding-left:20px;line-height:1.7}</style>' +
    '</head>\n<body>\n' + nav() + '\n<main class="t-wrap">' + bits.join('\n') + '</main>\n' + footer() + '\n<script src="/analytics.js?v=5" defer></script>\n<script src="/tp-nav.js?v=5" defer></script>\n</body>\n</html>';
  return { html: head, aggreg: { topic: topic.key, label: topic.label, manufacturers: manufacturers.length, intel: intel.length, projects: projects.length, tenders: tenders.length, events: events.length, knowledge: knowledge.length, materials: materials.length, technology: tech.length } };
}

function nav() {
  return '<header><link rel="stylesheet" href="/tp-nav.css?v=12"><div class="container nav"><a href="/index.html" class="logo" style="display:inline-flex;align-items:center;gap:9px"><svg class="logo-mark" width="34" height="34" viewBox="0 0 64 64" aria-hidden="true" style="flex:none"><circle cx="32" cy="32" r="26" fill="#0d1b2e" stroke="rgba(255,255,255,.30)" stroke-width="2"/><g stroke="#f5a623" stroke-width="1.4" fill="none" opacity=".8"><line x1="8" y1="32" x2="56" y2="32"/><ellipse cx="32" cy="32" rx="11" ry="26"/><ellipse cx="32" cy="32" rx="21" ry="26"/></g><path d="M36.5 9.6 L25 34 L32 34 L27.5 54.4 L42.9 27.5 L35.2 27.5 L39.7 9.6 Z" fill="#f5a623"/></svg><span class="word">Transformer<span class="accent">Path</span></span></a><button class="menu-toggle" aria-label="Menu">&#9776;</button><nav class="tpnav"><a href="/intel.html">Intel</a><a href="/manufacturers.html">Manufacturers</a><a href="/projects.html">Projects</a><a href="/tenders.html">Tenders</a><a href="/grids.html">Grids</a><a href="/events.html">Events</a><a href="/learn.html">Learn</a><a href="/tools.html">Tools</a><a href="/rfq.html">RFQ</a><span class="tpnav-utils"><a href="/search.html">&#128269;</a><a href="/workspace.html" data-tp-account>Account</a></span></nav></div></header>';
}
function footer() { return '<footer><div class="container"><p style="margin:0;color:var(--muted);font-size:.85rem">&#169; 2026 TransformerPath. All rights reserved.</p></div></footer>'; }

fs.mkdirSync('topics', { recursive: true });
const index = [];
CFG.pilot_topics.forEach((t) => {
  const { html, aggreg } = buildHub(t);
  fs.mkdirSync('topics/' + t.key, { recursive: true });
  fs.writeFileSync('topics/' + t.key + '/index.html', abs(html));
  index.push(aggreg);
  console.log('OK topics/' + t.key + '/ [manufacturers ' + aggreg.manufacturers + ' | intel ' + aggreg.intel + ' | projects ' + aggreg.projects + ' | tenders ' + aggreg.tenders + ' | knowledge ' + aggreg.knowledge + ' | events ' + aggreg.events + ' | materials ' + aggreg.materials + ']');
});
fs.writeFileSync('data/topic-index.json', JSON.stringify({ generated: new Date().toISOString(), topics: index }, null, 2));
console.log('topic hubs: ' + index.length + ' | data/topic-index.json written');
