#!/usr/bin/env node
/* Googlebot and Bingbot are not singled out, and /manufacturers stays crawlable.
 * Run: node tests/bot-access.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
check(/^User-agent:\s*\*/m.test(robots), 'robots.txt has a wildcard user-agent');
check(/^Allow:\s*\/\s*$/m.test(robots), 'robots.txt allows /');
check(!/Disallow:\s*\/manufacturers/i.test(robots), 'robots.txt does not disallow /manufacturers');
check(/^Disallow:\s*\/claim-listing\/\s*$/m.test(robots), 'robots.txt disallows /claim-listing/');
check(!/Googlebot|Bingbot/i.test(robots), 'robots.txt does not name Googlebot or Bingbot');
check(/Sitemap:\s*https:\/\/transformerpath\.com\/sitemap\.xml/.test(robots), 'robots.txt points at the sitemap');

const makers = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
check(!/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(makers), 'manufacturers.html has no robots noindex');

const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
check(!/Googlebot|Bingbot/i.test(toml), 'netlify.toml does not name Googlebot or Bingbot');
const blocked = toml.split('[[headers]]').filter(function (block) {
  return /X-Robots-Tag\s*=\s*"noindex/.test(block) && /\/manufacturers/i.test(block);
});
check(blocked.length === 0, 'no edge noindex rule targets /manufacturers');

const functionsDir = path.join(root, 'functions');
function walk(dir, hit) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, hit);
    else if (/\.js$/.test(ent.name) && /Googlebot|Bingbot/.test(fs.readFileSync(p, 'utf8'))) hit.push(p);
  });
}
const hits = [];
if (fs.existsSync(functionsDir)) walk(functionsDir, hits);
check(hits.length === 0, 'functions do not mention Googlebot or Bingbot');

if (failed) {
  console.error(failed + ' bot-access check(s) failed');
  process.exit(1);
}
console.log('bot-access checks passed');
