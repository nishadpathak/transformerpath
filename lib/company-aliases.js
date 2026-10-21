#!/usr/bin/env node
/* lib/company-aliases.js — known OEM legal-name / plant-name collapses.
 *
 * Used by the canonical company builder and the directory index so plant-level
 * census rows (e.g. Prolec GE Waukesha) participate as facilities of one
 * company rather than as unrelated manufacturer entities.
 *
 * Only add an alias when the records share an official brand / website and
 * are the same operating company. Do not invent group ownership.
 */
'use strict';

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').trim().replace(/\s+/g, ' ');
}

/* Exact display name → URL slug. Used when the ASCII slugify is empty
 * (Chinese legal names). Latin names are not listed here. */
function listingSlugOverrides() {
  if (listingSlugOverrides.map) return listingSlugOverrides.map;
  try {
    listingSlugOverrides.map = require('../data/listing-slugs.json');
  } catch (e) {
    listingSlugOverrides.map = {};
  }
  return listingSlugOverrides.map;
}

function slugify(s) {
  const raw = String(s || '').trim();
  const ascii = String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  /* A listed override replaces only an empty ASCII slug. A Latin name that
   * already slugifies stays on that slug, so a split listing cannot rename
   * an existing profile that shares the display name. */
  if (!ascii) {
    const over = listingSlugOverrides();
    if (raw && Object.prototype.hasOwnProperty.call(over, raw)) return over[raw];
  }
  return ascii;
}

function cleanBrandName(name) {
  let s = String(name || '').trim();
  s = s.replace(/\s*\((global HQ|GE Vernova|Schneider|Grid Solutions|HVDC|T&D India|Changzhou|Wuhan|Transformers|Kingdom of Saudi Arabia)\)/gi, '');
  s = s.replace(/\s+(USA|Canada|Brasil|Brazil|Colombia|Italy|Spain|Finland|Türkiye|Turkey|India|Malaysia|Vietnam|Japan|Thailand|China|SAE|Transformers SAE)$/i, '');
  return s.trim();
}

/* source norm(name) → canonical company */
const ALIASES = {
  'prolec ge ge vernova': { name: 'Prolec GE', slug: 'prolec-ge' },
  'prolec ge waukesha': { name: 'Prolec GE', slug: 'prolec-ge' },
  'prolec ge brasil': { name: 'Prolec GE', slug: 'prolec-ge' },
  'spx transformer solutions': { name: 'Prolec GE', slug: 'prolec-ge' },
  'spx transformer solutions prolec ge waukesha': { name: 'Prolec GE', slug: 'prolec-ge' },
  'waukesha electric systems': { name: 'Prolec GE', slug: 'prolec-ge' },
  'hico america hyosung': { name: 'Hyosung Heavy Industries', slug: 'hyosung-heavy-industries' },
  'abb power grids': { name: 'Hitachi Energy', slug: 'hitachi-energy' },
  'abb transformers': { name: 'Hitachi Energy', slug: 'hitachi-energy' },
  'hitachi abb power grids': { name: 'Hitachi Energy', slug: 'hitachi-energy' },
  'ge grid solutions': { name: 'GE Vernova', slug: 'ge-vernova' },
  'alstom grid': { name: 'GE Vernova', slug: 'ge-vernova' },
  'areva t and d': { name: 'GE Vernova', slug: 'ge-vernova' },
  'areva td': { name: 'GE Vernova', slug: 'ge-vernova' },
  'crompton greaves': { name: 'CG Power and Industrial Solutions', slug: 'cg-power-and-industrial-solutions' },
  'crompton greaves ltd': { name: 'CG Power and Industrial Solutions', slug: 'cg-power-and-industrial-solutions' },
  'cg power': { name: 'CG Power and Industrial Solutions', slug: 'cg-power-and-industrial-solutions' },
  'cg-power': { name: 'CG Power and Industrial Solutions', slug: 'cg-power-and-industrial-solutions' },
  'hammond power solutions baraboo': { name: 'Hammond Power Solutions', slug: 'hammond-power-solutions' },
  'green transfo energy turkey': { name: 'Green Transfo', slug: 'green-transfo' },
  'siemens energy tenjo': { name: 'Siemens Energy', slug: 'siemens-energy' },
  'siemens energy nuremberg': { name: 'Siemens Energy', slug: 'siemens-energy' },
  'jefferson electric': { name: 'Jefferson Electric (Voltaris)', slug: 'jefferson-electric-voltaris' },
  'hyundai heavy industries ees': { name: 'HD Hyundai Electric', slug: 'hd-hyundai-electric' },
  'hyundai electric and energy systems': { name: 'HD Hyundai Electric', slug: 'hd-hyundai-electric' },
  'smit transformatoren': { name: 'SGB-SMIT Group', slug: 'sgb-smit-group' },
  'royal smit': { name: 'SGB-SMIT Group', slug: 'sgb-smit-group' },
  'cooper power systems': { name: 'Cargill', slug: 'cargill' },
  /* Same official domain, second public profile. exact:true means a longer
   * plant name that merely cleans to this key stays its own profile. */
  'bhel bharat heavy electricals': { name: 'BHEL', slug: 'bhel' },
  'tbea co ltd': { name: 'TBEA Group (Changji HQ; Shenyang, Hengyang, Tianjin plants)', slug: 'tbea-group-changji-hq-shenyang-hengyang-tianjin-plants' },
  'china xd group': { name: "China XD Group (Xi'an XD Transformer)", slug: 'china-xd-group-xian-xd-transformer' },
  'efacec power solutions': { name: 'Efacec', slug: 'efacec' },
  'efacec distribution transformers': { name: 'Efacec', slug: 'efacec' },
  'tmc transformers spa': { name: 'TMC Transformers', slug: 'tmc-transformers' },
  'transformers and rectifiers india': { name: 'Transformers & Rectifiers India (TARIL)', slug: 'transformers-and-rectifiers-india-taril' },
  'elsewedy electric': { name: 'Elsewedy Electric (Transformers)', slug: 'elsewedy-electric-transformers', exact: true },
  'smit transformers': { name: 'Royal Smit Transformers B.V. (SGB-SMIT Group)', slug: 'royal-smit-transformers-b-v-sgb-smit-group' },
  'jshp transformer jiangsu': { name: 'Jiangsu Huapeng (JSHP, Huapeng Group)', slug: 'jiangsu-huapeng-jshp-huapeng-group' },
  'hitachi energy global hq': { name: 'Hitachi Energy', slug: 'hitachi-energy' },
  /* TED award notices use these legal short names. Same operating companies
   * as the directory rows (koncar-dst.hr; trafocz.cz states Trafo CZ, a.s.;
   * EthosEnergy Poland S.A. in Lubliniec is the transformers plant). */
  'koncar d and st': { name: 'Končar - Distribution & Special Transformers (D&ST)', slug: 'koncar-distribution-and-special-transformers-dandst' },
  'trafo cz': { name: 'Trafocz', slug: 'trafocz' },
  'ethosenergy poland': { name: 'EthosEnergy Poland - Transformers', slug: 'ethosenergy-poland-transformers' }
};

