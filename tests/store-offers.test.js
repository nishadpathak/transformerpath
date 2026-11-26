#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const artifact = process.argv.includes('--dist') ? 'dist/' : '';
const page = read(artifact + 'store/index.html');
const commerce = page.match(/<main[^>]*>[\s\S]*?<\/main>/)[0];
const routes = [...commerce.matchAll(/href="([^"]+)"/g)].map(match => match[1]);

assert.match(page, /<link rel="canonical" href="https:\/\/transformerpath\.com\/store\/">/);
assert.equal((page.match(/<h1\b/g) || []).length, 1);
assert.match(commerce, /No purchase is made on this page\./);
assert.doesNotMatch(commerce, /<form\b|<script\b|mailto:|checkout\/|buy\.stripe\.|\.netlify\/functions|\b(?:onclick|data-track*)=|\$\d|\binstant (?:access|delivery)\b/i);
assert.doesNotMatch(commerce, /equipment (?:board|marketplace)/i);

const targets = new Map([
  ['/data.html', /Directory, tender, and award CSV downloads/i],
  ['/templates/', /Test and commissioning (?:report )?templates/i],
  ['/pricing.html#engineers', /id="engineers"/i],
  ['/sponsor.html', /Sponsor &amp; Advertise|Sponsor & Advertise/i],
  ['/terms.html', /Terms of Use/i],
  ['/contact.html', /Contact/i],
  ['/', /TransformerPath/i],
]);
for (const link of routes) {
  if (link.startsWith('#')) {
    assert.match(commerce, new RegExp(`id="${link.slice(1)}"`), link + ' resolves in Store');
    continue;
  }
  assert.ok(targets.has(link), link + ' is an approved review link, never a direct payment link');
  const url = link.split('#')[0];
  const target = url.endsWith('/') ? url.slice(1) + 'index.html' : url.slice(1);
  assert.match(read(artifact + target), targets.get(link), link + ' resolves to the expected offer');
}
for (const href of targets.keys()) assert.ok(routes.includes(href), href + ' appears in Store');

const data = read(artifact + 'data.html');
for (const kind of ['directory', 'tenders', 'awards']) {
  assert.match(data, new RegExp(`data-csv-preview="${kind}" data-preview-rows="10"`), kind + ' has real preview rows');
}
if (artifact) assert.match(read('dist/sitemap.xml'), /<loc>https:\/\/transformerpath\.com\/store\/<\/loc>/);
console.log('Store: real offer destinations and sample rows, one canonical, no transaction or direct checkout.');
