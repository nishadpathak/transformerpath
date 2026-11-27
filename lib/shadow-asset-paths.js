#!/usr/bin/env node
/* Root HTML files that share a name with a directory are served at /name/
 * as well as /name.html. A relative stylesheet then requests /name/style.css
 * and 404s. Rewrite CSS, JS, and image URLs on those pages to root-absolute
 * paths. Navigation links are left as they are.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ASSET = /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|mp4|webm|webmanifest)(?:[?#]|$)/i;

/* /pricing/ and /claim/ are 200 rewrites onto these files, so the browser URL
 * is a directory even though no matching folder exists. */
const REWRITE_DIRECTORY_PAGES = new Set(['pricing.html', 'claim.html']);

function isShadowPage(file) {
  const base = path.basename(file);
  if (!base.endsWith('.html')) return false;
  const dir = path.dirname(file);
  if (dir !== '.' && dir !== '') return false;
  if (REWRITE_DIRECTORY_PAGES.has(base)) return true;
  const folder = base.slice(0, -5);
  try { return fs.statSync(folder).isDirectory(); } catch (e) { return false; }
}

function fixUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed || /^(?:https?:|\/\/|data:|mailto:|tel:|javascript:|#|\/)/i.test(trimmed)) return url;
  if (trimmed.startsWith('../')) return url;
  const noDot = trimmed.replace(/^\.\//, '');
  const pathOnly = noDot.split('#')[0].split('?')[0];
  if (!ASSET.test(pathOnly)) return url;
  return '/' + noDot;
}

function rootAbsoluteAssets(html) {
  let out = String(html).replace(/(\s(?:href|src|poster)\s*=\s*["'])([^"']+)(["'])/gi, function (_m, a, url, c) {
    return a + fixUrl(url) + c;
  });
  out = out.replace(/(\ssrcset\s*=\s*["'])([^"']+)(["'])/gi, function (_m, a, value, c) {
    const next = value.split(',').map(function (part) {
      const lead = (part.match(/^\s*/) || [''])[0];
      const bits = part.trim().split(/\s+/);
      if (!bits[0]) return part;
      bits[0] = fixUrl(bits[0]);
      return lead + bits.join(' ');
    }).join(',');
    return a + next + c;
  });
  return out;
}

module.exports = { rootAbsoluteAssets, isShadowPage, fixUrl };
