#!/usr/bin/env node
/* A DEWA/UAE tender is regional on the SEC profile. An SEC award is about SEC.
   "Secuencia" is not SEC. */
'use strict';
const fs = require('fs');
const { mentionsEntity, splitEntityIntel } = require('../lib/entity-intel');

let failed = 0;
function check(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failed++; console.error('  ✗ ' + msg); }
}

const SEC = 'Saudi Electricity Co / National Grid SA';
const dewa = { title: 'DEWA floats EPC for a 132/11 kV substation', snippet: 'Dubai Electricity and Water Authority tender in the UAE.', buyer: 'DEWA' };
const award = { title: 'Saudi Electricity Company (SEC) awards a substation EPC (synthetic fixture)', snippet: 'National Grid SA procurement.', buyer: 'Saudi Electricity Company (SEC)' };
const secuencia = { title: 'Central Fotovoltaica Puerto Peñasco Secuencia III', snippet: 'CFE solar plant in Mexico.', buyer: 'CFE' };
const sppc = { title: 'Saudi Power Procurement says about half the grid is being scaled up', snippet: 'Saudi Arabia grid demand, including AI.', buyer: 'Saudi Power Procurement Company' };

console.log('=== ENTITY VS REGIONAL INTEL ===');
check(mentionsEntity(award, SEC), 'SEC award is about Saudi Electricity / National Grid SA');
check(!mentionsEntity(dewa, SEC), 'DEWA tender is not about SEC');
check(!mentionsEntity(secuencia, SEC), 'Puerto Peñasco Secuencia is not an SEC mention');
check(!mentionsEntity(sppc, SEC), 'Saudi Power Procurement is not SEC');
check(mentionsEntity(dewa, 'DEWA'), 'DEWA tender is about DEWA');

const split = splitEntityIntel([dewa, award, secuencia, sppc], SEC);
check(split.about.length === 1 && split.about[0] === award, 'SEC split keeps only the SEC award');
check(split.regional.indexOf(dewa) >= 0, 'DEWA tender stays in the regional block');

const intel = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const gcc = (intel.GCC && intel.GCC.items) || [];
const live = splitEntityIntel(gcc, SEC);
check(live.about.some(function (it) { return /Saudi Electricity Company \(SEC\)/.test(it.title); }), 'corpus SEC award is entity intel');
check(!live.about.some(function (it) { return /DEWA/i.test(it.title) && !/Saudi Electricity/i.test(it.title); }), 'a DEWA-titled item is not SEC entity intel');
check(live.about.every(function (it) { return mentionsEntity(it, SEC); }), 'every SEC entity item names SEC');

['build-utilities.js', 'build-company-pages.js'].forEach(function (file) {
  const src = fs.readFileSync(file, 'utf8');
  check(src.indexOf('splitEntityIntel') >= 0 && src.indexOf('Regional intel') >= 0, file + ' separates regional intel');
});

if (failed) {
  console.error('ENTITY INTEL REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS');
