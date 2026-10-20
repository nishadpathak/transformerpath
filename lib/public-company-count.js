/* The one public company total.
 * Census rows that are plant aliases of a company already on the page are
 * hidden. Homepage, directory, manufacturers, meta descriptions and JSON-LD
 * publish this count. The raw census row count stays in manufacturers.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const aliases = require('./company-aliases');

function read(root) {
  root = root || path.join(__dirname, '..');
  const census = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
  const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'));
  const slugMap = aliases.slugMapFromRows(rows);
  const censusRows = census.reduce(function (sum, group) {
    return sum + (group.makers || []).filter(function (maker) {
      return maker && !/^Served by/i.test(maker[0]);
    }).length;
  }, 0);
  return {
    censusRows: censusRows,
    publicCount: aliases.visibleMakerCount(census, slugMap),
    slugMap: slugMap
  };
}

function namedCountryCount(census) {
  return (census || []).filter(function (group) {
    const name = String(group && group.country || '').trim();
    if (!name || name === '—' || name === '-' || name === '–') return false;
    return (group.makers || []).some(function (maker) {
      return maker && !/^Served by/i.test(maker[0]);
    });
  }).length;
}

module.exports = { read: read, namedCountryCount: namedCountryCount };
