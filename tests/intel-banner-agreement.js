#!/usr/bin/env node
/* Homepage banner and intel.html must share data/intel-status.json.
 * Fails if status, latest sourced item date, or last source check disagree,
 * or if a displayed date is blank. GCC coverage is checked only on GCC
 * market pages.
 * Run after stamp-intel.js and build-markets.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { formatDayUTC } = require('../lib/intel-freshness');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

function attr(html, id, name) {
  const re = new RegExp('id="' + id + '"[^>]*\\s' + name + '="([^"]*)"|' + name + '="([^"]*)"[^>]*id="' + id + '"');
  const m = html.match(re);
  return m ? (m[1] || m[2] || '') : '';
}

function region(html, id) {
  const at = html.indexOf('id="' + id + '"');
  if (at < 0) return '';
  return html.slice(at, at + 900).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function sourcedDay(text) {
  const m = String(text || '').match(/(\d{1,2} [A-Z][a-z]{2} \d{4})/);
  return m ? m[1] : '';
}

console.log('=== INTEL BANNER AGREEMENT ===');
const status = JSON.parse(fs.readFileSync('data/intel-status.json', 'utf8'));
const home = fs.readFileSync('index.html', 'utf8');
const intel = fs.readFileSync('intel.html', 'utf8');

check('status file has a public status', !!String(status.status || '').trim(), JSON.stringify(status.status));
check('status label is never blank', String(status.status || '').trim().length > 0);
check('status file has a source day', /^\d{4}-\d{2}-\d{2}$/.test(status.latest_source_iso || ''), status.latest_source_iso);
check('status file has a source-check day', /^\d{4}-\d{2}-\d{2}$/.test(status.latest_source_checked_at || ''), status.latest_source_checked_at);
check('status file has display labels', !!String(status.latest_source_date || '').trim() && !!String(status.latest_source_checked_label || '').trim());
check('sourced display date is never blank', /^\d{1,2} [A-Za-z]{3} \d{4}$/.test(String(status.latest_source_date || '').trim()), JSON.stringify(status.latest_source_date));
if (status.status === 'Updated today') {
  check('Updated today still names the sourced calendar day', /^\d{1,2} [A-Za-z]{3} \d{4}$/.test(status.latest_source_date));
} else if (/^UPDATED /.test(status.status || '')) {
  const updatedDay = String(status.status).slice('UPDATED '.length);
  check('UPDATED date is never blank', /^\d{1,2} [A-Za-z]{3} \d{4}$/.test(updatedDay), JSON.stringify(updatedDay));
  check('UPDATED date is the sourced item', updatedDay === status.latest_source_date, updatedDay + ' vs ' + status.latest_source_date);
}
check('global status is not the GCC discovery gate', status.reason !== 'discovery_claim_disallowed', status.reason);

['hero-live-pill', 'stamp', 'freshnessLine'].forEach(function (id) {
  const html = id === 'hero-live-pill' ? home : intel;
  const where = id === 'hero-live-pill' ? 'homepage' : 'intel.html';
  check(where + ' ' + id + ' status matches', attr(html, id, 'data-intel-status') === status.status,
    attr(html, id, 'data-intel-status') + ' vs ' + status.status);
  check(where + ' ' + id + ' source day matches', attr(html, id, 'data-intel-source') === status.latest_source_iso,
    attr(html, id, 'data-intel-source') + ' vs ' + status.latest_source_iso);
  check(where + ' ' + id + ' check day matches', attr(html, id, 'data-intel-checked') === status.latest_source_checked_at,
    attr(html, id, 'data-intel-checked') + ' vs ' + status.latest_source_checked_at);
});

const pill = region(home, 'hero-live-pill');
const stamp = region(intel, 'stamp');
const line = region(intel, 'freshnessLine');
[pill, stamp, line].forEach(function (text, i) {
  const name = ['homepage banner', 'intel stamp', 'intel freshness line'][i];
  check(name + ' shows the status', text.indexOf(status.status) !== -1, text.slice(0, 180));
  check(name + ' shows the source label', text.indexOf(status.latest_source_date) !== -1, text.slice(0, 180));
  check(name + ' shows the check label', text.indexOf(status.latest_source_checked_label) !== -1, text.slice(0, 180));
});

check('homepage banner reads intel-status.json', /data\/intel-status\.json/.test(home));
check('intel stamp reads intel-status.json', /data\/intel-status\.json/.test(intel));
check('homepage does not prefer the feed honesty label', !/feed\.honesty\s*&&\s*feed\.honesty\.latest_source_date/.test(home));
check('no hardcoded 8 Oct banner date', !/Latest sourced item 8 Oct 2026/i.test(home) && !/LATEST SOURCED ITEM 8 OCT 2026/.test(home));

const homeDay = sourcedDay(home.slice(home.indexOf('id="hero-live-date"'), home.indexOf('id="hero-live-date"') + 180));
const stampSlice = intel.slice(intel.indexOf('id="stamp"'), intel.indexOf('id="changelog-strip"'));
const stampDay = sourcedDay(stampSlice);
const lineDay = sourcedDay(intel.slice(intel.indexOf('id="freshnessLine"'), intel.indexOf('id="freshnessLine"') + 700));
[homeDay, stampDay, lineDay].forEach(function (day, i) {
  const name = ['homepage', 'intel stamp', 'intel freshness'][i];
  check(name + ' sourced date is never blank', !!String(day || '').trim(), JSON.stringify(day));
  check(name + ' sourced date is a calendar day', /^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(day), JSON.stringify(day));
  check(name + ' sourced date matches the status file', day === status.latest_source_date, day + ' vs ' + status.latest_source_date);
});
check('homepage and intel.html sourced dates agree', !!homeDay && homeDay === stampDay && stampDay === lineDay, homeDay + ' / ' + stampDay + ' / ' + lineDay);
check('homepage and intel.html status attributes agree',
  attr(home, 'hero-live-pill', 'data-intel-status') === attr(intel, 'stamp', 'data-intel-status') &&
  attr(intel, 'stamp', 'data-intel-status') === attr(intel, 'freshnessLine', 'data-intel-status'),
  attr(home, 'hero-live-pill', 'data-intel-status') + ' / ' + attr(intel, 'stamp', 'data-intel-status') + ' / ' + attr(intel, 'freshnessLine', 'data-intel-status'));
check('homepage does not carry the GCC coverage line', home.indexOf('GCC: latest confirmed') === -1);
check('intel.html does not carry the GCC coverage line', intel.indexOf('GCC: latest confirmed') === -1);
check('stamp date stays light on the navy pill', stampSlice.indexOf('color:#e5e7eb') !== -1 && stampSlice.indexOf('color:var(--text)') === -1);
check('stamp script keeps the build-time date when the payload is blank', stampSlice.indexOf('/^\\d{1,2} [A-Za-z]{3} \\d{4}$/.test(sourceLabel)') !== -1);
check('homepage script keeps the build-time date when the payload is blank', home.indexOf('/^\\d{1,2} [A-Za-z]{3} \\d{4}$/.test(sourceLabel)') !== -1);

const review = JSON.parse(fs.readFileSync('data/gcc-intel-review.json', 'utf8'));
const rows = review.rows || review.reviews || review.candidates || [];
function row(id) {
  return rows.find(function (r) { return r.candidate_id === id; });
}
['gcc-uae-saudi-grid-mou-2026-10-09', 'sa-sppc-grid-scale-2026-10-13',
  'sa-swa-jubail-grounding', 'sa-al-aflaj-33kv-replacement', 'sa-dhahran-1500kva-standby',
  'sa-swa-yanbu-t803-supervision', 'kw-mewre-75mva-stage1', 'kw-mewre-75mva-stage2'
].forEach(function (id) {
  const r = row(id);
  check(id + ' is PUBLISH on main', !!(r && r.decision === 'PUBLISH' && r.reviewer && r.reviewed_at), r && r.decision);
});

const coverage = JSON.parse(fs.readFileSync('data/gcc-coverage-report.json', 'utf8'));
const watch = JSON.parse(fs.readFileSync('data/gcc-market-watch.json', 'utf8'));
const gccIso = coverage.freshness && coverage.freshness.latest_confirmed_event_date;
const watchIso = watch.freshness && watch.freshness.latest_confirmed_event_date;
const gccLabel = formatDayUTC(gccIso);
check('GCC latest confirmed date is a real day', /^\d{4}-\d{2}-\d{2}$/.test(gccIso || ''), JSON.stringify(gccIso));
check('GCC confirmed display date is never blank', /^\d{1,2} [A-Za-z]{3} \d{4}$/.test(gccLabel), JSON.stringify(gccLabel));
check('coverage report and market watch agree on the confirmed day', gccIso === watchIso, gccIso + ' vs ' + watchIso);
const gccLine = 'GCC: latest confirmed ' + gccLabel;
const marketSrc = fs.readFileSync('build-markets.js', 'utf8');
const gccSlugs = [];
marketSrc.split(/\{\s*slug:/).slice(1).forEach(function (block) {
  const slug = (block.match(/^ '([^']+)'/) || [])[1];
  const intelKey = (block.match(/intel: '([^']+)'/) || [])[1];
  if (slug && intelKey === 'GCC') gccSlugs.push(slug);
});
check('GCC market pages exist', gccSlugs.length > 0, gccSlugs.join(','));
const marketDirs = fs.readdirSync('markets').filter(function (name) {
  return fs.existsSync(path.join('markets', name, 'index.html'));
});
marketDirs.forEach(function (slug) {
  const html = fs.readFileSync(path.join('markets', slug, 'index.html'), 'utf8');
  if (gccSlugs.indexOf(slug) !== -1) {
    check(slug + ' shows GCC coverage', html.indexOf(gccLine) !== -1 && html.indexOf('data-gcc-confirmed="' + gccIso + '"') !== -1, gccLine);
    check(slug + ' GCC date is not blank', html.indexOf('GCC: latest confirmed </') === -1 && html.indexOf('GCC: latest confirmed<') === -1);
  } else {
    check(slug + ' does not show GCC coverage', html.indexOf('GCC: latest confirmed') === -1 && html.indexOf('id="gcc-coverage"') === -1);
  }
});
check('markets index does not show the GCC coverage line', fs.readFileSync('markets.html', 'utf8').indexOf('GCC: latest confirmed') === -1);

if (failed) {
  console.error('INTEL BANNER AGREEMENT FAILED (' + failed + ')');
  process.exit(1);
}
console.log('INTEL BANNER AGREEMENT OK — ' + status.status +
  ' · ' + status.latest_source_date +
  ' · checked ' + status.latest_source_checked_label);
