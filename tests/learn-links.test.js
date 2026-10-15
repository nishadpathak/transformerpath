/**
 * Learn-section link wiring.
 * Static HTML (no JS) must point at files and anchors that exist.
 * Skip links must land on an id that is on the page.
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
for (let n = 0; n <= 19; n++) mainPages.push(`books/volume-${n}/index.html`);
for (const dir of fs.readdirSync(path.join(root, 'case-studies'))) {
  const rel = `case-studies/${dir}/index.html`;
  if (fs.existsSync(path.join(root, rel))) mainPages.push(rel);
}
mainPages.forEach((rel) => assertSkip(rel, 'main'));

['explorer.html', 'power3d.html', 'power500.html', 'oltc.html', 'bushing.html', 'coilassembly.html', 'coretopology.html']
  .forEach((rel) => assertSkip(rel, 'c3d'));

const books = read('books.html');
assert(
  books.includes('<a href="masterclass.html#construction">Ch.7</a> · <a href="masterclass.html#bushings">Ch.21</a> · <a href="masterclass.html#tapchangers">Ch.22</a>'),
  'Volume 8 roadmap cell should link chapters 7, 21 and 22 separately'
);

const learn = read('learn.html');
const staticSeries = learn.slice(learn.indexOf('id="seriespath"'), learn.indexOf('id="curriculum"'));
for (let n = 0; n <= 19; n++) {
  assert(staticSeries.includes(`books/volume-${n}/`), `series path is missing Volume ${n}`);
}
['fundamentals', 'powerdesign', 'testing', 'diagnostics', 'failures', 'manufacturing', 'insulation', 'construction', 'losses', 'shortcircuit', 'protection', 'special', 'sitelife', 'loading', 'repair', 'standards', 'assetmgmt', 'handbook', 'hvdc']
  .forEach((id) => {
    assert(staticSeries.includes(`masterclass.html#${id}`), `series path is missing #${id}`);
    assert(ids(read('masterclass.html')).has(id), `masterclass.html is missing #${id}`);
  });

const staticCurriculum = learn.slice(learn.indexOf('id="curriculum"'), learn.indexOf('id="paid-tools"'));
assert((staticCurriculum.match(/books\/volume-\d+\//g) || []).length === 26, 'each static curriculum card should link its volume');

console.log('learn link wiring ok');
