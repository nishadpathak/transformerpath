#!/usr/bin/env node
/* build-header-consistency.js
 *
 * Every public page gets the same site chrome as the homepage:
 * _partials/header.html (root-relative on nested pages via abs()).
 *
 * Replaces skip-link + the first site <header> (tpnav / tp-site-chrome).
 * Leaves in-page heroes (<header class="mc-hero">) alone.
 *
 * Run: node build-header-consistency.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'archive', '_private', 'transformerpath-site', 'dist', 'node_modules',
  'functions', '_partials', 'Transformer Equipments', 'admin', 'tests',
]);
const SKIP_FILES = new Set([
  'admin.html',
  'offline.html',
  'claim.html',
  'tutorial.html',
  'tx-design-masterclass.html',
]);

const abs = (html) => html.replace(
  /(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g,
  '$1="/$2"'
);

const REL = fs.readFileSync('_partials/header.html', 'utf8').trim();
const ABS = abs(REL);

function walk(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function isNested(file) {
  return file.split(path.sep).length > 1 && file !== path.basename(file);
}

function locateSiteChrome(html) {
  const skipRe = /<a\s+class="skip-link"[^>]*>[\s\S]*?<\/a>/;
  const skipMatch = skipRe.exec(html);
  let pos = html.indexOf('<header', skipMatch ? skipMatch.index : 0);
  while (pos !== -1) {
    const tagEnd = html.indexOf('>', pos);
    if (tagEnd < 0) break;
    const tag = html.slice(pos, tagEnd + 1);
    let close = html.indexOf('</header>', tagEnd);
    if (close < 0) {
      /* search.html (and similar) once lost </header> mid-tag: defer></scr<div */
      const broken = html.slice(tagEnd).search(/<\/scr(?!ipt)/);
      if (broken < 0) break;
      close = tagEnd + broken;
      const inner = html.slice(tagEnd + 1, close);
      const isHero = /\bmc-hero\b|\bac-hero\b/.test(tag);
      const isSite = !isHero && (/\btpnav\b/.test(inner) || /class="container nav"/.test(inner));
      if (isSite) {
        const start = skipMatch && skipMatch.index < pos ? skipMatch.index : pos;
        return { start, end: close + 5 };
      }
      break;
    }
    const inner = html.slice(tagEnd + 1, close);
    const isHero = /\bmc-hero\b|\bac-hero\b/.test(tag);
    const isSite = !isHero && (
      /\btp-site-chrome\b|\btp-sitehead\b/.test(tag) ||
      /\btpnav\b/.test(inner) ||
      /\bmainNav\b/.test(inner) ||
      /class="container nav"/.test(inner)
    );
    if (isSite) {
      const start = skipMatch && skipMatch.index < pos ? skipMatch.index : pos;
      return { start, end: close + '</header>'.length };
    }
    pos = html.indexOf('<header', close);
  }
  return null;
}

function ensureTpNavCss(html) {
  if (/tp-nav\.css/.test(html)) return html;
  const style = html.match(/href="((?:[^"]*\/)?)style\.css(?:\?v=\d+)?"/);
  const prefix = style ? style[1] : '/';
  const link = '<link rel="stylesheet" href="' + prefix + 'tp-nav.css?v=14">\n';
  if (html.includes('</head>')) return html.replace('</head>', link + '</head>');
  return html;
}

function dedupeChromeScripts(html) {
  let nav = 0;
  let pwa = 0;
  return html.replace(/<script src="[^"]*tp-(?:nav|pwa)\.js(?:\?v=\d+)?"[^>]*><\/script>\s*/g, (m) => {
    if (m.indexOf('tp-nav.js') !== -1) {
      nav += 1;
      return nav > 1 ? '' : m;
    }
    pwa += 1;
    return pwa > 1 ? '' : m;
  });
}

function looksCanonical(html) {
  return /class="tpnav"/.test(html)
    && /Industry Map/.test(html)
    && /href="(?:\/)?pricing\.html"/.test(html)
    && /id="theme-toggle"/.test(html)
    && /data-tp-account/.test(html);
}

function main() {
  const files = walk('.').sort();
  let swapped = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  files.forEach((file) => {
    const base = path.basename(file);
    if (SKIP_FILES.has(base)) { skipped += 1; return; }

    const html = fs.readFileSync(file, 'utf8');
    const loc = locateSiteChrome(html);
    if (!loc) { skipped += 1; return; }

    const nextHead = isNested(file) ? ABS : REL;
    let out = html.slice(0, loc.start) + nextHead + html.slice(loc.end).replace(/^\s*\n/, '\n');
    out = ensureTpNavCss(out);
    out = dedupeChromeScripts(out);

    if (out === html) { unchanged += 1; return; }
    fs.writeFileSync(file, out);

    const post = fs.readFileSync(file, 'utf8');
    if (looksCanonical(post)) {
      swapped += 1;
    } else {
      failed += 1;
      failures.push(file);
    }
  });

  console.log('header-consistency: ' + swapped + ' updated, ' + unchanged + ' already canonical, ' + skipped + ' skipped, ' + failed + ' failed.');
  if (failures.length) {
    failures.forEach((f) => console.error('!! ' + f));
    process.exit(1);
  }
}

main();
