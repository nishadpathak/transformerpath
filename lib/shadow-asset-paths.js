#!/usr/bin/env node
/* Root HTML files that share a name with a directory are served at /name/
 * as well as /name.html. A relative href then requests /name/intel.html
 * or /name/accessories/<slug>/ and 404s. Rewrite every internal href and
 * src on those pages to a root-absolute path. Parent-relative links on
 * genuinely nested pages are left alone.
 */
'use strict';
const fs = require('fs');
const path = require('path');

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

function isBareRelative(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed || /^(?:https?:|\/\/|data:|mailto:|tel:|javascript:|#|\?|\/)/i.test(trimmed)) return false;
  if (trimmed.startsWith('../')) return false;
  return true;
}

function fixUrl(url) {
  if (!isBareRelative(url)) return url;
  return '/' + String(url).trim().replace(/^\.\//, '');
}

function rootAbsoluteScriptUrls(html) {
  return String(html).replace(
    /(location(?:\.href)?\s*=\s*|location\.(?:assign|replace)\(\s*|fetch\(\s*|action\s*=\s*|return\s+)(["'])([^"']+)\2/gi,
    function (full, lead, quote, url) {
      if (!isBareRelative(url)) return full;
      if (!/\.html(?:[?#]|$)/i.test(url) && !/^data\//.test(url)) return full;
      return lead + quote + fixUrl(url) + quote;
    }
  );
}

function rootAbsoluteAssets(html) {
  let out = rootAbsoluteScriptUrls(html);
  out = out.replace(/(\s(?:href|src|poster)\s*=\s*["'])([^"']+)(["'])/gi, function (_m, a, url, c) {
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

module.exports = { rootAbsoluteAssets, isShadowPage, fixUrl, isBareRelative };
