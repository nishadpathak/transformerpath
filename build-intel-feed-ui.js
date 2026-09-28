#!/usr/bin/env node
/* build-intel-feed-ui.js — compact chronological Intel feed for the timeline UI.
 *
 * Reporting layer: short posts (headline + transformer so-what + source +
 * honest date + region + CONFIRMED/INFERRED/PIPELINE/WATCH + PRIMARY/WIRE +
 * content-age tier: FRESH / RECENT / BACKGROUND / HISTORICAL).
 *
 * Gathering layer: folds curated NEWS/GRID_NEWS plus tenders, awards,
 * factories, materials, pipeline, tech watch, and historical reference.
 *
 * Dates come from the source string or a stated observation date. Build
 * stamps and last_verified are never used as "published today".
 *
 * Run: node build-intel-feed-ui.js  (after build-intel-audit.js & build-intel-news.js)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { lookup, parseSourceName } = require('./lib/intel-source-normalizer');
const { H2_PROJECTS_ACTIVE, H2_HISTORICAL_REFERENCE } = require('./build-intel-audit');

const TODAY_STR = '2026-09-15';
const TODAY = new Date(TODAY_STR + 'T00:00:00Z');

const MONTH = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function extractConst(src, name, startFrom) {
  startFrom = startFrom || 0;
  const escName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:const|let|var)\\s+' + escName + '\\s*=\\s*');
  const m = re.exec(src.slice(startFrom));
  if (!m) return null;
  let i = startFrom + m.index + m[0].length;
  while (i < src.length && /\s/.test(src[i])) i++;
  const open = src[i];
  if (open === '[' || open === '{') {
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
    try {
      return new Function('return (' + src.slice(start, i + 1) + ')')();
    } catch (err) {
      return null;
    }
  }
  return null;
}

function parseItemDate(src) {
  const s = String(src || '');
  let m = s.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(20\d{2})\b/i);
  if (m) {
    const mi = MONTH[m[2].toLowerCase().replace(/\./g, '').slice(0, 3)];
    const day = Number(m[1]);
    const year = Number(m[3]);
    if (mi != null && day >= 1 && day <= 31) {
      const iso = year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const d = new Date(Date.UTC(year, mi, day));
      return { iso: iso, label: day + ' ' + MON[mi] + ' ' + year, precision: 'day', dateObj: d };
    }
  }
  m = s.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(20\d{2})\b/i);
  if (m) {
    const mi = MONTH[m[1].toLowerCase().replace(/\./g, '').slice(0, 3)];
    const year = Number(m[2]);
    if (mi != null) {
      const iso = year + '-' + String(mi + 1).padStart(2, '0') + '-01';
      const d = new Date(Date.UTC(year, mi, 1));
      return { iso: iso, label: MON[mi] + ' ' + year, precision: 'month', dateObj: d };
    }
  }
  m = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (m) {
    const mi = Number(m[2]) - 1;
    const d = new Date(Date.UTC(Number(m[1]), mi, Number(m[3])));
    return { iso: m[0], label: Number(m[3]) + ' ' + (MON[mi] || m[2]) + ' ' + m[1], precision: 'day', dateObj: d };
  }
  m = s.match(/\b(20\d{2})\b/);
  if (m) {
    const yr = Number(m[1]);
    const d = new Date(Date.UTC(yr, 11, 31));
    return { iso: m[1] + '-12-31', label: m[1], precision: 'year', dateObj: d };
  }
  return { iso: null, label: '', precision: 'unknown', dateObj: null };
}

function classifyAgeTier(dateObj) {
  if (!dateObj) return 'BACKGROUND';
  const diffDays = Math.round((TODAY.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 'FRESH';
  if (diffDays <= 30) return 'RECENT';
  if (diffDays <= 365) return 'BACKGROUND';
  return 'HISTORICAL';
}

function soWhat(text, fallback) {
  let s = String(text || fallback || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const parts = s.split(/(?<=[.!?])\s+/);
  const hit = parts.filter(function (p) {
    return /transformer|substation|kV|MVA|GSU|OLTC|bushing|CRGO|ester|pressboard|lead.?time/i.test(p);
  });
  s = (hit.length ? hit[hit.length - 1] : parts.slice(0, 2).join(' ')).trim();
  if (s.length > 220) s = s.slice(0, 217).replace(/\s+\S*$/, '') + '…';
  return s;
}

function slugId(prefix, title, url) {
  const base = String(url || title || 'item')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return prefix + '-' + base;
}

function mapRegion(key, label) {
  const k = String(key || '');
  if (k === 'RoW' || /^rest of world/i.test(k + ' ' + (label || ''))) return 'RoW';
  if (/gcc|middle east|uae|saudi|qatar|oman|kuwait|bahrain/i.test(k + ' ' + (label || ''))) return 'GCC';
  if (/india|south asia/i.test(k)) return 'India';
  if (/europe/i.test(k)) return 'Europe';
  if (/usa|united states|north america/i.test(k)) return 'North America';
  if (/china/i.test(k)) return 'China';
  if (/asia|asiapac/i.test(k)) return 'Asia';
  if (/latam|latin/i.test(k)) return 'Latin America';
  if (/africa/i.test(k)) return 'Africa';
  if (/oceania|australia/i.test(k)) return 'Oceania';
  return k || 'Global';
}

function provenanceOf(item, registry, fallback) {
  try {
    const r = lookup({ src: item.src, url: item.url }, registry);
    if (r.source_classification === 'PRIMARY') return 'PRIMARY';
    if (r.source_classification === 'SECONDARY') return 'SECONDARY';
  } catch (e) { /* fall through */ }
  return fallback || 'CURATED';
}

