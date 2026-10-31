#!/usr/bin/env node
/* Module 1 of each /learn course is public, indexable, and free.
 * The upgrade button uses the existing Learning Payment Link.
 * Prices and the other Payment Links are untouched.
 * Run: node tests/learn-free-modules.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const paid = require('../lib/paid-listings');
const courses = require('../scripts/write-learn-free-modules').COURSES;

const root = path.join(__dirname, '..');
const LEARNING = 'https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p';
const PRO = 'https://buy.stripe.com/fZu00c3pScJL1NC3v4fYY01';
const TEAM = 'https://buy.stripe.com/aFacMY6C4aBD2RG2r0fYY02';
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

check(paid.PAYMENT_LINKS.learning.url === LEARNING, 'Learning Payment Link is unchanged');
check(paid.PAYMENT_LINKS.learning.amountCents === 19900, 'Learning price is still $199');
check(paid.PAYMENT_LINKS.engineering_pro.url === PRO, 'Engineering Pro Payment Link is unchanged');
check(paid.PAYMENT_LINKS.engineering_pro.amountCents === 59900, 'Engineering Pro price is still $599');
check(paid.PAYMENT_LINKS.engineering_team.url === TEAM, 'Engineering Team Payment Link is unchanged');
check(paid.PAYMENT_LINKS.engineering_team.amountCents === 199900, 'Engineering Team price is still $1,999');

const learn = fs.readFileSync(path.join(root, 'learn.html'), 'utf8');
const pricing = fs.readFileSync(path.join(root, 'pricing.html'), 'utf8');
check(learn.indexOf(LEARNING) !== -1 && learn.indexOf(PRO) !== -1 && learn.indexOf(TEAM) !== -1, 'learn.html still links all three checkouts');
check(pricing.indexOf(LEARNING) !== -1 && pricing.indexOf(PRO) !== -1 && pricing.indexOf(TEAM) !== -1, 'pricing.html still links all three checkouts');
check(learn.indexOf('$199 one-time payment · 12 months access') !== -1, 'Learning price label is unchanged');
check(learn.indexOf('$599 one-time payment · 12 months access') !== -1, 'Engineering Pro price label is unchanged');
check(learn.indexOf('$1,999 one-time payment · 12 months access') !== -1, 'Engineering Team price label is unchanged');

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const dist = fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8');
check(/const DIRS = \[[\s\S]*?'learn'/.test(dist), 'dist publish copies the learn directory');

check(courses.length === 24, '24 courses have a free module 1');
courses.forEach(function (course) {
  const rel = course.volume === null
    ? 'learn/design/module-1/index.html'
    : 'learn/volume-' + course.volume + '/module-1/index.html';
  const url = course.volume === null
    ? 'https://transformerpath.com/learn/design/module-1/'
    : 'https://transformerpath.com/learn/volume-' + course.volume + '/module-1/';
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const main = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
  check(html.indexOf('href="#main"') !== -1 && /id="main"/.test(html), rel + ' skip link lands on #main');
  check(title.length >= 50 && title.length <= 60, rel + ' title is 50–60 (' + title.length + ')');
  check(desc.length >= 140 && desc.length <= 160 && /[.]$/.test(desc), rel + ' description is 140–160');
  check(html.indexOf('rel="canonical" href="' + url + '"') !== -1, rel + ' canonical is ' + url);
  check(/name="robots" content="index,follow"/.test(html) && !/noindex/i.test(html), rel + ' is indexable');
  check(html.indexOf('>Free<') !== -1, rel + ' is marked Free');
  check(main.indexOf('href="' + LEARNING + '"') !== -1 && main.indexOf('data-upgrade="learning"') !== -1, rel + ' upgrade uses the existing Learning checkout');
  check(main.indexOf(PRO) === -1 && main.indexOf(TEAM) === -1, rel + ' does not retarget Pro or Team');
  check(html.indexOf('course-gate') === -1 && html.indexOf('tp-gate') === -1, rel + ' has no paywall');
  check(main.indexOf('hello@transformerpath.com') !== -1, rel + ' uses the brand address');
  check(!/Dubai|UAE|United Arab Emirates/i.test(html), rel + ' does not place the brand in Dubai or the UAE');
  check(!/webinar|consulting|masterclass|book a call/i.test(main), rel + ' does not offer a class or a call');
  check((main.replace(/<[^>]+>/g, ' ').match(/[A-Za-z0-9]+/g) || []).length >= 450, rel + ' has a real lesson');
  check(learn.indexOf(url.replace('https://transformerpath.com', '')) !== -1, rel + ' is linked from Learn');
  check(sitemap.indexOf('<loc>' + url + '</loc>') !== -1, rel + ' is in the sitemap');
});

const track = fs.readFileSync(path.join(root, 'engineer-track/module-1.html'), 'utf8');
check(track.indexOf('>Free<') !== -1, 'engineer-track module 1 is marked Free');
check(track.indexOf('href="' + LEARNING + '"') !== -1, 'engineer-track module 1 upgrades to the existing Learning checkout');
check(!/noindex/i.test(track), 'engineer-track module 1 stays indexable');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nlearn free modules OK');
