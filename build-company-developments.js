#!/usr/bin/env node
/* build-company-developments.js — attach sourced Daily Intel to canonical
 * manufacturer entities.
 *
 * Matching is derived from companies.json names, company-slugs.json names,
 * parenthetical acronyms, and the documented aliases in lib/company-aliases.js.
 * Phrases are word-bounded (normalized tokens). A hit means the item
 * references that company — not that it is a verified award.
 *
 * facility_id is set only when a facility for that company has status SOURCED
 * and the item names that facility's city or site. Unsourced census rows are
 * not linked.
 *
 * Run before build-intelligence.js and build-company-pages.js.
 */
'use strict';
const fs = require('fs');
const { ALIASES, norm } = require('./lib/company-aliases');
const { assignEntityScope, sourcedFacilityId } = require('./lib/entity-scope');

const GENERIC = {
  transformer: 1, transformers: 1, electric: 1, electrical: 1, energy: 1, power: 1,
  group: 1, company: 1, limited: 1, ltd: 1, llc: 1, inc: 1, industries: 1,
  industrial: 1, solutions: 1, heavy: 1, international: 1, and: 1, the: 1, co: 1,
  corp: 1, corporation: 1, saog: 1, gmbh: 1, plc: 1
};

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

function extractConst(src, name) {
  const escName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:const|let|var)\\s+' + escName + '\\s*=\\s*');
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < src.length && /\s/.test(src[i])) i++;
  const open = src[i];
  if (open !== '{' && open !== '[') return null;
  const close = open === '[' ? ']' : '}';
  const start = i;
  let depth = 0, inStr = null, escp = false, line = false, block = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    const nx = src[i + 1];
    if (line) { if (ch === '\n') line = false; continue; }
    if (block) { if (ch === '*' && nx === '/') { block = false; i++; } continue; }
    if (inStr) {
      if (escp) { escp = false; continue; }
      if (ch === '\\') { escp = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '/' && nx === '/') { line = true; i++; continue; }
    if (ch === '/' && nx === '*') { block = true; i++; continue; }
    if (ch === '`' || ch === "'" || ch === '"') { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) break; }
  }
  try { return new Function('return (' + src.slice(start, i + 1) + ')')(); }
  catch (e) { return null; }
}

const MONTH = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function dateIso(item) {
  const direct = item.date_iso || item.event_date || item.publication_date || item.update_date;
  if (direct && /^\d{4}-\d{2}-\d{2}/.test(String(direct))) return String(direct).slice(0, 10);
  const m = String(item.src || '').match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(20\d{2})\b/i);
  if (!m) return '';
  const mi = MONTH[m[2].toLowerCase().slice(0, 3)];
  if (mi == null) return '';
  return m[3] + '-' + String(mi + 1).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
}

function intelItems() {
  const intel = readJson('data/intel.json', {});
  const fromJson = Object.keys(intel).flatMap(function (k) {
    return ((intel[k] && intel[k].items) || []).map(function (it) { return Object.assign({ _origin: 'intel.json' }, it); });
  });
  let fromNews = [];
  try {
    const html = fs.readFileSync('intel.html', 'utf8');
    const news = extractConst(html, 'NEWS');
    if (news && typeof news === 'object') {
      Object.keys(news).forEach(function (region) {
        ((news[region] && news[region].items) || []).forEach(function (it) {
          fromNews.push(Object.assign({ _origin: 'intel.html' }, it));
        });
      });
    }
  } catch (e) { /* Daily Intel page absent — json items still apply */ }
  const seen = {};
  const out = [];
  fromNews.concat(fromJson).forEach(function (it) {
    if (!it || !it.title) return;
    if (!it.url || !/^https?:\/\//i.test(it.url)) return;
    const key = (it.url || it.title).trim().toLowerCase();
    if (seen[key]) return;
    seen[key] = 1;
    it._date = dateIso(it);
    out.push(it);
  });
  return out;
}

function addPhrase(bucket, phrase, company, acronym, wholeName) {
  const n = norm(phrase);
  if (!n) return;
  const tokens = n.split(' ').filter(Boolean);
  if (!tokens.length) return;
  if (tokens.every(function (t) { return GENERIC[t]; })) return;
  if (tokens.length === 1) {
    const t = tokens[0];
    if (t.length < 3) return;
    if (t.length < 4 && !acronym && !wholeName) return;
  }
  (bucket[n] = bucket[n] || []);
  if (!bucket[n].some(function (c) { return c.id === company.id; })) bucket[n].push(company);
}

function buildIndex() {
  const companies = readJson('data/companies.json', { companies: [] }).companies || [];
  const slugs = readJson('data/company-slugs.json', []);
  const bySlug = {};
  companies.forEach(function (c) { if (c && c.slug) bySlug[c.slug] = c; });
  const phrases = {};
  companies.forEach(function (c) {
    if (!c || !c.name) return;
    addPhrase(phrases, c.name, c, false, true);
    const base = String(c.name).replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    addPhrase(phrases, base, c, false);
    const stripped = base.replace(/\b(group|ltd|limited|inc|llc|corp|corporation|saog|gmbh|plc|pvt|bv)\b/ig, ' ').replace(/\s+/g, ' ').trim();
    addPhrase(phrases, stripped, c, false);
    const left = base.split(/\s+&\s+/i)[0].trim();
    if (left && left !== base) addPhrase(phrases, left, c, false);
    const parens = String(c.name).match(/\(([^)]+)\)/g) || [];
    parens.forEach(function (p) {
      p.slice(1, -1).split(/[/|,]/).forEach(function (part) {
        const t = part.trim();
        if (/^[A-Z][A-Z0-9]{2,12}$/.test(t)) addPhrase(phrases, t, c, true);
      });
    });
  });
  (slugs || []).forEach(function (s) {
    if (!s || !s.slug || !s.name) return;
    const c = bySlug[s.slug];
    if (c) addPhrase(phrases, s.name, c, false);
  });
  Object.keys(ALIASES).forEach(function (phrase) {
    const dest = ALIASES[phrase];
    const c = dest && bySlug[dest.slug];
    if (c) addPhrase(phrases, phrase, c, false);
  });
  return { phrases: phrases, bySlug: bySlug, companies: companies };
}

