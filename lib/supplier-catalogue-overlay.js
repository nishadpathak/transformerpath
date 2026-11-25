/* Small sourced inputs for the large public census files. The main site build
 * materializes the inputs once, before generators derive profiles and indexes.
 * Keeping the patch separate allows review alongside other registry work. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const overlay = require('../data/supplier-catalogue-overlay-2026-11-25.json');

function one(rows, predicate, label) {
  const matches = rows.filter(predicate);
  if (matches.length !== 1) throw new Error('Supplier catalogue: expected one ' + label + ', found ' + matches.length);
  return matches[0];
}

function add(list, value) {
  if (!list.includes(value)) list.push(value);
}

function materializeSupplierCatalogue(dataDir) {
  const files = new Map();
  function read(name) {
    const file = path.join(dataDir, name + '.json');
    const original = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(original);
    files.set(file, { original, data });
    return data;
  }
  const accessories = read('accessories');
  const manufacturers = read('manufacturers');
  const manifest = read('directory-batch-manifest');
  const publish = read('directory-publish');
  const mark = (kind, slug, direct) => {
    const route = kind + '/' + slug + '/index.html';
    const old = manifest.pages[route];
    if (!old || old < overlay.date) manifest.pages[route] = overlay.date;
    if (direct) add(manifest.direct_profile_links, route);
  };

  for (const category of overlay.categoryAdditions) add(accessories.categories, category);
  for (const {slug, expected, set} of overlay.accessoryUpdates) {
    const row = one(accessories.suppliers, x => x.slug === slug, slug);
    for (const [field, value] of Object.entries(set)) {
      if (!isDeepStrictEqual(row[field], expected[field]) && !isDeepStrictEqual(row[field], value)) {
        throw new Error('Supplier catalogue: merge conflicting updates for ' + slug + '.' + field);
      }
      row[field] = value;
    }
    mark('accessories', slug, true);
  }
  for (const row of overlay.accessoryAdditions) {
    const existing = accessories.suppliers.filter(x => x.slug === row.slug || x.name === row.name);
    if (!existing.length) accessories.suppliers.push(row);
    else if (existing.length !== 1 || !isDeepStrictEqual(existing[0], row)) {
      throw new Error('Supplier catalogue: merge colliding listing ' + row.slug);
    }
    add(publish.accessories, row.slug);
    if (!(row.slug in publish.flags)) publish.flags[row.slug] = 'do_not_contact';
    mark('accessories', row.slug, true);
  }
  for (const entry of overlay.manufacturerProductAdditions) {
    const country = one(manufacturers, r => r.country === entry.country, entry.country + ' manufacturer list');
    const row = one(country.makers, r => r[0] === entry.name && r[2] === entry.website, entry.name);
    const codes = row[3].split(',');
    for (const product of entry.add) add(codes, product);
    row[3] = codes.join(',');
    mark('manufacturers', entry.slug, false);
  }

  const changed = [];
  for (const [file, {original, data}] of files) {
    if (isDeepStrictEqual(JSON.parse(original), data)) continue;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + (original.endsWith('\n') ? '\n' : ''));
    changed.push(path.basename(file));
  }
  return changed;
}

module.exports = { materializeSupplierCatalogue };