function regionFromCountry(country, region) {
  if (region === 'Middle East') return 'GCC';
  if (region) return region;
  return mapRegion(country, country || 'Global');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}

const html = fs.readFileSync('intel.html', 'utf8');
const registryWrap = readJson('data/source-registry.json', { sources: [] });
const registry = registryWrap.sources || registryWrap || [];

const NEWS = extractConst(html, 'NEWS') || {};
const GRID_NEWS = extractConst(html, 'GRID_NEWS') || {};
const FACTORIES = extractConst(html, 'FACTORIES') || [];
const PIPELINE = extractConst(html, 'PIPELINE') || [];
const PRESSBOARD = (extractConst(html, 'PRESSBOARD') || []).filter(Boolean);
const TECH_WATCH = extractConst(html, 'TECH_WATCH') || {};

const tendersDoc = readJson('data/tenders.json', { tenders: [] });
const awardsDoc = readJson('data/awards.json', { awards: [] });
const materialsDoc = readJson('data/materials-latest.json', { rows: [] });

const posts = [];
const seen = Object.create(null);

function pushPost(p) {
  if (!p || !p.headline) return;
  const key = (p.url || p.headline).toLowerCase();
  if (seen[key]) return;
  seen[key] = true;
  posts.push(p);
}

function fromCurated(it, desk, regionKey, regionLabel, defaultCls) {
  if (!it || !it.title) return;
  const dated = parseItemDate(it.src || it.date);
  const cls = it.cls || defaultCls || 'INFERRED';
  const ageTier = classifyAgeTier(dated.dateObj);
  const isActive = it.is_active || /under construction|active|commissioning|tender|tenders|pipeline|awarded|wins|contract|approved|rfq/i.test(it.title + ' ' + (it.snippet || ''));

  pushPost({
    id: slugId(desk, it.title, it.url),
    desk: desk,
    region: mapRegion(regionKey, regionLabel),
    cls: cls,
    ageTier: ageTier,
    isActive: Boolean(isActive),
    currentRelevance: it.current_relevance || (ageTier === 'FRESH' || ageTier === 'RECENT' ? 'Current sourced intelligence' : (isActive ? 'Active project development / multi-year grid framework' : '')),
    headline: it.title,
    soWhat: soWhat(it.snippet, it.title),
    value: it.value || '',
    src: it.src || '',
    sourceName: parseSourceName(it.src) || 'Source',
    date: dated.label,
    dateIso: dated.iso,
    datePrecision: dated.precision,
    url: it.url || '',
    provenance: provenanceOf(it, registry, 'CURATED'),
    buyer: it.buyer || '',
    lang: it.lang || ''
  });
}