function hasPhrase(textNorm, phrase) {
  return (' ' + textNorm + ' ').indexOf(' ' + phrase + ' ') >= 0;
}

function matchCompanies(item, index) {
  const text = norm(item.title || '');
  if (!text) return [];
  const hits = [];
  Object.keys(index.phrases).forEach(function (phrase) {
    if (!hasPhrase(text, phrase)) return;
    index.phrases[phrase].forEach(function (c) {
      hits.push({ company: c, phrase: phrase });
    });
  });
  // Drop a shorter phrase when a longer phrase on the same title already
  // selected a company and the short phrase is contained in that longer one.
  const longest = {};
  hits.forEach(function (h) {
    const prev = longest[h.company.id];
    if (!prev || h.phrase.length > prev.phrase.length) longest[h.company.id] = h;
  });
  const kept = Object.keys(longest).map(function (id) { return longest[id]; });
  const specific = kept.filter(function (h) {
    return !kept.some(function (other) {
      return other.company.id !== h.company.id && other.phrase.length > h.phrase.length &&
        (' ' + other.phrase + ' ').indexOf(' ' + h.phrase + ' ') >= 0 && hasPhrase(text, other.phrase);
    });
  });
  return assignEntityScope(specific, text, index.companies, GENERIC, norm);
}

const ITEMS = intelItems();
const INDEX = buildIndex();
const FACILITIES = readJson('data/facilities.json', { facilities: [] }).facilities || [];

const byCompany = {};
ITEMS.forEach(function (it) {
  matchCompanies(it, INDEX).forEach(function (hit) {
    const c = hit.company;
    if (!byCompany[c.id]) {
      byCompany[c.id] = {
        name: c.name,
        company_id: c.id,
        slug: c.slug,
        developments: []
      };
    }
    const facilityId = sourcedFacilityId(c, it, FACILITIES, norm);
    byCompany[c.id].developments.push({
      title: it.title,
      src: it.src || '',
      url: it.url || '',
      value: it.value || '',
      date_iso: it._date || '',
      matched_phrase: hit.phrase,
      event_scope: facilityId ? 'factory' : (hit.scope || 'group'),
      facility_id: facilityId
    });
  });
});

const out = Object.keys(byCompany).map(function (id) {
  const row = byCompany[id];
  row.developments.sort(function (a, b) { return String(b.date_iso).localeCompare(String(a.date_iso)); });
  row.developments = row.developments.slice(0, 8);
  const newest = row.developments.map(function (d) { return d.date_iso; }).filter(Boolean).sort().pop() || null;
  row.source = 'TransformerPath Daily Intel';
  row.lastVerified = newest;
  row.lastVerified_meaning = 'Newest linked Daily Intel source date. Not a separate verification visit.';
  return row;
}).filter(function (row) { return row.developments.length; });

out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });

fs.writeFileSync('data/company-developments.json', JSON.stringify(out, null, 2) + '\n');
console.log('company-developments.json wrote ' + out.length + ' entities with sourced intel from ' + ITEMS.length + ' items');
const watch = ['Kolektor ETRA', 'Transformers & Rectifiers India (TARIL)', 'Voltamp Transformers'];
watch.forEach(function (name) {
  const row = out.find(function (r) { return r.name === name; });
  console.log('  ' + name + ': ' + (row ? row.developments.map(function (d) { return d.date_iso + ' ' + d.title; }).join(' | ') : 'NO MATCH'));
});
