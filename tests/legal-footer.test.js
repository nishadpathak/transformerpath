#!/usr/bin/env node
/* Privacy, Terms and Contact are in every page footer, and /privacy-policy 301s. */
'use strict';

const fs = require('fs');
const path = require('path');
const legal = require('../lib/legal-footer');

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('FAIL ' + msg); }
  else console.log('ok ' + msg);
}

const bare = '<!DOCTYPE html><html><head></head><body><h1>Hi</h1></body></html>';
const withFooter = legal.ensureLegalFooter(bare);
check(withFooter.indexOf('href="/privacy.html">Privacy</a>') !== -1, 'a page without a footer gains Privacy');
check(withFooter.indexOf('href="/terms.html">Terms</a>') !== -1, 'a page without a footer gains Terms');
check(withFooter.indexOf('href="/contact.html">Contact</a>') !== -1, 'a page without a footer gains Contact');
check((withFooter.match(/<footer\b/gi) || []).length === 1, 'the added footer is the only footer');
check(legal.ensureLegalFooter(withFooter) === withFooter, 'a second pass does not add another footer');

const partial = '<p>Just a snippet</p>';
check(legal.ensureLegalFooter(partial) === partial, 'a fragment with no body is left alone');

const existing = '<html><body><footer><a href="privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="contact.html">Contact</a></footer></body></html>';
check(legal.ensureLegalFooter(existing) === existing, 'an existing legal footer is not rewritten');

const thin = '<html><body><footer><div class="container"><p>&#169; 2026 TransformerPath</p></div></footer></body></html>';
const filled = legal.ensureLegalFooter(thin);
check((filled.match(/<footer\b/gi) || []).length === 1, 'a copyright footer stays a single footer');
check(filled.indexOf('href="/privacy.html"') !== -1 && filled.indexOf('href="/terms.html"') !== -1 && filled.indexOf('href="/contact.html"') !== -1, 'the copyright footer gains the three links');
check(filled.indexOf('</nav></div></footer>') !== -1, 'the added links sit inside the footer container');

const toml = fs.readFileSync('netlify.toml', 'utf8');
const redirects = fs.readFileSync('_redirects', 'utf8');
check(toml.indexOf('from = "/privacy-policy"\n  to = "/privacy"\n  status = 301') !== -1, 'netlify.toml 301s /privacy-policy to /privacy');
check(toml.indexOf('from = "/privacy-policy/"\n  to = "/privacy"\n  status = 301') !== -1, 'netlify.toml 301s /privacy-policy/ to /privacy');
check(redirects.indexOf('/privacy-policy     /privacy     301') !== -1, '_redirects 301s /privacy-policy');
check(redirects.indexOf('/privacy-policy.html     /privacy     301') !== -1, '_redirects 301s /privacy-policy.html');
check(fs.readFileSync('build-topic-hubs.js', 'utf8').indexOf('href="/privacy.html"') !== -1, 'topic hub builder keeps the Privacy link');

const SKIP = new Set(['.git', 'node_modules', 'dist', 'archive', '_private', 'transformerpath-site', 'transformerpath']);
function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const missing = [];
walk('.', []).forEach(function (file) {
  const html = fs.readFileSync(file, 'utf8');
  if (!/<\/body>/i.test(html)) return;
  const spans = legal.footerSpans(html);
  const combined = spans.map(function (span) { return span.html; }).join('\n');
  const gaps = legal.missingLinks(combined);
  if (!spans.length || gaps.length) missing.push(file + (gaps.length ? ' missing ' + gaps.map(function (g) { return g.label; }).join(',') : ' has no footer'));
});
check(missing.length === 0, 'every page footer links Privacy, Terms and Contact');
if (missing.length) missing.slice(0, 20).forEach(function (line) { console.error('  ' + line); });

if (failed) {
  console.error(failed + ' legal footer check(s) failed');
  process.exit(1);
}
console.log('legal footer checks passed');
