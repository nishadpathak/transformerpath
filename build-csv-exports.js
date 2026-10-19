#!/usr/bin/env node
/* build-csv-exports.js — write the paid CSV files from the live JSON.
 *
 * Run from the Netlify build, after directory, tender, and award data exist.
 * Output is data/csv-exports/, gitignored, and included only in the
 * csv-download function. It is not copied to dist/.
 */
'use strict';
const path = require('path');
const csv = require('./lib/csv-exports');

const dest = process.argv[2] ? path.resolve(process.argv[2]) : csv.defaultExportDir();
const manifest = csv.writeExports(dest);
const files = manifest.files;
console.log('csv exports: directory ' + files.directory.rows +
  ', tenders ' + files.tenders.rows +
  ', awards ' + files.awards.rows +
  ' → ' + dest);
