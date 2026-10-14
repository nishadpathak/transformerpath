#!/usr/bin/env node
/* Stamp crawlable freshness lines from data/freshness.json — never from
 * today's clock alone. Public status follows latest_source_date via
 * lib/intel-freshness (INTEL COVERAGE DELAYED when discovery lags). */
'use strict';
const fs = require('fs');
const { classifyIntelStatus, statusDotColor, formatDayUTC } = require('./lib/intel-freshness');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

const FRESH = readJson('data/freshness.json', {});
const di = (FRESH.surfaces || []).find((s) => s.id === 'daily_intel') || {};
const feed = readJson('data/intel-feed-ui.json', {});
const status = classifyIntelStatus({
  latestSourceIso: di.latest_source_date || FRESH.latest_source_date || (feed.honesty && feed.honesty.latest_source_iso),
  latestCheckedAt: di.latest_source_checked_at || FRESH.latest_source_checked_at,
  buildAt: di.build_at || FRESH.build_at || FRESH.generated,
  dataCurrentClaimAllowed: (di.data_current_claim_allowed === true) || (FRESH.data_current_claim_allowed === true)
});

const statusLabel = status.statusLabel;
const sourceLabel = status.latest_source_date || 'not recorded';
const checkedLabel = status.latest_source_checked_at
  ? formatDayUTC(status.latest_source_checked_at)
  : null;
const buildLabel = status.build_at ? formatDayUTC(status.build_at) : null;
const stamp =
  '<span style="color:' + statusDotColor(statusLabel) + ';font-weight:800;letter-spacing:.5px">● ' +
  statusLabel + '</span> · Latest sourced item: <b style="color:var(--text)">' + sourceLabel + '</b>' +
  (checkedLabel ? ' · source checked ' + checkedLabel : '') +
  (buildLabel ? ' · page built ' + buildLabel : '');
const line =
  'Latest sourced item <b style="color:var(--text)">' + sourceLabel + '</b>' +
  (checkedLabel ? ' · last source check <b style="color:var(--text)">' + checkedLabel + '</b>' : '') +
  (buildLabel ? ' · build <b style="color:var(--text)">' + buildLabel + '</b>' : '') +
  ' · status <b style="color:var(--text)">' + statusLabel + '</b>';

function stampFile(file, apply) {
  let s;
  try { s = fs.readFileSync(file, 'utf8'); } catch (e) {
    console.warn(file + ' not found; skipping stamp');
    return;
  }
  const next = apply(s);
  if (next !== s) {
    fs.writeFileSync(file, next);
    console.log('stamped ' + file);
  }
}

stampFile('intel.html', function (s) {
  if (/id="stamp">/.test(s)) {
    s = s.replace(/(id="stamp">)[\s\S]*?(<\/div>)/, '$1' + stamp + '$2');
  } else {
    console.warn('stamp element not found in intel.html');
  }
  if (/id="freshnessLine">/.test(s)) {
    s = s.replace(/(id="freshnessLine">)[\s\S]*?(<\/span>)/, '$1' + line + '$2');
  }
  return s;
});

stampFile('index.html', function (s) {
  if (/id="hero-live-status">/.test(s)) {
    s = s.replace(/(id="hero-live-status">)[^<]*/, '$1' + statusLabel);
  }
  if (/id="hero-live-date"/.test(s)) {
    s = s.replace(
      /(id="hero-live-date"[^>]*>)[^<]*/,
      '$1Latest sourced item ' + sourceLabel
    );
  }
  const dot = statusDotColor(statusLabel);
  if (/id="hero-live-dot"/.test(s)) {
    s = s.replace(
      /(<span class="live-dot" id="hero-live-dot"[^>]*)(>)/,
      function (_, a, b) {
        if (/style=/.test(a)) {
          return a.replace(/style="[^"]*"/, 'style="background:' + dot + '"') + b;
        }
        return a + ' style="background:' + dot + '"' + b;
      }
    );
  }
  return s;
});

console.log('stamped freshness -> ' + statusLabel + ' (source ' + sourceLabel + ')');
