#!/usr/bin/env node
/* tests/check-knowledge-integrity.js
 *
 * Fails when the knowledge hub, taxonomy, redirects or depth audit drift
 * apart from the articles build-knowledge.js actually publishes.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ARTICLES } = require('../build-knowledge.js');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error('  x ' + msg);
}

function publishedSlug(target) {
  const m = String(target || '').match(/^\/knowledge\/([a-z0-9-]+)\.html$/);
  return m ? m[1] : null;
}

const slugs = ARTICLES.map(function (a) { return a.slug; });
const titles = ARTICLES.map(function (a) { return a.title; });
const slugSet = new Set(slugs);

const seenSlug = {};
slugs.forEach(function (slug) {
  if (seenSlug[slug]) fail('duplicate slug ' + slug);
  seenSlug[slug] = 1;
});
const seenTitle = {};
titles.forEach(function (title) {
  if (seenTitle[title]) fail('duplicate title ' + JSON.stringify(title));
  seenTitle[title] = 1;
});

const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/knowledge-taxonomy.json'), 'utf8'));
const allowedLife = new Set(taxonomy.lifecycle_values || []);
const owner = {};
(taxonomy.clusters || []).forEach(function (cluster) {
  const members = [];
  if (cluster.pillar_slug) members.push(cluster.pillar_slug);
  (cluster.spokes || []).forEach(function (slug) { members.push(slug); });
  members.forEach(function (slug) {
    if (!slugSet.has(slug)) fail('unknown slug in taxonomy: ' + slug + ' (cluster ' + cluster.id + ')');
    if (!owner[slug]) owner[slug] = [];
    owner[slug].push(cluster.id);
  });
});
slugs.forEach(function (slug) {
  const clusters = owner[slug] || [];
  if (clusters.length !== 1) fail('article ' + slug + ' is in ' + clusters.length + ' clusters');
  const life = taxonomy.lifecycle && taxonomy.lifecycle[slug];
  if (!life || !allowedLife.has(life)) fail('article ' + slug + ' has no allowed lifecycle');
});
Object.keys(taxonomy.lifecycle || {}).forEach(function (slug) {
  if (!slugSet.has(slug)) fail('unknown slug in taxonomy lifecycle: ' + slug);
});

const hub = fs.readFileSync(path.join(ROOT, 'knowledge.html'), 'utf8');
slugs.forEach(function (slug) {
  if (hub.indexOf('href="knowledge/' + slug + '.html"') < 0) fail('hub missing a link to ' + slug);
});
if (hub.indexOf('"@type":"ItemList"') < 0 && hub.indexOf('"@type": "ItemList"') < 0) fail('hub missing ItemList JSON-LD');
if (hub.indexOf('"@type":"BreadcrumbList"') < 0 && hub.indexOf('"@type": "BreadcrumbList"') < 0) fail('hub missing BreadcrumbList JSON-LD');

const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
toml.split('[[redirects]]').slice(1).forEach(function (block) {
  const from = (block.match(/from\s*=\s*"([^"]+)"/) || [])[1];
  const to = (block.match(/to\s*=\s*"([^"]+)"/) || [])[1];
  const status = Number((block.match(/status\s*=\s*(\d+)/) || [])[1]);
  if (status !== 301 || !from || from.indexOf('/knowledge/') !== 0) return;
  const target = publishedSlug(to);
  if (!target || !slugSet.has(target) || !fs.existsSync(path.join(ROOT, 'knowledge', target + '.html'))) {
    fail('301 target is not a published page: ' + from + ' -> ' + to);
  }
});

const depth = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/knowledge-depth.json'), 'utf8'));
const covered = depth.articles || {};
slugs.forEach(function (slug) {
  const row = covered[slug];
  if (!row || !row.grade || typeof row.words !== 'number') fail('depth JSON does not cover ' + slug);
});
Object.keys(covered).forEach(function (slug) {
  if (!slugSet.has(slug)) fail('depth JSON lists unpublished slug ' + slug);
});

if (failures.length) {
  console.error('check-knowledge-integrity: ' + failures.length + ' failure(s)');
  process.exit(1);
}
console.log('check-knowledge-integrity: ' + slugs.length + ' articles, ' + (taxonomy.clusters || []).length + ' clusters');
