#!/usr/bin/env node
/* Free Engineer Track modules 1–4 are static self-study pages.
 * The live URLs are /engineer-track/module-N.html. No account, no price,
 * and no offer of a class, a call, or a certification.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  PASS  ' + label);
  else {
    failed++;
    console.error('  FAIL  ' + label + (detail ? ' :: ' + detail : ''));
  }
}

const modules = [1, 2, 3, 4].map(function (n) {
  return {
    n: n,
    rel: 'engineer-track/module-' + n + '.html',
    url: 'https://transformerpath.com/engineer-track/module-' + n + '.html'
  };
});

const track = fs.readFileSync(path.join(root, 'engineer-track.html'), 'utf8');
const learn = fs.readFileSync(path.join(root, 'learn.html'), 'utf8');
const dist = fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const dirs = dist.match(/const DIRS = \[([\s\S]*?)\];/);
check('publish copies the engineer-track directory', !!(dirs && dirs[1].indexOf("'engineer-track'") !== -1));

modules.forEach(function (mod) {
  const file = path.join(root, mod.rel);
  check(mod.rel + ' exists', fs.existsSync(file));
  const html = fs.readFileSync(file, 'utf8');
  const main = (html.match(/<main id="main"[\s\S]*?<\/main>/) || [''])[0];
  const words = (main.replace(/<[^>]+>/g, ' ').match(/[A-Za-z0-9'’%°+-]+/g) || []);
  const h1 = ((html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1] || '');
  const branded = h1 + ' | TransformerPath';
  const desc = ((html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '');
  check(mod.rel + ' title keeps the module number inside 50–60', branded.length >= 50 && branded.length <= 60 && branded.indexOf('Module ' + mod.n) === 0, branded + ' (' + branded.length + ')');
  check(mod.rel + ' description is a complete 140–160 sentence', desc.length >= 140 && desc.length <= 160 && /[.]$/.test(desc), String(desc.length));
  check(mod.rel + ' has a skip link to #main', html.indexOf('href="#main"') !== -1 && /id="main"/.test(html));
  check(mod.rel + ' is self-canonical', html.indexOf('href="' + mod.url + '"') !== -1);
  check(mod.rel + ' is long enough to study', words.length >= 1200, String(words.length));
  check(mod.rel + ' names an IEC or IEEE designation', /IEC\s+6\d{4}|IEEE\s+C57\./.test(main));
  check(mod.rel + ' gives the TransformerPath address', html.indexOf('hello@transformerpath.com') !== -1);
  check(mod.rel + ' has no price', !/\$\s?\d/.test(main) && !/£\s?\d/.test(main) && !/€\s?\d/.test(main));
  check(mod.rel + ' does not place the brand in Dubai or the UAE', !/Dubai|UAE|United Arab Emirates/i.test(html));
  check(mod.rel + ' does not offer a class, a call, or a certification', !/webinar|masterclass|consulting|instructor|tutoring|certificate|book a call|sign in to/i.test(main));
  check(mod.rel + ' is linked from the track', track.indexOf(mod.rel) !== -1);
  check(mod.rel + ' is linked from Learn', learn.indexOf(mod.rel) !== -1);
  check(mod.rel + ' is in the sitemap', sitemap.indexOf(mod.url) !== -1);
  check(mod.rel + ' links back to the track', html.indexOf('href="/engineer-track.html"') !== -1);
});

const m1 = fs.readFileSync(path.join(root, 'engineer-track/module-1.html'), 'utf8');
check('module 1 states clock 11 as 330 degrees of lag', /330 degrees of lag/.test(m1));
check('module 1 does not treat 650 kV as the 123 kV lightning level', /650&nbsp;kV is not that row/.test(m1) && /450&nbsp;kV/.test(m1));
check('module 1 does not call 40 MVA a distribution class', /not a distribution-transformer class/.test(m1));

const m2 = fs.readFileSync(path.join(root, 'engineer-track/module-2.html'), 'utf8');
check('module 2 keeps short-circuit withstand as a special test', /special test under IEC 60076-5/.test(m2));
check('module 2 keeps the partial-discharge induced test last', /it is last/.test(m2));
check('module 2 links module 1 and module 3', m2.indexOf('/engineer-track/module-1.html') !== -1 && m2.indexOf('/engineer-track/module-3.html') !== -1);

const m3 = fs.readFileSync(path.join(root, 'engineer-track/module-3.html'), 'utf8');
check('module 3 requires the factory frequency-response baseline', /IEC 60076-18/.test(m3));
check('module 3 links module 4', m3.indexOf('/engineer-track/module-4.html') !== -1);

const m4 = fs.readFileSync(path.join(root, 'engineer-track/module-4.html'), 'utf8');
check('module 4 refuses a single gas sample as a diagnosis', /not a diagnosis/.test(m4));
check('module 4 links module 3', m4.indexOf('/engineer-track/module-3.html') !== -1);

if (failed) {
  console.error('ENGINEER TRACK MODULES FAIL ' + failed);
  process.exit(1);
}
console.log('ENGINEER TRACK MODULES PASS');
