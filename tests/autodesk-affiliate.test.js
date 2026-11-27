#!/usr/bin/env node
/* Autodesk notes stay on the engineering and Learn pages named in
 * data/autodesk-affiliate.json. One note per page. The base URL and the
 * sub-ID parameter name live only in that file. */
'use strict';
const fs = require('fs');
const path = require('path');
const adsk = require('../lib/autodesk-affiliate');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const cfg = adsk.load();
check('base URL is the placeholder', cfg.baseUrl === 'AUTODESK_AFFILIATE_URL_PLACEHOLDER');
check('sub-ID parameter is sid', cfg.subIdParam === 'sid');
check('between 5 and 15 placements', cfg.placements.length >= 5 && cfg.placements.length <= 15, String(cfg.placements.length));

function expectedSid(page) {
  let slug = page.replace(/^\//, '').replace(/\/$/, '');
  if (slug.endsWith('.html')) slug = slug.slice(0, -'.html'.length);
  if (slug.indexOf('knowledge/') === 0) slug = slug.slice('knowledge/'.length);
  if (slug.indexOf('learn/') === 0) slug = slug.slice('learn/'.length);
  slug = slug.replace(/\//g, '-');
  const calc = page === '/calculator.html' || page.indexOf('sizing-calculation') !== -1;
  return (calc ? 'tp-calc-' : 'tp-learn-') + slug;
}

function fileFor(page) {
  if (page.endsWith('/')) return page.slice(1) + 'index.html';
  return page.slice(1);
}

const allowed = new Set();
const sids = {};
cfg.placements.forEach(function (p) {
  const sid = expectedSid(p.page);
  check(p.page + ' sid ' + sid, p.sid === sid, p.sid);
  check(p.page + ' sid unique', !sids[p.sid], p.sid);
  sids[p.sid] = p.page;
  const rel = fileFor(p.page);
  allowed.add(rel);
  const file = path.join(root, rel);
  const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const block = adsk.blockForPage(p.page);
  const href = adsk.hrefFor(cfg.baseUrl, cfg.subIdParam, p.sid);
  check(rel + ' exists', !!html);
  check(rel + ' has one note', html && (html.split('data-tp-autodesk="' + p.sid + '"').length - 1) === 1);
  check(rel + ' note matches config', html.indexOf(block) !== -1);
  check(rel + ' href uses placeholder and sid', href === 'AUTODESK_AFFILIATE_URL_PLACEHOLDER?sid=' + p.sid && html.indexOf('href="' + href + '"') !== -1);
  check(rel + ' rel and target', html.indexOf('rel="sponsored noopener" target="_blank"') !== -1);
  check(rel + ' says Affiliate link', (html.split('>Affiliate link<').length - 1) === 1);
  check(rel + ' one script', (html.split('src="/tp-autodesk.js"').length - 1) === 1);
  const forbidden = rel === 'index.html' ||
    /^(rfq|pricing|events|directory|vendors)\.html$/.test(rel) ||
    /^(checkout|events|manufacturers|directory)\//.test(rel);
  check(rel + ' is not a forbidden surface', !forbidden);
});

check('placeholder joins a bare base with ?', adsk.hrefFor('AUTODESK_AFFILIATE_URL_PLACEHOLDER', 'sid', 'tp-calc-calculator') === 'AUTODESK_AFFILIATE_URL_PLACEHOLDER?sid=tp-calc-calculator');
check('https base with a query uses &', adsk.hrefFor('https://cj.example/click?a=1', 'sid', 'tp-learn-explorer') === 'https://cj.example/click?a=1&sid=tp-learn-explorer');
check('https base ending in ? keeps the joiner', adsk.hrefFor('https://cj.example/click?', 'subId', 'tp-learn-windings') === 'https://cj.example/click?subId=tp-learn-windings');

const browser = fs.readFileSync(path.join(root, 'tp-autodesk.js'), 'utf8');
const hrefSource = browser.slice(browser.indexOf('function hrefFor'), browser.indexOf('function apply'));
const browserHref = new Function(hrefSource + '\nreturn hrefFor;')();
check('browser join matches the config module',
  browserHref(cfg.baseUrl, cfg.subIdParam, 'tp-learn-explorer') === adsk.hrefFor(cfg.baseUrl, cfg.subIdParam, 'tp-learn-explorer') &&
  browserHref('https://cj.example/click?a=1', 'sid', 'tp-learn-explorer') === adsk.hrefFor('https://cj.example/click?a=1', 'sid', 'tp-learn-explorer'));
check('browser script reads the config', browser.indexOf('/data/autodesk-affiliate.json') !== -1);
check('browser script rewrites only an https base', browser.indexOf("/^https:\\/\\//.test(cfg.baseUrl)") !== -1);
check('browser script sets rel and target', browser.indexOf("a.rel = 'sponsored noopener'") !== -1 && browser.indexOf("a.target = '_blank'") !== -1);
const dist = fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8');
check('tp-autodesk.js is published', dist.indexOf("'tp-autodesk.js'") !== -1);
const links = fs.readFileSync(path.join(root, 'check-links.js'), 'utf8');
check('link gate allows the staged placeholder', links.indexOf("clean === 'AUTODESK_AFFILIATE_URL_PLACEHOLDER'") !== -1);
const knowledge = fs.readFileSync(path.join(root, 'build-knowledge.js'), 'utf8');
check('knowledge rebuild keeps the note', knowledge.indexOf('autodesk.blockForPage') !== -1);

const disc = fs.readFileSync(path.join(root, 'affiliate-disclosure.html'), 'utf8');
const softwareAt = disc.indexOf('<h2>Software and engineering tools</h2>');
const software = softwareAt === -1 ? '' : disc.slice(softwareAt);
check('disclosure has a software section', softwareAt !== -1);
check('commission at no extra cost', software.indexOf('does not add to the price you pay') !== -1 && software.indexOf('may earn a commission') !== -1);
check('editorial and rankings', software.indexOf('does not change the editorial text') !== -1 && software.indexOf('any ranking on this site') !== -1);
check('links are marked Affiliate link', software.indexOf('marked with the words Affiliate link') !== -1);
const emails = software.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
check('only contact is hello@', emails.length > 0 && emails.every(function (e) { return e === 'hello@transformerpath.com'; }), emails.join(', '));
check('software section has no place or personal name', !/\bDubai\b|\bUAE\b|\bEmirates\b|\bElin\b|\bowner\b/i.test(software));

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
check('sitemap lastmod for the disclosure', sitemap.indexOf('<loc>https://transformerpath.com/affiliate-disclosure.html</loc><lastmod>2026-11-26</lastmod>') !== -1);
const dates = JSON.parse(fs.readFileSync(path.join(root, 'data/sitemap-content-dates.json'), 'utf8'));
check('content-date cache matches', dates.pages['affiliate-disclosure.html'] === '2026-11-26');

const SKIP = new Set(['node_modules', '.git', 'dist', 'archive', 'transformerpath']);
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return out;
}
const stray = [];
walk(root, []).forEach(function (rel) {
  if (allowed.has(rel)) return;
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  if (html.indexOf('data-tp-autodesk') !== -1 || html.indexOf('AUTODESK_AFFILIATE_URL_PLACEHOLDER') !== -1) stray.push(rel);
});
check('no Autodesk note outside the placement list', stray.length === 0, stray.slice(0, 8).join(', '));

const banned = ['index.html', 'rfq.html', 'pricing.html', 'events.html', 'directory.html', 'checkout/index.html'];
banned.forEach(function (rel) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  check(rel + ' has no Autodesk link', html.indexOf('data-tp-autodesk') === -1 && html.indexOf('AUTODESK_AFFILIATE') === -1);
});

if (failed) {
  console.error('AUTODESK AFFILIATE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('AUTODESK AFFILIATE OK');
