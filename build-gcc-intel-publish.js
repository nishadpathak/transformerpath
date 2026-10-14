#!/usr/bin/env node
/* build-gcc-intel-publish.js — promote graded GCC discovery candidates into Intel.
 *
 * Desk path: data/gcc-discovery-publish-overrides.json approve[] releases a
 * held candidate (HOLD_FOR_REVIEW / REVIEW_QUEUE), including SUPPORTED items.
 * reject[] never publishes. INTERNAL_COVERAGE_ONLY and REVIEW_REQUIRED stay off
 * the feed. CONFIRMED items that are not still in the review queue publish
 * without a desk row. The SUPPORTED allowlist does not bypass a hold.
 *
 * SUPPORTED releases keep evidence_grade SUPPORTED (never relabeled CONFIRMED).
 * Idempotent via INJECT:GCC_DISCOVERY markers in intel.html.
 *
 * Run after build-gcc-intel-discovery.js and before build-intel-feed-ui.js.
 */
'use strict';
const fs = require('fs');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}
function jstr(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '\\n');
}

const candidatesDoc = readJson('data/gcc-discovery-candidates.json', { candidates: [] });
const candidates = candidatesDoc.candidates || [];
const overrides = readJson('data/gcc-discovery-publish-overrides.json', { approve: [], reject: [] });
const APPROVE = new Set(overrides.approve || []);
const REJECT = new Set(overrides.reject || []);

const ALLOW_SUPPORTED_IDS = new Set([
  'uae-dewa-2122600155',
  'kw-mewre-75mva-stage1',
  'kw-mewre-75mva-relocation',
  'kw-mewre-75mva-stage2',
  'sa-swa-jubail-grounding',
  'sa-al-aflaj-33kv-replacement',
  'sa-dhahran-1500kva-standby',
  'sa-swa-yanbu-t803-supervision'
]);

function shouldPublish(c) {
  if (!c || c.publish_decision === 'INTERNAL_COVERAGE_ONLY') return false;
  if (REJECT.has(c.candidate_id)) return false;
  if (c.evidence_grade === 'REJECTED' || c.evidence_grade === 'REVIEW_REQUIRED') return false;
  // Already curated under a near-duplicate headline in NEWS.GCC
  if (c.candidate_id === 'om-localisation-aug12') return false;
  // Desk approve[] is the only release for a candidate still in the review queue.
  // A SUPPORTED allowlist must not publish the rest of the held set.
  if (APPROVE.has(c.candidate_id)) return true;
  if (c.publish_decision === 'HOLD_FOR_REVIEW' || c.publish_decision === 'REVIEW_QUEUE') return false;
  if (c.evidence_grade === 'CONFIRMED') return true;
  if (c.evidence_grade === 'SUPPORTED' && ALLOW_SUPPORTED_IDS.has(c.candidate_id)) return true;
  return false;
}

