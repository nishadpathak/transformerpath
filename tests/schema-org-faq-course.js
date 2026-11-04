#!/usr/bin/env node
/* Organization names the brand and hello@ only. FAQPage stays. Course cites the live $199 offer.
 * Run: node tests/schema-org-faq-course.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const org = home.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@graph":\[\{"@type":"Organization".*?)<\/script>/);
check(!!org, 'homepage has Organization JSON-LD');
if (org) {
  const data = JSON.parse(org[1]);
  const node = data['@graph'][0];
  check(node['@type'] === 'Organization' && node.name === 'TransformerPath', 'brand name is TransformerPath');
  check(node.email === 'hello@transformerpath.com', 'organization email is hello@');
  check(!node.address && !node.telephone, 'organization has no address or phone');
}
const faq = fs.readFileSync(path.join(root, 'faq.html'), 'utf8');
check(faq.indexOf('"@type": "FAQPage"') !== -1, 'faq.html has FAQPage markup');
const learn = fs.readFileSync(path.join(root, 'learn.html'), 'utf8');
const pricing = fs.readFileSync(path.join(root, 'pricing.html'), 'utf8');
const offers = [
  ['199', '/checkout/?product=learning', 'Learning', 'https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p'],
  ['599', '/checkout/?product=engineering_pro', 'Engineering Pro', 'https://buy.stripe.com/fZu00c3pScJL1NC3v4fYY01'],
  ['1999', '/checkout/?product=engineering_team', 'Engineering Team', 'https://buy.stripe.com/aFacMY6C4aBD2RG2r0fYY02']
];
check(learn.indexOf('"@type": "Course"') !== -1, 'learn.html has Course markup');
const courseJson = learn.match(/<script type="application\/ld\+json">(\{"@context": "https:\/\/schema.org", "@type": "Course"[\s\S]*?)<\/script>/);
check(!!courseJson, 'Course JSON-LD is present');
if (courseJson) {
  const course = JSON.parse(courseJson[1]);
  check(Array.isArray(course.offers) && course.offers.length === 3, 'Course lists the three live offers');
  offers.forEach(function (row, i) {
    const offer = course.offers[i] || {};
    check(offer.price === row[0] && offer.url === row[1] && offer.name === row[2], row[2] + ' offer matches the live checkout');
  });
}
const paid = require('../lib/paid-listings');
offers.forEach(function (row) {
  check(pricing.indexOf('href="' + row[1] + '"') !== -1 && pricing.indexOf('href="' + row[3] + '"') === -1, 'pricing page gates the ' + row[2] + ' checkout');
});
check(paid.PAYMENT_LINKS.learning.url === offers[0][3], 'Learning Payment Link is unchanged');
check(paid.PAYMENT_LINKS.engineering_pro.url === offers[1][3], 'Engineering Pro Payment Link is unchanged');
check(paid.PAYMENT_LINKS.engineering_team.url === offers[2][3], 'Engineering Team Payment Link is unchanged');
if (failed) process.exit(1);
console.log('schema checks passed');
