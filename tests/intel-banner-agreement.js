#!/usr/bin/env node
/* Homepage banner and intel.html must share data/intel-status.json.
 * Fails if status, latest sourced item date, or last source check disagree.
 * Run after stamp-intel.js.
 */
'use strict';
const fs = require('fs');

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

console.log('=== INTEL BANNER AGREEMENT ===');
const status = JSON.parse(fs.readFileSync('data/intel-status.json', 'utf8'));
const home = fs.readFileSync('index.html', 'utf8');
const intel = fs.readFileSync('intel.html', 'utf8');

check('status file has a public status', !!status.status, status.status);
check('status file has a source day', /^\d{4}-\d{2}-\d{2}$/.test(status.latest_source_iso || ''), status.latest_source_iso);
check('status file has a source-check day', /^\d{4}-\d{2}-\d{2}$/.test(status.latest_source_checked_at || ''), status.latest_source_checked_at);
check('status file has display labels', status.latest_source_date && status.latest_source_checked_label);

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

if (failed) {
  console.error('INTEL BANNER AGREEMENT FAILED (' + failed + ')');
  process.exit(1);
}
console.log('INTEL BANNER AGREEMENT OK — ' + status.status +
  ' · ' + status.latest_source_date +
  ' · checked ' + status.latest_source_checked_label);
