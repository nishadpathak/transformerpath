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
check(enforce.indexOf('pagead2.googlesyndication.com') !== -1, 'enforcing CSP still names AdSense');
check(enforce.indexOf('https:') !== -1 && enforce.indexOf("'unsafe-inline'") !== -1, 'enforcing CSP still allows https and inline scripts');
/* WebKit logs a console error on every page for a report-only policy that
 * has no report-to endpoint, and then ignores the policy. The header is
 * removed. The enforcing policy is unchanged. */
check(report === '', 'report-only CSP header is not sent');
check(toml.indexOf('Content-Security-Policy-Report-Only') === -1, 'netlify.toml does not set a report-only policy');

if (failed) {
  console.error(failed + ' CSP check(s) failed');
  process.exit(1);
}
console.log('CSP report-only checks passed');
