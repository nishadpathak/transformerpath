/* Declared origin: the country of manufacture a supplier states.
 *
 * A row is kept only when origin_source is an official company page or filing
 * and origin_checked is the day that page was read. The quote is the words
 * on that page. A company with no row is shown as an em dash.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_DENY = /\bMr\.?\b|\bMs\.?\b|\bDr\.?\b/;
const EVIDENCE = {
  'United States': /\bUnited States\b|\bUSA\b|\bUS manufacturer\b/,
  Mexico: /\bMexico\b/,
  Australia: /\bAustralia\b/,
  Germany: /\bGermany\b/,
  Netherlands: /\bNetherlands\b/,
  Romania: /\bRomania\b/,
  Malaysia: /\bMalaysia\b/,
  India: /\bIndia\b/,
  China: /\bChina\b/,
  'Czech Republic': /\bCzech Republic\b/,
  Brazil: /\bBrazil\b/,
  Italy: /\bItaly\b/i,
  Israel: /\bIsrael\b/,
  Thailand: /\bThailand\b/
};

const NOTE = 'Buyers may need origin information for grid equipment under upcoming rules in the United States and the European Union. Declared origin is the country of manufacture a supplier states on its own site or in a filing. Where no statement is on file, the field shows —. This is not legal advice.';

function load(root) {
  const file = path.join(root || path.join(__dirname, '..'), 'data', 'declared-origins.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function bySlug(doc) {
  const map = {};
  ((doc && doc.companies) || []).forEach(function (row) {
    if (row && row.slug) map[row.slug] = row;
  });
  return map;
}

function listingLabel(record) {
  if (!record || !Array.isArray(record.origin) || !record.origin.length) return '—';
  return record.origin.join(', ');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function citation(record) {
  if (!record) return '';
  return ' <a href="' + esc(record.origin_source) + '" target="_blank" rel="noopener">source</a> <span class="src">(checked ' + esc(record.origin_checked) + ')</span>';
}

function profileHtml(record) {
  return '<p data-declared-origin="1"><b>Declared origin</b>: ' + esc(listingLabel(record)) + citation(record) + '</p>' +
    '<p class="declared-origin-note">' + esc(NOTE) + '</p>';
}

function listingHtml(record) {
  const attrs = record
    ? ' data-origin="' + esc(record.origin.join('|')) + '" data-origin-source="' + esc(record.origin_source) + '" data-origin-checked="' + esc(record.origin_checked) + '"'
    : '';
  return '<span class="declared-origin"' + attrs + '>Declared origin: ' + esc(listingLabel(record)) + citation(record) + '</span>';
}

function validate(doc) {
  const errors = [];
  const companies = doc && doc.companies;
  if (!Array.isArray(companies)) return ['companies missing'];
  const seen = {};
  companies.forEach(function (row) {
    if (!row || !row.slug) {
      errors.push('record missing slug');
      return;
    }
    if (seen[row.slug]) errors.push('duplicate slug ' + row.slug);
    seen[row.slug] = 1;
    if (!Array.isArray(row.origin) || !row.origin.length) errors.push(row.slug + ' origin');
    if (!row.origin_source || !/^https:\/\//i.test(row.origin_source)) errors.push(row.slug + ' origin_source');
    if (!DATE.test(row.origin_checked || '')) errors.push(row.slug + ' origin_checked');
    const quote = String(row.quote || '');
    if (!quote.trim()) errors.push(row.slug + ' quote');
    if (NAME_DENY.test(quote)) errors.push(row.slug + ' personal name');
    (row.origin || []).forEach(function (country) {
      const re = EVIDENCE[country];
      if (!re) errors.push(row.slug + ' unknown origin ' + country);
      else if (!re.test(quote)) errors.push(row.slug + ' quote misses ' + country);
    });
  });
  return errors;
}

module.exports = {
  NOTE: NOTE,
  load: load,
  bySlug: bySlug,
  listingLabel: listingLabel,
  profileHtml: profileHtml,
  listingHtml: listingHtml,
  validate: validate
};
