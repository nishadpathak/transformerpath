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
check('homepage does not say confirmed awards', !/confirmed awards/i.test(html));
check('homepage pairs the confirmed-scope count with plain wording', html.indexOf('data-stat="awardsConfirmed">' + confirmed + '</b> with confirmed transformer scope') >= 0);
check('homepage total is not labelled as confirmed transformer orders', !new RegExp('>' + stats.awards + '<[^>]*>\\s*confirmed', 'i').test(html));

const awardsPage = fs.readFileSync('awards.html', 'utf8');
const awardsBuilder = fs.readFileSync('build-awards.js', 'utf8');
check('awards page drops Confirmed Contract Results', awardsPage.indexOf('Confirmed Contract Results') < 0 && awardsBuilder.indexOf('Confirmed Contract Results') < 0);
check('awards page does not call the total source-confirmed awards', awardsPage.indexOf('source-confirmed awards') < 0 && awardsBuilder.indexOf('source-confirmed awards') < 0);
check('awards page shows the tracked total and the confirmed-scope count', awardsPage.indexOf('>' + stats.awards + '<') >= 0 && awardsPage.indexOf('>' + confirmed + '<') >= 0 && awardsPage.indexOf(stats.awards + ' awards tracked') >= 0 && awardsPage.indexOf(confirmed + ' with confirmed transformer scope') >= 0);
check('awards page does not state a count of confirmed transformer orders', !/\d+ confirmed transformer orders/.test(awardsPage));
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
