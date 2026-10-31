#!/usr/bin/env node
/* Visitor-facing manufacturer totals use the approved public copy.
 * 1,000 and above render as a floored "1,000+" label. The exact census
 * stays in site-stats.manufacturers and in JSON-LD size.
 */
'use strict';
const fs = require('fs');
const assert = require('assert');
const { publicCountLabel } = require('../lib/public-count-label');

assert.strictEqual(publicCountLabel(1053), '1,000+');
assert.strictEqual(publicCountLabel(1000), '1,000+');
assert.strictEqual(publicCountLabel(1999), '1,000+');
assert.strictEqual(publicCountLabel(2000), '2,000+');
assert.strictEqual(publicCountLabel(2500), '2,000+');
assert.strictEqual(publicCountLabel(999), '999');
assert.strictEqual(publicCountLabel(0), '0');
assert.strictEqual(publicCountLabel('1,053'), '1,000+');
assert.strictEqual(publicCountLabel('1,000+'), '1,000+');

const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const label = publicCountLabel(stats.manufacturers);
assert.strictEqual(stats.manufacturersPublicLabel, label, 'site-stats publishes the public label');
assert.ok(stats.manufacturers >= 1000, 'the live census is in the 1,000+ band');

const builder = fs.readFileSync('build-site-stats.js', 'utf8');
assert.ok(builder.indexOf('manufacturersPublicLabel') >= 0, 'the stats builder stamps the public label');
assert.ok(builder.indexOf('publicCountLabel') >= 0, 'the stats builder renders through the label');
assert.ok(!/Browse all ' \+ current\.manufacturers \+ ' transformer companies/.test(builder), 'the homepage title no longer stamps the raw count');

const phrases = [
  ['index.html', 'A growing sourced directory of <span data-stat="manufacturersPublicLabel">' + label + '</span> transformer makers'],
  ['index.html', 'title="Browse all ' + label + ' transformer companies"'],
  ['index.html', '<b data-stat="manufacturersPublicLabel">' + label + '</b>'],
  ['pricing.html', 'the <span data-stat="manufacturersPublicLabel">' + label + '</span>-manufacturer directory'],
  ['pricing.html', 'Browse <span data-stat="manufacturersPublicLabel">' + label + '</span> manufacturers'],
  ['intel.html', 'Explore <span data-stat="manufacturersPublicLabel">' + label + '</span> transformer manufacturers'],
  ['intelligence.html', 'Manufacturer census: ' + label + ' companies'],
  ['directory.html', 'data-stat="manufacturersPublicLabel">' + label],
  ['manufacturers.html', 'Showing ' + label + ' companies across'],
  ['manufacturers.html', '<b>' + label + '</b><small>Companies</small>'],
  ['manufacturers.html', 'data-stat="manufacturersPublicLabel">' + label + '</b> companies are public'],
  ['vendors.html', label],
  ['vendors.html', 'Transformer OEMs (' + label + ')']
];
phrases.forEach(function (pair) {
  const html = fs.readFileSync(pair[0], 'utf8');
  assert.ok(html.indexOf(pair[1]) >= 0, pair[0] + ' missing ' + pair[1]);
});

const raw = String(stats.manufacturers);
const forbidden = [
  ['index.html', new RegExp('directory of (?:<[^>]+>)?' + raw + '(?:</[^>]+>)? transformer makers')],
  ['index.html', new RegExp('Browse all ' + raw + ' transformer companies')],
  ['index.html', new RegExp('data-stat="manufacturers">' + raw)],
  ['pricing.html', new RegExp(raw + '-manufacturer')],
  ['pricing.html', new RegExp('Browse (?:<[^>]+>)?' + raw)],
  ['intel.html', new RegExp('Explore (?:<[^>]+>)?' + raw + '(?:</[^>]+>)? transformer manufacturers')],
  ['intelligence.html', new RegExp('Manufacturer census: ' + raw)],
  ['manufacturers.html', new RegExp('Showing ' + raw + ' companies')],
  ['vendors.html', new RegExp('Transformer OEMs \\(' + raw + '\\)')],
  ['directory.html', new RegExp('data-stat="manufacturers">' + raw)]
];
forbidden.forEach(function (pair) {
  const html = fs.readFileSync(pair[0], 'utf8');
  assert.ok(!pair[1].test(html), pair[0] + ' still publishes the raw count ' + pair[1]);
});

const mfg = fs.readFileSync('manufacturers.html', 'utf8');
const size = mfg.match(/"size"\s*:\s*(\d+)/);
assert.ok(size && Number(size[1]) === stats.manufacturers, 'JSON-LD size stays the exact census');
assert.ok(mfg.indexOf('function publicCountLabel') >= 0, 'the manufacturers page re-renders the label after load');
assert.ok(/const countLabel = filtered \? String\(makerCount\) : publicCountLabel\(makerCount\)/.test(mfg), 'an unfiltered manufacturers count uses the label');

const vendors = fs.readFileSync('vendors.html', 'utf8');
assert.ok(vendors.indexOf("pillOem.textContent = 'Transformer OEMs (' + oemLabel + ')'") >= 0, 'the vendor pill does not put the raw OEM count back');
const directoryJs = fs.readFileSync('tp-directory.js', 'utf8');
assert.ok(directoryJs.indexOf('data-stat="manufacturersPublicLabel"') >= 0, 'the directory script keeps the public label');
assert.ok(directoryJs.indexOf('function publicCountLabel') >= 0, 'the directory script can render the label without the JSON field');

const ssr = fs.readFileSync('build_ssr.js', 'utf8');
assert.ok(ssr.indexOf('publicCountLabel(view.oem)') >= 0, 'vendor SSR uses the label');
assert.ok(ssr.indexOf('publicCountLabel(makers)') >= 0, 'manufacturer SSR uses the label');
assert.ok(/"size"\s*:\s*\)\s*\d|makers/.test(ssr) && ssr.indexOf("'$1' + makers") >= 0, 'dataset size stays the exact count');

console.log('public manufacturer label ok (' + stats.manufacturers + ' → ' + label + ')');
