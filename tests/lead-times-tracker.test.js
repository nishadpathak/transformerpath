#!/usr/bin/env node
/* The lead-time tracker publishes only rows the selector kept. A year-only
 * record and an undated record stay off the page.
 */
'use strict';
const fs = require('fs');
const { selectRows, pageDay } = require('../lib/lead-time-rows');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const selected = selectRows();
const html = fs.readFileSync('lead-times.html', 'utf8');
const rows = html.match(/<tr data-kind="[^"]+"[\s\S]*?<\/tr>/g) || [];
check('page is the free tracker', html.indexOf('>Lead times and factory capacity<') >= 0 && /Free tracker/.test(html));
check('row count matches the selector', rows.length === selected.rows.length, rows.length + ' vs ' + selected.rows.length);
check('there is at least one lead-time row and one capacity row', selected.rows.some(function (row) { return row.kind === 'lead_time'; }) && selected.rows.some(function (row) { return row.kind === 'factory_capacity'; }));
check('the page has fewer than twenty rows', rows.length > 0 && rows.length < 20, String(rows.length));

selected.rows.forEach(function (row) {
  check(row.lastChecked + ' is on the page', html.indexOf('data-last-checked="' + row.lastChecked + '"') >= 0);
  check(row.sourceUrl + ' is linked', html.indexOf(row.sourceUrl.replace(/&/g, '&amp;')) >= 0 || html.indexOf(row.sourceUrl) >= 0);
  check(row.lastChecked + ' has a label', !!row.lastCheckedLabel);
});

rows.forEach(function (row) {
  check('row has a last-checked value', /data-last-checked="(20\d{2}-\d{2}-\d{2}|20\d{2}-\d{2})"/.test(row), row.slice(0, 180));
  check('row has a source url', /data-source-url="https?:\/\/[^"]+"/.test(row));
});

check('year-only 120–150 week headline is not a row', html.indexOf('120–150') < 0 && html.indexOf('120-150') < 0);
check('undated four-year pv magazine figure is not a row', html.indexOf('128-week') < 0 && html.indexOf('128 week') < 0);
check('Virginia capacity is the company figure', html.indexOf('67000 MVA/year') >= 0 && html.indexOf('Company-reported') >= 0);
check('Virginia check day is 15 Oct 2026', html.indexOf('15 Oct 2026') >= 0);
check('month rows say the day is not stated', /day not stated on the source label/.test(html));
check('page day is the newest day-precision check', pageDay(selected.rows) === '2026-10-15');
check('directory lead-time notes are named as left off', /Directory lead-time notes/.test(html));

if (failed) {
  console.error('LEAD TIMES TRACKER FAILED (' + failed + ')');
  process.exit(1);
}
console.log('LEAD TIMES TRACKER OK — ' + rows.length + ' rows');
