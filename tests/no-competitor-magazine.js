#!/usr/bin/env node
/* Fails if Transformers Magazine (Merit Media) is linked or named as a
 * source anywhere except the host denylist. */
'use strict';
const fs = require('fs');
const path = require('path');
const { BLOCKED_SOURCE_HOSTS, isBlockedEvent } = require('../lib/blocked-sources');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'dist', 'vendor']);
const ALLOW = new Set([path.join(ROOT, 'lib', 'blocked-sources.js')]);
const TEXT = /\.(html|js|json|md|txt|ics|xml|css|yml|yaml|toml|csv)$/i;

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (TEXT.test(ent.name)) out.push(p);
  }
  return out;
}

const conference = 'https://conference.' + BLOCKED_SOURCE_HOSTS[0] + '/conference/industry-navigator-2027/';
if (!isBlockedEvent({ official_url: conference, name: 'Industry Navigator 2027', series_slug: 'industry-navigator' })) {
  console.error('events pipeline did not block a Merit Media conference');
  process.exit(1);
}
if (!isBlockedEvent({ name: 'Industry Navigator 2028', id: 'industry-navigator-2028' })) {
  console.error('events pipeline did not block an Industry Navigator edition');
  process.exit(1);
}
if (isBlockedEvent({ name: 'CIGRE 2027', official_url: 'https://www.cigre.org/' })) {
  console.error('events pipeline blocked an unrelated event');
  process.exit(1);
}

const hits = [];
walk(ROOT, []).forEach(function (file) {
  if (ALLOW.has(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  BLOCKED_SOURCE_HOSTS.forEach(function (host) {
    if (text.toLowerCase().indexOf(host) !== -1) hits.push(path.relative(ROOT, file) + ' ' + host);
  });
});

if (hits.length) {
  console.error('competitor magazine domain found:');
  hits.slice(0, 40).forEach(function (hit) { console.error('  ' + hit); });
  process.exit(1);
}
console.log('no competitor magazine domains outside the denylist');
