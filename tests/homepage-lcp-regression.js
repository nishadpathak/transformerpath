#!/usr/bin/env node
/* tests/homepage-lcp-regression.js
 * Mobile LCP was the 510KB hero poster, faded in from opacity 0, while a
 * second hero image was preloaded and an infinite blurred aurora kept the
 * main thread busy. The homepage stays free of the AdSense loader.
 * Run: node tests/homepage-lcp-regression.js
 */
'use strict';
const fs = require('fs');
const inject = require('../adsense-inject');

const html = fs.readFileSync('index.html', 'utf8');
const small = 'media/power-transformer-3d-poster-800.jpg';
const full = 'media/power-transformer-3d-poster.jpg';
let failures = [];
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failures.push(label);
}

check('mobile poster file exists', fs.existsSync(small));
const smallBytes = fs.existsSync(small) ? fs.statSync(small).size : 0;
const fullBytes = fs.statSync(full).size;
check('mobile poster is under 120KB', smallBytes > 0 && smallBytes < 120 * 1024, smallBytes + ' bytes');
check('mobile poster is smaller than the full poster', smallBytes < fullBytes, smallBytes + ' vs ' + fullBytes);
check('hero img points phones at the small poster', html.indexOf('src="' + small + '"') !== -1 && html.indexOf(small + ' 800w') !== -1);
check('full poster remains available for wide screens', html.indexOf(full + ' 1280w') !== -1);
check('poster is not faded in from opacity 0', /\.hero-stage__viz\{ animation: none; \}/.test(html));
check('brand/hero.jpg is not preloaded ahead of the poster', !/rel="preload" as="image" href="brand\/hero\.jpg"/.test(html));
check('google fonts do not block first paint', /rel="preload" as="style" href="https:\/\/fonts\.googleapis\.com\//.test(html));
check('late font swap cannot reset LCP', /display=optional/.test(html));
check('phones do not idle-load the 3D model', /matchMedia\('\(max-width: 819px\)'\)/.test(html));
check('the LCP poster is preloaded and decoded on the critical path', /rel="preload" as="image" href="media\/power-transformer-3d-poster-800\.jpg"/.test(html) && !/data-tp-3d-poster[\s\S]{0,400}decoding="async"/.test(html));
check('aurora blur does not animate forever', !/animation: aurora /.test(html) && !/animation: aurora /.test(fs.readFileSync('style.css', 'utf8')));

const stamped = inject.stampHtml(html, 'index.html');
check('AdSense loader is not stamped on the homepage', stamped.indexOf(inject.cfg.LOADER) === -1 && stamped.indexOf('adsbygoogle') === -1);
check('homepage still has no manual ad slot', stamped.indexOf('data-tp-ad="in-content"') === -1);

if (failures.length) {
  console.error('\n' + failures.length + ' homepage LCP check(s) failed');
  process.exit(1);
}
console.log('\nHomepage LCP checks passed.');
