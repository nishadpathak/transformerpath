#!/usr/bin/env node
/* An unsourced plant count is an em dash. A plant is added only when the
 * facility record is already counted, or is SOURCED with a source URL and
 * an evidence quote. Company homepages are not plant sources.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const DASH = '—';
const builder = fs.readFileSync('build-markets.js', 'utf8');
check('builder prints an em dash when no plant is sourced', /function plantFigure\(n\) \{\n  return n > 0 \? String\(n\) : '—';\n\}/.test(builder));
check('builder does not print a zero sourced-plant stat', builder.indexOf("'<div class=\"s\"><b>' + facs.length + '</b><span>sourced plants</span></div>'") === -1);
check('a sourced plant still needs a source URL and an evidence quote', /f\.public_count\) return true;\n    return f\.status === 'SOURCED' && f\.source_url && f\.evidence_quote;/.test(builder));

const facilities = JSON.parse(fs.readFileSync('data/facilities.json', 'utf8')).facilities || [];
const saudi = facilities.filter(function (row) { return /saudi/i.test(row.country || ''); });
function isSourced(row) {
  if (row.public_count) return true;
  return row.status === 'SOURCED' && row.source_url && row.evidence_quote;
}
check('Saudi has facility rows', saudi.length > 0, String(saudi.length));
check('no Saudi facility is a sourced plant', saudi.every(function (row) { return !isSourced(row); }));
check('Saudi company homepages are not stored as plant evidence', saudi.every(function (row) { return !row.evidence_quote; }));

const page = fs.readFileSync('markets/saudi-arabia/index.html', 'utf8');
check('Saudi page shows 11 manufacturers', page.indexOf('<b>11</b><span>manufacturers tracked</span>') >= 0);
check('Saudi sourced plants are an em dash', page.indexOf('<b>' + DASH + '</b><span>sourced plants</span>') >= 0);
check('Saudi sourced plants are not zero', page.indexOf('<b>0</b><span>sourced plants</span>') === -1);
check('Saudi plant heading is an em dash', page.indexOf('Confirmed manufacturing plants &amp; facilities (' + DASH + ')') >= 0);
check('Saudi plant heading is not zero', page.indexOf('facilities (0)') === -1);

const markets = fs.readFileSync('markets.html', 'utf8');
check('market index does not print zero plants', markets.indexOf('>0</b> <span style="color:var(--muted)">plants</span>') === -1);

function walk(dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (name === 'index.html') out.push(full);
  });
}
const pages = [];
walk('markets', pages);
const zeros = pages.filter(function (file) {
  return fs.readFileSync(file, 'utf8').indexOf('<b>0</b><span>sourced plants</span>') >= 0;
});
check('no market page prints zero sourced plants', zeros.length === 0, zeros.join(', '));

const uae = fs.readFileSync('markets/uae/index.html', 'utf8');
const uaeStat = (uae.match(/<div class="s"><b>(\d+)<\/b><span>sourced plants<\/span>/) || [])[1];
check('UAE sourced plants stay 8', uaeStat === '8', uaeStat);

if (failed) {
  console.error('SOURCED PLANT DASH FAILED (' + failed + ')');
  process.exit(1);
}
console.log('SOURCED PLANT DASH OK');
