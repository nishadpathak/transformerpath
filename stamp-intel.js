#!/usr/bin/env node
/* Stamp crawlable freshness lines from data/freshness.json — never from
 * today's clock alone. Search engines must not see "Loading freshness…" or a
 * frozen SSR date that contradicts the live refresh (homepage DATA STALE). */
'use strict';
const fs = require('fs');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

const FRESH = readJson('data/freshness.json', {});
const di = (FRESH.surfaces || []).find((s) => s.id === 'daily_intel') || {};
const raw = di.last_successful_refresh || di.last_data_refresh || di.last_build;
let stamp = 'Refresh pending — last successful refresh not recorded';
let line = stamp;
let statusLabel = 'DATA CURRENT';
let dstrShort = '';
let ageH = 999;
if (raw) {
  const dt = new Date(raw);
  const valid = !isNaN(dt.getTime());
  dstrShort = valid
    ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : String(raw);
  const tstr = valid ? dt.toISOString().slice(11, 16) + ' UTC' : '';
  ageH = valid ? (Date.now() - dt.getTime()) / (1000 * 60 * 60) : 999;
  const when = tstr ? (dstrShort + ' ' + tstr) : dstrShort;
  if (ageH > 72) {
    stamp = 'Data stale — last successful refresh ' + when;
    statusLabel = 'DATA STALE';
  } else if (ageH > 36) {
    stamp = 'Refresh delayed — last successful refresh ' + when;
    statusLabel = 'REFRESH DELAYED';
  } else {
    stamp = 'Last successful refresh: ' + when;
    statusLabel = 'DATA CURRENT';
  }
  line = 'Last successful refresh: <b style="color:var(--text)">' + when + '</b> · cadence: ' + (di.cadence || 'curated at build');
}

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

// Homepage hero pill — SSR must match freshness.json or crawlers/no-JS visitors
// see a frozen "13 Sep" / DATA STALE claim even when the desk is current.
if (dstrShort) {
  stampFile('index.html', function (s) {
    if (/id="hero-live-status">/.test(s)) {
      s = s.replace(/(id="hero-live-status">)[^<]*/, '$1' + statusLabel);
    }
    if (/id="hero-live-date"/.test(s)) {
      s = s.replace(
        /(id="hero-live-date"[^>]*>)[^<]*/,
        '$1Canonical database refreshed ' + dstrShort
      );
    }
    // Dot colour for no-JS / first paint
    const dot = ageH > 72 ? '#94a3b8' : (ageH > 36 ? '#e0a800' : '#1a9d4a');
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
}

console.log('stamped freshness -> ' + stamp + ' / homepage ' + statusLabel);
