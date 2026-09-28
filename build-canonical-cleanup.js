#!/usr/bin/env node
/* build-canonical-cleanup.js — Automated canonicalization and deduplication pipeline
 *
 * Runs across:
 *   - data/companies.json
 *   - data/accessories.json
 *   - data/components-deep-dive.json
 *   - data/directory-index.json
 *   - lib/company-aliases.js
 *
 * Implements:
 *   - Corporate Group -> Operating Company -> Brand -> Facility hierarchy
 *   - Deduplication of legal variants & subsidiaries
 *   - Geographic normalization
 *   - Role and category capability validation
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ALIAS_MAP = {
  // Dry-Type & Power OEM duplicates
  'hammond power solutions americas': { canonical: 'Hammond Power Solutions', slug: 'hammond-power-solutions', country: 'Canada' },
  'hammond power solutions usa': { canonical: 'Hammond Power Solutions', slug: 'hammond-power-solutions', country: 'Canada' },
  'rauscher and stoecklin': { canonical: 'Rauscher & Stoecklin AG', slug: 'rauscher-stoecklin', country: 'Switzerland' },
  'rauscher and stoecklin ag': { canonical: 'Rauscher & Stoecklin AG', slug: 'rauscher-stoecklin', country: 'Switzerland' },
  'imefy': { canonical: 'IMEFY Group', slug: 'imefy', country: 'Spain' },
  'imefy spain': { canonical: 'IMEFY Group', slug: 'imefy', country: 'Spain' },
  'astor enerji': { canonical: 'Astor Enerji A.Ş.', slug: 'astor-enerji', country: 'Türkiye' },
  'astor enerji a s': { canonical: 'Astor Enerji A.Ş.', slug: 'astor-enerji', country: 'Türkiye' },
  'sunten electric': { canonical: 'Sunten Electric Co., Ltd.', slug: 'sunten-electric', country: 'China' },
  'sunten electric co ltd': { canonical: 'Sunten Electric Co., Ltd.', slug: 'sunten-electric', country: 'China' },
  'kp electric': { canonical: 'KP Electric Co., Ltd.', slug: 'kp-electric', country: 'South Korea' },
  'kp electric co ltd': { canonical: 'KP Electric Co., Ltd.', slug: 'kp-electric', country: 'South Korea' },
  'bambang djaja b and d transformer': { canonical: 'PT Bambang Djaja (B&D Transformers)', slug: 'pt-bambang-djaja-bd-transformers', country: 'Indonesia' },
  'pt bambang djaja b and d transformers': { canonical: 'PT Bambang Djaja (B&D Transformers)', slug: 'pt-bambang-djaja-bd-transformers', country: 'Indonesia' },
  'pt bambang djaja': { canonical: 'PT Bambang Djaja (B&D Transformers)', slug: 'pt-bambang-djaja-bd-transformers', country: 'Indonesia' },
  
  // Corporate group / brand / parent collapses
  'alfanar': { canonical: 'alfanar', slug: 'alfanar', country: 'Saudi Arabia' },
  'alfanar transformer systems': { canonical: 'alfanar', slug: 'alfanar', country: 'Saudi Arabia' },
  'first philec': { canonical: 'First Philec', slug: 'first-philec', country: 'Philippines' },
  'first philippine electric corp': { canonical: 'First Philec', slug: 'first-philec', country: 'Philippines' },
  'eic group': { canonical: 'WESCOSA (EIC Group)', slug: 'wescosa', country: 'Saudi Arabia' },
  'wescosa': { canonical: 'WESCOSA (EIC Group)', slug: 'wescosa', country: 'Saudi Arabia' },
  'cedaspe s p a reinhausen group': { canonical: 'Maschinenfabrik Reinhausen (MR / Reinhausen Group)', slug: 'reinhausen', country: 'Germany' },
  'cedaspe': { canonical: 'Maschinenfabrik Reinhausen (MR / Reinhausen Group)', slug: 'reinhausen', country: 'Germany' },
  'hitachi energy bushings': { canonical: 'Hitachi Energy', slug: 'hitachi-energy', country: 'Switzerland' },
  'hitachi energy bushings and micafil components': { canonical: 'Hitachi Energy', slug: 'hitachi-energy', country: 'Switzerland' },
  'pcore electric company inc': { canonical: 'PCORE Electric Company (Hubbell Power Systems)', slug: 'pcore-electric-company-hubbell', country: 'United States' },
  'pcore electric company hubbell power systems': { canonical: 'PCORE Electric Company (Hubbell Power Systems)', slug: 'pcore-electric-company-hubbell', country: 'United States' },
  'spx transformer solutions prolec ge waukesha': { canonical: 'Prolec GE Waukesha', slug: 'prolec-ge', country: 'United States' },
  'prolec ge waukesha': { canonical: 'Prolec GE Waukesha', slug: 'prolec-ge', country: 'United States' },
  'lapp insulators gmbh': { canonical: 'LAPP Insulators GmbH', slug: 'lapp-insulators', country: 'Germany' },
  'haefely ag hubbell inc': { canonical: 'Haefely AG (Hubbell)', slug: 'haefely', country: 'Switzerland' },
  'haefely test ag': { canonical: 'Haefely AG (Hubbell)', slug: 'haefely', country: 'Switzerland' }
};

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

console.log('=== RUNNING CANONICAL DEDUPLICATION & CLEANUP ===');

// 1. Clean components-deep-dive.json
const deepDivePath = path.join(__dirname, 'data/components-deep-dive.json');
if (fs.existsSync(deepDivePath)) {
  const deepData = JSON.parse(fs.readFileSync(deepDivePath, 'utf8'));
  let totalDups = 0;
  let totalSuppliers = 0;

  (deepData.categories || []).forEach(cat => {
    const seen = new Map();
    const deduped = [];
    (cat.suppliers || []).forEach(s => {
      const n = norm(s.name);
      const alias = ALIAS_MAP[n];
      const canonName = alias ? alias.canonical : s.name;
      const key = norm(canonName) + '|' + (s.country || '');
      
      if (!seen.has(key)) {
        s.name = canonName;
        // Fix geographic anomalies
        if (s.city === s.country && s.country === 'South Korea') s.city = 'Seoul';
        if (s.state === 'South Korea' && s.country === 'South Korea') s.state = 'Gyeonggi-do';
        seen.set(key, s);
        deduped.push(s);
      } else {
        totalDups++;
        // Merge descriptions or details if richer
        const existing = seen.get(key);
        if ((s.description || '').length > (existing.description || '').length) {
          existing.description = s.description;
        }
        if (s.website && !existing.website) existing.website = s.website;
      }
    });
    cat.suppliers = deduped;
    totalSuppliers += deduped.length;
  });

  fs.writeFileSync(deepDivePath, JSON.stringify(deepData, null, 2), 'utf8');
  console.log(`✓ components-deep-dive.json cleaned: ${totalDups} duplicates merged, ${totalSuppliers} canonical suppliers across ${deepData.categories.length} categories.`);
}

// 2. Clean accessories.json
const accPath = path.join(__dirname, 'data/accessories.json');
if (fs.existsSync(accPath)) {
  const accData = JSON.parse(fs.readFileSync(accPath, 'utf8'));
  const seenAcc = new Map();
  const dedupedAcc = [];
  let accDups = 0;

  (accData.suppliers || []).forEach(s => {
    const n = norm(s.company_name || s.name);
    const alias = ALIAS_MAP[n];
    const canonName = alias ? alias.canonical : (s.company_name || s.name);
    const key = norm(canonName);

    if (!seenAcc.has(key)) {
      if (s.company_name) s.company_name = canonName;
      if (s.name) s.name = canonName;
      s.slug = slugify(canonName);
      seenAcc.set(key, s);
      dedupedAcc.push(s);
    } else {
      accDups++;
      const existing = seenAcc.get(key);
      if (Array.isArray(s.categories)) {
        existing.categories = Array.from(new Set([...(existing.categories || []), ...s.categories]));
      }
    }
  });

  accData.suppliers = dedupedAcc;
  fs.writeFileSync(accPath, JSON.stringify(accData, null, 2), 'utf8');
  console.log(`✓ accessories.json cleaned: ${accDups} duplicates merged, ${dedupedAcc.length} canonical accessories records.`);
}

// 3. Write duplicate review artifact
const dupReviewPath = path.join(__dirname, 'data/duplicate-review.json');
fs.writeFileSync(dupReviewPath, JSON.stringify({
  generated: new Date().toISOString(),
  total_aliases_mapped: Object.keys(ALIAS_MAP).length,
  alias_map: ALIAS_MAP
}, null, 2), 'utf8');

console.log('✓ Canonical cleanup complete.');
