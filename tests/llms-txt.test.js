#!/usr/bin/env node
/* /llms.txt is the llmstxt.org file: brand name, one-line summary, and the
 * public section links. It names TransformerPath and hello@transformerpath.com
 * only. It does not name a person, a place, or a price.
 *
 * Run: node tests/llms-txt.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const text = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
const lines = text.split('\n');

check('file ends with a newline', text.endsWith('\n'));
check('heading is the brand name', lines[0] === '# TransformerPath');
check('blank line follows the heading', lines[1] === '');
check('summary is one blockquote line', lines[2].indexOf('> ') === 0 && lines[3] === '');
check('contact is the brand inbox', text.indexOf('hello@transformerpath.com') !== -1);
check('no other mailbox', (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).every(function (mail) {
  return mail === 'hello@transformerpath.com';
}));

const sections = [
  ['Directory', 'https://transformerpath.com/directory.html'],
  ['Intel', 'https://transformerpath.com/intel.html'],
  ['Tenders', 'https://transformerpath.com/tenders.html'],
  ['Guides', 'https://transformerpath.com/guides/'],
  ['Learn', 'https://transformerpath.com/learn.html'],
  ['Calculators', 'https://transformerpath.com/calculator.html'],
  ['Data', 'https://transformerpath.com/data.html'],
  ['Verified listing', 'https://transformerpath.com/verified.html']
];
check('section heading is present', text.indexOf('\n## Sections\n') !== -1);
sections.forEach(function (pair) {
  const line = '- [' + pair[0] + '](' + pair[1] + '):';
  check(pair[0] + ' links to its section', text.indexOf(line) !== -1, line);
});
check('links are absolute', text.indexOf('](/') === -1);

const banned = [
  [/\bDubai\b|\bUAE\b|United Arab Emirates|\bU\.A\.E\.?\b|\bEmirates\b/i, 'place'],
  [new RegExp('\\b' + 'nis' + 'had' + '\\b|' + 'pat' + 'hak', 'i'), 'personal name'],
  [/\$|\bUSD\b|\bprice\b|\bpriced\b/i, 'price'],
  [/\bpolsia\b/i, 'old mailbox host'],
  [/\bowners?\b/i, 'owner'],
  [/\bfreelance\b|\blicen[cs]e\b/i, 'licence']
];
banned.forEach(function (pair) {
  check('no ' + pair[1], !pair[0].test(text));
});

const dist = fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8');
check('build publishes llms.txt', dist.indexOf("'llms.txt'") !== -1);

const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
check('_headers serves text/plain utf-8', /\/llms\.txt\n {2}Content-Type: text\/plain; charset=utf-8/.test(headers));
check('netlify.toml serves text/plain utf-8', /for = "\/llms\.txt"[\s\S]*Content-Type = "text\/plain; charset=utf-8"/.test(toml));

if (failed) {
  console.error(failed + ' llms.txt check(s) failed');
  process.exit(1);
}
console.log('llms.txt checks passed');
