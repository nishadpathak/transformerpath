#!/usr/bin/env node
/* The intel subscribe box posts to the existing Netlify form. It does not add a backend.
 * Run: node tests/intel-subscribe.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const intel = fs.readFileSync(path.join(root, 'intel.html'), 'utf8');
const subscribe = fs.readFileSync(path.join(root, 'subscribe.html'), 'utf8');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}
function has(html, needle) { return html.indexOf(needle) !== -1; }
['name="subscribe"', 'data-netlify="true"', 'data-netlify-honeypot="bot-field"', 'name="form-name" value="subscribe"', 'name="email"', 'name="name"', 'name="company"', 'name="interest"', 'name="bot-field"'].forEach(function (needle) {
  check(has(subscribe, needle), 'Daily Brief form has ' + needle);
  check(has(intel, needle), 'intel box has ' + needle);
});
check(!has(intel, 'functions/watchlist-subscribe'), 'intel box does not call the watchlist function');
const functions = fs.readdirSync(path.join(root, 'functions'));
check(functions.indexOf('intel-subscribe.js') === -1, 'no new intel subscribe function');
if (failed) process.exit(1);
console.log('intel subscribe checks passed');
