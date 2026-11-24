#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');

const slug = 'reinhausen-brasil';
const edition = 'step-power-transformers-2027';
const href = '/services/' + slug + '/';
const source = 'https://step-latam.com/en/#sponsors';
const name = 'MR do Brasil Indústria Mecânica Ltda.';
const row = require('../data/services.json').services.find(r => r.id === 'srv:' + slug);

assert.equal(row.company_name, name);
assert.equal(row.country, 'Brazil');
assert.equal(row.city, 'Embu das Artes');
assert.equal(row.state_province, 'São Paulo');
assert.equal(row.voltage_capability_kv, undefined);
assert.equal(row.profile_page, true);
assert.equal(row.directory_publish, true);
assert.match(row.description, /sales and maintenance of on-load tap changers/);
assert.match(row.capability_source_url, /reinhausen_iso_9001_en\.pdf/);

const canonical = require('../data/companies.json').companies;
const local = canonical.filter(x => x.name === name);
assert.equal(local.length, 1);
assert.equal(local[0].factory_count, 0);
assert.ok(local[0].roles.includes('Transformer Service Provider'));
assert.equal(local[0].roles.some(x => x.includes('Manufacturer')), false);
assert.ok(canonical.some(x => x.slug === 'maschinenfabrik-reinhausen-mr-reinhausen-group'));

const listed = require('../data/directory-index.json').companies.filter(x => x.slug === slug);
assert.equal(listed.length, 1);
assert.equal(listed[0].kind, 'service_repair');
assert.equal(listed[0].factory_count, 0);
assert.equal(listed[0].country, 'Brazil');

const profile = fs.readFileSync('services/' + slug + '/index.html', 'utf8');
assert.ok(profile.includes('<link rel="canonical" href="https://transformerpath.com' + href + '">'));
assert.ok(profile.includes(name));
assert.ok(profile.includes('href="' + row.capability_source_url + '"'));
assert.ok(profile.includes('name="robots" content="index,follow"'));
assert.ok(fs.readFileSync('services.html', 'utf8').includes(row.id));

const block = require('../data/event-directory.json').sections[edition];
assert.equal(block.section, 'Official sponsor');
assert.equal(block.source_url, source);
assert.deepEqual(block.entries.map(x => x.href), [href]);
assert.equal(block.entries[0].booth, undefined);
const ed = require('../data/events.json').find(x => x.id === edition);
assert.equal(ed.key_exhibitors, null);

const event = fs.readFileSync('events/' + edition + '/index.html', 'utf8');
assert.ok(event.includes('<h2>Official sponsor</h2><ul><li><a href="' + href + '">MR Reinhausen (Brazil profile)</a>'));
assert.ok(event.includes('href="' + source + '" rel="noopener">Source: event organiser</a>'));
assert.doesNotMatch(event.match(/<h2>Official sponsor<.*?<\/p>/s)[0], /Exhibiting at STEP|FEATURED|Booth /);
assert.doesNotMatch(profile, /Exhibiting at STEP|FEATURED/);

console.log('STEP official sponsor link and distinct Reinhausen Brasil service record passed.');
