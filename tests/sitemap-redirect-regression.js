#!/usr/bin/env node
/* Sitemap locs must be pages (HTTP 200), not 301s.
 * URLs removed on 16 Oct 2026 must 301 to a page that exists.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const checkSitemap = require('../check-sitemap');
const { loadRules, permanentMap } = require('../lib/site-redirects');
const retired = require('../lib/retired-url-redirects');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  PASS  ' + label);
  else {
    failed++;
    console.error('  FAIL  ' + label + (detail ? ' :: ' + detail : ''));
  }
}

function pageFor(urlPath) {
  if (urlPath === '/') return 'index.html';
  if (urlPath.endsWith('/')) return urlPath.slice(1) + 'index.html';
  return urlPath.replace(/^\//, '');
}

const root = path.join(__dirname, '..');
const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const result = checkSitemap(xml, root);
check('sitemap check reports no errors', result.errors.length === 0, result.errors.slice(0, 5).join(' | '));
check('czech-republic.html is not in the sitemap', xml.indexOf('czech-republic.html') === -1);

const rules = loadRules(root);
function hasRule(source, from, to) {
  return rules.some(function (rule) {
    return rule.source === source && rule.status === 301 && rule.from === from && rule.to === to;
  });
}

const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
check('turkey country directory 301s to turkiye', hasRule('netlify.toml', '/directory/country/turkey/', '/directory/country/turkiye/'));
check('turkey country directory target exists', fs.existsSync(path.join(root, 'directory/country/turkiye/index.html')));
check('/directory?region redirects to manufacturers', /from = "\/directory"\s+to = "\/manufacturers\.html"\s+status = 301\s+force = true\s+query = \{region = ":region"\}/.test(toml));
check('/directory?country redirects to manufacturers', /from = "\/directory"\s+to = "\/manufacturers\.html"\s+status = 301\s+force = true\s+query = \{country = ":country"\}/.test(toml));
check('bare /directory still maps to the hub', permanentMap(root).get('/directory') === '/directory.html');

retired.RULES.forEach(function (pair) {
  check(pair[0] + ' 301 in netlify.toml', hasRule('netlify.toml', pair[0], pair[1]));
  check(pair[0] + ' 301 in _redirects', hasRule('_redirects', pair[0], pair[1]));
  const target = pageFor(pair[1]);
  check(pair[0] + ' target exists', fs.existsSync(path.join(root, target)), target);
  check(pair[0] + ' is not in the sitemap', xml.indexOf('https://transformerpath.com' + pair[0]) === -1);
});

let missingPage = 0;
result.locVals.forEach(function (loc) {
  let pathname = '';
  try { pathname = new URL(loc).pathname; } catch (e) { missingPage++; return; }
  if (!fs.existsSync(path.join(root, pageFor(pathname)))) missingPage++;
});
check('every sitemap URL has a page file', missingPage === 0 && result.locVals.length > 1000, String(missingPage) + ' missing of ' + result.locVals.length);

if (failed) {
  console.error('SITEMAP REDIRECT REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('SITEMAP REDIRECT REGRESSION OK');