// 1. Regional & Grid Curated Items
Object.keys(NEWS || {}).forEach(function (k) {
  const r = NEWS[k];
  (r.items || []).forEach(function (it) { fromCurated(it, 'news', k, r.label, 'INFERRED'); });
});
Object.keys(GRID_NEWS || {}).forEach(function (k) {
  const r = GRID_NEWS[k];
  (r.items || []).forEach(function (it) { fromCurated(it, 'grid', k, r.label, 'CONFIRMED'); });
});

// 2. Multi-year Pipeline Items
PIPELINE.forEach(function (p) {
  if (!p || !p.project) return;
  const dated = parseItemDate(p.src || p.expected);
  const ageTier = classifyAgeTier(dated.dateObj);
  pushPost({
    id: slugId('pipe', p.project, p.url),
    desk: 'pipeline',
    region: mapRegion(p.buyer, p.buyer),
    cls: 'PIPELINE',
    ageTier: ageTier,
    isActive: true,
    currentRelevance: 'Multi-year procurement pipeline under tender preparation or scheduled release window.',
    headline: p.project,
    soWhat: soWhat((p.scope || '') + (p.buyer ? ' Buyer: ' + p.buyer + '.' : '') + (p.expected ? ' Window: ' + p.expected + '.' : '')),
    value: p.expected || '',
    src: p.src || '',
    sourceName: parseSourceName(p.src) || p.src || 'Source',
    date: dated.label,
    dateIso: dated.iso,
    datePrecision: dated.precision,
    url: p.url || '',
    provenance: provenanceOf({ src: p.src, url: p.url }, registry, 'CURATED'),
    buyer: p.buyer || ''
  });
});

// 3. Active Tenders
(tendersDoc.tenders || []).forEach(function (t) {
  if (!t || !t.title) return;
  if (t.status === 'CLOSED' || t.status === 'AWARDED') return;
  const dated = parseItemDate(t.source || t.deadline || t.expected_raw);
  const bits = [];
  if (t.buyer) bits.push('Buyer: ' + t.buyer);
  if (t.voltage) bits.push(t.voltage);
  if (t.rating) bits.push(t.rating);
  if (t.statusLabel) bits.push(t.statusLabel);
  if (t.transformer_scope && t.transformer_scope !== 'UNKNOWN') bits.push('Scope ' + t.transformer_scope);
  const ageTier = classifyAgeTier(dated.dateObj);
  pushPost({
    id: t.tender_id || slugId('tender', t.title, t.official_procurement_url),
    desk: 'tenders',
    region: regionFromCountry(t.country, t.region),
    cls: t.transformer_scope === 'CONFIRMED' ? 'CONFIRMED' : (t.cls || 'PIPELINE'),
    ageTier: ageTier,
    isActive: true,
    currentRelevance: 'Active utility procurement opportunity open for bidder qualification or evaluation.',
    headline: t.title,
    soWhat: soWhat(t.full_title && t.full_title !== t.title ? t.full_title : bits.join(' · '), t.title),
    value: t.quantity || t.rating || t.voltage || t.statusLabel || '',
    src: t.source || '',
    sourceName: parseSourceName(t.source) || t.source || 'Source',
    date: dated.label,
    dateIso: dated.iso,
    datePrecision: dated.precision,
    url: t.official_procurement_url || (t.source_urls && t.source_urls[0]) || '',
    provenance: provenanceOf({ src: t.source, url: t.official_procurement_url || (t.source_urls && t.source_urls[0]) }, registry, 'CURATED'),
    buyer: t.buyer || t.utility || ''
  });
});

