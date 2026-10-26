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

const dir = path.join(__dirname, '..', 'content', 'engineering-guides');
const files = fs.readdirSync(dir).filter(function (name) { return name.endsWith('.md'); });
check('ten engineering guides', files.length === 10, String(files.length));

const standards = /IEC\s+6\d{4}|IEEE\s+C57\./;
files.forEach(function (name) {
  const text = fs.readFileSync(path.join(dir, name), 'utf8');
  const body = text.replace(/^#.*$/gm, ' ').replace(/^description:.*$/gm, ' ');
  const words = body.match(/[A-Za-z0-9'’/%°+-]+/g) || [];
  check(name + ' is at least 1,200 words', words.length >= 1200, String(words.length));
  check(name + ' cites an IEC or IEEE designation', standards.test(text));
  check(name + ' does not invent a price', !/\$\s?\d/.test(text));
  check(name + ' does not place TransformerPath in Dubai or the UAE', !/Dubai|UAE|United Arab Emirates/i.test(text));
});

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const guidesIndex = fs.readFileSync(path.join(__dirname, '..', 'guides', 'index.html'), 'utf8');
const header = fs.readFileSync(path.join(__dirname, '..', '_partials', 'header.html'), 'utf8');
check('homepage nav links the guides', index.indexOf('<a href="/guides/">Guides</a>') >= 0);
check('homepage lists the ten guides', (index.match(/href="\/guides\/[a-z0-9-]+\/"/g) || []).length >= 10);
check('shared header links the guides', header.indexOf('<a href="/guides/">Guides</a>') >= 0);
check('guides index links each guide', files.every(function (name) {
  const slug = name.replace(/^\d+-/, '').replace(/\.md$/, '');
  return guidesIndex.indexOf('/guides/' + slug + '/') >= 0 && fs.existsSync(path.join(__dirname, '..', 'guides', slug, 'index.html'));
}));

const sitemap = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
check('sitemap lists the guides index', sitemap.indexOf('https://transformerpath.com/guides/</loc>') >= 0);
files.forEach(function (name) {
  const slug = name.replace(/^\d+-/, '').replace(/\.md$/, '');
  check('sitemap lists ' + slug, sitemap.indexOf('https://transformerpath.com/guides/' + slug + '/</loc>') >= 0);
});

if (failed) {
  console.error('ENGINEERING GUIDES FAIL ' + failed);
  process.exit(1);
}
console.log('ENGINEERING GUIDES PASS');
