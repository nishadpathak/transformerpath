#!/usr/bin/env node
/* check-site-footer.js — one site footer per page.
 *
 * components.html and calculator.html each rendered the shared site footer
 * twice. This gate fails when a page contains more than one site footer
 * (a <footer> that uses the shared .cols chrome). Pages may omit that
 * footer. A small copyright footer does not count.
 *
 * Run: node check-site-footer.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP = new Set([
  '.git',
  'node_modules',
  'dist',
  'archive',
  '_private',
  'transformerpath-site',
]);

const FOOTER_RE = /<footer\b[^>]*>[\s\S]*?<\/footer>/gi;

function stripNonDom(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function isSiteFooter(block) {
  return /class\s*=\s*["'][^"']*\bcols\b/.test(block);
}

function siteFooterCount(html) {
  const visible = stripNonDom(html);
  FOOTER_RE.lastIndex = 0;
  let count = 0;
  let match;
  while ((match = FOOTER_RE.exec(visible))) {
    if (isSiteFooter(match[0])) count += 1;
  }
  return count;
}

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function selfTest() {
  const site = '<footer><div class="cols"><a href="index.html">Home</a></div></footer>';
  const tiny = '<footer><p>© 2026 TransformerPath</p></footer>';
  const cases = [
    ['one site footer', '<main></main>' + site, 1],
    ['two site footers', site + site, 2],
    ['site footer plus copyright footer', site + tiny, 1],
    ['footer markup inside a script', '<script>var x = "' + site.replace(/"/g, '\\"') + '";</script>' + site, 1],
    ['no footer', '<main></main>', 0],
  ];
  const failed = [];
  for (const [name, html, expected] of cases) {
    const got = siteFooterCount(html);
    if (got !== expected) failed.push(name + ' (expected ' + expected + ', got ' + got + ')');
  }
  if (failed.length) {
    console.error('site footer self-test failed:');
    failed.forEach((line) => console.error('  ' + line));
    process.exit(1);
  }
}

function main() {
  selfTest();
  const root = process.cwd();
  const files = walk(root).sort();
  const problems = [];
  for (const file of files) {
    const count = siteFooterCount(fs.readFileSync(file, 'utf8'));
    if (count > 1) problems.push(path.relative(root, file) + ' has ' + count + ' site footers');
  }
  if (problems.length) {
    console.error('Site footer: ' + problems.length + ' page(s) include it more than once');
    problems.forEach((line) => console.error('  ' + line));
    process.exit(1);
  }
  console.log('Site footer OK — ' + files.length + ' page(s), at most one site footer each.');
}

main();