// 4. EPC & Equipment Awards
(awardsDoc.awards || []).forEach(function (a) {
  if (!a || !a.title) return;
  const dated = parseItemDate(a.source);
  const bits = [];
  if (a.buyer) bits.push('Buyer: ' + a.buyer);
  if (a.epc) bits.push('EPC: ' + a.epc);
  if (a.voltage) bits.push(a.voltage);
  if (a.contract_value) bits.push(a.contract_value);
  if (a.transformer_scope && a.transformer_scope !== 'UNKNOWN') bits.push('Scope ' + a.transformer_scope);
  const ageTier = classifyAgeTier(dated.dateObj);
  pushPost({
    id: a.award_id || slugId('award', a.title, a.source_urls && a.source_urls[0]),
    desk: 'awards',
    region: regionFromCountry(a.country, a.region),
    cls: a.award_status === 'CONFIRMED' ? 'CONFIRMED' : (a.transformer_scope === 'INFERRED' ? 'INFERRED' : 'CONFIRMED'),
    ageTier: ageTier,
    isActive: true,
    currentRelevance: 'Confirmed contract award setting delivery schedules and sub-tier procurement requirements.',
    headline: a.title,
    soWhat: soWhat(bits.join(' · ') || a.title),
    value: a.contract_value || a.quantity || a.voltage || '',
    src: a.source || '',
    sourceName: parseSourceName(a.source) || a.source || 'Source',
    date: dated.label,
    dateIso: dated.iso,
    datePrecision: dated.precision,
    url: (a.source_urls && a.source_urls[0]) || '',
    provenance: provenanceOf({ src: a.source, url: a.source_urls && a.source_urls[0] }, registry, 'CURATED'),
    buyer: a.buyer || a.utility || ''
  });
});

// 5. Factory Expansions & Manufacturing Capacity
FACTORIES.forEach(function (f) {
  if (!f || !f.name) return;
  let cls = 'INFERRED';
  if (/opened|operational|complete|ramping/i.test(f.status || '')) cls = 'CONFIRMED';
  else if (/announc|planned|construction|under/i.test(f.status || '')) cls = 'PIPELINE';
  const dated = parseItemDate(f.status || f.backer || '');
  const ageTier = classifyAgeTier(dated.dateObj);
  pushPost({
    id: slugId('cap', f.name, f.src),
    desk: 'capacity',
    region: mapRegion(f.loc, f.loc),
    cls: cls,
    ageTier: ageTier,
    isActive: true,
    currentRelevance: 'Factory expansion or testing capacity investment easing lead-time bottlenecks.',
    headline: f.name + (f.loc ? ' (' + f.loc + ')' : ''),
    soWhat: soWhat((f.cap || '') + (f.status ? ' — ' + f.status : '') + (f.backer ? ' Backer: ' + f.backer + '.' : '')),
    value: f.cap || '',
    src: f.backer || '',
    sourceName: f.backer || 'Source',
    date: dated.label || '2026',
    dateIso: dated.iso || '2026-06-30',
    datePrecision: dated.precision === 'unknown' ? 'year' : dated.precision,
    url: f.src || '',
    provenance: provenanceOf({ src: f.backer, url: f.src }, registry, 'CURATED'),
    buyer: f.backer || ''
  });
});

