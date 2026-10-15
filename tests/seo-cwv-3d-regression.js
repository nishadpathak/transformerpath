#!/usr/bin/env node
/* tests/seo-cwv-3d-regression.js
 * The SEO pass treated `img.data` inside the explorer script as an <img> tag
 * and deferred three.js ahead of the inline boot. Both left /power3d blank
 * and made the homepage say interactive 3D was unavailable.
 * Run: node tests/seo-cwv-3d-regression.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cwv = require('../lib/seo-cwv');

const root = path.join(__dirname, '..');
let failed = 0;

function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

function publish(rel) {
  return cwv.apply(fs.readFileSync(path.join(root, rel), 'utf8'), rel, root, {}, []);
}

function scriptTags(html) {
  const tags = [];
  const re = /<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) tags.push(m[1]);
  return tags;
}

function srcOf(attrs) {
  const m = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : '';
}

console.log('=== SEO CWV 3D REGRESSION ===');

['power3d.html', 'explorer.html', 'coilassembly.html'].forEach(function (rel) {
  const published = publish(rel);
  check(rel + ' keeps the image-data loop', published.indexOf('i<img.data.length') !== -1);
  check(rel + ' does not rewrite that loop into a tag',
    published.indexOf('i<img fetchpriority') === -1 && published.indexOf('i<img loading') === -1);
  const boot = scriptTags(published).filter(function (attrs) {
    return cwv.scriptKeepsParserOrder(attrs);
  });
  check(rel + ' keeps 3D scripts parser-blocking',
    boot.length > 0 && boot.every(function (attrs) { return !/\bdefer\b/i.test(attrs); }),
    boot.map(srcOf).join(', '));
});

const hero = publish('hero-3d.html');
const heroSrcs = scriptTags(hero).map(function (attrs) {
  return { src: srcOf(attrs), defer: /\bdefer\b/i.test(attrs), blocking: cwv.scriptKeepsParserOrder(attrs) };
});
['tp-webgl-gate.js', 'three.min.js', 'tp-3d-core.js', 'tp-power-assembly.js'].forEach(function (name) {
  const tag = heroSrcs.filter(function (t) { return t.src.indexOf(name) !== -1; })[0];
  check('hero-3d does not defer ' + name, !!(tag && tag.blocking && !tag.defer), tag && tag.src);
});
check('hero-3d poster tag is still a real image',
  /<img(?=[\s>/])[^>]*data-tp-3d-poster/.test(hero));
check('hero-3d still tells the parent when 3D cannot start',
  /parent\.postMessage\(\{ type: 'tp-3d-state'/.test(hero));

const home = publish('index.html');
check('homepage does not ship three.min.js', home.indexOf('three.min.js') === -1);
check('homepage still defers the WebGL gate',
  /<script\b[^>]*src=["']tp-webgl-gate\.js["'][^>]*defer|<script\b[^>]*defer[^>]*src=["']tp-webgl-gate\.js["']/.test(home));
check('phones still wait for a tap before the 3D iframe',
  /matchMedia\('\(max-width: 819px\)'\)/.test(home) && home.indexOf("f.src='hero-3d.html'") !== -1);
check('homepage keeps the static unavailable note',
  home.indexOf('Interactive 3D is unavailable in this browser.') !== -1 &&
  /id="hero3dNote" hidden/.test(home));
check('mobile poster is still the LCP image',
  home.indexOf('media/power-transformer-3d-poster-800.jpg') !== -1);

const gate = fs.readFileSync(path.join(root, 'tp-webgl-gate.js'), 'utf8');
check('no-WebGL fallback copy remains',
  gate.indexOf('Interactive 3D is unavailable in this browser.') !== -1 &&
  gate.indexOf('media/power-transformer-3d-poster.jpg') !== -1);

if (failed) {
  console.error('\n' + failed + ' SEO CWV 3D check(s) failed');
  process.exit(1);
}
console.log('\nSEO CWV 3D checks passed.');
