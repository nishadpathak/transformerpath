#!/usr/bin/env node
/* tests/awards-wording-regression.js
 * Homepage "Confirmed" and "Awards" appear together only beside the
 * confirmed transformer_scope count, not beside the tracked total.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const confirmed = stats.awardsConfirmed;
const inferred = stats.awardsInferred;
const unknown = stats.awardsUnknown;

console.log('=== AWARDS WORDING REGRESSION ===');
check('site-stats awards is the tracked total', stats.awards === confirmed + inferred + unknown, stats.awards + ' vs ' + (confirmed + inferred + unknown));
check('homepage says Awards tracked', /Awards tracked/.test(html));
check('homepage does not say Confirmed Awards', !/Confirmed Awards/.test(html));

const together = [];
const re = /confirmed awards/ig;
let m;
while ((m = re.exec(html))) {
  const start = Math.max(0, m.index - 40);
  together.push(html.slice(start, m.index + m[0].length));
}
check('Confirmed+Awards appears once', together.length === 1, JSON.stringify(together));
check('that pairing is the confirmed-scope count', together.length === 1 && together[0].indexOf(String(confirmed)) >= 0, together[0]);
check('pairing is not the tracked total', together.length === 1 && together[0].indexOf('>' + stats.awards + '<') < 0 && !new RegExp('>' + stats.awards + '<[^>]*>\\s*confirmed awards', 'i').test(html));
check('inferred count is present', html.indexOf('data-stat="awardsInferred">' + inferred) >= 0);
check('unknown count is present', html.indexOf('data-stat="awardsUnknown">' + unknown) >= 0);
const title = html.match(/title="(\d+) awards tracked, split by transformer scope"/);
const visible = html.match(/data-stat="awards">(\d+)/);
check('awards title uses the same total as the visible split', !!title && Number(title[1]) === confirmed + inferred + unknown, title && title[1]);
check('visible awards count uses that same total', !!visible && !!title && visible[1] === title[1], (visible && visible[1]) + ' vs ' + (title && title[1]));
const loader = fs.readFileSync('site-stats.js', 'utf8');
check('runtime title is set from the same three counts', /awardParts\[0\] \+ awardParts\[1\] \+ awardParts\[2\]/.test(loader) && /d\.awards = awardTracked/.test(loader) && /awardTracked \+ ' awards tracked/.test(loader));
const builder = fs.readFileSync('build-site-stats.js', 'utf8');
check('build writes one tracked total into the JSON and the homepage title', /const awardsTracked = awardsConfirmed \+ awardsInferred \+ awardsUnknown/.test(builder) && /awards: awardsTracked/.test(builder) && /current\.awards \+ ' awards tracked/.test(builder));

if (failed) {
  console.error('AWARDS WORDING REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('AWARDS WORDING REGRESSION OK');
