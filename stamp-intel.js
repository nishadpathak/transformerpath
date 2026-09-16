#!/usr/bin/env node
/* Stamp the crawlable /intel freshness line from the last successful refresh
 * in data/freshness.json — never from today's clock. Search engines must not
 * see "Loading freshness…" or a build-date pretending to be a data refresh. */
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
if (raw) {
  const dt = new Date(raw);
  const valid = !isNaN(dt.getTime());
  const dstr = valid
    ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : String(raw);
  const tstr = valid ? dt.toISOString().slice(11, 16) + ' UTC' : '';
  const ageH = valid ? (Date.now() - dt.getTime()) / (1000 * 60 * 60) : 999;
  const when = tstr ? (dstr + ' ' + tstr) : dstr;
  if (ageH > 72) stamp = 'Data stale — last successful refresh ' + when;
  else if (ageH > 36) stamp = 'Refresh delayed — last successful refresh ' + when;
  else stamp = 'Last successful refresh: ' + when;
  line = 'Last successful refresh: <b style="color:var(--text)">' + when + '</b> · cadence: ' + (di.cadence || 'curated at build');
}

const file = 'intel.html';
let s;
try { s = fs.readFileSync(file, 'utf8'); } catch (e) {
  console.warn('intel.html not found; skipping stamp'); process.exit(0);
}

if (/id="stamp">/.test(s)) {
  s = s.replace(/(id="stamp">)[\s\S]*?(<\/div>)/, '$1' + stamp + '$2');
} else {
  console.warn('stamp element not found in ' + file);
}
if (/id="freshnessLine">/.test(s)) {
  s = s.replace(/(id="freshnessLine">)[\s\S]*?(<\/span>)/, '$1' + line + '$2');
}

fs.writeFileSync(file, s);
console.log('stamped ' + file + ' -> ' + stamp);
