#!/usr/bin/env node
/* build-intel-news.js — inject international, multilingual intel items.
 *
 * intel.html is a hand-authored page whose "Power Grid News" tab reads the
 * GRID_NEWS const. That const labels itself "worldwide, multilingual" and has
 * region buckets (GCC/India/Europe/USA/China/AsiaPac/LatAm/Africa), but only a
 * handful of foreign-language items were present. This builder injects a batch
 * of source-backed international items (from data/intel-news.json, verified
 * with real URLs and language tags) into the matching GRID_NEWS regions, so the
 * feed surfaces Chinese, Japanese, Korean, Spanish, Italian, German, French,
 * Portuguese, Turkish, Arabic and Slovenian transformer/grid news.
 *
 * It also merges the same items into data/intel.json (the shared source read by
 * the market/utility/company-page builders) so international news flows to the
 * rest of the site. Nothing is invented — every item in data/intel-news.json
 * has a real source URL and provenance.
 *
 * Idempotent: items are inserted inside a marker comment, and any previously
 * inserted block is removed before re-adding, so re-running never duplicates.
 *
 * Run: node build-intel-news.js  (part of the Netlify build).
 */
'use strict';
const fs = require('fs');

// ── The verified international items (single source of truth). ────────────────
const ITEMS = JSON.parse(fs.readFileSync('data/intel-news.json', 'utf8'));

