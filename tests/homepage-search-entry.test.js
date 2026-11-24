#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = name => readFileSync(join(__dirname, '..', name), 'utf8');
const home = read('index.html');
const hero = home.match(/<section class="hero-stage"[^>]*>[\s\S]*?<\/section>/)?.[0] || '';
const forms = [...home.matchAll(/<form\b[^>]*role="search"[^>]*>[\s\S]*?<\/form>/g)];
const draftForm = forms[0]?.[0] || '';
assert.ok(hero.includes(draftForm) && draftForm, 'Global Search appears in the first hero');
assert.equal(forms.length, 1, 'There is one and only one search form');
assert.match(draftForm, /action="\/search\.html" method="get"/);
assert.match(draftForm, /<label for="heroSearchQuery">Search companies and tenders<\/label>/);
assert.match(draftForm, /<input id="heroSearchQuery" type="search" name="q"[^>]* required>/);
assert.match(draftForm, /<button class="btn-primary" type="submit">Search<\/button>/);
assert.equal((hero.match(/class="btn-primary"/g) || []).length, 1, 'One primary action in the first hero');
for (const entry of ['/directory.html', '/rfq.html', 'power3d.html']) {
  assert.ok(hero.indexOf('href="' + entry + '"') > hero.indexOf('</form>'), entry + ' remains after search');
}
assert.ok(hero.includes('id="heroWatchBtn"'), 'The optional tour remains available');
assert.ok(home.includes('href="tenders.html?status=open"'), 'Direct tender shortcut stays available');
assert.match(read('search.html'), /const initialQ = urlParams\.get\('q'\);/, 'The existing index accepts the form query');

const pricing = read('pricing.html');
const intro = pricing.match(/<section id="main"\s[\s\S]*?<\/section>/)?.[0] || '';
assert.match(intro, /Each plan lists what is available today\. Features marked <b>Coming soon<\/b> are not included yet\./);
assert.match(pricing, /data-feature="bom_costing" data-delivery="built"/);
assert.match(pricing, /data-feature="project_workspace" data-delivery="coming_soon"/);
assert.match(pricing, /data-feature="rfq_inbox" data-delivery="built"/);
assert.match(pricing, /id="ctaProfessional" href="\/checkout\/\?product=engineering_pro"[^>]*>Unlock Engineering Pro — \$599/);

console.log('Homepage search entry and pricing availability checks passed.');