function toIntelItem(c) {
  const dates = c.dates || {};
  const primary = (c.sources || []).find(function (s) { return s.role === 'PRIMARY'; }) || (c.sources || [])[0] || {};
  const srcName = primary.source_id || primary.source_type || 'GCC source';
  // Age anchor = observation dates only (update / float / publication / event).
  // NEVER use tender_close_date — a future close made DEWA look like Oct 2026
  // ("stale forever") and MEWRE relocation stamp as 30 Nov 2026.
  const todayIso = new Date().toISOString().slice(0, 10);
  const candidates = [
    dates.update_date,
    dates.tender_float_date,
    dates.publication_date,
    dates.event_date
  ].filter(Boolean);
  let displayDate = null;
  candidates.forEach(function (d) {
    const day = String(d).slice(0, 10);
    if (day > todayIso) return; // ignore future-dated labels
    if (!displayDate || day > displayDate) displayDate = day;
  });
  if (!displayDate) {
    // Fall back to any observation date even if future-tagged (rare)
    displayDate = dates.update_date || dates.tender_float_date ||
      dates.publication_date || dates.event_date || null;
    if (displayDate) displayDate = String(displayDate).slice(0, 10);
  }
  let srcDateLabel = displayDate || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(srcDateLabel)) {
    const parts = srcDateLabel.split('-');
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    srcDateLabel = Number(parts[2]) + ' ' + MON[Number(parts[1]) - 1] + ' ' + parts[0];
  }
  // Never promote SUPPORTED (or anything short of CONFIRMED) to a CONFIRMED badge.
  const cls = c.evidence_grade === 'CONFIRMED' ? 'CONFIRMED'
    : (c.classifications || []).indexOf('TENDER') >= 0 ? 'PIPELINE' : 'INFERRED';
  const valueBits = [];
  if (c.rating) valueBits.push(c.rating);
  if (c.voltage) valueBits.push(c.voltage);
  if (c.key_values_extracted && c.key_values_extracted.investment) valueBits.push(c.key_values_extracted.investment);
  return {
    title: c.title,
    snippet: c.snippet,
    value: valueBits.join(' · '),
    src: String(srcName).replace(/-/g, ' ') + (srcDateLabel ? ' · ' + srcDateLabel + ' [en]' : ' [en]'),
    url: primary.url || '',
    cls: cls,
    lang: 'en',
    isNew: true,
    region: 'GCC',
    buyer: c.buyer || undefined,
    event_date: dates.event_date || undefined,
    update_date: dates.update_date || undefined,
    publication_date: dates.publication_date || undefined,
    tender_float_date: dates.tender_float_date || undefined,
    tender_close_date: dates.tender_close_date || undefined,
    date_iso: displayDate || dates.event_date || undefined,
    classifications: c.classifications,
    evidence_grade: c.evidence_grade,
    evidence_note: c.evidence_grade === 'SUPPORTED'
      ? 'Evidence: SUPPORTED — not yet fully verified. No live portal adapter has confirmed this item.'
      : undefined,
    candidate_id: c.candidate_id,
    tender_id: c.tender_id || undefined
  };
}

function itemLiteral(it) {
  let out = '{ title:"' + jstr(it.title) + '", snippet:"' + jstr(it.snippet) + '"';
  if (it.value) out += ', value:"' + jstr(it.value) + '"';
  out += ', src:"' + jstr(it.src) + '", url:"' + jstr(it.url) + '"';
  if (it.cls) out += ', cls:"' + jstr(it.cls) + '"';
  if (it.evidence_grade) out += ', evidence_grade:"' + jstr(it.evidence_grade) + '"';
  if (it.evidence_note) out += ', evidence_note:"' + jstr(it.evidence_note) + '"';
  out += ', lang:"' + (it.lang || 'en') + '"';
  if (it.isNew) out += ', isNew:true';
  if (it.event_date) out += ', event_date:"' + jstr(it.event_date) + '"';
  if (it.update_date) out += ', update_date:"' + jstr(it.update_date) + '"';
  if (it.publication_date) out += ', publication_date:"' + jstr(it.publication_date) + '"';
  if (it.date_iso) out += ', date_iso:"' + jstr(it.date_iso) + '"';
  if (it.tender_id) out += ', tender_id:"' + jstr(it.tender_id) + '"';
  out += ' }';
  return out;
}

