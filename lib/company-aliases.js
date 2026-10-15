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
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
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
  'hitachi energy global hq': { name: 'Hitachi Energy', slug: 'hitachi-energy' }
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
function directoryCompanySlug(name, slugByNormName) {
  const key = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (slugByNormName && slugByNormName[key]) return slugByNormName[key];
  const alias = resolveCompanyAlias(name);
  if (alias.aliased && alias.slug) return alias.slug;
  return '';
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
  directoryCompanySlug,
  locSlug
};