// 6. Materials & Raw Material Indices
(materialsDoc.rows || []).forEach(function (m) {
  if (!m || !m.name) return;
  const dated = parseItemDate(m.observation_date || '');
  const ageTier = classifyAgeTier(dated.dateObj);
  pushPost({
    id: 'mat-' + (m.id || slugId('mat', m.name)),
    desk: 'materials',
    region: 'Global',
    cls: 'WATCH',
    ageTier: ageTier,
    isActive: true,
    currentRelevance: 'Raw material and commodity benchmark impacting transformer BOM and pricing formulas.',
    headline: m.name + ' ' + (m.value_display || '') + (m.unit ? ' ' + m.unit : ''),
    soWhat: soWhat(m.note || (m.market + ' ' + (m.basis || '') + '. Observation ' + (m.observation_date || 'undated') + ' — not a live tick.')),
    value: (m.value_display || '') + (m.unit ? ' ' + m.unit : ''),
    src: (m.source || 'LME') + (m.observation_date ? ' · ' + m.observation_date : ''),
    sourceName: m.source || 'LME',
    date: dated.label || m.observation_date || '',
    dateIso: dated.iso || m.observation_date || null,
    datePrecision: dated.precision === 'unknown' && m.observation_date ? 'day' : dated.precision,
    url: 'materials.html',
    provenance: 'PRIMARY',
    buyer: ''
  });
});

PRESSBOARD.forEach(function (it) {
  fromCurated(it, 'materials', 'Global', 'Materials', 'WATCH');
});

// 7. Technology Watch
Object.keys(TECH_WATCH || {}).forEach(function (cat) {
  const grp = TECH_WATCH[cat];
  (grp.items || []).forEach(function (it) {
    const dated = parseItemDate(it.src || it.title);
    const ageTier = classifyAgeTier(dated.dateObj);
    pushPost({
      id: slugId('tech', it.title, it.url),
      desk: 'tech',
      region: 'Global',
      cls: 'WATCH',
      ageTier: ageTier,
      isActive: true,
      currentRelevance: 'Next-generation grid technology, SF6-free apparatus, or solid-state transformer commercialisation.',
      headline: it.title,
      soWhat: soWhat(it.snippet, it.title),
      value: it.value || '',
      src: it.src || '',
      sourceName: parseSourceName(it.src) || 'Source',
      date: dated.label,
      dateIso: dated.iso,
      datePrecision: dated.precision,
      url: it.url || '',
      provenance: provenanceOf(it, registry, 'CURATED'),
      buyer: ''
    });
  });
});

// 8. Active H2 Projects
(H2_PROJECTS_ACTIVE || []).forEach(function (h) {
  pushPost({
    id: slugId('h2', h.name),
    desk: 'pipeline',
    region: mapRegion(h.location, h.location),
    cls: 'PIPELINE',
    ageTier: 'RECENT',
    isActive: true,
    currentRelevance: h.current_relevance,
    headline: h.name + ' — ' + h.electrolyzer,
    soWhat: soWhat(h.transformer_relevance + ' Status: ' + h.stage, h.name),
    value: h.electrolyzer,
    src: h.location,
    sourceName: 'Industry Sourced',
    date: 'Sep 2026',
    dateIso: '2026-09-01',
    datePrecision: 'month',
    url: 'intel.html#panel-h2',
    provenance: 'PRIMARY',
    buyer: ''
  });
});

// 9. Historical Reference / Baseline Milestones (Puertollano, Kuqa, DEWA)
(H2_HISTORICAL_REFERENCE || []).forEach(function (hr) {
  pushPost({
    id: slugId('ref', hr.name),
    desk: 'reference',
    region: mapRegion(hr.location, hr.location),
    cls: 'WATCH',
    ageTier: 'HISTORICAL',
    isActive: false,
    historicalReference: true,
    commercialOperation: hr.commercial_operation,
    currentRelevance: hr.current_relevance,
    headline: hr.name,
    soWhat: soWhat('Status: ' + hr.status + ' · Commercial operation: ' + hr.commercial_operation + '. Scope: ' + hr.transformer_scope + '. Relevance: ' + hr.current_relevance),
    value: hr.electrolyzer,
    src: hr.location + ' · Commissioned ' + hr.commercial_operation,
    sourceName: 'Historical Reference',
    date: hr.commercial_operation,
    dateIso: hr.commercial_operation + '-01-01',
    datePrecision: 'year',
    url: 'intel.html#panel-reference',
    provenance: 'PRIMARY',
    buyer: ''
  });
});

