#!/usr/bin/env node
/* Bottleneck explainers: sourced claims, sponsor slot, SEO fields, menu. */
'use strict';
const fs = require('fs');
const path = require('path');
const copy = require('../lib/bottleneck-copy');
const schema = require('../lib/seo-schema');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ok ' + label);
  else {
    console.error('  FAIL ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

copy.assertWindows();

const STRIPE = 'https://buy.stripe.com/bJedR2gcE257eAofdMfYY0R';
const EXPECTED_SOURCES = {
  'bottlenecks/index.html': 2,
  'bottlenecks/grain-oriented-electrical-steel/index.html': 4,
  'bottlenecks/copper-conductors/index.html': 3,
  'bottlenecks/bushings/index.html': 1,
  'bottlenecks/insulation-pressboard-paper/index.html': 2,
  'bottlenecks/test-bay-capacity/index.html': 3
};

function mainHtml(html) {
  const m = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return m ? m[1] : '';
}

function externalUrls(html) {
  const found = {};
  const re = /href="(https:\/\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (/transformerpath\.com|buy\.stripe\.com|linkedin\.com/i.test(m[1])) continue;
    found[m[1]] = 1;
  }
  return Object.keys(found);
}

const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const header = fs.readFileSync('_partials/header.html', 'utf8');
const footer = fs.readFileSync('_partials/footer.html', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

check('header intel skips the redirect', header.indexOf('href="/intel.html"') !== -1 && !/href="\/intel"(?!\.html)/.test(header));
check('footer intel skips the redirect', footer.indexOf('href="/intel.html"') !== -1);
check('header menu lists bottlenecks inside Directory', /lead-times\/">Lead times<\/a>\s*<a href="bottlenecks\/">Bottlenecks<\/a>/.test(header));
check('footer menu lists bottlenecks', /lead-times\/">Lead times<\/a><a href="bottlenecks\/">Bottlenecks<\/a>/.test(footer));
check('bottlenecks is not a top-level bar label', header.indexOf('class="tpnav"') !== -1);

copy.PAGES.forEach(function (page) {
  const html = fs.readFileSync(page.rel, 'utf8');
  const main = mainHtml(html);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const description = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || '';
  const expectCanon = 'https://transformerpath.com/' + page.rel.replace(/index\.html$/, '');
  check(page.rel + ' title', title === copy.TITLES[page.rel], title);
  check(page.rel + ' description', description === copy.DESCRIPTIONS[page.rel], String(description.length));
  check(page.rel + ' canonical', canon === expectCanon, canon);
  check(page.rel + ' consent', html.indexOf('/consent.js') !== -1);
  check(page.rel + ' ad marker', html.indexOf('<!--tp-ad-slot-->') !== -1);
  check(page.rel + ' mobile wrap', html.indexOf('overflow-wrap:anywhere') !== -1 && html.indexOf('max-width:720px') !== -1);
  check(page.rel + ' in sitemap', sitemap.indexOf(expectCanon + '</loc>') !== -1);

  const blocks = schema.extractJsonLd(html);
  const nodes = schema.flatten(blocks);
  const article = nodes.filter(function (n) { return n['@type'] === 'Article'; })[0];
  check(page.rel + ' Article', !!article && article.headline === title && article.datePublished === copy.AS_OF);
  check(page.rel + ' author is an organization', !!(article && article.author && article.author['@type'] === 'Organization' && article.author.name === 'TransformerPath'));
  check(page.rel + ' no Person node', !nodes.some(function (n) { return n['@type'] === 'Person'; }));

  const claims = main.match(/<p class="claim">[\s\S]*?<\/p>/g) || [];
  check(page.rel + ' has claims', claims.length >= 2, String(claims.length));
  claims.forEach(function (block, i) {
    const ok = /href="https:\/\//.test(block) && /<time datetime="[^"]+">/.test(block);
    if (!ok) check(page.rel + ' claim ' + i + ' sourced', false, block.slice(0, 140));
  });
  const urls = externalUrls(main);
  check(page.rel + ' source count ' + urls.length, urls.length === EXPECTED_SOURCES[page.rel], urls.join(' '));

  ['/lead-times/', '/buy-early/', '/spare-capacity/'].forEach(function (href) {
    check(page.rel + ' links ' + href, main.indexOf('href="' + href + '"') !== -1);
  });

  const sponsorBlocks = main.match(/data-component-sponsor="/g) || [];
  if (page.sponsor) {
    check(page.rel + ' sponsor slot', sponsorBlocks.length === 1 && main.indexOf('data-component-sponsor="' + page.sponsor + '"') !== -1);
    check(page.rel + ' uses the existing sponsor link', main.indexOf(STRIPE) !== -1 && main.split(STRIPE).length === 2);
    check(page.rel + ' sponsor price text', main.indexOf('Sponsor this section, $199/mo') !== -1);
  } else {
    check(page.rel + ' has no sponsor slot', sponsorBlocks.length === 0 && main.indexOf(STRIPE) === -1 && main.indexOf('$') === -1);
  }

  check(page.rel + ' no vendor spotlight names', !/\bWeidmann\b|\bElin\b|\bNomex\b|\bDuPont\b|\bPCORE\b|\bFostoria\b/i.test(html));
  check(page.rel + ' no brand locale', !/\bDubai\b|\bUAE\b|United Arab Emirates/i.test(html));
  check(page.rel + ' contact', main.indexOf('hello@transformerpath.com') !== -1);
  check(page.rel + ' no bare /intel href', !/href="\/intel"(?!\.html)/.test(html));
});

check('index menu bottlenecks', /href="\/bottlenecks\/">Bottlenecks<\/a>/.test(index) || /href="bottlenecks\/">Bottlenecks<\/a>/.test(index));
check('index intel.html', /href="\/intel\.html"/.test(index));

const goes = fs.readFileSync('bottlenecks/grain-oriented-electrical-steel/index.html', 'utf8');
check('GOES directory category', goes.indexOf('href="/components.html#crgo-steel"') !== -1 && goes.indexOf('href="/materials/crgo/"') !== -1);
const copper = fs.readFileSync('bottlenecks/copper-conductors/index.html', 'utf8');
check('copper directory category', copper.indexOf('href="/components.html#copper-ctc"') !== -1 && copper.indexOf('href="/materials/ctc/"') !== -1);
const bush = fs.readFileSync('bottlenecks/bushings/index.html', 'utf8');
check('bushings directory category', bush.indexOf('href="/components.html#bushings"') !== -1 && bush.indexOf('href="/components/bushings/"') !== -1);
const paper = fs.readFileSync('bottlenecks/insulation-pressboard-paper/index.html', 'utf8');
check('pressboard directory category', paper.indexOf('href="/components.html#pressboard"') !== -1 && paper.indexOf('href="/materials/transformerboard/"') !== -1);
const bay = fs.readFileSync('bottlenecks/test-bay-capacity/index.html', 'utf8');
check('test bay directory category', bay.indexOf('href="/laboratories.html"') !== -1 && bay.indexOf('href="/components.html#test-equipment"') !== -1 && bay.indexOf('href="/factory-capacity/"') !== -1);

if (failed) {
  console.error('BOTTLENECKS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('BOTTLENECKS OK');
