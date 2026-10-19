#!/usr/bin/env node
/* Sourced landing pages exist only when five makers qualify, and carry ItemList.
 * Run: node tests/sourced-hubs.js
 */
'use strict';

const fs = require('fs');
const specs = require('../lib/manufacturer-specs');
const catalog = require('../lib/seo-catalog');
const { fitWindow } = require('../lib/seo-fit');

const errors = [];
function fail(msg) { errors.push(msg); }

const doc = specs.load();
const hubs = specs.hubs(doc);
const slugs = hubs.map(function (h) { return h.slug; });
if (slugs.indexOf('power-transformers') < 0) fail('power hub missing');
if (slugs.indexOf('400-kv') < 0) fail('400 kV hub missing');
if (slugs.indexOf('distribution-transformers') >= 0) fail('distribution hub published below the gate');
if (slugs.indexOf('dry-type-transformers') >= 0) fail('dry-type hub published below the gate');
hubs.forEach(function (h) {
  if (h.companies.length < specs.MIN_HUB) fail(h.slug + ' below minimum');
  if (h.title.length < 50 || h.title.length > 60) fail(h.title + ' length ' + h.title.length);
  const desc = fitWindow(h.lead, 140, 160, [' Only sourced fields are shown.', ' Independent record on TransformerPath.']);
  if (desc.length < 140 || desc.length > 160) fail(h.slug + ' description ' + desc.length);
  const rel = 'manufacturers/sourced/' + h.slug + '/index.html';
  const html = fs.readFileSync(rel, 'utf8');
  const draft = catalog.draft(rel, html, catalog.create());
  const list = (draft.nodes || []).find(function (n) { return n && n['@type'] === 'ItemList'; });
  if (!list) fail(h.slug + ' ItemList missing');
  else if (list.numberOfItems !== h.companies.length) fail(h.slug + ' ItemList count');
  if (html.indexOf('application/ld+json') < 0) fail(h.slug + ' json-ld script');
  if (html.indexOf('Suggest a correction') < 0 || html.indexOf('correct-company.html') < 0) fail(h.slug + ' corrections link');
  h.companies.forEach(function (c) {
    if (html.indexOf('/manufacturers/' + c.slug + '/') < 0) fail(h.slug + ' missing ' + c.slug);
  });
});

const indexHtml = fs.readFileSync('manufacturers/sourced/index.html', 'utf8');
if (indexHtml.indexOf('Suggest a correction') < 0 || indexHtml.indexOf('correct-company.html') < 0) fail('index corrections link');
const indexTitle = 'Sourced manufacturer group directory | TransformerPath';
if (indexTitle.length < 50 || indexTitle.length > 60) fail('index title ' + indexTitle.length);
const board = fs.readFileSync('manufacturers.html', 'utf8');
if (board.indexOf('manufacturers/sourced/400-kv/') < 0) fail('directory link');

if (errors.length) {
  console.error('SOURCED HUBS FAIL');
  errors.forEach(function (e) { console.error('  ' + e); });
  process.exit(1);
}
console.log('SOURCED HUBS OK ' + slugs.join(', '));
