#!/usr/bin/env node
/* A manufacturer meta description states the sourced-fields limit once.
 * The length pad must not add "Only sourced fields are shown." after
 * "Only sourced census fields are shown."
 * Run: node tests/manufacturer-description-repeat.test.js
 */
'use strict';

const catalog = require('../lib/seo-catalog');
const { assignUnique } = require('../lib/seo-fit');

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

function genericSourcedSentence(text) {
  return String(text || '').replace(/Only sourced census fields are shown\.?/g, '').indexOf('Only sourced fields are shown') !== -1;
}

const cat = catalog.create();
const items = Object.keys(cat.companies).map(function (slug) {
  const draft = catalog.draft('manufacturers/' + slug + '/index.html', '<h1>' + cat.companies[slug].name + '</h1>', cat);
  return {
    slug: slug,
    draft: draft.draftDesc,
    pads: draft.padsDesc,
    salt: draft.salt
  };
});
assignUnique(items, 'description', 140, 160);

const abb = items.filter(function (item) { return item.slug === 'abb'; })[0];
check(!!abb, 'ABB is in the manufacturer catalog');
if (abb) {
  const desc = abb.description;
  check(desc.indexOf('Only sourced census fields are shown. Only sourced fields are shown.') === -1, 'ABB description does not repeat the sourced-fields sentence: ' + desc);
  check(!genericSourcedSentence(desc), 'ABB description keeps the census sentence and drops the shorter copy: ' + desc);
  check((desc.match(/Only sourced census fields are shown/g) || []).length === 1, 'ABB description states the census limit once: ' + desc);
  check(desc.length >= 140 && desc.length <= 160, 'ABB description stays in the meta window (' + desc.length + '): ' + desc);
}

let repeated = 0;
let outside = 0;
items.forEach(function (item) {
  const desc = item.description || '';
  if (genericSourcedSentence(desc) || (desc.match(/Only sourced census fields are shown/g) || []).length > 1) {
    repeated++;
    if (repeated <= 8) console.error('REPEAT ' + item.slug + ': ' + desc);
  }
  if (desc.length < 140 || desc.length > 160) outside++;
});
check(repeated === 0, 'no manufacturer description repeats the sourced-fields sentence (' + repeated + ')');
check(outside === 0, 'every manufacturer description stays in the 140–160 window (' + outside + ' outside)');
check(items.length > 100, 'the scan covered the manufacturer catalog (' + items.length + ')');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('manufacturer description repeat checks passed (' + items.length + ' pages)');
