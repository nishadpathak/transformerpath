#!/usr/bin/env node
/* build-gcc-intel-publish.js — promote graded GCC discovery candidates into Intel.
 *
 * Only CONFIRMED (+ selected high-evidence SUPPORTED tenders) with a non-internal
 * publish_decision enter NEWS.GCC / data/intel.json. Discovery still does not
 * auto-publish REVIEW_REQUIRED / AML speculation / Qatar-zero coverage facts.
 *
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
  if (c.publish_decision === 'HOLD_FOR_REVIEW' && c.evidence_grade === 'REVIEW_REQUIRED') return false;
  // Already curated under a near-duplicate headline in NEWS.GCC
  if (c.candidate_id === 'om-localisation-aug12') return false;
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
    candidate_id: c.candidate_id,
    tender_id: c.tender_id || undefined
  };
}

function itemLiteral(it) {
  let out = '{ title:"' + jstr(it.title) + '", snippet:"' + jstr(it.snippet) + '"';
  if (it.value) out += ', value:"' + jstr(it.value) + '"';
  out += ', src:"' + jstr(it.src) + '", url:"' + jstr(it.url) + '"';
  if (it.cls) out += ', cls:"' + jstr(it.cls) + '"';
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
  if (c.dates) pushObs(c.dates.source_checked_at);
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
  cadence: 'daily (curated)',
  refreshed_at_build: true,
  newest_validated_content_date: newest,
  note: 'updated reflects newest validated GCC/content observation — not a silent redeploy clock. Excludes tender_close_date and future dates.',
  gcc_published: publishableAll.map(function (p) { return p.candidate_id || p.title; })
};
fs.writeFileSync('data/intel.json', JSON.stringify(intel, null, 2));
console.log('data/intel.json: upserted ' + upserted + ', prepended ' + prepended + '; updated=' + intel.updated);
