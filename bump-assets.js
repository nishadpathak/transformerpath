#!/usr/bin/env node
/* Stamp asset cache-busters across the served site so a CSS/JS/theme change is
 * never served stale by the browser HTTP cache or the service worker.
 *
 * Browsers cache by full URL (including the ?v= query). If we edit style.css but
 * leave href="style.css?v=5" unchanged, returning visitors — especially on Chrome
 * with the service worker's stale-while-revalidate — keep getting the old sheet
 * and the site looks "not updated". Bump data/config.json -> assets.* and re-run
 * this (part of the Netlify build) and every page that references the asset gets
 * the new query, forcing a fresh fetch.
 *
 * Run after the build chain: `node bump-assets.js`
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CFG = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
const A = CFG.assets || {};
const CSS_V = A.css || 1;
const JS_V = A.js || 1;
const THEME_V = A.theme || 1;
const SW_CACHE = A.sw || 'transformerpath-v1';

const SKIP = new Set(['archive', '_private', 'transformerpath-site', 'node_modules', '.git']);

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = walk('.');
let touched = 0, htmlFiles = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  // style.css?v=N, style.css (no query) on generated pages
  s = s.replace(/style\.css\?v=\d+/g, 'style.css?v=' + CSS_V);
  // tp-theme.css?v=N
  s = s.replace(/tp-theme\.css\?v=\d+/g, 'tp-theme.css?v=' + THEME_V);
  // JS assets: analytics.js, course-gate.js, supabase.js, etc.
  s = s.replace(/(analytics\.js|course-gate\.js|sitemap\.js|material-latest\.js)\?v=\d+/g, '$1?v=' + JS_V);
  s = s.replace(/(<script src="material-latest\.js)([">])/g, '$1?v=' + JS_V + '$2');
  if (s !== before) {
    fs.writeFileSync(f, s);
    touched++;
    if (f.endsWith('.html')) htmlFiles++;
  }
}

// Update sw.js cache name so the old service worker is replaced (not served stale).
if (fs.existsSync('sw.js')) {
  let sw = fs.readFileSync('sw.js', 'utf8');
  const swBefore = sw;
  sw = sw.replace(/const CACHE = '[^']*';/, "const CACHE = '" + SW_CACHE + "';");
  // Also update any CORE asset string to the versioned filename so precache is fresh.
  sw = sw.replace(/'style\.css(?!\?v=)'/g, "'style.css?v=" + CSS_V + "'");
  if (sw !== swBefore) fs.writeFileSync('sw.js', sw);
}

console.log('bump-assets: stamped ' + touched + ' files (css?v=' + CSS_V + ', js?v=' + JS_V + ', theme?v=' + THEME_V + ', sw=' + SW_CACHE + ')');
