#!/usr/bin/env node
/* Apply reviewed paid listings onto the directory index.
 * Sets listing_tier "verified" and verified true only. Does not rewrite the
 * file when nothing changed, and does not touch capability, evidence, or
 * ranking fields.
 */
'use strict';
const fs = require('fs');
const paid = require('./lib/paid-listings');

const indexPath = 'data/directory-index.json';
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const doc = paid.load();
const changed = paid.applyVerifiedManufacturers(index.companies || [], doc);
if (!changed) {
  console.log('paid listings: no verified manufacturer rows to apply');
  process.exit(0);
}
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log('paid listings applied to directory index:', changed);
