#!/usr/bin/env node
// Build gate: every intel news item must carry a real source URL.
// Fails the build if an item in data/intel-news.json or data/intel.json has
// no http(s) source URL, or points at one of the retired unbacked items.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RETIRED = [
  'tndindia.com/pgcil-approves-investment-for-western-southern-expansion',
  'al-babtain-awarded-al-hasa-north-substation-contract',
  'siemens-energy-tennet-complete-balwin3-fat',
  'bad-honnef-testing-expansion',
  'dewa-floats-12-substation-tender',
  'aep-ohio-puco-transmission-filing-data-centers/829104',
];
const errors = [];
function checkItem(file, where, it) {
  const url = String((it && (it.url || it.source_url)) || '').trim();
  const label = (it && it.title ? it.title : '(untitled)').slice(0, 90);
  if (!/^https?:\/\/[^\s/]+\.[^\s]+/.test(url)) errors.push(file + ' ' + where + ': no source URL :: ' + label);
  else if (RETIRED.some((r) => url.includes(r))) errors.push(file + ' ' + where + ': retired unbacked source :: ' + label);
}
const news = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/intel-news.json'), 'utf8'));
(Array.isArray(news) ? news : []).forEach((it, i) => checkItem('intel-news.json', '[' + i + ']', it));
const intel = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/intel.json'), 'utf8'));
let n = news.length;
for (const [region, block] of Object.entries(intel)) {
  if (!block || !Array.isArray(block.items)) continue;
  block.items.forEach((it, i) => { n++; checkItem('intel.json', region + '[' + i + ']', it); });
}
if (errors.length) {
  console.error('check-intel-sources: FAIL (' + errors.length + ')\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('check-intel-sources: OK — ' + n + ' intel items all carry a source URL');
