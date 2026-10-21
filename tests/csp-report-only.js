#!/usr/bin/env node
/* Report-only CSP names the third parties the site already loads.
 * The enforcing policy stays in place.
 * Run: node tests/csp-report-only.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

const toml = fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8');
function header(name) {
  const key = name + ' = "';
  const i = toml.indexOf(key);
  if (i === -1) return '';
  const j = toml.indexOf('"\n', i);
  return toml.slice(i + key.length, j);
}

const enforce = header('Content-Security-Policy');
const report = header('Content-Security-Policy-Report-Only');
check(enforce.indexOf("default-src 'self' https: data: blob:") === 0, 'enforcing CSP is still present');
check(enforce.indexOf("object-src 'none'") !== -1, 'enforcing CSP still blocks object embeds');
check(enforce.indexOf('js.stripe.com') === -1, 'enforcing CSP was not rewritten around Stripe');
const hosts = [
  'pagead2.googlesyndication.com',
  'googleads.g.doubleclick.net',
  'fundingchoicesmessages.google.com',
  'js.stripe.com',
  'api.stripe.com',
  'hooks.stripe.com',
  'm.stripe.network',
  'buy.stripe.com',
  'checkout.stripe.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'ipapi.co'
];
hosts.forEach(function (host) {
  check(report.indexOf(host) !== -1, 'report-only allows ' + host);
});
check(report.indexOf("'unsafe-inline'") !== -1 && report.indexOf('https:') !== -1, 'report-only keeps inline scripts and https:');
check(report.indexOf("object-src 'none'") !== -1, 'report-only still names object-src none');

if (failed) {
  console.error(failed + ' CSP check(s) failed');
  process.exit(1);
}
console.log('CSP report-only checks passed');
