#!/usr/bin/env node
/* Directory and country listings are readable without JavaScript. */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ssr = require('../lib/directory-ssr');

const index = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8'));
const companies = index.companies || [];
const view = ssr.vendors(companies);
assert.strictEqual(view.total, companies.length);
assert(view.total > 0, 'directory index has companies');
assert(view.listHtml.indexOf('class="vnd-card"') >= 0, 'vendor rows are prerendered');
assert(view.listHtml.indexOf('Loading suppliers') < 0, 'vendor list is not a loading placeholder');
assert(view.countryOptions.indexOf('<option value="">All Countries</option>') === 0, 'country select keeps the all-countries option');
const empty = ssr.vendorCard({ name: '', country: '', kind: 'manufacturer' });
assert(empty.indexOf('—') >= 0, 'missing vendor fields render an em dash');

const root = ssr.directoryRoot(companies, JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8')));
assert(root.indexOf('class="dir-list"') >= 0, 'directory list is prerendered');
assert(root.indexOf('class="dir-controls"') >= 0, 'directory controls exist for the script');
assert(root.indexOf('Showing <b>' + companies.length + '</b> of ' + companies.length) >= 0, 'directory count matches the index');
assert(root.indexOf('Loading the directory index') < 0, 'directory is not a loading placeholder');
assert((root.match(/class="kg-card"/g) || []).length === Math.min(60, companies.length), 'directory shows the first page of rows');

execFileSync(process.execPath, ['build_ssr.js', 'vendors.html'], { stdio: 'inherit' });
execFileSync(process.execPath, ['build_ssr.js', 'directory.html'], { stdio: 'inherit' });
const vendors = fs.readFileSync('vendors.html', 'utf8');
const directory = fs.readFileSync('directory.html', 'utf8');
execFileSync(process.execPath, ['build_ssr.js', 'vendors.html'], { stdio: 'inherit' });
execFileSync(process.execPath, ['build_ssr.js', 'directory.html'], { stdio: 'inherit' });
assert.strictEqual(fs.readFileSync('vendors.html', 'utf8'), vendors, 'vendor prerender is idempotent');
assert.strictEqual(fs.readFileSync('directory.html', 'utf8'), directory, 'directory prerender is idempotent');

assert(vendors.indexOf('id="vndVisibleCount"') >= 0, 'visible count element remains');
assert(vendors.indexOf('<!--SSR:vndVisibleCount-->\n' + view.total + '\n') >= 0, 'static vendor count is the index total');
assert(vendors.indexOf('<!--SSR:cntTotal-->\n' + view.total + '\n') >= 0, 'static organisation count is the index total');
assert(!/id="vndVisibleCount"[^>]*>\s*0\s*</.test(vendors), 'static HTML does not say 0 listed');
assert(vendors.indexOf('Loading suppliers from the unified database') < 0, 'vendor loading text is gone');
const vendorList = vendors.slice(vendors.indexOf('<!--SSR:vndList-->'), vendors.indexOf('<!--/SSR:vndList-->'));
assert((vendorList.match(/class="vnd-card"/g) || []).length === Math.min(75, companies.length), 'vendor page includes listing rows');
assert(vendors.indexOf('while (selCountry.options.length > 1)') >= 0, 'script replaces prerendered country options');

assert(directory.indexOf('Loading the directory index') < 0, 'directory loading text is gone');
assert(directory.indexOf('class="dir-list"') >= 0, 'directory rows are in the page');
assert(directory.indexOf(companies[0].name) >= 0, 'first directory record is in the static HTML');

const countryFiles = fs.readdirSync('manufacturers').filter(function (name) { return name.endsWith('.html'); });
assert(countryFiles.length > 80, 'country listing pages are present');
countryFiles.forEach(function (name) {
  const html = fs.readFileSync(path.join('manufacturers', name), 'utf8');
  const count = html.match(/(\d+)\s+manufacturers?\s+listed/i);
  assert(count && Number(count[1]) > 0, name + ' has a non-zero manufacturer count');
  assert(html.indexOf('mk-row') >= 0, name + ' has listing rows without JavaScript');
});

console.log('directory ssr tests passed');