// ── JS-escaping for single-quoted object injections into intel.html. ─────────
function jstr(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
function itemObj(it) {
  // Render as a single-quoted object literal matching intel.html's item shape.
  let out = '{ title:"' + jstr(it.title) + '", snippet:"' + jstr(it.snippet) + '"' +
    (it.value ? ', value:"' + jstr(it.value) + '"' : '') +
    ', src:"' + jstr(it.src) + '", url:"' + jstr(it.url) + '"' +
    (it.cls ? ', cls:"' + jstr(it.cls) + '"' : '') +
    ', lang:"' + (it.lang || 'en') + '"' +
    (it.isNew ? ', isNew:true' : '') + ' }';
  return out;
}

// ── Read intel.html and inject into GRID_NEWS. ────────────────────────────────
const htmlFile = 'intel.html';
let html = fs.readFileSync(htmlFile, 'utf8');

// Group items by region bucket.
const byRegion = {};
ITEMS.forEach((it) => { const r = it.region || 'RoW'; (byRegion[r] = byRegion[r] || []).push(it); });

// The GRID_NEWS const region label blocks. We inject each item's block just
// before the closing "    ]\n  }," of its region, inside a marker so re-running
// the builder replaces rather than duplicates. We match each region by its
// name as a top-level key of GRID_NEWS (the block after "const GRID_NEWS = {").
//
// Because intel.html also has a separate NEWS const with GCC/India/Europe/USA/
// RoW, we must scope the replacement to the GRID_NEWS const only. We do this by
// locating the first "const GRID_NEWS = {" and operating on that substring's
// region blocks; the NEWS const (which appears before) is left untouched.
const gridStart = html.indexOf('const GRID_NEWS = {');
if (gridStart < 0) {
  console.error('!! GRID_NEWS const not found in intel.html'); process.exit(1);
}
const gridHead = html.slice(0, gridStart);
const gridBody = html.slice(gridStart);
const gridEnd = gridBody.indexOf('};'); // end of GRID_NEWS const
const gridConst = gridBody.slice(0, gridEnd + 2);
const gridTail = gridBody.slice(gridEnd + 2);

// Strip any previously injected international block from GRID_NEWS, then
// re-inject fresh. Marker: /*INJECT:INTL:<REGION>*/ ... /*/INJECT:INTL:<REGION>*/
let injected = gridConst.replace(/\/\*INJECT:INTL:[A-Za-z]+\*\/[\s\S]*?\/\*\/INJECT:INTL:[A-Za-z]+\*\//g, '');

function regionBlockOpen(region) {
  // Find "  RELABEL: {\n    label: \"...\",\n    items: [" within gridConst.
  const re = new RegExp('\\n  ' + region + ': \\{\\n    label: "([^"]*)",\\n    items: \\[');
  const m = re.exec(injected);
  if (!m) return null;
  return m.index + m[0].length; // index right after "items: ["
}

const regionOrder = ['GCC', 'India', 'Europe', 'USA', 'China', 'AsiaPac', 'LatAm', 'Africa'];
let insertedCount = 0;
for (const region of Object.keys(byRegion)) {
  const items = byRegion[region];
  if (!items || !items.length) continue;
  if (!regionOrder.includes(region)) {
    console.warn('!! region ' + region + ' not in GRID_NEWS; skipping ' + items.length);
    continue;
  }
  const open = regionBlockOpen(region);
  if (open === null) {
    console.warn('!! region block ' + region + ' not found; skipping ' + items.length);
    continue;
  }
  const markerOpen = '/*INJECT:INTL:' + region + '*/';
  const markerClose = '/*/INJECT:INTL:' + region + '*/';
  const block = markerOpen + ' ' +
    items.map(itemObj).join(',\n      ') +
    ',' + markerClose;
  // Insert into the region's items array right after "items: ["
  injected = injected.slice(0, open) + ' ' + block + injected.slice(open);
  insertedCount += items.length;
}

if (insertedCount > 0) {
  fs.writeFileSync(htmlFile, gridHead + injected + gridTail);
  // Also fold the international items into the Daily News tab's "Rest of World"
  // (RoW) region so the default Daily News view surfaces them too — marked
  // idempotently, inside the NEWS const only (which uses GCC/India/Europe/USA/RoW).
  const foldIntoNewsRoW = ITEMS.filter((it) => ['China', 'AsiaPac', 'LatAm', 'Africa'].includes(it.region));
  let composed = fs.readFileSync(htmlFile, 'utf8');
  composed = composed.replace(/\/\*INJECT:INTLNEWS\*\/[\s\S]*?\/\*\/INJECT:INTLNEWS\*\//g, '');
  const nStart = composed.indexOf('const NEWS = {');
  const nEnd = composed.indexOf('};', nStart); // close of NEWS const
  const nConst = composed.slice(nStart, nEnd + 2);
  const nRest = composed.slice(nEnd + 2);
  const roRowRe = /\n  RoW: \{\n    label: "([^"]*)",\n    items: \[/;
  const roRowMatch = roRowRe.exec(nConst);
  if (foldIntoNewsRoW.length && roRowMatch) {
    const openIdx = roRowMatch.index + roRowMatch[0].length;
    const block = '/*INJECT:INTLNEWS*/ ' +
      foldIntoNewsRoW.map(itemObj).join(',\n      ') +
      ',/*/INJECT:INTLNEWS*/';
    const newNConst = nConst.slice(0, openIdx) + ' ' + block + nConst.slice(openIdx);
    fs.writeFileSync(htmlFile, composed.slice(0, nStart) + newNConst + nRest);
    console.log('intel.html NEWS.RoW: folded ' + foldIntoNewsRoW.length + ' international items into Daily News (Rest of World)');
  } else if (foldIntoNewsRoW.length) {
    console.warn('!! NEWS RoW block not found; skipping Daily-News fold');
  }
  console.log('intel.html GRID_NEWS: injected ' + insertedCount + ' international items across ' + Object.keys(byRegion).length + ' regions');
} else {
  console.log('intel.html: no international items injected');
}

// ── Merge into data/intel.json (shared source for market/utility pages). ─────
// data/intel.json uses region keys GCC/India/Europe/USA/RoW. Grid-region items
// fold into the closest existing key so market pages (which read INTEL[m.intel])
// pick up the international coverage without breaking the 5-key contract.
const ISO_PATH = 'data/intel.json';
const intel = JSON.parse(fs.readFileSync(ISO_PATH, 'utf8'));
// Canonical data-refresh timestamp. This is a CURATED dataset compiled at build;
// it is not a live scrape. The public freshness readout must show THIS date, not
// the visitor's local "today", and never imply a change that is only a redeploy.
intel.updated = intel.refresh_meta && intel.refresh_meta.newest_validated_content_date
  ? (String(intel.refresh_meta.newest_validated_content_date).length === 10
      ? intel.refresh_meta.newest_validated_content_date + 'T12:00:00.000Z'
      : intel.refresh_meta.newest_validated_content_date)
  : new Date().toISOString();
intel.refresh_meta = Object.assign({}, intel.refresh_meta || {}, {
  cadence: 'daily (curated)',
  refreshed_at_build: true,
  note: 'Curated transformer-industry intelligence. updated tracks newest validated content observation when present — not a silent redeploy clock.',
});
const FOLD = { China: 'RoW', AsiaPac: 'RoW', LatAm: 'RoW', Africa: 'RoW' };
const srcByRegion = {};
ITEMS.forEach((it) => { const fold = FOLD[it.region] || it.region; (srcByRegion[fold] = srcByRegion[fold] || []).push(it); });
let mergedCount = 0;
Object.keys(srcByRegion).forEach((region) => {
  if (!intel[region]) { intel[region] = { label: region, items: [] }; }
  const existingUrl = new Set((intel[region].items || []).map((x) => x.url));
  const fresh = srcByRegion[region].filter((it) => !existingUrl.has(it.url));
  if (!fresh.length) return;
  intel[region].items = intel[region].items.concat(fresh.map((it) => {
    const o = { title: it.title, snippet: it.snippet, value: it.value || '', src: it.src, url: it.url, lang: it.lang || 'en' };
    if (it.isNew) o.isNew = true;
    if (it.cls) o.cls = it.cls;
    return o;
  }));
  mergedCount += fresh.length;
});
fs.writeFileSync(ISO_PATH, JSON.stringify(intel, null, 2));
console.log('data/intel.json: merged ' + mergedCount + ' international items (' + Object.keys(srcByRegion).join(',') + ')');
