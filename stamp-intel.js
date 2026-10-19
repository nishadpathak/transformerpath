#!/usr/bin/env node
/* Stamp the homepage banner and intel.html from data/intel-status.json.
 * Both pages get the same status, latest sourced item, and source check.
 * This script does not recompute the clocks. */
'use strict';
const fs = require('fs');
const { statusDotColor } = require('./lib/intel-freshness');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

const status = readJson('data/intel-status.json');
if (!status || !status.status || !status.latest_source_iso) {
  console.error('data/intel-status.json missing. Run node build-intel-status.js first.');
  process.exit(1);
}

const statusLabel = status.status;
const sourceLabel = String(status.latest_source_date || '').replace(/\s+/g, ' ').trim();
if (!/^\d{1,2} [A-Za-z]{3} \d{4}$/.test(sourceLabel)) {
  console.error('latest sourced item label is blank or not a calendar day: ' + JSON.stringify(status.latest_source_date));
  process.exit(1);
}
const checkedLabel = status.latest_source_checked_label || null;
const buildLabel = status.build_label || null;
const dot = status.dot || statusDotColor(statusLabel);

const stamp =
  '<span style="color:' + dot + ';font-weight:800;letter-spacing:.5px">● ' +
  statusLabel + '</span> · Latest sourced item: <b style="color:#e5e7eb">' + sourceLabel + '</b>' +
  (checkedLabel ? ' · source checked ' + checkedLabel : '') +
  (buildLabel ? ' · page built ' + buildLabel : '');
const line =
  'Latest sourced item <b style="color:var(--text)">' + sourceLabel + '</b>' +
  (checkedLabel ? ' · last source check <b style="color:var(--text)">' + checkedLabel + '</b>' : '') +
  (buildLabel ? ' · build <b style="color:var(--text)">' + buildLabel + '</b>' : '') +
  ' · status <b style="color:var(--text)">' + statusLabel + '</b>';

function upsertAttrs(open, id) {
  let tag = open;
  const pairs = {
    'data-intel-status': statusLabel,
    'data-intel-source': status.latest_source_iso || '',
    'data-intel-checked': status.latest_source_checked_at || ''
  };
  Object.keys(pairs).forEach(function (k) {
    const ar = new RegExp('\\s' + k + '="[^"]*"');
    if (ar.test(tag)) tag = tag.replace(ar, ' ' + k + '="' + pairs[k] + '"');
    else tag += ' ' + k + '="' + pairs[k] + '"';
  });
  return tag;
}

function stampFile(file, apply) {
  let s;
  try { s = fs.readFileSync(file, 'utf8'); } catch (e) {
    console.error(file + ' not found');
    process.exit(1);
  }
  const next = apply(s);
  if (next === s) {
    console.warn(file + ' stamp made no change');
  }
  fs.writeFileSync(file, next);
  console.log('stamped ' + file);
}

stampFile('intel.html', function (s) {
  if (!/id="stamp"/.test(s)) {
    console.error('stamp element not found in intel.html');
    process.exit(1);
  }
  s = s.replace(/(<div class="stamp" id="stamp")([^>]*)>/, function (_, a, b) {
    return upsertAttrs(a + b, 'stamp') + '>';
  });
  s = s.replace(/(id="stamp"[^>]*>)[\s\S]*?(<\/div>)/, '$1' + stamp + '$2');
  if (!/id="freshnessLine"/.test(s)) {
    console.error('freshnessLine not found in intel.html');
    process.exit(1);
  }
  s = s.replace(/(<span id="freshnessLine")([^>]*)>/, function (_, a, b) {
    return upsertAttrs(a + b, 'freshnessLine') + '>';
  });
  s = s.replace(/(id="freshnessLine"[^>]*>)[\s\S]*?(<\/span>)/, '$1' + line + '$2');
  return s;
});

stampFile('index.html', function (s) {
  if (!/id="hero-live-pill"/.test(s) || !/id="hero-live-status"/.test(s) || !/id="hero-live-check"/.test(s)) {
    console.error('homepage banner elements missing');
    process.exit(1);
  }
  s = s.replace(/(<div class="hero-live-pill" id="hero-live-pill")([^>]*)>/, function (_, a, b) {
    return upsertAttrs(a + b, 'hero-live-pill') + '>';
  });
  s = s.replace(/(id="hero-live-status">)[^<]*/, '$1' + statusLabel);
  s = s.replace(/(id="hero-live-date"[^>]*>)[^<]*/, '$1Latest sourced item ' + sourceLabel);
  s = s.replace(/(id="hero-live-check"[^>]*>)[^<]*/, '$1' + (checkedLabel ? 'source checked ' + checkedLabel : 'source checked not recorded'));
  if (/id="hero-live-dot"/.test(s)) {
    s = s.replace(/(<span class="live-dot" id="hero-live-dot"[^>]*)(>)/, function (_, a, b) {
      if (/style=/.test(a)) return a.replace(/style="[^"]*"/, 'style="background:' + dot + '"') + b;
      return a + ' style="background:' + dot + '"' + b;
    });
  }
  return s;
});

console.log('stamped intel status -> ' + statusLabel + ' (source ' + sourceLabel + ', checked ' + (checkedLabel || 'none') + ')');
