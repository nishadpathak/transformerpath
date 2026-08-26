#!/usr/bin/env node
/* Stamp the crawlable /intel "last updated" date at build time so search
 * engines never see a stale date. Netlify runs this in the build command
 * before publishing (see netlify.toml). Idempotent: it just rewrites the
 * #stamp element to today's date, so re-running is safe. */
'use strict';
const fs = require('fs');
const file = 'intel.html';
let s;
try { s = fs.readFileSync(file, 'utf8'); } catch (e) {
  console.warn('intel.html not found; skipping stamp'); process.exit(0);
}
const label = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const value = 'Updated: ' + label;
const re = /(id="stamp">)[\s\S]*?(<\/div>)/;
if (re.test(s)) {
  s = s.replace(re, (m, a, b) => a + value + b);
  fs.writeFileSync(file, s);
  console.log('stamped ' + file + ' -> ' + value);
} else {
  console.warn('stamp element not found in ' + file);
}
