#!/usr/bin/env node
/* build-company-developments.js — attach confirmed TransformerPath Intel to
 * permanent manufacturer entities.
 *
 * TransformerPath Daily Intel already contains confirmed, sourced company
 * developments (orders, factory expansions, acquisitions, rebrands). This
 * build matches those items to the known census/tier manufacturer entities and
 * emits data/company-developments.json so a manufacturer's profile page can
 * accumulate real history instead of leaving the intelligence trapped inside
 * dated intel pages.
 *
 * Honesty rules:
 *   - Every item's title/src/url comes VERBATIM from data/intel.json — nothing
 *     is invented.
 *   - Association is a keyword match on the item title/snippet. We therefore
 *     only ever claim an item "references this company" (the section label),
 *     never that it is a verified project award to that company.
 *   - No capability numbers are derived here.
 *
 * Run before build-company-pages (see netlify.toml). Output: internal.
 */
'use strict';
const fs = require('fs');
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const ITEMS = Object.values(INTEL).flatMap(function (r) { return (r.items || []); });

// Entity (exact census/tier name) -> distinctive match keywords.
// Keywords are word-boundary matched against title+snippet.
const MAP = {
  'Hitachi Energy': ['hitachi energy'],
  'Siemens Energy': ['siemens energy'],
  'CG Power': ['cg power'],
  'BHEL (Bharat Heavy Electricals)': ['bhel'],
  'China XD Group': ['china xd'],
  'TBEA Co. Ltd.': ['tbea'],
  'Hyosung Heavy Industries': ['hyosung heavy'],
  'HD Hyundai Electric': ['hd hyundai'],
  'SGB-SMIT Group': ['sgb-smit'],
  'Royal SMIT Transformers': ['royal smit'],
  'Smit Transformers': ['smit transformers'],
  'KONČAR Group (Power + Distribution & Special Transformers)': ['koncar', 'končar'],
  'WEG': ['weg'],
  'Transformers & Rectifiers India (TARIL)': ['taril'],
  'Mitsubishi Electric': ['mitsubishi electric'],
  'Prolec GE': ['prolec'],
  'GE Vernova': ['ge vernova'],
  'Voltamp Transformers': ['voltamp'],
};

function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function matches(item, kws) {
  // Match on the TITLE only, so an item is only associated when it actually
  // names the company as its subject (prevents snippet-level false matches
  // such as "Mitsubishi Power" vs "Mitsubishi Electric", or a competitor named
  // in passing). The section label stays "Intel referencing <company>".
  const t = (item.title || '').toLowerCase();
  for (const k of kws) {
    if (new RegExp('\\b' + escRe(k.toLowerCase()) + '\\b').test(t)) return true;
  }
  return false;
}

const out = [];
Object.entries(MAP).forEach(function (e) {
  const name = e[0]; const kws = e[1];
  const hits = ITEMS.filter(function (it) { return matches(it, kws); }).slice(0, 5);
  if (!hits.length) return;
  out.push({
    name: name,
    developments: hits.map(function (it) {
      return { title: it.title, src: it.src, url: it.url, value: it.value || '' };
    }),
    source: 'TransformerPath Daily Intel',
    lastVerified: '2026-08-28',
  });
});

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/company-developments.json', JSON.stringify(out, null, 2));

console.log('company-developments.json wrote ' + out.length + ' entities with sourced intel');
out.forEach(function (e) { console.log('  ' + e.name + ' (' + e.developments.length + ')'); });
