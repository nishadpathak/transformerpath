#!/usr/bin/env node
/* Server-rendered event labels must not freeze between deploys. */
'use strict';
const fs = require('fs');

const source = fs.readFileSync('build_ssr.js', 'utf8');
let failed = 0;
function check(ok, message) {
  if (ok) console.log('  ✓ ' + message);
  else { console.error('  ✗ ' + message); failed++; }
}

check(/data-rel-end/.test(source), 'SSR emits date attributes for the browser clock');
check(/const lbl = ''/.test(source), 'up-next SSR does not bake a relative label');
check(/rel-today"\$\{relAttr\}><\/span>/.test(source), 'live SSR label is empty until the browser clock runs');
check(!/const lbl = evState\(ev\)\.key === 'LIVE' \? 'Live now'/.test(source), 'SSR has no build-time Live now branch');

if (failed) process.exit(1);
console.log('EVENT SSR CLOCK OK');
