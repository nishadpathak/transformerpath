#!/usr/bin/env node
/* Strip duplicate tp-nav.css <link> tags that sit inside <header>,
   replace footer H2 column labels, and add skip-to-content + main ids.
   Skips iCloud conflict copies (` 2.html`). Does not invent content. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SKIP_DIR = new Set(['.git', 'node_modules', '.cursor', 'admin']);
const ICLOUD = / \d+\.[^/]+$/;

const LINK_IN_HEADER = /(<header[^>]*>)\s*<link\s+rel="stylesheet"\s+href="(?:\.?\.?\/)?(?:tp-nav\.css|\/tp-nav\.css)\?v=\d+"\s*>\s*/gi;
const FOOTER_H2 = /<h2>(INTELLIGENCE|INDUSTRY|ENGINEERING|LEARN|BUSINESS|COMPANY|CONTACT)<\/h2>/g;
const SKIP_LINK = '<a class="skip-link" href="#main">Skip to content</a>\n';

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = path.join(dir, name);
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && name.endsWith('.html') && !ICLOUD.test(name)) out.push(p);
  }
}

const files = [];
walk(ROOT, files);

let css = 0, foot = 0, skip = 0, main = 0, touched = 0;
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const orig = html;

  const beforeCss = html;
  html = html.replace(LINK_IN_HEADER, '$1\n  ');
  if (html !== beforeCss) css++;

  const beforeFoot = html;
  html = html.replace(FOOTER_H2, '<p class="footer-col-label">$1</p>');
  if (html !== beforeFoot) foot++;

  if (!html.includes('class="skip-link"') && /<header>/.test(html)) {
    html = html.replace(/<header>/, SKIP_LINK + '<header>');
    skip++;
  }

  if (/<main\b/.test(html) && !/<main[^>]*\bid\s*=/.test(html)) {
    html = html.replace(/<main\b/, '<main id="main" tabindex="-1"');
    main++;
  }

  if (html !== orig) {
    fs.writeFileSync(file, html);
    touched++;
  }
}

console.log('strip-header-nav-css: files=' + files.length +
  ' touched=' + touched +
  ' css-in-header=' + css +
  ' footer-h2=' + foot +
  ' skip-link=' + skip +
  ' main-id=' + main);
