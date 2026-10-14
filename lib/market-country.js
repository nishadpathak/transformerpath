#!/usr/bin/env node
/* lib/market-country.js — which country a market page may show a record for.
 *
 * Market pages list a tender, project or award only when the record's project
 * country or delivery country is that market, or when an evidenced
 * cross-border link names that market. Title keywords are not a country.
 *
 * A cross-border link counts only when it names a country and carries an
 * http(s) source URL. A bare country string is not evidence. An empty country
 * is not guessed.
 *
 * Aliases below are name variants already used in the corpus (Saudi / USA /
 * UAE). They are not geographic inferences.
 */
'use strict';

function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const ALIASES = {
  'saudi': 'saudi arabia',
  'ksa': 'saudi arabia',
  'kingdom of saudi arabia': 'saudi arabia',
  'uae': 'united arab emirates',
  'u a e': 'united arab emirates',
  'usa': 'united states',
  'u s a': 'united states',
  'united states of america': 'united states',
  'uk': 'united kingdom',
  'u k': 'united kingdom',
  'great britain': 'united kingdom',
  'turkey': 'turkiye',
  'turkiye': 'turkiye',
  'republic of korea': 'south korea',
  'korea republic of': 'south korea'
};

function canonicalCountry(name) {
  const folded = fold(name);
  if (!folded) return '';
  return ALIASES[folded] || folded;
}

function isHttpUrl(url) {
  const value = String(url || '').trim();
  return /^https?:\/\/[^\s/?#]+\.[^\s/?#]+(?:[^\s]*)?$/i.test(value);
}

function pushUnique(list, name) {
  const country = canonicalCountry(name);
  if (country && list.indexOf(country) < 0) list.push(country);
}

/* Project country and, when the record carries one, delivery country. */
function assignedCountries(record) {
  const out = [];
  if (!record || typeof record !== 'object') return out;
  pushUnique(out, record.country);
  pushUnique(out, record.project_country);
  pushUnique(out, record.delivery_country);
  return out;
}

/* cross_border_links: [{ country, source_url }]. source_url is required. */
function evidencedCrossBorderCountries(record) {
  const links = record && (record.cross_border_links || record.crossBorderLinks);
  if (!Array.isArray(links)) return [];
  const out = [];
  links.forEach(function (link) {
    if (!link || typeof link !== 'object') return;
    if (!isHttpUrl(link.source_url || link.sourceUrl)) return;
    pushUnique(out, link.country);
  });
  return out;
}

function marketCountries(market) {
  const out = [];
  if (!market || typeof market !== 'object') return out;
  pushUnique(out, market.gridsName);
  pushUnique(out, market.name);
  pushUnique(out, market.manufName);
  pushUnique(out, market.country);
  return out;
}

function recordOnMarket(record, market) {
  const markets = marketCountries(market);
  if (!markets.length || !record) return false;
  const assigned = assignedCountries(record);
  const cross = evidencedCrossBorderCountries(record);
  return markets.some(function (country) {
    return assigned.indexOf(country) >= 0 || cross.indexOf(country) >= 0;
  });
}

module.exports = {
  fold: fold,
  canonicalCountry: canonicalCountry,
  isHttpUrl: isHttpUrl,
  assignedCountries: assignedCountries,
  evidencedCrossBorderCountries: evidencedCrossBorderCountries,
  marketCountries: marketCountries,
  recordOnMarket: recordOnMarket
};
