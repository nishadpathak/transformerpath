#!/usr/bin/env node
/* The homepage heading stays in the left column, and the 3D explorer caption
 * sits above the bottom component panel on a phone. Both use a system font
 * so a late webfont does not change the line count.
 * Run: node tests/hero-label-overlap.js
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
check(home.indexOf('max-width:min(32rem, 38vw)') !== -1, 'homepage copy stays left of the poster labels');
check(home.indexOf('font-family:Syne,system-ui,sans-serif') !== -1, 'homepage heading has a system-ui fallback');
check(home.indexOf('.hero-stage__copy{ max-width:40rem; }') !== -1, 'stacked hero copy uses the full column');
const explorer = fs.readFileSync(path.join(root, 'power3d.html'), 'utf8');
check(explorer.indexOf('bottom:calc(38vh + 16px)') !== -1, 'explorer caption sits above the phone panel');
check(explorer.indexOf('max-width:min(36rem,calc(100% - 346px))') !== -1, 'explorer caption stays clear of the side panel');
check(explorer.indexOf('#help{') !== -1 && explorer.indexOf('font-family:system-ui,-apple-system,"Segoe UI",sans-serif') !== -1, 'explorer chrome uses a system font');
if (failed) { console.error(failed + ' overlap check(s) failed'); process.exit(1); }
console.log('hero overlap checks passed');
