#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'intel.html'), 'utf8');
const ids = [];
const re = /<article class="intel-post" id="([^"]+)"/g;
let m;
while ((m = re.exec(html))) ids.push(m[1]);
const seen = new Set();
const dups = [];
for (const id of ids) {
  if (seen.has(id)) dups.push(id);
  seen.add(id);
}
if (!ids.length) {
  console.error('intel.html has no SSR intel posts');
  process.exit(1);
}
if (dups.length) {
  console.error('duplicate intel article ids: ' + dups.slice(0, 8).join(', '));
  process.exit(1);
}
const builder = fs.readFileSync(path.join(__dirname, '..', 'build-intel-feed-ui.js'), 'utf8');
if (/injectMarker\(page, 'intel-feed', latest\.map/.test(builder) && /injectMarker\(page, 'intel-timeline', latest\.map/.test(builder)) {
  console.error('builder still writes the same card list into both markers');
  process.exit(1);
}
console.log('intel timeline: ' + ids.length + ' posts, no duplicate ids');
