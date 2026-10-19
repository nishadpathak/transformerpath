/**
 * Learn-section skip links.
 * Skip-to-content must land on an id that is on the page.
 * Lesson copy and course links stay with the current pages.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function ids(html) {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
}

function assertSkip(rel, target) {
  const html = read(rel);
  assert(!html.includes('<<<<<<<'), `${rel} still has a merge conflict marker`);
  assert(html.includes(`href="#${target}"`), `${rel} skip link should target #${target}`);
  assert(ids(html).has(target), `${rel} is missing id="${target}"`);
}

const mainPages = [
  'learn.html',
  'books.html',
  'education.html',
  'calculator.html',
  'teams.html',
  'construction-guide.html',
  'pricing.html',
  'engineer-track.html',
  'academy.html',
  'case-studies.html',
];
for (let n = 0; n <= 22; n++) mainPages.push(`books/volume-${n}/index.html`);
for (const dir of fs.readdirSync(path.join(root, 'case-studies'))) {
  const rel = `case-studies/${dir}/index.html`;
  if (fs.existsSync(path.join(root, rel))) mainPages.push(rel);
}
mainPages.forEach((rel) => assertSkip(rel, 'main'));

['explorer.html', 'power3d.html', 'power500.html', 'oltc.html', 'bushing.html', 'coilassembly.html', 'coretopology.html']
  .forEach((rel) => assertSkip(rel, 'c3d'));

assert(
  read('build-books.js').includes('<main id="main" tabindex="-1" class="c-wrap">'),
  'book volume builder should keep the skip target'
);
assert(
  read('build-case-studies.js').includes('<main id="main" tabindex="-1" class="c-wrap">'),
  'case study builder should keep the skip target'
);

const books = read('books.html');
assert(books.includes('Volumes 0–22 roadmap'), 'books roadmap should keep the current 0–22 series');
assert(
  books.includes('href="learn.html">Ch.7 · 21 · 22</a>'),
  'Volume 8 course cell should keep the current single course link'
);

console.log('learn link wiring ok');
