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
  ['199', 'https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p', 'Learning'],
  ['599', 'https://buy.stripe.com/fZu00c3pScJL1NC3v4fYY01', 'Engineering Pro'],
  ['1999', 'https://buy.stripe.com/aFacMY6C4aBD2RG2r0fYY02', 'Engineering Team']
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
offers.forEach(function (row) {
  check(pricing.indexOf(row[1]) !== -1, 'pricing page still uses the ' + row[2] + ' checkout');
});
if (failed) process.exit(1);
console.log('schema checks passed');
