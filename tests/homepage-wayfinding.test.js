#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const page = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const hero = page.match(/<section class="hero-stage"[^>]*>[\s\S]*?<\/section>/)?.[0];
assert.ok(hero, 'home has one primary masthead');
assert.equal((page.match(/<h1\b/g) || []).length, 1);
assert.equal((page.match(/role="search"/g) || []).length, 1, 'home retains a single search landmark');
assert.match(hero, /<form\b(?=[^>]*action="\/?search\.html")(?=[^>]*method="get")[^>]*>/);
assert.match(hero, /<input\b(?=[^>]*type="search")(?=[^>]*name="q")(?=[^>]*\brequired\b)(?=[^>]*aria-label=)[^>]*>/);
const quick = hero.match(/<nav class="home-wayfinding"[^>]*>[\s\S]*?<\/nav>/)?.[0];
assert.ok(quick);
assert.deepEqual([...quick.matchAll(/href="([^"]+)"/g)].map(m => m[1]), [
  '/directory.html', '/intel.html', '/tenders.html?status=open', '/learn.html', '/tools.html', '/find-a-part.html'
]);
assert.ok(hero.indexOf('class="home-search"') < hero.indexOf('class="home-wayfinding"'), 'search is the first task');
assert.ok(page.indexOf(hero) < page.indexOf('class="home-hero-banner"'), 'mobile image does not obstruct primary tasks');
assert.ok(page.indexOf('class="home-hero-banner"') < page.indexOf('id="ticker"'), 'ticker remains below mobile banner');
assert.ok(page.indexOf('id="ticker"') < page.indexOf('id="hero-live-pill"'), 'sourced coverage is the second section');
assert.match(hero, /href="\/rfq\.html"/);
assert.match(hero, /href="power3d\.html"/);
assert.match(hero, /aria-controls="heroVideoModal"/);
assert.match(page, /id="hero-intel-cta"/);
assert.match(page, /id="hero-live-pill"/);
assert.match(page, /search\.html\?q=Transformerboard/);
console.log('Homepage wayfinding: one search and six direct tasks, optional 3D and RFQ, sourced coverage retained.');
