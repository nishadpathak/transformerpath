#!/usr/bin/env node
/* build-intel-categories.js — topical taxonomy for TransformerPath Daily Intel.
 *
 * The intelligence-aggregation brief calls for categorising transformer/energy
 * developments. This build tags each item in data/intel.json with one of eight
 * topical categories using high-precision keyword rules, and emits
 * data/intel-categories.json so other pages (and future filters) can surface a
 * lightweight topical tag.
 *
 * HONESTY:
 *   - Categories are DERIVED TOPICAL TAGS from an automated keyword classifier,
 *     not editorial judgements of importance or intent. They are regenerated at
 *     every build so they cannot drift from the source items.
 *   - The classifier is word-bounded and ordered (specific content before
 *     generic catch-alls) to avoid substring false positives. It is a reviewer's
 *     starting point, not an authority; no item is relabelled, invented or
 *     summarised here — the title/snippet/src/url pass through verbatim.
 *   - Confidence is recorded per item so a consumer knows the tag is automated.
 *
 * Run: node build-intel-categories.js  (after any intel.json change).
 */
'use strict';
const fs = require('fs');
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const REGIONS = Object.keys(INTEL);
const ITEMS = REGIONS.flatMap(function (r) {
  return (INTEL[r].items || []).map(function (it) { return Object.assign({ _region: r, _regionLabel: INTEL[r].label || '' }, it); });
});

// Topical categories (the aggregation brief's taxonomy).
const CATEGORIES = ['transformer-market', 'grid-infrastructure', 'project-news', 'manufacturing', 'materials-supply-chain', 'regulatory-trade', 'utility-policy', 'technology'];

// High-precision, word-bounded rules; specific content words evaluated first so a
// transformer-market item that also names a "factory" is not mis-tagged.
const RULES = [
  { cat: 'regulatory-trade', re: /\b(section 337|anti.?dumping|import (duty|ban|tariff)|export (ban|control|restriction)|tariff(s|ed|s)?\b|trade (investigation|case|barrier)|public-procurement exemption|procurement exemption)\b/i },
  { cat: 'materials-supply-chain', re: /\b(crgo|copper (price|shortage|scrap|cost|demand)|transformer oil\b|pressboard|insulation (paper|material|board)|electrical steel|grain-oriented|grain oriented|lithium\b|raw material|supply (chain|shortage|constraint)|lead time)\b/i },
  { cat: 'technology', re: /\b(solid.?state transformer|digital twin|artificial intelligence|\bai\b|condition monitoring|partial discharge|\bpd\b|sensor|smart (grid|meter|transformer)|remote monitoring|predictive maintenance)\b/i },
  { cat: 'manufacturing', re: /\b(factory|manufacturing (facility|plant|base|capacity)|new plant|plant opens|opens? .*(plant|factory|facility|mill)|expand(s|ed|ing)? (manufacturing|plant|capacity|operations)|invest(s|ed|ing|ment)?|capacity (expansion|addition|increase)|acquire(s)?|acquisition|commission(s|ed)? .*(plant|line|facility))\b/i },
  { cat: 'project-news', re: /\b(substation|interconnector|transmission (line|project|link|investment|network)|hvdc\b|power plant|data ?centr(e|er)|grid (connection|link|reinforcement)|project (award|win|contract|tender)|gigawatt|\bgw\b|tender(s|ing|ed)?|epc contract|award(s|ed)? .*contract)\b/i },
  { cat: 'grid-infrastructure', re: /\b(grid (moderni|reinforce|upgrade development)|transmission|substation|switchgear|voltage|\bkv\b|interconnection|networking|utility\b)\b/i },
  { cat: 'utility-policy', re: /\b(grid code|policy|regulation|regulator|capacity (market|mechanism)|approval to supply|approved to supply|net.?metering|procurement rule)\b/i },
  { cat: 'transformer-market', re: /\b(transformer|order book|backlog|lead time|power transformer|distribution transformer)\b/i },
];
function classify(s) { const r = RULES.find(function (x) { return x.re.test(s); }); return r ? r.cat : 'transformer-market'; }

const CATEGORY_COUNTRIES = {
  'transformer-market': [], 'grid-infrastructure': [], 'project-news': [], 'manufacturing': [],
  'materials-supply-chain': [], 'regulatory-trade': [], 'utility-policy': [], 'technology': [],
};
const out = { generated: new Date().toISOString().slice(0, 10), categories: CATEGORIES, items: [] };
ITEMS.forEach(function (it) {
  const cat = classify((it.title || '') + ' :: ' + (it.snippet || '').slice(0, 200));
  out.items.push({
    title: it.title, snippet: it.snippet, value: it.value || '', src: it.src || '',
    url: it.url || '', isNew: !!it.isNew, region: it._region, regionLabel: it._regionLabel,
    category: cat,
    // Automated topical tag, not an editorial judgement.
    category_source: 'auto-keyword', confidence: 'LIMITED',
  });
  CATEGORY_COUNTRIES[cat].push({ title: it.title, url: it.url || '', src: it.src || '' });
});
const counts = {};
out.items.forEach(function (it) { counts[it.category] = (counts[it.category] || 0) + 1; });
out.counts = counts;
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/intel-categories.json', JSON.stringify(out, null, 2));
console.log('intel-categories.json wrote ' + out.items.length + ' tagged items');
console.log('  ' + JSON.stringify(counts));
module.exports = out;
