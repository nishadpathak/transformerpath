#!/usr/bin/env node
/* tests/check-directories.js — directory integrity gate.
 *
 * Fails on:
 *   - duplicate ids, duplicate compact names, or same-country same-host
 *     records whose names are a token-prefix of each other
 *   - empty required fields that are not labeled in data/directory-integrity.json
 *   - country labels that do not resolve to an ISO 3166-1 alpha-2 code
 *     (Central America (SIEPAC) is allowed only as a labeled regional grid)
 *   - slug canonicalisation: cg-power must 301 to cg-power-and-industrial-solutions,
 *     and an indexable company-slugs row must not keep an alias source slug
 *
 * Live HTTP checks are weekly (scripts/weekly-link-check.js), not this gate.
 *
 * Run: node tests/check-directories.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveCountry } = require('../lib/country-codes');
const { ALIASES, slugify, resolveCompanyAlias } = require('../lib/company-aliases');
const {
  REQUIRED, blank, fieldValue, loadDirectories, findDuplicates
} = require('../lib/directory-records');

const ROOT = path.join(__dirname, '..');
const failures = [];
function fail(msg) { failures.push(msg); }

const integrity = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/directory-integrity.json'), 'utf8'));
const flags = {};
(integrity.flags || []).forEach(function (f) {
  const key = [f.directory, f.name, f.country, f.field].join('\t');
  flags[key] = f;
});
const LABELS = { unknown: 1, cleared_not_official: 1, cleared_wrong_entity: 1, cleared_hijacked: 1, dead: 1, regional_not_a_country: 1 };

const dirs = loadDirectories();
Object.keys(dirs).forEach(function (directory) {
  const rows = dirs[directory];
  findDuplicates(rows).forEach(function (d) {
    fail(directory + ' ' + d.type + ': ' + (d.names ? d.names.join(' | ') : d.id));
  });
  rows.forEach(function (row) {
    const country = resolveCountry(row.country);
    if (!country.ok) {
      fail(directory + ' country "' + row.country + '" (' + row.name + ') ' + country.reason);
    } else if (country.regional) {
      const key = [directory, row.name, row.country, 'country'].join('\t');
      const flag = flags[key];
      if (!flag || flag.label !== 'regional_not_a_country') {
        fail(directory + ' regional country "' + row.country + '" (' + row.name + ') is not labeled regional_not_a_country');
      }
    }
    REQUIRED[directory].forEach(function (field) {
      if (!blank(fieldValue(row, field))) return;
      const key = [directory, row.name, row.country, field].join('\t');
      const flag = flags[key];
      if (!flag) {
        fail(directory + ' empty ' + field + ' on ' + row.name + ' (' + row.country + ') with no integrity label');
        return;
      }
      if (!LABELS[flag.label]) fail(directory + ' bad label ' + flag.label + ' on ' + row.name + ' ' + field);
      if (!flag.checked) fail(directory + ' unlabeled checked date on ' + row.name + ' ' + field);
    });
  });
});

function expectRedirect(src, dest) {
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  const from = '/manufacturers/' + src + '/';
  const to = '/manufacturers/' + dest + '/';
  const block = new RegExp('from\\s*=\\s*"' + from.replace(/\//g, '\\/') + '"[\\s\\S]{0,180}to\\s*=\\s*"' + to.replace(/\//g, '\\/') + '"[\\s\\S]{0,80}status\\s*=\\s*301');
  if (!block.test(toml)) fail('netlify.toml missing 301 ' + from + ' → ' + to);
  const page = path.join(ROOT, 'manufacturers', src, 'index.html');
  if (!fs.existsSync(page)) {
    fail('missing redirect page manufacturers/' + src + '/');
    return;
  }
  const html = fs.readFileSync(page, 'utf8');
  const refresh = /http-equiv=["']refresh["']/i.test(html) && html.indexOf('/manufacturers/' + dest + '/') !== -1;
  if (!refresh) fail('manufacturers/' + src + '/ is not a meta-refresh to ' + dest);
  if (/Highest sourced voltage evidence|Directory Completeness Score|Claim this profile/i.test(html)) {
    fail('manufacturers/' + src + '/ is still a full profile');
  }
}

expectRedirect('cg-power', 'cg-power-and-industrial-solutions');
expectRedirect('hammond-power-solutions-baraboo', 'hammond-power-solutions');
expectRedirect('green-transfo-energy-turkey', 'green-transfo');
expectRedirect('siemens-energy-tenjo', 'siemens-energy');
expectRedirect('siemens-energy-nuremberg', 'siemens-energy');
expectRedirect('jefferson-electric', 'jefferson-electric-voltaris');

const slugs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/company-slugs.json'), 'utf8'));
const seenSlug = {};
slugs.forEach(function (row) {
  if (!row || !row.slug) return;
  if (seenSlug[row.slug]) fail('duplicate company slug ' + row.slug);
  seenSlug[row.slug] = row;
  if (!row.indexable) return;
  const alias = resolveCompanyAlias(row.name);
  if (alias.aliased && alias.slug !== row.slug) {
    fail('indexable alias slug ' + row.slug + ' should be ' + alias.slug + ' (' + row.name + ')');
  }
});

Object.keys(ALIASES).forEach(function (key) {
  const dest = ALIASES[key].slug;
  const src = slugify(key);
  if (!src || src === dest) return;
  const page = path.join(ROOT, 'manufacturers', src, 'index.html');
  if (!fs.existsSync(page)) return;
  const html = fs.readFileSync(page, 'utf8');
  if (!/http-equiv=["']refresh["']/i.test(html) || html.indexOf('/manufacturers/' + dest + '/') === -1) {
    fail('alias page manufacturers/' + src + '/ does not redirect to ' + dest);
  }
});

if (!integrity.checked) fail('directory-integrity.json missing checked date');

if (failures.length) {
  console.error('DIRECTORY CHECK FAILED — ' + failures.length);
  failures.forEach(function (f) { console.error('  ' + f); });
  process.exit(1);
}
const counts = {};
Object.keys(dirs).forEach(function (k) { counts[k] = dirs[k].length; });
console.log('DIRECTORY CHECK OK ' + JSON.stringify(counts));
