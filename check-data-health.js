#!/usr/bin/env node
/* check-data-health.js — TransformerPath consolidated data-health / integrity gate.
 *
 * ONE command that orchestrates existing integrity gates and adds missing
 * detections. Produces a readable report on stdout and writes
 * qa/DATA-HEALTH-REPORT.txt. Does NOT mutate canonical data.
 *
 * Detects (errors fail the process; warnings are review items):
 *   - stale manufacturer-count copy (legacy census figures in count contexts)
 *   - duplicate canonical company IDs
 *   - orphan facilities / facilities without manufacturing evidence
 *   - capability summary contradicting evidence
 *   - annual MVA used as unit rating
 *   - Intel source missing / invalid status
 *   - date anomalies / future dates
 *   - duplicate canonical events
 *   - procurement status contradictions
 *   - stale commodity presentation
 *   - broken internal links
 *   - missing canonical tags
 *   - public admin artifacts
 *   - secret / service-role exposure
 *   - unexpected generated files
 *
 * Run: node check-data-health.js
 *      node check-data-health.js --skip-children   # inline checks only
 *      TP_DATA_HEALTH_SKIP_CHILDREN=1 node check-data-health.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const SKIP_CHILDREN =
  args.has('--skip-children') ||
  process.env.TP_DATA_HEALTH_SKIP_CHILDREN === '1';

const errors = [];
const warnings = [];
const sections = [];
const childResults = [];

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}
function exists(p) { return fs.existsSync(p); }
function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }

function fail(section, msg) {
  errors.push('[' + section + '] ' + msg);
}
function warn(section, msg) {
  warnings.push('[' + section + '] ' + msg);
}
function section(title, bodyLines) {
  sections.push({ title: title, lines: bodyLines || [] });
}

const SKIP_WALK = new Set([
  'node_modules', 'dist', 'archive', 'transformerpath', 'transformerpath-site',
  '.git', 'vendor', 'media', 'backup-pre-sprint', '_private', '_docs',
  'Transformer Equipments'
]);

function walkFiles(dir, pred, out) {
  out = out || [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (SKIP_WALK.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, pred, out);
    else if (!pred || pred(p, e.name)) out.push(p);
  }
  return out;
}

// ── Child-gate orchestration ───────────────────────────────────────────────
const CHILD_GATES = [
  { id: 'census-stale', script: 'check-census-stale.js', covers: 'stale manufacturer counts' },
  { id: 'voltage-evidence', script: 'check-voltage-evidence-consistency.js', covers: 'capability vs evidence' },
  { id: 'entity-canonical', script: 'check-entity-canonical.js', covers: 'alias redirects / competing OEM profiles' },
  { id: 'intel-date-order', script: 'check-intel-date-order.js', covers: 'intel date anomalies' },
  { id: 'links', script: 'check-links.js', covers: 'broken internal links' },
  { id: 'event-integrity', script: 'check-event-integrity.js', covers: 'duplicate events / status contradictions' },
  // check-data-quality.js stays a separate netlify gate (R1–R10). It is not
  // re-spawned here so this orchestrator stays focused on the Phase-20 list and
  // does not double-fail on pre-existing R8 alias-page / R9 audit findings.
  { id: 'archives', script: 'check-archives.js', covers: 'future/immutable archive dates' }
];

function runChildren() {
  const lines = [];
  if (SKIP_CHILDREN) {
    lines.push('Skipped (--skip-children / TP_DATA_HEALTH_SKIP_CHILDREN=1)');
    section('Child gates', lines);
    return;
  }
  for (const g of CHILD_GATES) {
    if (!exists(g.script)) {
      warn('child-gates', 'missing script ' + g.script);
      childResults.push({ id: g.id, ok: false, skipped: true });
      lines.push('SKIP  ' + g.id + ' — script missing');
      continue;
    }
    const r = spawnSync(process.execPath, [g.script], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024
    });
    const code = r.status == null ? 1 : r.status;
    const ok = code === 0;
    childResults.push({ id: g.id, ok: ok, code: code, covers: g.covers });
    const tail = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-2).join(' | ');
    if (ok) {
      lines.push('PASS  ' + g.id + ' — ' + g.covers + (tail ? ' :: ' + tail.slice(0, 140) : ''));
    } else {
      lines.push('FAIL  ' + g.id + ' — exit ' + code + (tail ? ' :: ' + tail.slice(0, 160) : ''));
      fail('child-gates', g.id + ' failed (exit ' + code + ') — ' + g.covers);
    }
  }
  section('Child gates', lines);
}

// ── 1. Stale manufacturer counts (inline belt-and-braces) ─────────────────
function checkStaleCensus() {
  const lines = [];
  const stats = readJson('data/site-stats.json', {});
  const canon = Number(stats.manufacturers);
  if (!canon || canon < 100) {
    fail('census', 'site-stats.manufacturers missing/invalid');
    lines.push('ERROR canonical manufacturers invalid');
    section('Stale manufacturer counts', lines);
    return;
  }
  lines.push('Canonical manufacturers = ' + canon);
  const staleRe = [
    { re: /\b1,?002\b/, label: '1002' },
    { re: /\b911\b/, label: '911' },
    { re: /\b709\b/, label: '709' }
  ];
  const CONTEXT = /maker|manufacturer|companies|company census|directory of|transformer (?:makers|companies|OEMs)|OEM census|sourced directory|total_companies|"m"\s*:\s*911|"manufacturers"\s*:\s*911/i;
  const hits = [];
  const scanRoots = ['index.html', 'manufacturers.html', 'faq.html', 'pricing.html', 'buyers-guide.html', 'data/site-stats.json', 'data/directory-health.json', 'data/map-points.json', 'site-stats.js'];
  for (const f of scanRoots) {
    if (!exists(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    text.split('\n').forEach(function (line, i) {
      for (const s of staleRe) {
        if (!s.re.test(line)) continue;
        if (s.label === '911' && /\+\d[\d\s]*911|\bext\.?\s*911|phone[^\n]{0,20}911/i.test(line)) continue;
        if (/911\s*→\s*906|911-to-906|reconciliation|forbidden hardcoded|stale 709/i.test(line)) continue;
        const kpi = new RegExp('"(?:manufacturers|total_companies|m)"\\s*:\\s*' + s.label.replace(',', '\\,?'), 'i');
        if (!CONTEXT.test(line) && !kpi.test(line)) continue;
        hits.push(f + ':' + (i + 1) + ' [' + s.label + ']');
      }
    });
  }
  // KPI drift
  const kpiChecks = [
    ['data/directory-health.json', function (j) { return j.kpi_summary && j.kpi_summary.total_companies; }],
    ['data/map-points.json', function (j) { return j.counts && j.counts.m; }],
    ['data/site-stats.json', function (j) { return j.manufacturers; }]
  ];
  for (const pair of kpiChecks) {
    const file = pair[0]; const pick = pair[1];
    if (!exists(file)) continue;
    const n = pick(readJson(file, {}));
    if (n != null && Number(n) !== canon) {
      hits.push(file + ' KPI ' + n + ' != canonical ' + canon);
    }
  }
  if (hits.length) {
    hits.slice(0, 20).forEach(function (h) { fail('census', h); lines.push('ERROR ' + h); });
  } else {
    lines.push('OK — no stale 709/911/1002 manufacturer-count copy in key surfaces');
  }
  section('Stale manufacturer counts', lines);
}

// ── 2. Duplicate canonical company IDs ─────────────────────────────────────
function checkDuplicateCompanyIds() {
  const lines = [];
  const sources = [
    ['data/companies.json', function (j) { return j.companies || []; }, function (c) { return c.id; }],
    ['data/directory-index.json', function (j) { return j.companies || []; }, function (c) { return c.canonical_id || c.id; }],
    ['data/manufacturer-intel.json', function (j) { return j.companies || []; }, function (c) { return c.id || (String(c.name || '').toLowerCase() + '|' + String(c.country || '').toLowerCase()); }]
  ];
  for (const src of sources) {
    const file = src[0]; const listFn = src[1]; const keyFn = src[2];
    if (!exists(file)) { warn('dup-ids', 'missing ' + file); continue; }
    const list = listFn(readJson(file, {}));
    const seen = Object.create(null);
    let dups = 0;
    list.forEach(function (c) {
      const k = keyFn(c);
      if (!k) return;
      if (seen[k]) {
        dups++;
        fail('dup-ids', file + ' duplicate canonical id ' + k);
      }
      seen[k] = 1;
    });
    lines.push(file + ': ' + list.length + ' records, duplicates=' + dups);
  }
  if (!errors.some(function (e) { return e.indexOf('[dup-ids]') === 0; })) {
    lines.push('OK — no duplicate canonical company IDs');
  }
  section('Duplicate canonical company IDs', lines);
}

// ── 3. Orphan facilities / no manufacturing evidence ───────────────────────
function checkFacilities() {
  const lines = [];
  const facDoc = readJson('data/facilities.json', {});
  const facs = facDoc.facilities || [];
  const comps = (readJson('data/companies.json', {}).companies) || [];
  const companyIds = new Set(comps.map(function (c) { return c.id; }));
  const facIds = new Set(facs.map(function (f) { return f.id; }));

  let orphanCompany = 0;
  let noLocation = 0;
  let noEvidence = 0;
  const orphanSamples = [];
  const noEvSamples = [];

  facs.forEach(function (f) {
    if (f.company_id && !companyIds.has(f.company_id)) {
      orphanCompany++;
      if (orphanSamples.length < 8) orphanSamples.push(f.id + ' → ' + f.company_id);
    }
    if (!f.country && !f.city) noLocation++;
    const evidence =
      f.public_count === true ||
      !!String(f.produces || '').trim() ||
      /^(INDEPENDENTLY_SOURCED|COMPANY_REPORTED)$/i.test(String(f.claim_type || '')) ||
      !!String((f.capabilities && f.capabilities.produces) || '').trim();
    if (!evidence) {
      noEvidence++;
      if (noEvSamples.length < 5) noEvSamples.push(f.id);
    }
  });

  // Company → facility_ids pointing at missing facilities
  let brokenRefs = 0;
  comps.forEach(function (c) {
    (c.facility_ids || []).forEach(function (fid) {
      if (!facIds.has(fid)) {
        brokenRefs++;
        if (brokenRefs <= 8) fail('facilities', 'company ' + c.id + ' references missing facility ' + fid);
      }
    });
  });

  if (orphanCompany) {
    orphanSamples.forEach(function (s) { fail('facilities', 'orphan facility (unknown company_id): ' + s); });
    fail('facilities', orphanCompany + ' facilities with company_id not in companies.json');
  }
  if (noLocation) {
    fail('facilities', noLocation + ' facilities missing both country and city');
  }
  // Census-only sites without manufacturing evidence are expected at scale — warn, do not fail.
  if (noEvidence) {
    warn('facilities', noEvidence + '/' + facs.length + ' facilities lack manufacturing evidence (census-only / review). Samples: ' + noEvSamples.join(', '));
  }

  lines.push('Facilities=' + facs.length + ' public_count≈' + (facDoc.public_count || 'n/a'));
  lines.push('Orphan company_id=' + orphanCompany + ' | missing location=' + noLocation + ' | broken facility_ids refs=' + brokenRefs);
  lines.push('Without manufacturing evidence=' + noEvidence + ' (warning — not auto-deleted)');
  section('Orphan facilities / manufacturing evidence', lines);
}

// ── 4. Capability summary contradicting evidence ───────────────────────────
function checkCapabilityEvidence() {
  const lines = [];
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  const tiers = readJson('data/manufacturer-tiers.json', []);
  const prov = readJson('data/manufacturer-provenance.json', []);
  const byName = Object.create(null);
  (Array.isArray(prov) ? prov : []).forEach(function (p) { byName[norm(p.name)] = p; });

  let raised = 0;
  (Array.isArray(tiers) ? tiers : []).forEach(function (t) {
    if (!t || !t.name) return;
    const p = byName[norm(t.name)];
    if (!p) return;
    let maxEv = 0;
    (p.facts || []).forEach(function (f) {
      if (f.field !== 'voltage_class_evidence') return;
      if (/REJECT/i.test(String(f.confidence || ''))) return;
      const v = typeof f.value === 'number' ? f.value : parseFloat(f.value);
      if (!isNaN(v) && v > maxEv) maxEv = v;
    });
    const tierKv = typeof t.kv === 'number' ? t.kv : parseFloat(t.kv) || 0;
    // Evidence above tier is the CG Power class — pages must surface MAX(tier, evidence).
    // Tier above sparse evidence is allowed (tier may cite broader disclosures).
    if (maxEv > tierKv) raised++;
  });

  // CG Power regression anchor (same as voltage-evidence gate)
  const cgProv = byName[norm('CG Power')] || byName[norm('CG Power and Industrial Solutions Limited')] ||
    Object.keys(byName).map(function (k) { return byName[k]; }).find(function (p) { return /cg power/i.test(p.name || ''); });
  let cgMax = 0;
  if (cgProv) {
    (cgProv.facts || []).forEach(function (f) {
      if (f.field !== 'voltage_class_evidence') return;
      if (/REJECT/i.test(String(f.confidence || ''))) return;
      const v = typeof f.value === 'number' ? f.value : parseFloat(f.value);
      if (!isNaN(v) && v > cgMax) cgMax = v;
    });
  }
  if (cgMax < 765) {
    fail('capability', 'CG Power must expose ≥765 kV accepted voltage evidence (got ' + cgMax + ')');
  } else {
    lines.push('CG Power evidence max = ' + cgMax + ' kV');
  }
  lines.push('Manufacturers with evidence>tier: ' + raised + ' (summary must use MAX — enforced via child voltage-evidence gate)');
  section('Capability summary vs evidence', lines);
}

// ── 5. Annual MVA used as unit rating ──────────────────────────────────────
function checkAnnualMvaAsUnit() {
  const lines = [];
  let hard = 0;

  const intel = (readJson('data/manufacturer-intel.json', {}).companies) || [];
  intel.forEach(function (c) {
    const mva = c.reported_mva;
    if (typeof mva === 'number' && mva > 2500) {
      hard++;
      fail('annual-mva', c.name + ' reported_mva=' + mva + ' looks like annual throughput used as unit rating');
    }
  });

  const tiers = readJson('data/manufacturer-tiers.json', []);
  (Array.isArray(tiers) ? tiers : []).forEach(function (t) {
    const note = String(t.note || '') + ' ' + String(t.capNote || '');
    const annualNote = /annual|MVA\/year|per year|throughput/i.test(note);
    // Unit ceiling field holding an annual-scale number
    if (typeof t.cap === 'number' && t.cap > 2500) {
      hard++;
      fail('annual-mva', t.name + ' cap(unit)=' + t.cap + ' >2500 MVA — annual capacity misfiled as unit rating');
    }
    // Explicit annual figure also stored as the only "mva" with no cap separation when note says annual
    if (annualNote && typeof t.mva === 'number' && t.mva > 0 && (t.cap == null || t.cap === t.mva) && t.mva > 5000) {
      warn('annual-mva', t.name + ' annual envelope ' + t.mva + ' MVA with no distinct unit cap — confirm separation');
    }
  });

  const dir = (readJson('data/directory-index.json', {}).companies) || [];
  dir.forEach(function (c) {
    if (typeof c.mva === 'number' && c.mva > 2500 && !c.annual_mva_capacity) {
      hard++;
      fail('annual-mva', (c.name || c.canonical_id) + ' directory mva=' + c.mva + ' without annual_mva_capacity disambiguation');
    }
  });

  lines.push('Hard annual-as-unit findings: ' + hard);
  if (!hard) lines.push('OK — no annual MVA misfiled as unit rating');
  section('Annual MVA vs unit rating', lines);
}

// ── 6. Intel source missing / invalid status ───────────────────────────────
const VALID_EVIDENCE = new Set(['CONFIRMED', 'SUPPORTED', 'REVIEW_REQUIRED', 'REJECTED']);
const VALID_PUBLIC_STATUS = new Set([
  'DATA CURRENT', 'REFRESH DELAYED', 'DATA STALE', 'INTEL COVERAGE DELAYED',
  'HEALTHY', 'AGING', 'STALE'
]);

function checkIntelSources() {
  const lines = [];
  const feed = readJson('data/intel-feed-ui.json', {});
  const posts = feed.posts || feed.items || [];
  let missing = 0;
  posts.forEach(function (p) {
    const has = !!(p.url || p.src || p.sourceName || (p.provenance && (p.provenance.url || p.provenance.source)));
    if (!has) {
      missing++;
      if (missing <= 12) fail('intel-source', 'feed post missing source: ' + (p.id || p.headline || '(untitled)'));
    }
  });
  lines.push('Intel feed posts=' + posts.length + ' missing source=' + missing);

  const cand = (readJson('data/gcc-discovery-candidates.json', {}).candidates) || [];
  let badGrade = 0;
  let publishedNoSource = 0;
  cand.forEach(function (c) {
    if (c.evidence_grade && !VALID_EVIDENCE.has(c.evidence_grade)) {
      badGrade++;
      fail('intel-source', c.candidate_id + ' invalid evidence_grade=' + c.evidence_grade);
    }
    const srcs = c.sources || [];
    const hasSrc = (Array.isArray(srcs) && srcs.length) || c.source_url || c.source;
    if ((c.published_to_intel || c.publish_decision === 'PUBLISH') && !hasSrc) {
      publishedNoSource++;
      fail('intel-source', c.candidate_id + ' published/publishable without source');
    }
  });
  lines.push('GCC candidates=' + cand.length + ' bad grade=' + badGrade + ' published-without-source=' + publishedNoSource);

  const fresh = readJson('data/freshness.json', {});
  const di = ((fresh && fresh.surfaces) || []).find(function (s) { return s.id === 'daily_intel'; });
  if (!di) {
    fail('intel-source', 'daily_intel surface missing from freshness.json');
  } else {
    const pub = di.public_status || di.status_label || di.status;
    if (pub && !VALID_PUBLIC_STATUS.has(String(pub))) {
      // Allow compound labels already in production set; unknown → error
      fail('intel-source', 'invalid daily_intel public status: ' + pub);
    } else {
      lines.push('daily_intel status=' + pub);
    }
  }
  section('Intel source / status', lines);
}

// ── 7. Date anomalies / future dates ───────────────────────────────────────
function checkDateAnomalies() {
  const lines = [];
  const today = new Date().toISOString().slice(0, 10);
  const tomorrowPad = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  let future = 0;

  function checkIso(where, label, v, opts) {
    if (!v) return;
    const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return;
    opts = opts || {};
    // Year-only precision commonly uses YYYY-12-31 as a sentinel — review, not hard fail.
    if (opts.precision === 'year' || opts.precision === 'month') {
      if (m[1] > tomorrowPad) {
        warn('dates', where + ' ' + label + '=' + m[1] + ' (precision=' + opts.precision + ') is after today — review sentinel');
      }
      return;
    }
    // Allow near-term scheduled event dates; flag publication / observed / build stamps in the future
    if (/publish|observed|generated|build|checked|refresh|source_date|dateIso/i.test(label) && m[1] > tomorrowPad) {
      future++;
      if (future <= 15) fail('dates', where + ' ' + label + '=' + m[1] + ' is in the future');
    }
  }

  const feed = readJson('data/intel-feed-ui.json', {});
  (feed.posts || []).forEach(function (p) {
    checkIso('intel:' + (p.id || ''), 'dateIso', p.dateIso || p.date, { precision: p.datePrecision });
    checkIso('intel:' + (p.id || ''), 'publication', p.publication_date, { precision: p.datePrecision });
  });

  const mats = (readJson('data/materials.json', {}).materials) || [];
  mats.forEach(function (m) {
    checkIso('materials:' + (m.material || m.id), 'observation_date', m.observation_date);
  });

  const fresh = readJson('data/freshness.json', {});
  checkIso('freshness', 'generated', fresh.generated);
  ((fresh.surfaces) || []).forEach(function (s) {
    checkIso('freshness:' + s.id, 'last_successful_refresh', s.last_successful_refresh || s.last_data_refresh);
  });

  // Dated intel archives must not be future editions
  fs.readdirSync('.').filter(function (f) { return /^intel-2026-\d{2}-\d{2}\.html$/.test(f); }).forEach(function (f) {
    const dm = f.match(/^intel-2026-(\d{2})-(\d{2})\.html$/);
    const iso = '2026-' + dm[1] + '-' + dm[2];
    if (iso > today) {
      future++;
      fail('dates', f + ' edition date is in the future');
    }
  });

  lines.push('Future-date hard findings: ' + future + ' (today=' + today + ')');
  if (!future) lines.push('OK — no future publication/observation/archive dates');
  section('Date anomalies', lines);
}

// ── 8. Duplicate canonical events ──────────────────────────────────────────
function checkDuplicateEvents() {
  const lines = [];
  const series = (readJson('data/event-series.json', {}).series) || [];
  const seen = Object.create(null);
  let dups = 0;
  series.forEach(function (s) {
    (s.editions || []).forEach(function (ed) {
      const k = (s.key || s.name) + '|' + ed.year;
      if (seen[k]) {
        dups++;
        fail('events', 'duplicate canonical edition ' + s.name + ' ' + ed.year + ' (' + ed.slug + ' vs ' + seen[k] + ')');
      }
      seen[k] = ed.slug || ed.name;
    });
  });
  // Flat events list
  const flat = readJson('data/events-canonical.json', null) || readJson('data/events.json', null);
  const editions = (flat && (flat.events || flat.editions || flat)) || [];
  if (Array.isArray(editions)) {
    const slugSeen = Object.create(null);
    editions.forEach(function (e) {
      const slug = e.slug || e.id;
      if (!slug || typeof e !== 'object') return;
      if (slugSeen[slug]) {
        dups++;
        fail('events', 'duplicate event slug ' + slug);
      }
      slugSeen[slug] = 1;
    });
  }
  lines.push('Duplicate canonical editions/slugs: ' + dups);
  if (!dups) lines.push('OK — no duplicate canonical events');
  section('Duplicate canonical events', lines);
}

// ── 9. Procurement status contradictions ───────────────────────────────────
const PROC_STATES = new Set(['ANNOUNCED', 'OPEN', 'BIDS_OPENED', 'UNDER_EVALUATION', 'AWARDED', 'CLOSED', 'CANCELLED']);
const TERMINAL = new Set(['AWARDED', 'CLOSED', 'CANCELLED']);

function checkProcurement() {
  const lines = [];
  let hard = 0;
  const cand = (readJson('data/gcc-discovery-candidates.json', {}).candidates) || [];
  const byProc = Object.create(null);

  cand.forEach(function (c) {
    const st = c.procurement_state;
    if (st && !PROC_STATES.has(st)) {
      hard++;
      fail('procurement', c.candidate_id + ' invalid procurement_state=' + st);
    }
    const events = c.procurement_events || [];
    if (events.length) {
      // Chronological contradiction: a later event re-opens after CANCELLED without supersede note
      const ordered = events.slice().sort(function (a, b) {
        return String(a.at || '').localeCompare(String(b.at || ''));
      });
      let sawTerminal = null;
      ordered.forEach(function (ev) {
        const s = ev.state || ev.status;
        if (!s) return;
        if (!PROC_STATES.has(s)) {
          hard++;
          fail('procurement', c.candidate_id + ' invalid event state=' + s);
        }
        if (sawTerminal && !TERMINAL.has(s) && s !== sawTerminal) {
          hard++;
          fail('procurement', c.candidate_id + ' procurement reopened after terminal state ' + sawTerminal + ' → ' + s);
        }
        if (TERMINAL.has(s)) sawTerminal = s;
      });
      const last = ordered[ordered.length - 1];
      const lastState = last && (last.state || last.status);
      if (lastState && st && lastState !== st && !(st === 'OPEN' && lastState === 'ANNOUNCED')) {
        // Current state should match latest event (ANNOUNCED→OPEN same-day is OK if current is OPEN)
        if (!(TERMINAL.has(st) && TERMINAL.has(lastState))) {
          warn('procurement', c.candidate_id + ' procurement_state=' + st + ' but latest event=' + lastState);
        }
      }
    }
    const pid = c.canonical_procurement_id || c.tender_id;
    if (pid) {
      byProc[pid] = byProc[pid] || [];
      byProc[pid].push(c);
    }
  });

  Object.keys(byProc).forEach(function (pid) {
    const rows = byProc[pid];
    if (rows.length < 2) return;
    const states = Array.from(new Set(rows.map(function (r) { return r.procurement_state; }).filter(Boolean)));
    const hasOpen = states.indexOf('OPEN') >= 0 || states.indexOf('ANNOUNCED') >= 0;
    const hasTerm = states.some(function (s) { return TERMINAL.has(s); });
    if (hasOpen && hasTerm) {
      hard++;
      fail('procurement', 'canonical id ' + pid + ' has concurrent OPEN/ANNOUNCED and terminal states: ' + states.join(','));
    }
  });

  // Tender OPEN while an award row exists for the same tender_id
  const tenders = (readJson('data/tenders.json', {}).tenders) || [];
  const awards = (readJson('data/awards.json', {}).awards) || [];
  const awardedIds = new Set(awards.map(function (a) { return a.tender_id; }).filter(Boolean));
  tenders.forEach(function (t) {
    const st = t.status || t.stage;
    const tid = t.tender_id;
    if (tid && awardedIds.has(tid) && (st === 'OPEN' || st === 'CLOSING_SOON' || st === 'EXPECTED')) {
      hard++;
      fail('procurement', 'tender ' + tid + ' status=' + st + ' but awards.json has an award row');
    }
  });

  lines.push('Hard procurement contradictions: ' + hard);
  if (!hard) lines.push('OK — no procurement status contradictions');
  section('Procurement status', lines);
}

// ── 10. Stale commodity presentation ───────────────────────────────────────
function checkCommodityPresentation() {
  const lines = [];
  const mats = (readJson('data/materials.json', {}).materials) || [];
  mats.forEach(function (m) {
    const aged = /^(STALE|AGING|HISTORICAL)$/i.test(String(m.freshness_status || m.age_class || ''));
    const pres = String(m.presentation || '');
    if (aged && m.price != null && !/historical market reference/i.test(pres)) {
      fail('commodity', (m.material || m.id) + ' aged priced ref lacks Historical market reference presentation (got "' + pres + '")');
    }
    if (/live feed|live price|real-?time/i.test(pres)) {
      fail('commodity', (m.material || m.id) + ' presentation claims live pricing');
    }
  });

  // Public HTML must not show badge text STALE for LME cards when presentation is Historical
  ['materials.html', 'index.html'].forEach(function (f) {
    if (!exists(f)) return;
    const html = fs.readFileSync(f, 'utf8');
    if (/>\s*STALE\s*</.test(html) && /copper|aluminium|Historical market reference/i.test(html)) {
      // Allow intel "DATA STALE" copy; flag commodity badge specifically
      if (/basis[^>]*>\s*STALE\s*</i.test(html) || /class="[^"]*basis[^"]*"[^>]*>\s*STALE/i.test(html)) {
        fail('commodity', f + ' still presents public STALE badge for materials');
      } else {
        warn('commodity', f + ' contains STALE token — verify not a commodity public badge');
      }
    }
    if (/\blive feed\b/i.test(html) && /data-m=["']copper|Materials Intelligence/i.test(html)) {
      // "never presented as a live feed" is OK; positive "is a live feed" is not
      if (!/not a live feed|never (?:presented as )?a live feed|not live/i.test(html)) {
        fail('commodity', f + ' may present commodities as a live feed');
      }
    }
  });

  lines.push('Materials rows checked: ' + mats.length);
  section('Stale commodity presentation', lines);
}

// ── 11. Broken internal links (sampled + child gate) ───────────────────────
function checkLinksInline() {
  const lines = [];
  // Lightweight sample of root pages; full scan is the child gate.
  const pages = ['index.html', 'intel.html', 'manufacturers.html', 'materials.html', 'events.html', 'pricing.html'];
  let broken = 0;
  pages.forEach(function (f) {
    if (!exists(f)) return;
    const html = fs.readFileSync(f, 'utf8').replace(/\$\{[^}]*\}/g, 'JS');
    const re = /(?:href|src)\s*=\s*["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(html))) {
      const target = m[1];
      if (!target || /^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(target)) continue;
      if (/(?:^|[/_\-.#?])JS(?:[/.#?]|$)/.test(target)) continue;
      const clean = target.split('#')[0].split('?')[0];
      if (!clean) continue;
      const resolved = clean.startsWith('/')
        ? path.resolve(ROOT, clean.slice(1))
        : path.resolve(path.dirname(path.resolve(ROOT, f)), clean);
      if (fs.existsSync(resolved)) continue;
      if (!path.extname(resolved) && (fs.existsSync(resolved + '.html') || fs.existsSync(path.join(resolved, 'index.html')))) continue;
      broken++;
      if (broken <= 12) fail('links', f + ' → ' + target);
    }
  });
  lines.push('Sampled root pages broken links: ' + broken + (SKIP_CHILDREN ? '' : ' (full scan via child gate check-links.js)'));
  section('Broken internal links (sample)', lines);
}

// ── 12. Missing canonical tags ─────────────────────────────────────────────
function checkCanonicalTags() {
  const lines = [];
  const exempt = /^(404|offline|admin|claim|tutorial|tx-design-masterclass|hero-3d|viz-lab)\.html$/i;
  const rootHtml = fs.readdirSync('.').filter(function (f) { return f.endsWith('.html') && !/^intel-2026-/.test(f); });
  let missing = 0;
  rootHtml.forEach(function (f) {
    if (exempt.test(f)) return;
    const html = fs.readFileSync(f, 'utf8');
    if (!/rel\s*=\s*["']canonical["']/i.test(html)) {
      missing++;
      fail('canonical', f + ' missing <link rel="canonical">');
    }
  });
  lines.push('Root public HTML missing canonical: ' + missing + ' / ' + rootHtml.length);
  section('Missing canonical tags', lines);
}

// ── 13. Public admin artifacts ─────────────────────────────────────────────
function checkAdminArtifacts() {
  const lines = [];
  const adminFiles = ['admin.html'].concat(
    exists('admin') ? walkFiles('admin', function (p, name) { return name.endsWith('.html'); }) : []
  );
  adminFiles.forEach(function (f) {
    const relF = rel(f);
    if (!exists(f)) return;
    const html = fs.readFileSync(f, 'utf8');
    if (!/noindex/i.test(html)) {
      fail('admin', relF + ' is publicly shipped without noindex');
    }
    // Hard-coded plaintext passwords
    if (/password\s*=\s*["'][^"']{1,64}["']/i.test(html) && !/PW_HASH|sha256|hash/i.test(html)) {
      fail('admin', relF + ' appears to embed a plaintext password');
    }
  });
  if (exists('sitemap.xml')) {
    const sm = fs.readFileSync('sitemap.xml', 'utf8');
    if (/admin\.html|\/admin\//i.test(sm)) {
      fail('admin', 'sitemap.xml lists admin surfaces');
    } else {
      lines.push('OK — admin not in sitemap.xml');
    }
  }
  if (exists('robots.txt')) {
    const rb = fs.readFileSync('robots.txt', 'utf8');
    if (!/Disallow:\s*\/admin/i.test(rb)) {
      warn('admin', 'robots.txt does not Disallow /admin');
    } else {
      lines.push('OK — robots.txt Disallow admin');
    }
  }
  lines.push('Admin HTML files checked: ' + adminFiles.length + ' (must remain noindex; client hash is not authorization)');
  section('Public admin artifacts', lines);
}

// ── 14. Secret / service-role exposure ─────────────────────────────────────
function checkSecretExposure() {
  const lines = [];
  const secretRes = [
    { re: /sb_secret_[A-Za-z0-9_-]{10,}/g, label: 'supabase service secret' },
    { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, label: 'JWT-like token' },
    { re: /sk_live_[A-Za-z0-9]{10,}/g, label: 'stripe live secret' },
    { re: /sk_test_[A-Za-z0-9]{20,}/g, label: 'stripe test secret' },
    { re: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+['"]/g, label: 'service role assignment' }
  ];
  // Client-reachable surfaces only (not functions/ — those stay server-side)
  const clients = walkFiles('.', function (p, name) {
    const r = rel(p);
    if (/^functions\//.test(r)) return false;
    if (/^tests\//.test(r)) return false;
    if (/^check-|^build-|^stamp-|^merge-|^audit-/.test(name)) return false;
    return /\.(html|js|json)$/i.test(name);
  });

  let hits = 0;
  clients.forEach(function (p) {
    const r = rel(p);
    // Known-safe public publishable config
    if (r === 'supabase-config.js') {
      const t = fs.readFileSync(p, 'utf8');
      if (/service_role|sb_secret_|eyJhbGci/i.test(t) && /["']eyJ/.test(t)) {
        hits++;
        fail('secrets', 'supabase-config.js appears to embed a service-role JWT');
      }
      return;
    }
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
    if (text.length > 2e6) return;
    for (const s of secretRes) {
      s.re.lastIndex = 0;
      const m = text.match(s.re);
      if (!m) continue;
      // Allow documentation placeholders in comments inside nested forks already skipped
      const real = m.filter(function (tok) {
        return !/sb_secret_\.\.\.|sk_live_\.\.\.|YOUR_|REPLACE_|example/i.test(tok);
      });
      if (!real.length) continue;
      hits += real.length;
      fail('secrets', r + ' may expose ' + s.label + ' (' + real[0].slice(0, 24) + '…)');
    }
  });
  lines.push('Client-side secret-pattern hits: ' + hits);
  if (!hits) lines.push('OK — no service-role / sk_live exposure in client surfaces');
  section('Secret / service-role exposure', lines);
}

// ── 15. Unexpected generated files ─────────────────────────────────────────
function checkUnexpectedGenerated() {
  const lines = [];
  const conflict = / \d{1,2}(\.[^./]+)?$/;
  const bad = [];
  walkFiles('.', function (p, name) {
    if (conflict.test(name)) bad.push(rel(p));
    return false;
  });
  // Also catch root-level unexpected dumps
  ['americas_transformer_projects.json', 'asia_transformer_projects.json', '_sync_diag.js', '_merge_validate.js'].forEach(function (f) {
    if (exists(f)) bad.push(f + ' (unexpected generated dump at repo root)');
  });

  bad.forEach(function (b) { fail('generated', 'unexpected generated/conflict file: ' + b); });
  lines.push('Unexpected generated/conflict files: ' + bad.length);
  if (!bad.length) lines.push('OK — no iCloud conflict copies or stray project dumps at scan roots');
  section('Unexpected generated files', lines);
}

// ── Legacy smoke (entity census + search) from tests/check-data-health.js ──
function checkLegacySmoke() {
  const lines = [];
  const STATS = readJson('data/site-stats.json', {});
  const MANUF = readJson('data/manufacturers.json', []);
  const DIR = readJson('data/directory-index.json', {});
  const companies = DIR.companies || [];
  const totalMakers = (Array.isArray(MANUF) ? MANUF : []).reduce(function (s, g) {
    return s + (g.makers || []).filter(function (m) { return !/^Served by/i.test(m[0]); }).length;
  }, 0);
  if (totalMakers !== STATS.manufacturers) {
    fail('census-smoke', 'manufacturers.json count ' + totalMakers + ' != site-stats ' + STATS.manufacturers);
  } else {
    lines.push('Census makers match site-stats (' + totalMakers + ')');
  }
  const projects = (readJson('data/projects.json', {}).projects) || [];
  const tenders = (readJson('data/tenders.json', {}).tenders) || [];
  const grids = readJson('data/grids.json', []);
  if (projects.length !== STATS.projects) fail('census-smoke', 'projects drift ' + projects.length + ' vs ' + STATS.projects);
  if (tenders.length !== STATS.tenders) fail('census-smoke', 'tenders drift ' + tenders.length + ' vs ' + STATS.tenders);
  if (Array.isArray(grids) && grids.length !== STATS.countries) fail('census-smoke', 'grids drift ' + grids.length + ' vs ' + STATS.countries);

  const ACCS = (readJson('data/accessories.json', {}).suppliers) || [];
  function testSearch(q) {
    const query = q.toLowerCase();
    const cHits = companies.filter(function (c) {
      return ((c.name || '') + ' ' + (c.country || '') + ' ' + (c.capability_labels || []).join(' ')).toLowerCase().indexOf(query) >= 0;
    }).length;
    const aHits = ACCS.filter(function (a) {
      return ((a.name || '') + ' ' + (a.category || '') + ' ' + (a.products || []).join(' ')).toLowerCase().indexOf(query) >= 0;
    }).length;
    return cHits + aHits;
  }
  ['765 kV', 'Transformerboard', 'OLTC', 'Saudi Arabia', 'India'].forEach(function (q) {
    const n = testSearch(q);
    if (n <= 0) fail('search-smoke', 'query "' + q + '" returned 0 hits');
    else lines.push('Search "' + q + '" → ' + n + ' hits');
  });
  section('Census + search smoke', lines);
}

// ── Report ─────────────────────────────────────────────────────────────────
function writeReport(ok) {
  const out = [];
  out.push('TransformerPath DATA HEALTH REPORT');
  out.push('Generated: ' + new Date().toISOString());
  out.push('Result: ' + (ok ? 'PASS' : 'FAIL'));
  out.push('Errors: ' + errors.length + ' | Warnings: ' + warnings.length);
  out.push('Child gates skipped: ' + (SKIP_CHILDREN ? 'yes' : 'no'));
  out.push('');
  sections.forEach(function (s) {
    out.push('## ' + s.title);
    (s.lines || []).forEach(function (l) { out.push('  ' + l); });
    out.push('');
  });
  if (warnings.length) {
    out.push('## Warnings (review — non-blocking)');
    warnings.forEach(function (w) { out.push('  ⚠ ' + w); });
    out.push('');
  }
  if (errors.length) {
    out.push('## Errors (blocking)');
    errors.forEach(function (e) { out.push('  ✗ ' + e); });
    out.push('');
  } else {
    out.push('## Errors');
    out.push('  (none)');
    out.push('');
  }
  out.push('Pre-existing review notes:');
  out.push('  - Many facilities are census-listed without independent manufacturing evidence; counted as warnings, not deleted.');
  out.push('  - Event editions without provenance source remain advisory via check-event-integrity.');
  out.push('  - Admin HTML is intentionally published behind noindex + robots Disallow; client hash is not server auth.');
  out.push('  - check-data-quality.js remains a separate netlify gate (not re-spawned here). Known open classes:');
  out.push('      R8 alias manufacturer pages missing corrections CTA; R9 census-audit total drift vs config.');
  out.push('    Do not weaken that gate — triage those findings on their own track.');
  out.push('  - Intel feed year-precision rows may use YYYY-12-31 sentinels; flagged as warnings when after today.');
  out.push('');

  if (!exists('qa')) fs.mkdirSync('qa', { recursive: true });
  const reportPath = path.join('qa', 'DATA-HEALTH-REPORT.txt');
  fs.writeFileSync(reportPath, out.join('\n') + '\n');
  return reportPath;
}

function main() {
  console.log('══════════════════════════════════════════════════');
  console.log(' TransformerPath — consolidated data-health gate');
  console.log('══════════════════════════════════════════════════');

  runChildren();
  checkStaleCensus();
  checkDuplicateCompanyIds();
  checkFacilities();
  checkCapabilityEvidence();
  checkAnnualMvaAsUnit();
  checkIntelSources();
  checkDateAnomalies();
  checkDuplicateEvents();
  checkProcurement();
  checkCommodityPresentation();
  checkLinksInline();
  checkCanonicalTags();
  checkAdminArtifacts();
  checkSecretExposure();
  checkUnexpectedGenerated();
  checkLegacySmoke();

  const ok = errors.length === 0;
  const reportPath = writeReport(ok);

  sections.forEach(function (s) {
    console.log('\n▸ ' + s.title);
    (s.lines || []).forEach(function (l) { console.log('  ' + l); });
  });
  if (warnings.length) {
    console.log('\nWarnings (' + warnings.length + '):');
    warnings.slice(0, 40).forEach(function (w) { console.warn('  ⚠ ' + w); });
    if (warnings.length > 40) console.warn('  … +' + (warnings.length - 40) + ' more');
  }
  console.log('\nReport: ' + reportPath);
  if (!ok) {
    console.error('\nDATA HEALTH FAIL — ' + errors.length + ' error(s):');
    errors.slice(0, 60).forEach(function (e) { console.error('  ✗ ' + e); });
    if (errors.length > 60) console.error('  … +' + (errors.length - 60) + ' more');
    process.exit(1);
  }
  console.log('\n✅ DATA HEALTH PASS — ' + warnings.length + ' warning(s) for review');
  process.exit(0);
}

main();