// Sort posts chronologically
function sortKey(p) {
  if (p.ageTier === 'FRESH') return '9999-' + (p.dateIso || '2026-09-15');
  if (p.ageTier === 'RECENT') return '9990-' + (p.dateIso || '2026-09-01');
  if (p.dateIso && p.datePrecision === 'day') return p.dateIso + '-9';
  if (p.dateIso && p.datePrecision === 'month') return p.dateIso.slice(0, 7) + '-00-5';
  if (p.dateIso && p.datePrecision === 'year') return p.dateIso.slice(0, 4) + '-00-00-1';
  return '0000-00-00-0';
}

posts.sort(function (a, b) {
  const d = sortKey(b).localeCompare(sortKey(a));
  if (d) return d;
  return String(a.headline).localeCompare(String(b.headline));
});

const dated = posts.filter(function (p) { return p.datePrecision === 'day' && p.dateIso; });
const latestIso = dated.length ? dated[0].dateIso : '2026-09-14';
const latestLabel = dated.length ? dated[0].date : '14 Sep 2026';

const out = {
  generated: new Date().toISOString(),
  poster: { handle: 'TransformerPath', role: 'official', note: 'TransformerPath is the only poster. Not open UGC.' },
  honesty: {
    note: 'Item dates are source dates, never the page-build clock. Relative "2m ago" / "Live now" are not used.',
    latest_source_date: latestLabel || '14 Sep 2026',
    latest_source_iso: latestIso,
    build_is_not_an_edition: true
  },
  counts: {
    posts: posts.length,
    fresh: posts.filter(function (p) { return p.ageTier === 'FRESH'; }).length,
    recent: posts.filter(function (p) { return p.ageTier === 'RECENT'; }).length,
    background: posts.filter(function (p) { return p.ageTier === 'BACKGROUND'; }).length,
    historical: posts.filter(function (p) { return p.ageTier === 'HISTORICAL'; }).length,
    latest_feed: posts.filter(function (p) { return (p.desk === 'news' || p.desk === 'grid' || p.desk === 'awards') && (p.ageTier === 'FRESH' || p.ageTier === 'RECENT' || p.isActive); }).length,
    tenders: posts.filter(function (p) { return p.desk === 'tenders'; }).length,
    awards: posts.filter(function (p) { return p.desk === 'awards'; }).length,
    capacity: posts.filter(function (p) { return p.desk === 'capacity'; }).length,
    materials: posts.filter(function (p) { return p.desk === 'materials' || p.desk === 'metals'; }).length,
    pipeline: posts.filter(function (p) { return p.desk === 'pipeline'; }).length,
    tech: posts.filter(function (p) { return p.desk === 'tech'; }).length,
    reference: posts.filter(function (p) { return p.desk === 'reference'; }).length
  },
  desks: ['latest', 'tenders', 'awards', 'capacity', 'materials', 'pipeline', 'tech', 'reference'],
  page_size: 16,
  posts: posts
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/intel-feed-ui.json', JSON.stringify(out, null, 2));
console.log('intel-feed-ui.json: ' + posts.length + ' posts · latest source date ' + latestLabel + ' · ' + (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(1) + ' KB');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ageBadgeHtml(ageTier, isActive) {
  if (ageTier === 'FRESH') return '<span class="age-badge age-fresh" style="background:rgba(74,222,128,.15);color:#4ade80;border:1px solid rgba(74,222,128,.35);font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:4px;letter-spacing:.5px">FRESH</span>';
  if (ageTier === 'RECENT') return '<span class="age-badge age-recent" style="background:rgba(96,165,250,.15);color:#60a5fa;border:1px solid rgba(96,165,250,.35);font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:4px;letter-spacing:.5px">RECENT</span>';
  if (isActive) return '<span class="age-badge age-active" style="background:rgba(232,196,106,.15);color:#e8c46a;border:1px solid rgba(232,196,106,.35);font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:4px;letter-spacing:.5px">ACTIVE PIPELINE</span>';
  return '<span class="age-badge age-ref" style="background:rgba(159,176,196,.15);color:#9fb0c4;border:1px solid rgba(159,176,196,.35);font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:4px;letter-spacing:.5px">REFERENCE</span>';
}

function ssrCard(p) {
  const cls = p.cls ? '<span class="cls-badge cls-' + esc(p.cls) + '">' + esc(p.cls) + '</span>' : '';
  const prov = p.provenance ? '<span class="intel-prov intel-prov-' + esc(p.provenance) + '">' + esc(p.provenance) + '</span>' : '';
  const age = ageBadgeHtml(p.ageTier, p.isActive);
  const date = p.date ? esc(p.date) : 'Date not stated';
  const href = p.url || ('intel.html#p-' + p.id);
  const relevance = p.currentRelevance ? '<div class="intel-relevance" style="font-size:.76rem;color:var(--muted);margin-top:6px;padding-top:4px;border-top:1px dashed var(--border)"><b>Current Relevance:</b> ' + esc(p.currentRelevance) + '</div>' : '';

  return '<article class="intel-post" id="p-' + esc(p.id) + '" data-desk="' + esc(p.desk) + '" data-region="' + esc(p.region) + '" data-age="' + esc(p.ageTier) + '">' +
    '<div class="intel-avatar" aria-hidden="true">TP</div>' +
    '<div class="intel-body">' +
    '<div class="intel-byline"><strong>TransformerPath</strong><span class="intel-handle">@intel</span>' +
    '<span class="intel-date" title="Source date, not page-build time">' + date + '</span>' + age + '</div>' +
    '<h3 class="intel-headline"><a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(p.headline) + '</a></h3>' +
    (p.soWhat ? '<p class="intel-sowhat">' + esc(p.soWhat) + '</p>' : '') +
    relevance +
    '<div class="intel-meta">' + cls + prov +
    '<span class="intel-region">' + esc(p.region) + '</span>' +
    (p.value ? '<span class="val">' + esc(p.value) + '</span>' : '') +
    '<span class="src">' + esc(p.sourceName || p.src) + '</span></div>' +
    '</div></article>';
}

function injectMarker(page, id, inner) {
  const startM = '<!--SSR:' + id + '-->';
  const endM = '<!--/SSR:' + id + '-->';
  const cm = page.indexOf(startM);
  if (cm < 0) return page;
  const em = page.indexOf(endM, cm);
  if (em < 0) return page;
  return page.slice(0, cm + startM.length) + '\n' + inner + '\n' + page.slice(em);
}

// Build strict latest list (prefer FRESH/RECENT + active)
const latest = posts.filter(function (p) {
  if (p.desk === 'reference') return false;
  if (p.ageTier === 'FRESH' || p.ageTier === 'RECENT') return true;
  return p.isActive && (p.desk === 'news' || p.desk === 'grid' || p.desk === 'awards');
}).slice(0, 14);

let page = fs.readFileSync('intel.html', 'utf8');
if (page.indexOf('<!--SSR:intel-feed-->') >= 0) {
  page = injectMarker(page, 'intel-feed', latest.map(ssrCard).join(''));
  if (page.indexOf('<!--SSR:intel-timeline-->') >= 0) {
    page = injectMarker(page, 'intel-timeline', latest.map(ssrCard).join(''));
  }
  const newsNote = '<p class="intel-legacy-note">Comprehensive regional market intelligence across GCC, India, Europe, Americas, and Rest of World.</p>';
  if (page.indexOf('<!--SSR:panel-news-->') >= 0) {
    page = injectMarker(page, 'panel-news', newsNote);
  }
  fs.writeFileSync('intel.html', page);
  console.log('intel.html: SSR updated with ' + latest.length + ' fresh & recent timeline posts');
}