function resolveCompanyAlias(rawName) {
  const rawKey = norm(rawName);
  const cleanedKey = norm(cleanBrandName(rawName));
  let hit = ALIASES[rawKey];
  if (!hit && cleanedKey !== rawKey) {
    const cleanedHit = ALIASES[cleanedKey];
    /* exact aliases match only the name itself. A plant row that cleans down
     * to that name (Elsewedy Electric (Kingdom of Saudi Arabia)) stays put. */
    if (cleanedHit && !cleanedHit.exact) hit = cleanedHit;
  }
  if (hit) return { name: hit.name, slug: hit.slug, aliased: true, sourceName: String(rawName || '').trim() };
  return { name: String(rawName || '').trim(), slug: slugify(rawName), aliased: false, sourceName: String(rawName || '').trim() };
}

function isAliasedName(rawName) {
  return !!resolveCompanyAlias(rawName).aliased;
}

/* Census display name → profile slug. Prefer the company-slugs map (keyed by
 * the same lowercase punctuation-stripped name the directory uses). Plant
 * rows that are not their own profile resolve through ALIASES. */
/* Same key the claim-page generator uses when it reads company-slugs.json.
 * Accented letters stay in the key as gaps, matching the stored listing name. */
function censusNameKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').trim();
}

function slugMapFromRows(rows) {
  const map = {};
  (rows || []).forEach(function (row) {
    if (row && row.name && row.slug) map[censusNameKey(row.name)] = row.slug;
  });
  return map;
}

function directoryCompanySlug(name, slugByNormName) {
  const key = censusNameKey(name);
  if (slugByNormName && slugByNormName[key]) return slugByNormName[key];
  const alias = resolveCompanyAlias(name);
  if (alias.aliased && alias.slug) return alias.slug;
  return '';
}

/* A plant row that only exists as an alias is hidden when the canonical
 * company is already a census row. The census itself is left unchanged. */
function directProfileSlug(name, slugByNormName) {
  const key = censusNameKey(name);
  return (slugByNormName && slugByNormName[key]) || '';
}

function ownedProfileSlugs(countries, slugByNormName) {
  const owned = new Set();
  (countries || []).forEach(function (country) {
    (country.makers || []).forEach(function (maker) {
      const direct = directProfileSlug(maker && maker[0], slugByNormName);
      if (direct) owned.add(direct);
    });
  });
  return owned;
}

function aliasRowHidden(name, slugByNormName, owned) {
  if (!name || /^Served by/i.test(name)) return false;
  const direct = directProfileSlug(name, slugByNormName);
  const resolved = directoryCompanySlug(name, slugByNormName);
  if (!resolved || direct === resolved) return false;
  return !!(owned && owned.has(resolved));
}

function visibleMakerCount(countries, slugByNormName) {
  const owned = ownedProfileSlugs(countries, slugByNormName);
  let count = 0;
  (countries || []).forEach(function (country) {
    (country.makers || []).forEach(function (maker) {
      if (!maker || /^Served by/i.test(maker[0])) return;
      if (!aliasRowHidden(maker[0], slugByNormName, owned)) count++;
    });
  });
  return count;
}

/** First token before a comma — "Memphis, TN" and "Memphis, Tennessee" → memphis */
function locSlug(city) {
  const head = String(city || '').split(',')[0].trim();
  return slugify(head);
}

module.exports = {
  ALIASES,
  norm,
  slugify,
  cleanBrandName,
  resolveCompanyAlias,
  isAliasedName,
  censusNameKey,
  slugMapFromRows,
  directoryCompanySlug,
  directProfileSlug,
  ownedProfileSlugs,
  aliasRowHidden,
  visibleMakerCount,
  locSlug
};
