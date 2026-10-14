#!/usr/bin/env node
/* check-adsense.js — every published HTML page carries the AdSense loader.
 *
 * Runs after build-dist.js. Fails the build when:
 *   - dist/ads.txt is missing the publisher line
 *   - any published HTML page lacks the async loader, or names another pub id
 *   - the loader is outside <head> or appears more than once
 *   - a knowledge article, the intel list, or a directory list lacks exactly
 *     one in-content slot (below the hero / title) labelled Advertisement
 *   - checkout, pricing, admin or login pages contain a manual slot
 *
 * Run: node check-adsense.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const inject = require('./adsense-inject');
const cfg = inject.cfg;

const DIST = 'dist';
const problems = [];

function relPosix(p) {
  return path.relative(DIST, p).split(path.sep).join('/');
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (!fs.existsSync(DIST)) {
  console.error('check-adsense: dist/ is missing — run node build-dist.js first');
  process.exit(1);
}

const adsPath = path.join(DIST, 'ads.txt');
if (!fs.existsSync(adsPath)) {
  problems.push('dist/ads.txt is missing');
} else {
  const ads = fs.readFileSync(adsPath, 'utf8');
  if (ads.indexOf(cfg.ADS_TXT_LINE) === -1) {
    problems.push('dist/ads.txt is missing "' + cfg.ADS_TXT_LINE + '"');
  }
}

const files = walk(DIST, []);
if (!files.length) problems.push('dist/ contains no HTML pages');

let loaders = 0;
let slots = 0;

for (const file of files) {
  const rel = relPosix(file);
  const html = fs.readFileSync(file, 'utf8');
  const head = inject.headInner(html);
  const loaderCount = html.split(cfg.LOADER).length - 1;
  const headCount = head.split(cfg.LOADER).length - 1;

  if (loaderCount !== 1 || headCount !== 1) {
    problems.push(rel + ' :: loader count ' + loaderCount + ' (in <head> ' + headCount + '), expected 1');
  } else {
    loaders++;
  }

  const pubs = html.match(/ca-pub-\d+/g) || [];
  const wrong = pubs.filter(function (id) { return id !== cfg.CLIENT; });
  if (wrong.length) problems.push(rel + ' :: wrong pub id ' + wrong.join(','));
  if (!pubs.length) problems.push(rel + ' :: missing ' + cfg.CLIENT);

  const slotCount = html.split('data-tp-ad="in-content"').length - 1;
  const excluded = inject.isSlotExcluded(rel);
  const wanted = inject.wantsInContentSlot(rel);

  if (excluded && slotCount) {
    problems.push(rel + ' :: manual slot on a checkout/pricing/admin/login page');
  }
  if (wanted && slotCount !== 1) {
    problems.push(rel + ' :: expected exactly one in-content slot, found ' + slotCount);
  }
  if (!wanted && slotCount) {
    problems.push(rel + ' :: unexpected manual slot (' + slotCount + ')');
  }
  if (wanted && slotCount === 1) {
    slots++;
    if (html.indexOf('>Advertisement<') === -1) problems.push(rel + ' :: slot is not labelled Advertisement');
    if (html.indexOf('data-ad-slot="' + cfg.INCONTENT_SLOT + '"') === -1) {
      problems.push(rel + ' :: data-ad-slot is not ' + cfg.INCONTENT_SLOT);
    }
    if (html.indexOf('data-ad-client="' + cfg.CLIENT + '"') === -1) {
      problems.push(rel + ' :: slot client is not ' + cfg.CLIENT);
    }
    const slotAt = html.indexOf('data-tp-ad="in-content"');
    const hero = html.search(/<section[^>]*class="[^"]*\bhero\b/);
    if (hero >= 0) {
      const heroEnd = html.indexOf('</section>', hero);
      if (heroEnd < 0 || slotAt < heroEnd) problems.push(rel + ' :: slot is above or inside the hero');
    }
    const h1 = html.search(/<h1[\s>]/);
    if (h1 >= 0 && slotAt < h1) problems.push(rel + ' :: slot is above the title');
    if (!inject.slotConfigured()) {
      if (html.indexOf('data-tp-ad-pending="1"') === -1) {
        problems.push(rel + ' :: placeholder slot is not marked pending');
      }
      const asideStart = html.lastIndexOf('<aside', slotAt);
      const asideTag = html.slice(asideStart, html.indexOf('>', asideStart));
      if (asideTag.indexOf(' hidden') === -1 && !/\shidden(?:=|\s|>)/.test(asideTag + '>')) {
        problems.push(rel + ' :: placeholder slot is not hidden');
      }
    }
  }
}

if (problems.length) {
  console.error('ADSENSE CHECK FAILED — ' + problems.length + ' problem(s):');
  problems.slice(0, 40).forEach(function (p) { console.error('  ' + p); });
  if (problems.length > 40) console.error('  … and ' + (problems.length - 40) + ' more');
  process.exit(1);
}

console.log('ADSENSE CHECK OK — ' + loaders + ' pages with ' + cfg.CLIENT +
  ' in <head>, ' + slots + ' in-content slots (slot=' + cfg.INCONTENT_SLOT +
  '), ads.txt present.');
