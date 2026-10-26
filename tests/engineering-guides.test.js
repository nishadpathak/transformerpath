#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  PASS  ' + label);
  else {
    console.error('  FAIL  ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const dir = path.join(__dirname, '..', 'guides');
const slugs = [
  'reading-a-transformer-nameplate',
  'transformer-inquiry',
  'cooling-and-temperature-rise',
  'vector-group-and-paralleling',
  'factory-acceptance-tests',
  'site-tests-before-energization',
  'dissolved-gas-analysis',
  'insulating-liquid-acceptance',
  'frequency-response-analysis',
  'loading-above-nameplate'
];
check('ten engineering guides', slugs.length === 10);

slugs.forEach(function (slug) {
  const file = path.join(dir, slug, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const main = (html.match(/<main id="main"[\s\S]*?<\/main>/) || [''])[0].replace(/<[^>]+>/g, ' ');
  const words = main.match(/[A-Za-z0-9'’/%°+-]+/g) || [];
  check(slug + ' is at least 1,200 words', words.length >= 1200, String(words.length));
  check(slug + ' cites an IEC or IEEE designation', /IEC\s+6\d{4}|IEEE\s+C57\./.test(html));
  check(slug + ' does not invent a price', !/\$\s?\d/.test(main));
  check(slug + ' does not place TransformerPath in Dubai or the UAE', !/Dubai|UAE|United Arab Emirates/i.test(html));
  check(slug + ' is on the guides index', fs.readFileSync(path.join(dir, 'index.html'), 'utf8').indexOf('/guides/' + slug + '/') >= 0);
});

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const guidesIndex = fs.readFileSync(path.join(__dirname, '..', 'guides', 'index.html'), 'utf8');
const header = fs.readFileSync(path.join(__dirname, '..', '_partials', 'header.html'), 'utf8');
check('homepage nav links the guides', index.indexOf('<a href="/guides/">Guides</a>') >= 0);
check('homepage lists the ten guides', (index.match(/href="\/guides\/[a-z0-9-]+\/"/g) || []).length >= 10);
check('shared header links the guides', header.indexOf('<a href="/guides/">Guides</a>') >= 0);
check('guides index links each guide', slugs.every(function (slug) {
  return guidesIndex.indexOf('/guides/' + slug + '/') >= 0 && fs.existsSync(path.join(__dirname, '..', 'guides', slug, 'index.html'));
}));

const sitemap = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
check('sitemap lists the guides index', sitemap.indexOf('https://transformerpath.com/guides/</loc>') >= 0);
slugs.forEach(function (slug) {
  check('sitemap lists ' + slug, sitemap.indexOf('https://transformerpath.com/guides/' + slug + '/</loc>') >= 0);
});

if (failed) {
  console.error('ENGINEERING GUIDES FAIL ' + failed);
  process.exit(1);
}
console.log('ENGINEERING GUIDES PASS');
