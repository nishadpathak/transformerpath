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
  'hyundai heavy industries ees': { name: 'HD Hyundai Electric', slug: 'hd-hyundai-electric' },
  'hyundai electric and energy systems': { name: 'HD Hyundai Electric', slug: 'hd-hyundai-electric' },
  'smit transformatoren': { name: 'SGB-SMIT Group', slug: 'sgb-smit-group' },
  'royal smit': { name: 'SGB-SMIT Group', slug: 'sgb-smit-group' },
  'cooper power systems': { name: 'Cargill', slug: 'cargill' }
};

function resolveCompanyAlias(rawName) {
  const cleaned = cleanBrandName(rawName);
  const hit = ALIASES[norm(cleaned)] || ALIASES[norm(rawName)];
  if (hit) return { name: hit.name, slug: hit.slug, aliased: true, sourceName: String(rawName || '').trim() };
  return { name: String(rawName || '').trim(), slug: slugify(rawName), aliased: false, sourceName: String(rawName || '').trim() };
}

function isAliasedName(rawName) {
  return !!resolveCompanyAlias(rawName).aliased;
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
  locSlug
};
