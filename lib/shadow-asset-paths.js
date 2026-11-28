#!/usr/bin/env node
/* Root HTML files can also be served at /name/. A relative href then
 * requests /name/intel.html and may 404. The publish build normalizes
 * root-file links and assets; authored directory-shadow pages also use
 * these helpers in source-level checks. Nested pages keep local links.
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
  /* Template and concatenation holes are filled at runtime. Prefixing them
   * turns https:// and data: into /https:// and /data:. */
  if (!trimmed || trimmed.indexOf('${') !== -1 || trimmed.indexOf('+') !== -1) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\?|\/)/i.test(trimmed)) return false;
  if (trimmed.startsWith('../')) return false;
  return true;
}

function rootHref(url) {
  if (!isBareRelative(url)) return String(url == null ? '' : url);
  return '/' + String(url).trim().replace(/^\.\//, '');
}

function fixUrl(url) {
  if (!isBareRelative(url)) return url;
  return rootHref(url);
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
  out = out.replace(/(\s(?:href|src|poster|action|formaction)\s*=\s*["'])([^"']+)(["'])/gi, function (_m, a, url, c) {
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

module.exports = { rootAbsoluteAssets, isShadowPage, fixUrl, isBareRelative, rootHref };
