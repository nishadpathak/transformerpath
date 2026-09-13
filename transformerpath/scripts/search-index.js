#!/usr/bin/env node
/**
 * Canonical search index (P0.7 core, Node-side).
 *
 * Builds a searchable index from the SAME canonical data model the rest of the
 * platform uses, groups results by entity type, and scores by how many query
 * tokens match. It never fabricates results: a query that matches nothing
 * returns an empty group, and zero-result queries can be recorded to the
 * internal research-demand queue (P0.8).
 *
 * Deliberate trust rules baked in:
 *  - Company results expose "highestSourcedVoltageEvidence" (a sourced kV range)
 *    and NEVER an annual-capacity MVA number on the same line (P0.6).
 *  - verificationStatus is only ever LISTED here (public-source records); it is
 *    never silently upgraded to VERIFIED / SUPPLIER PRO (P0.3/P0.4).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const isServedBy = (m) => /^Served by/i.test((m && m[0]) || '');
const clean = (s) => String(s || '').trim();

const SYNONYMS = {
  transformerboard: ['pressboard', 'transformerboard', 'insulation board'],
  pressboard: ['pressboard', 'transformerboard'],
  oltc: ['oltc', 'on-load tap-changer', 'tap changer', 'tap-changer'],
  ct: ['current transformer'],
  crgo: ['crgo', 'core steel', 'grain oriented']
};

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function loadComponents() {
  const src = fs.readFileSync(path.join(ROOT, 'components-catalog.js'), 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const cat = ctx.window.TP_COMPONENTS;
  return (cat && cat.items) || [];
}

function buildIndex() {
  const records = [];

  // Companies (manufacturer listings) — public-source, LISTED.
  const manufacturers = loadJson('data/manufacturers.json');
  for (const block of manufacturers) {
    for (const m of (block.makers || []).filter((x) => !isServedBy(x))) {
      records.push({
        type: 'company',
        name: clean(m[0]),
        country: clean(block.country),
        region: clean(block.region),
        city: clean(m[1]),
        transformerTypes: clean(m[3]),
        url: clean(m[2]),
        highestSourcedVoltageEvidence: null,
        verificationStatus: 'LISTED',
        source: 'data/manufacturers.json'
      });
    }
  }

  // Rich OEM profiles — add voltage evidence, capabilities, certifications.
  const profiles = loadJson('data/directory-profiles.json');
  for (const key of Object.keys(profiles)) {
    const p = profiles[key];
    records.push({
      type: 'company',
      name: key.replace(/\s*\(.*?\)\s*/g, ' ').trim() || key,
      displayName: key,
      country: null,
      region: null,
      highestSourcedVoltageEvidence: p.kvRange || null,
      capabilities: p.capabilities || [],
      certifications: p.certifications || [],
      componentCategories: p.componentCategories || [],
      plants: p.plants || [],
      utilityApprovals: p.utilityApprovals || [],
      verificationStatus: 'LISTED',
      source: 'data/directory-profiles.json'
    });
  }

  // Components / materials / machinery categories.
  for (const c of loadComponents()) {
    records.push({
      type: 'component',
      name: c.name,
      category: c.category,
      blurb: c.blurb,
      detail3d: c.detail3d || null,
      supplierCount: 0, // honest: no sourced supplier records yet
      source: 'components-catalog.js'
    });
  }

  // Utilities.
  const utilities = loadJson('data/utility-directory.json');
  const utilEntries = Array.isArray(utilities)
    ? utilities
    : Object.keys(utilities).map((k) => Object.assign({ name: k }, utilities[k]));
  for (const u of utilEntries) {
    records.push({
      type: 'utility',
      name: u.name || '',
      country: u.country || null,
      blurb: typeof u === 'object' ? JSON.stringify(u).slice(0, 200) : '',
      source: 'data/utility-directory.json'
    });
  }

  return records;
}

function tokenize(q) {
  const base = String(q || '')
    .toLowerCase()
    .replace(/[^a-z0-9+.\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t !== 'kv' && t !== 'transformer' && t.length > 1);
  const expanded = new Set(base);
  for (const t of base) (SYNONYMS[t] || []).forEach((s) => expanded.add(s));
  return [...expanded];
}

function haystack(rec) {
  return JSON.stringify(rec).toLowerCase();
}

/** Returns { total, groups: { company:[], component:[], utility:[] }, byType } */
function search(query, index) {
  const idx = index || buildIndex();
  const tokens = tokenize(query);
  const scored = [];
  for (const rec of idx) {
    if (tokens.length === 0) break;
    const hay = haystack(rec);
    let hits = 0;
    for (const t of tokens) if (hay.includes(t)) hits++;
    if (hits === 0) continue;
    const confidence = hits / tokens.length; // 0..1
    scored.push({ rec, hits, confidence });
  }
  scored.sort((a, b) => b.confidence - a.confidence || b.hits - a.hits);

  const groups = {};
  for (const s of scored) {
    (groups[s.rec.type] ??= []).push(s);
  }
  const byType = {};
  Object.keys(groups).forEach((t) => (byType[t] = groups[t].length));
  return { query, tokens, total: scored.length, groups, byType };
}

module.exports = { buildIndex, search, tokenize };

if (require.main === module) {
  const q = process.argv.slice(2).join(' ') || '765 kV';
  const res = search(q);
  console.log('Query:', q, '| tokens:', res.tokens.join(','), '| total:', res.total, '| byType:', JSON.stringify(res.byType));
  Object.keys(res.groups).forEach((type) => {
    console.log('\n' + type.toUpperCase());
    res.groups[type].slice(0, 8).forEach((s) => {
      const r = s.rec;
      const extra =
        r.type === 'company'
          ? [r.country, r.highestSourcedVoltageEvidence ? 'kV evidence: ' + r.highestSourcedVoltageEvidence : null]
              .filter(Boolean)
              .join(' · ')
          : r.category || r.country || '';
      console.log('  [' + (s.confidence * 100).toFixed(0) + '%] ' + (r.displayName || r.name) + (extra ? '  — ' + extra : ''));
    });
  });
}
