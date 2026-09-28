#!/usr/bin/env node
/* clean-manufacturers-census.js
 *
 * Systematic deduplication, legal alias canonicalization, and capability revalidation
 * across data/manufacturers.json and manufacturers.html.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAW_CENSUS_PATH = path.join(__dirname, 'data/manufacturers.json');
const data = JSON.parse(fs.readFileSync(RAW_CENSUS_PATH, 'utf8'));

// Canonical name mappings
const CANONICAL_MAP = {
  'hammond power solutions (americas)': 'Hammond Power Solutions',
  'hammond power solutions usa': 'Hammond Power Solutions',
  'hammond power solutions': 'Hammond Power Solutions',
  'rauscher & stoecklin': 'Rauscher & Stoecklin AG',
  'rauscher & stoecklin ag': 'Rauscher & Stoecklin AG',
  'imefy': 'IMEFY Group',
  'imefy spain': 'IMEFY Group',
  'astor enerji': 'Astor Enerji A.Ş.',
  'astor enerji a.ş.': 'Astor Enerji A.Ş.',
  'sunten electric': 'Sunten Electric Co., Ltd.',
  'sunten electric co., ltd.': 'Sunten Electric Co., Ltd.',
  'kp electric': 'KP Electric Co., Ltd.',
  'kp electric co., ltd.': 'KP Electric Co., Ltd.',
  'bambang djaja (b&d transformer)': 'PT Bambang Djaja (B&D Transformers)',
  'pt bambang djaja (b&d transformers)': 'PT Bambang Djaja (B&D Transformers)',
  'pt bambang djaja': 'PT Bambang Djaja (B&D Transformers)',
  'alfanar': 'alfanar',
  'alfanar transformer systems': 'alfanar',
  'first philec': 'First Philec',
  'first philippine electric corp': 'First Philec',
  'eic group': 'WESCOSA (EIC Group)',
  'wescosa': 'WESCOSA (EIC Group)',
  'wescsa (eic group)': 'WESCOSA (EIC Group)',
  'tamco switchgear': 'Tamco Switchgear',
  'tamco': 'Tamco Switchgear',
  'spx transformer solutions': 'Prolec GE Waukesha',
  'prolec ge waukesha': 'Prolec GE Waukesha',
  'pcore electric company inc.': 'PCORE Electric Company (Hubbell Power Systems)',
  'pcore electric company': 'PCORE Electric Company (Hubbell Power Systems)',
  'hitachi energy bushings': 'Hitachi Energy',
  'hitachi energy (bushings & micafil components)': 'Hitachi Energy',
  'cedaspe s.p.a. (reinhausen group)': 'Maschinenfabrik Reinhausen (MR / Reinhausen Group)',
  'cedaspe': 'Maschinenfabrik Reinhausen (MR / Reinhausen Group)',
  'haefely test ag': 'Haefely AG (Hubbell)',
  'haefely ag (hubbell inc.)': 'Haefely AG (Hubbell)'
};

// Companies that are NOT transformer manufacturers (distributors, test sets, switchgear only)
const NON_MANUFACTURERS = new Set([
  'camille bauer metrawatt',
  'larson electronics',
  'r&b switchgear'
]);

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

let totalBefore = 0;
let totalAfter = 0;
let duplicatesRemoved = 0;
let nonMakersRemoved = 0;

const cleanedData = data.map(countryGroup => {
  const seenInCountry = new Map();
  const validMakers = [];

  (countryGroup.makers || []).forEach(m => {
    if (/^Served by/i.test(m[0])) {
      validMakers.push(m);
      return;
    }
    totalBefore++;

    const rawName = String(m[0] || '').trim();
    const rawLower = rawName.toLowerCase();
    
    // Check non-manufacturer removal
    if (NON_MANUFACTURERS.has(rawLower) || NON_MANUFACTURERS.has(norm(rawName))) {
      nonMakersRemoved++;
      console.log(`- Removed non-manufacturer: ${rawName} (${countryGroup.country})`);
      return;
    }

    const canonName = CANONICAL_MAP[rawLower] || CANONICAL_MAP[norm(rawName)] || rawName;
    const key = norm(canonName);

    // Fix location anomalies
    let city = m[1] || '';
    if ((city === countryGroup.country || city === 'South Korea') && countryGroup.country === 'South Korea') {
      city = 'Gyeonggi-do / Seoul';
    }
    if (!city && canonName.includes('Magnetron')) {
      city = 'Curitiba, PR';
    }

    if (!seenInCountry.has(key)) {
      const updatedMaker = [...m];
      updatedMaker[0] = canonName;
      updatedMaker[1] = city;
      seenInCountry.set(key, updatedMaker);
      validMakers.push(updatedMaker);
      totalAfter++;
    } else {
      duplicatesRemoved++;
      console.log(`- Merged duplicate in ${countryGroup.country}: "${rawName}" -> "${canonName}"`);
      // Merge types
      const existing = seenInCountry.get(key);
      const types1 = (existing[3] || '').split(',').map(x => x.trim()).filter(Boolean);
      const types2 = (m[3] || '').split(',').map(x => x.trim()).filter(Boolean);
      const mergedTypes = Array.from(new Set([...types1, ...types2])).join(',');
      existing[3] = mergedTypes;
      if (!existing[2] && m[2]) existing[2] = m[2];
    }
  });

  return {
    ...countryGroup,
    makers: validMakers
  };
});

fs.writeFileSync(RAW_CENSUS_PATH, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log(`\n=== MANUFACTURER CENSUS CLEANUP COMPLETE ===`);
console.log(`Total records before: ${totalBefore}`);
console.log(`Duplicates removed:   ${duplicatesRemoved}`);
console.log(`Non-makers removed:   ${nonMakersRemoved}`);
console.log(`Total records after:  ${totalAfter}`);
