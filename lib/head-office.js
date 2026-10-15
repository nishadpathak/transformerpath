/* Sourced head offices. A plant row must not become the company country.
 *
 * data/head-offices.json is the only place a country or city is overridden.
 * Every office in that file has a public source_url. This module does not
 * invent a location from a name or from the first census row.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function load(root) {
  const file = path.join(root || path.join(__dirname, '..'), 'data', 'head-offices.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byName = {};
  (doc.offices || []).forEach(function (office) {
    if (!office || !office.name || !office.country || !office.source_url) return;
    byName[norm(office.name)] = office;
    if (office.slug) byName['slug:' + office.slug] = office;
  });
  return { checked: doc.checked || '', offices: doc.offices || [], byName: byName };
}

function officeFor(record, index) {
  if (!record || !index) return null;
  const bySlug = record.slug && index.byName['slug:' + record.slug];
  if (bySlug) return bySlug;
  return index.byName[norm(record.name)] || null;
}

/* A later census row that is the company's own name replaces a head office
 * taken earlier from a plant alias. A plant alias never replaces a head office
 * already taken from the company's own row. */
function canonicalRowReplacesAliasHq(prevFromAlias, incomingAliased) {
  return !!prevFromAlias && !incomingAliased;
}

module.exports = {
  norm: norm,
  load: load,
  officeFor: officeFor,
  canonicalRowReplacesAliasHq: canonicalRowReplacesAliasHq
};
