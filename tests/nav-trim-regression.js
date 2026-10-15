#!/usr/bin/env node
/* The primary bar is seven destinations plus More. Engineering stays
 * reachable inside More. The phone panel is closed until the menu opens. */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const PRIMARY = ['Intel', 'Directory', 'Projects', 'Tenders', 'Events', 'Learn', 'RFQ'];
const html = fs.readFileSync('index.html', 'utf8');
const nav = html.slice(html.indexOf('<nav class="tpnav"'), html.indexOf('</nav>'));
const more = nav.slice(nav.indexOf('class="tpnav-more"'));
const bar = nav.slice(0, nav.indexOf('class="tpnav-more"'));
const css = fs.readFileSync('tp-nav.css', 'utf8');

console.log('=== NAV TRIM ===');
PRIMARY.forEach(function (label) {
  check(label + ' stays in the bar', bar.indexOf('>' + label + '<') >= 0 || bar.indexOf('>' + label + '</a>') >= 0);
});
check('bar has seven primary labels', PRIMARY.filter(function (label) {
  return bar.indexOf('>' + label + '<') >= 0 || bar.indexOf('>' + label + '</a>') >= 0;
}).length === 7);
check('Engineering is inside More', more.indexOf('>Engineering<') >= 0);
check('Engineering is not a top-level bar link', bar.indexOf('>Engineering<') < 0);
check('hamburger starts closed', /aria-expanded="false"/.test(html.slice(html.indexOf('menu-toggle'), html.indexOf('menu-toggle') + 180)));
check('phone panel is hidden until open', /@media \(max-width: 1023px\)[\s\S]*\.tpnav \{\s*display: none;/.test(css) && /\.tpnav\.open \{\s*display: flex;/.test(css));
check('hamburger is shown on a phone', /@media \(max-width: 1023px\)[\s\S]*\.menu-toggle \{\s*display: block;/.test(css));
['map.html', 'logistics.html', 'associations.html', 'buyers.html', 'match.html', 'compare.html', 'education.html', 'media.html', 'affiliate-disclosure.html'].forEach(function (file) {
  check(file + ' exists', fs.existsSync(file));
});

if (failed) {
  console.error('NAV TRIM FAILED (' + failed + ')');
  process.exit(1);
}
console.log('NAV TRIM OK');
