'use strict';
/* Per-country tender pages.
 *
 * A tender is listed under the country already stored on the record.
 * Saudi / USA / UAE aliases match the directory's country label. A tender
 * is not copied onto a second country. Directory manufacturers are the
 * census rows filed under that country. They are not a forecast of who wins.
 */
const { canonicalCountry } = require('./market-country');

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const DISPLAY = {
  'saudi arabia': 'Saudi Arabia',
  'united arab emirates': 'United Arab Emirates',
  'united states': 'United States',
  'united kingdom': 'United Kingdom',
  'south korea': 'South Korea',
  'south africa': 'South Africa',
  'new zealand': 'New Zealand',
  'czech republic': 'Czechia',
  'turkiye': 'Türkiye'
};

function displayCountry(canonical) {
  const key = String(canonical || '');
  if (!key) return '';
  if (DISPLAY[key]) return DISPLAY[key];
  return key.replace(/\b[a-z]/g, function (ch) { return ch.toUpperCase(); });
}

function slugForCountry(country) {
  const canonical = canonicalCountry(country);
  if (!canonical) return '';
  return slugify(displayCountry(canonical));
}

function groupTenders(tenders) {
  const groups = {};
  (tenders || []).forEach(function (tender) {
    if (!tender) return;
    const canonical = canonicalCountry(tender.country);
    if (!canonical) return;
    const slug = slugForCountry(tender.country);
    if (!slug) return;
    if (!groups[slug]) {
      groups[slug] = {
        slug: slug,
        canonical: canonical,
        name: displayCountry(canonical),
        tenders: []
      };
    }
    groups[slug].tenders.push(tender);
  });
  return groups;
}

function directoryGroupsFor(groups, canonical) {
  return (groups || []).filter(function (group) {
    return group && canonicalCountry(group.country) === canonical;
  });
}

function makerRows(groups) {
  const rows = [];
  (groups || []).forEach(function (group) {
    (group.makers || []).forEach(function (maker) {
      const name = maker && maker[0] ? String(maker[0]).trim() : '';
      if (!name || /^Served by/i.test(name)) return;
      rows.push({
        name: name,
        city: maker[1] ? String(maker[1]).trim() : '',
        url: maker[2] ? String(maker[2]).trim() : '',
        types: maker[3] ? String(maker[3]).trim() : '',
        filedUnder: group.country
      });
    });
  });
  return rows;
}

module.exports = {
  slugify: slugify,
  displayCountry: displayCountry,
  slugForCountry: slugForCountry,
  groupTenders: groupTenders,
  directoryGroupsFor: directoryGroupsFor,
  makerRows: makerRows
};
