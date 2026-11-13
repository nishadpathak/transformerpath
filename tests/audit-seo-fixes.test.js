#!/usr/bin/env node
/* Guards for the audit fixes: titles, descriptions, the build-time intel
 * feed, the skip-link target, the hero preload, and the cache headers.
 */
'use strict';

const fs = require('fs');
const { fitWindow } = require('../lib/seo-fit');
const catalog = require('../lib/seo-catalog');
const { ensureSkipTarget } = require('../lib/skip-target');
const snap = require('../build-intel-feed-snapshot');

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

function lin(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function contrast(fg, bg) {
  function L(rgb) { return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); }
  const a = L(fg), b = L(bg);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

const faq = fitWindow('Frequently asked questions', 50, 60, [' | TransformerPath']);
check(faq.length >= 50 && faq.length <= 60, 'faq title window ' + faq);
check(/\| TransformerPath$/.test(faq), 'faq title keeps the brand ' + faq);
check(!/\brecord\b/i.test(faq), 'faq title has no record pad ' + faq);

const flagged = fitWindow('🇧🇩 Transformer | transformer makers', 50, 60, [' | TransformerPath']);
check(!/\p{Regional_Indicator}/u.test(flagged), 'flag is not the country ' + flagged);
check(/\| TransformerPath$/.test(flagged) && !/\|\s+transformer\b/.test(flagged), 'lowercase fragment is not the brand ' + flagged);

const dashed = fitWindow('ACUME Electrical | —, UAE supplier', 50, 60, [' | TransformerPath']);
check(!/\|\s*[—–]/.test(dashed) && /UAE/.test(dashed) && /\| TransformerPath$/.test(dashed), 'empty place is omitted ' + dashed);

const cat = catalog.create();
const home = catalog.draft('index.html', fs.readFileSync('index.html', 'utf8'), cat);
const homeTitle = fitWindow(home.draftTitle, 50, 60, home.padsTitle);
const homeDesc = fitWindow(home.draftDesc, 140, 160, home.padsDesc);
check(/^The global platform for transformers\b/.test(homeDesc), 'homepage description keeps its subject ' + homeDesc);
check(!/\|\s*TransformerPath\s*$/.test(homeDesc), 'homepage description does not repeat the title brand');
check(homeTitle === 'Transformer Industry Intelligence | TransformerPath', 'homepage title ' + homeTitle);
const dir = catalog.draft('directory.html', fs.readFileSync('directory.html', 'utf8'), cat);
const dirDesc = fitWindow(dir.draftDesc, 140, 160, dir.padsDesc);
check(/^The transformer industry directory\b/.test(dirDesc), 'directory description keeps its subject ' + dirDesc);
check(!/\|\s*TransformerPath\s*$/.test(dirDesc), 'directory description does not repeat the title brand');

const doc = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const built = snap.buildSnapshot(doc);
check(built.latest_item_date > '2026-07-11', 'snapshot date follows the latest intel item ' + built.latest_item_date);
check(Array.isArray(built.articles) && built.timestamp.indexOf(built.latest_item_date) === 0, 'snapshot timestamp is the latest item');
const rss = snap.buildRss(doc);
check(rss.indexOf('<lastBuildDate>' + snap.rfc822(built.latest_item_date) + '</lastBuildDate>') !== -1, 'rss lastBuildDate is the latest item');
check(rss.indexOf('11 Jul 2026') === -1, 'rss is not stuck on 11 Jul 2026');

const skipped = ensureSkipTarget('<a class="skip-link" href="#main">Skip</a><header></header><p>Body</p><footer></footer>');
check(/<main id="main"/.test(skipped) && skipped.indexOf('<footer>') > skipped.indexOf('<main'), 'skip link wraps the content');
const already = '<main id="main">x</main>';
check(ensureSkipTarget('<a class="skip-link" href="#main"></a>' + already) === '<a class="skip-link" href="#main"></a>' + already, 'an existing main id is left alone');

const homeHtml = fs.readFileSync('index.html', 'utf8');
check(/#glanceCards \.g-region\s*\{[^}]*color:#7c2d12;\s*background:#fef3c7/.test(homeHtml), 'glance badge uses the darker brown');
check(contrast([124, 45, 18], [254, 243, 199]) >= 4.5, 'glance badge contrast is at least WCAG AA');

const toml = fs.readFileSync('netlify.toml', 'utf8');
check(/from = "\/index\.html"\s+to = "\/"\s+status = 301/s.test(toml), '/index.html redirects to /');
check(/for = "\/manifest\.webmanifest"[\s\S]{0,80}Content-Type = "application\/manifest\+json"/.test(toml), 'manifest content type');
check(/for = "\/\*\.css"[\s\S]{0,80}max-age=31536000, immutable/.test(toml), 'css is immutable');
check(/for = "\/\*\.js"[\s\S]{0,80}max-age=31536000, immutable/.test(toml), 'js is immutable');
check(/for = "\/sw\.js"[\s\S]{0,80}must-revalidate/.test(toml), 'service worker stays revalidated');
check(fs.readFileSync('functions/intel-feed.js', 'utf8').indexOf('fetch(') === -1, 'intel-feed does not fetch upstream on the request');
check(fs.readFileSync('tp-freshness.js', 'utf8').indexOf('FEED_TIMEOUT_MS = 3000') !== -1, 'freshness call times out at 3s');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('audit seo fixes ok');
