#!/usr/bin/env node
/* /learn checkout buttons use the existing one-time Payment Links.
 * Run: node tests/learn-checkout.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const paid = require('../lib/paid-listings');
const root = path.join(__dirname, '..');
const learn = fs.readFileSync(path.join(root, 'learn.html'), 'utf8');
const pricing = fs.readFileSync(path.join(root, 'pricing.html'), 'utf8');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}
const plans = [
  ['learning', 'Learning', '$199 one-time payment · 12 months access'],
  ['engineering_pro', 'Engineering Pro', '$599 one-time payment · 12 months access'],
  ['engineering_team', 'Engineering Team', '$1,999 one-time payment · 12 months access']
];
plans.forEach(function (row) {
  const url = paid.PAYMENT_LINKS[row[0]].url;
  const href = 'href="' + url + '"';
  check(learn.indexOf(href) !== -1, 'learn.html links ' + row[1] + ' to the existing checkout');
  check(learn.indexOf(row[2]) !== -1, 'learn.html labels ' + row[1] + ' as a one-time 12-month payment');
  check(pricing.indexOf(href) !== -1, 'pricing.html keeps the same ' + row[1] + ' link');
});
check(learn.indexOf('No auto-renewal') !== -1, 'learn.html says there is no auto-renewal');
check(learn.indexOf('self-serve') !== -1, 'learn.html says access is self-serve');
check(learn.indexOf('no live teaching, and no personal review') !== -1, 'learn.html declines live teaching and personal review');
check(!/webinar/i.test(learn), 'learn.html does not use the banned public word');
check(learn.indexOf('Compare 3 plans') === -1 && learn.indexOf('See team pricing') === -1, 'the old pricing-page buttons are replaced');
check(learn.indexOf('5kQ00c3pS8tv9g4fdMfYY00') === -1, 'learn.html does not use the redirected fork checkout');
if (failed) process.exit(1);
console.log('learn checkout checks passed');
