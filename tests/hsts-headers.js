#!/usr/bin/env node
/* HSTS is one year, includes subdomains, and does not preload.
 * Run: node tests/hsts-headers.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const VALUE = 'max-age=31536000; includeSubDomains';
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

const headers = fs.readFileSync(path.join(__dirname, '..', '_headers'), 'utf8');
const toml = fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8');
const dist = fs.readFileSync(path.join(__dirname, '..', 'build-dist.js'), 'utf8');

check(headers.indexOf('Strict-Transport-Security: ' + VALUE) !== -1, '_headers sets HSTS with includeSubDomains');
check(!/Strict-Transport-Security:[^\n]*preload/i.test(headers), '_headers does not preload HSTS');
check(toml.indexOf('Strict-Transport-Security = "' + VALUE + '"') !== -1, 'netlify.toml sets the same HSTS value');
check(!/Strict-Transport-Security[^\n]*preload/i.test(toml), 'netlify.toml does not preload HSTS');
check(dist.indexOf("'_headers'") !== -1, 'build-dist publishes _headers');

if (failed) {
  console.error(failed + ' HSTS check(s) failed');
  process.exit(1);
}
console.log('HSTS checks passed');
