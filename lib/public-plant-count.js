/* A sourced plant is counted once per city and country inside a company group.
 * Sister-company copies of the same plant stay in the file and are not counted.
 * Nothing here invents a plant or deletes a record.
 */
'use strict';

const { canonicalCountry } = require('./market-country');

const GENERIC = {
  electric: 1, power: 1, energy: 1, transformer: 1, transformers: 1, group: 1,
  the: 1, international: 1, global: 1, limited: 1, solutions: 1, grid: 1,
  plant: 1, works: 1, manufacturing: 1, company: 1, ltd: 1, llc: 1, inc: 1,
  gmbh: 1, plc: 1, spa: 1, pte: 1, wll: 1, and: 1, new: 1, co: 1
};
const PLACE_WORDS = ['united arab emirates', 'saudi arabia', 'south korea', 'south africa', 'united kingdom', 'united states', 'new zealand', 'switzerland', 'germany', 'france', 'india', 'china', 'japan', 'turkiye', 'turkey', 'vietnam', 'indonesia', 'malaysia', 'italy', 'spain', 'brazil', 'brasil', 'chile', 'mexico', 'egypt', 'nigeria', 'australia', 'canada', 'sweden', 'norway', 'finland', 'poland', 'netherlands', 'belgium', 'austria', 'hungary', 'qatar', 'kuwait', 'bahrain', 'oman', 'pakistan', 'colombia', 'argentina', 'portugal', 'greece', 'denmark', 'ireland', 'romania', 'algeria', 'ethiopia', 'thailand', 'singapore', 'czechia', 'usa', 'uae', 'uk'];

function fold(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function countryNamedIn(text) {
  const folded = ' ' + fold(text).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const words = PLACE_WORDS.slice().sort(function (a, b) { return b.length - a.length; });
  for (let i = 0; i < words.length; i++) {
    if (folded.indexOf(' ' + words[i] + ' ') >= 0) return canonicalCountry(words[i]);
  }
  return '';
}

function plantKeys(city) {
  const raw = fold(city);
  const keys = [];
  const stem = raw.split(',')[0].split('/')[0].split('(')[0].replace(/[^a-z0-9]+/g, ' ').trim();
  if (stem) keys.push(stem);
  const paren = raw.match(/\(([^)]+)\)/);
  if (paren) {
    const inner = paren[1].replace(/[^a-z0-9]+/g, ' ').trim();
    if (inner.length >= 5) keys.push(inner);
  }
  return keys;
}

function cityOverlap(a, b) {
  const left = plantKeys(a);
  const right = plantKeys(b);
  return left.some(function (key) { return right.indexOf(key) >= 0; });
}

function domainOf(company) {
  const raw = String((company && company.website) || '').trim();
  if (!raw) return '';
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : ('https://' + raw)).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (e) { return ''; }
}

function tokensOf(name) {
  return fold(name).split(/[^a-z0-9]+/).filter(function (token) {
    return token.length >= 3 && !GENERIC[token] && !countryNamedIn(token);
  });
}

function sameBrand(a, b, companyById) {
  const left = companyById[a.company_id] || { name: a.company_name || '' };
  const right = companyById[b.company_id] || { name: b.company_name || '' };
  const leftDomain = domainOf(left);
  const rightDomain = domainOf(right);
  if (leftDomain && leftDomain === rightDomain) return true;
  const leftTokens = tokensOf(left.name || a.company_name);
  const rightTokens = tokensOf(right.name || b.company_name);
  return leftTokens.some(function (token) { return rightTokens.indexOf(token) >= 0; });
}

function scorePlant(facility, companyById) {
  const company = companyById[facility.company_id] || { name: facility.company_name || '' };
  const companyCountry = canonicalCountry(company.country || '');
  const facilityCountry = canonicalCountry(facility.country || '');
  let score = 0;
  if (companyCountry && facilityCountry && companyCountry === facilityCountry) score += 100;
  else if (companyCountry && facilityCountry) score -= 40;
  const blob = (facility.company_name || '') + ' ' + (facility.id || '');
  const stem = plantKeys(facility.city)[0] || '';
  if (stem && blob.toLowerCase().indexOf(stem.split(' ')[0]) >= 0) score += 20;
  const named = countryNamedIn(company.name || facility.company_name || '');
  if (named && facilityCountry && named !== facilityCountry) score -= 25;
  else if (!named) score += 30;
  const url = String(facility.source_url || '');
  if (url.replace(/\/+$/, '').split('/').length > 4) score += 10;
  score -= String(facility.id || '').length / 1000;
  return score;
}

/* Marks later copies public_count false. Returns how many were unmarked. */
function dedupePublicPlants(facilities, companyById) {
  const lookup = companyById || {};
  const byCountry = {};
  (facilities || []).forEach(function (facility) {
    if (!facility || !facility.public_count) return;
    const country = canonicalCountry(facility.country);
    if (!country || !plantKeys(facility.city).length) return;
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(facility);
  });
  let dropped = 0;
  Object.keys(byCountry).forEach(function (country) {
    const rows = byCountry[country];
    const parent = rows.map(function () { return -1; });
    function find(i) {
      if (parent[i] < 0) return i;
      parent[i] = find(parent[i]);
      return parent[i];
    }
    function unite(i, j) {
      const a = find(i);
      const b = find(j);
      if (a !== b) parent[b] = a;
    }
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        if (sameBrand(rows[i], rows[j], lookup) && cityOverlap(rows[i].city, rows[j].city)) unite(i, j);
      }
    }
    const parts = {};
    rows.forEach(function (facility, i) {
      const root = find(i);
      if (!parts[root]) parts[root] = [];
      parts[root].push(facility);
    });
    Object.keys(parts).forEach(function (root) {
      const group = parts[root];
      if (group.length < 2) return;
      group.sort(function (a, b) { return scorePlant(b, lookup) - scorePlant(a, lookup); });
      const keep = group[0];
      group.slice(1).forEach(function (facility) {
        facility.public_count = false;
        facility.duplicate_of = keep.id;
        facility.count_note = 'Same ' + (facility.city || 'plant') + ' record as ' + keep.id + '. Not counted again.';
        dropped++;
      });
    });
  });
  return dropped;
}

module.exports = {
  canonicalCountry: canonicalCountry,
  plantKeys: plantKeys,
  cityOverlap: cityOverlap,
  dedupePublicPlants: dedupePublicPlants
};
