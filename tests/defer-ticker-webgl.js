#!/usr/bin/env node
/* The homepage poster is the LCP image. WebGL waits, and the ticker waits for load.
 * Run: node tests/defer-ticker-webgl.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}
check(html.indexOf('fetchpriority="high"') !== -1 && html.indexOf('power-transformer-3d-poster-800.jpg') !== -1, 'hero poster is the high-priority image');
check(html.indexOf('<iframe') === -1, 'homepage HTML does not include a WebGL iframe');
check(html.indexOf("f.src='hero-3d.html'") !== -1, 'WebGL iframe is injected from script');
check(html.indexOf("requestIdleCallback(kick,{timeout:2500})") !== -1, 'WebGL waits for idle');
check(html.indexOf("window.addEventListener('load', deferTicker)") !== -1, 'ticker waits for load');
check(html.indexOf('requestIdleCallback(paintTicker,{timeout:2000})') !== -1, 'ticker then waits for idle');
check(!/\(function\(\)\{var tk=document\.getElementById\('ticker'\)/.test(html), 'ticker is not painted by an immediate IIFE');
if (failed) process.exit(1);
console.log('ticker and WebGL checks passed');