function alreadyInNews(htmlText, it) {
  if (it.tender_id && htmlText.indexOf(it.tender_id) >= 0) return true;
  const key = String(it.title || '').slice(0, 64);
  if (key && htmlText.indexOf(key) >= 0) return true;
  // Only treat a URL as a duplicate when it is item-specific (not a portal homepage/list).
  if (it.url) {
    const path = String(it.url).replace(/^https?:\/\//, '').split('?')[0];
    const generic = /\/$|list-of-tender|open-tenders|tenderboard\.gov|etimad\.sa\/?$/i.test(path) || path.split('/').length <= 2;
    if (!generic && htmlText.indexOf(it.url) >= 0) return true;
  }
  if (/localis.*transformer-component|transformer-component.*localis/i.test(it.title || '') &&
      /localis.*transformer-component|transformer-component.*localis/i.test(htmlText)) {
    return true;
  }
  return false;
}

const publishableAll = candidates.filter(shouldPublish).map(toIntelItem);
const htmlFile = 'intel.html';
let html = fs.readFileSync(htmlFile, 'utf8');

// Strip previous inject first so re-runs replace cleanly
html = html.replace(/\/\*INJECT:GCC_DISCOVERY\*\/[\s\S]*?\/\*\/INJECT:GCC_DISCOVERY\*\//g, '');

// Dedupe ONLY against the NEWS const — never against SSR timeline HTML, which
// still contains prior-run tender ids and would prevent re-injection.
const newsStartForDedup = html.indexOf('const NEWS = {');
const newsEndForDedup = newsStartForDedup >= 0 ? html.indexOf('\n};', newsStartForDedup) : -1;
const newsOnly = (newsStartForDedup >= 0 && newsEndForDedup >= 0)
  ? html.slice(newsStartForDedup, newsEndForDedup)
  : html;

const publishable = publishableAll.filter(function (it) { return !alreadyInNews(newsOnly, it); });

if (publishable.length) {
  const newsStart = html.indexOf('const NEWS = {');
  if (newsStart < 0) { console.error('NEWS const not found'); process.exit(1); }
  const before = html.slice(0, newsStart);
  const afterStart = html.slice(newsStart);
  const newsEndRel = afterStart.indexOf('\n};');
  if (newsEndRel < 0) { console.error('NEWS const end not found'); process.exit(1); }
  let newsConst = afterStart.slice(0, newsEndRel + 3);
  const newsTail = afterStart.slice(newsEndRel + 3);
  const gccKey = newsConst.search(/GCC\s*:\s*\{/);
  if (gccKey < 0) { console.error('NEWS.GCC block not found'); process.exit(1); }
  const itemsKey = newsConst.indexOf('items:', gccKey);
  const arrOpen = newsConst.indexOf('[', itemsKey);
  if (arrOpen < 0) { console.error('NEWS.GCC items array not found'); process.exit(1); }
  const block = '\n      /*INJECT:GCC_DISCOVERY*/\n      ' +
    publishable.map(itemLiteral).join(',\n      ') +
    ',\n      /*/INJECT:GCC_DISCOVERY*/';
  newsConst = newsConst.slice(0, arrOpen + 1) + block + newsConst.slice(arrOpen + 1);
  html = before + newsConst + newsTail;
  fs.writeFileSync(htmlFile, html);
  console.log('intel.html NEWS.GCC: injected ' + publishable.length + ' GCC discovery items');
} else {
  fs.writeFileSync(htmlFile, html);
  console.log('gcc-intel-publish: no new NEWS.GCC injects (already present or empty gate)');
}

// Merge into data/intel.json — upsert by tender_id/title so date fixes replace stale rows
const intel = readJson('data/intel.json', {});
if (!intel.GCC) intel.GCC = { label: 'GCC', items: [] };
const todayIso = new Date().toISOString().slice(0, 10);
let upserted = 0;
let prepended = 0;
publishableAll.forEach(function (it) {
  const items = intel.GCC.items || [];
  const idx = items.findIndex(function (x) {
    if (it.tender_id && x.tender_id && String(x.tender_id) === String(it.tender_id)) return true;
    if (it.url && x.url && it.url === x.url) return true;
    return x.title === it.title;
  });
  if (idx >= 0) {
    intel.GCC.items[idx] = Object.assign({}, items[idx], it);
    upserted++;
  } else {
    intel.GCC.items = [it].concat(intel.GCC.items || []);
    prepended++;
  }
});

// Drop discovery rows that are still held. Keep curated cards and anything
// already published (Oman) even when this build does not re-inject it.
const publishedIds = new Set(publishableAll.map(function (p) { return p.candidate_id; }).filter(Boolean));
const knownIds = new Set((candidates || []).map(function (c) { return c.candidate_id; }));
const alreadyPublished = new Set((candidates || []).filter(function (c) {
  return c.published_to_intel === true;
}).map(function (c) { return c.candidate_id; }));
let removedHeld = 0;
intel.GCC.items = (intel.GCC.items || []).filter(function (x) {
  if (!x || !x.candidate_id || !knownIds.has(x.candidate_id)) return true;
  if (publishedIds.has(x.candidate_id) || alreadyPublished.has(x.candidate_id)) return true;
  removedHeld++;
  return false;
});

// Stamp from validated observation dates only — never tender_close, never future.
const dateCandidates = [];
function pushObs(d) {
  if (!d) return;
  const day = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  if (day > todayIso) return;
  dateCandidates.push(day);
}
publishableAll.forEach(function (it) {
  ['date_iso', 'update_date', 'publication_date', 'tender_float_date', 'event_date'].forEach(function (k) {
    pushObs(it[k]);
  });
});
(candidatesDoc.candidates || []).forEach(function (c) {
  // Do NOT push source_checked_at into content newest — that is a probe clock.
  if (c.dates) {
    ['update_date', 'tender_float_date', 'publication_date', 'event_date'].forEach(function (k) {
      pushObs(c.dates[k]);
    });
  }
});
dateCandidates.sort();
const newest = dateCandidates.length ? dateCandidates[dateCandidates.length - 1] : null;
if (newest) {
  const noon = newest + 'T12:00:00.000Z';
  const nowIso = new Date().toISOString();
  // Cap at now so morning UTC builds never stamp a future refresh time.
  intel.updated = noon > nowIso ? nowIso : noon;
}
intel.refresh_meta = {
  cadence: 'once daily at 06:00 UTC (10:00 Dubai), only when TP_BUILD_HOOK_URL is set',
  refreshed_at_build: true,
  newest_validated_content_date: newest,
  note: 'updated reflects newest validated CONTENT observation (float/publication/event/update) — not source_checked_at and not a silent redeploy clock. Excludes tender_close_date and future dates. Human approve[] overrides from gcc-discovery-publish-overrides.json.',
  gcc_published: publishableAll.map(function (p) { return p.candidate_id || p.title; }),
  desk_approved: Array.from(APPROVE)
};
fs.writeFileSync('data/intel.json', JSON.stringify(intel, null, 2));
console.log('data/intel.json: upserted ' + upserted + ', prepended ' + prepended + ', removed held ' + removedHeld + '; updated=' + intel.updated);

// Publication sticks across the next discovery rebuild: flip published_to_intel
// only for rows this build actually released. Held candidates stay false.
function markPublished(list) {
  let n = 0;
  (list || []).forEach(function (c) {
    if (!c || !publishedIds.has(c.candidate_id)) return;
    if (c.published_to_intel !== true) n++;
    c.published_to_intel = true;
  });
  return n;
}
markPublished(candidatesDoc.candidates);
fs.writeFileSync('data/gcc-discovery-candidates.json', JSON.stringify(candidatesDoc, null, 2) + '\n');
// Discovery input is hand-maintained. Flip only the published_to_intel booleans
// for this release so the next discovery rebuild does not drop them, without
// reformatting the rest of the file.
const inputPath = 'data/gcc-sep-2026-discovery-input.json';
if (fs.existsSync(inputPath)) {
  let inputText = fs.readFileSync(inputPath, 'utf8');
  publishedIds.forEach(function (id) {
    const re = new RegExp('("candidate_id"\\s*:\\s*"' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]*?"published_to_intel"\\s*:\\s*)false');
    inputText = inputText.replace(re, '$1true');
  });
  fs.writeFileSync(inputPath, inputText);
}
const coverageReport = readJson('data/gcc-coverage-report.json', null);
if (coverageReport && Array.isArray(coverageReport.missed_record_analysis)) {
  coverageReport.missed_record_analysis.forEach(function (row) {
    if (row && publishedIds.has(row.candidate_id)) row.published = true;
  });
  fs.writeFileSync('data/gcc-coverage-report.json', JSON.stringify(coverageReport, null, 2) + '\n');
}
console.log('published_to_intel set for ' + publishedIds.size + ' desk release(s): ' + Array.from(publishedIds).join(', '));
