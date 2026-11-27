#!/usr/bin/env node
/* Remove Transformers Magazine (Merit Media) links and credits.
 * A fact whose only URL is one of those domains is dropped. A fact that also
 * cites another public source keeps that source and loses the magazine link.
 * Run: node scripts/strip-competitor-magazine.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { BLOCKED_SOURCE_HOSTS, isBlockedSource } = require('../lib/blocked-sources');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'vendor']);
const TEXT = /\.(html|js|json|md|txt|ics|xml|css|yml|yaml|toml|csv)$/i;
const DOMAIN = new RegExp(
  'https?:\\/\\/(?:[a-z0-9.-]+\\.)?(?:' + BLOCKED_SOURCE_HOSTS.map(function (host) {
    return host.replace(/\./g, '\\.');
  }).join('|') + ')(?:\\/[^\\s"\'<>\\\\]*)?',
  'gi'
);

function hasDomain(value) {
  const text = String(value || '').toLowerCase();
  return BLOCKED_SOURCE_HOSTS.some(function (host) { return text.indexOf(host) !== -1; });
}

function otherHttp(value) {
  const urls = String(value || '').match(/https?:\/\/[^\s"'<>\\]+/gi) || [];
  return urls.some(function (url) { return !isBlockedSource(url); });
}

function stripHtml(html) {
  let out = html.replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, function (li) {
    if (!hasDomain(li)) return li;
    if (!otherHttp(li)) return '';
    return li
      .replace(/<a\b[^>]*href=["']https?:\/\/[^"']*transformers?-magazine\.com[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(DOMAIN, '');
  });
  out = out.replace(/<a\b[^>]*href=["']https?:\/\/[^"']*transformers?-magazine\.com[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
  out = out.replace(DOMAIN, '');
  out = out.replace(/\s*\((?:Transformers Magazine|Transformer Magazine)\)/g, '');
  out = out.replace(/(?:Transformers Magazine|Transformer Magazine)\s*[·•]\s*/g, '');
  out = out.replace(/Source:\s*(?:Transformers Magazine|Transformer Magazine)/gi, 'Source');
  return out;
}

function magazineOnly(obj) {
  const urls = [];
  (function walk(value) {
    if (typeof value === 'string' && /^https?:/i.test(value.trim())) urls.push(value.trim());
    else if (value && typeof value === 'object') Object.keys(value).forEach(function (key) { walk(value[key]); });
  })(obj);
  if (!urls.length) return hasDomain(JSON.stringify(obj));
  return urls.every(function (url) { return isBlockedSource(url); });
}

function dropRecord(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (item.id === 'med:transformers-magazine') return true;
  const news = item.title || item.headline || (item.url && item.src);
  if (!news) return false;
  return magazineOnly(item);
}

function writeJson(data, raw) {
  const pretty = raw.indexOf('\n') !== -1;
  let out = JSON.stringify(data, null, pretty ? 2 : 0);
  if (raw.endsWith('\n') && !out.endsWith('\n')) out += '\n';
  return out;
}

function cleanJson(value) {
  if (Array.isArray(value)) {
    const next = [];
    value.forEach(function (item) {
      if (dropRecord(item)) return;
      const cleaned = cleanJson(item);
      if (cleaned !== undefined) next.push(cleaned);
    });
    return next;
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = cleanJson(value[key]);
    });
    return out;
  }
  if (typeof value === 'string') {
    if (!hasDomain(value) && !/\((?:Transformers Magazine|Transformer Magazine)\)/.test(value)) return value;
    if (/^https?:/i.test(value.trim()) && !otherHttp(value)) return '';
    return value.replace(DOMAIN, '').replace(/\s*\((?:Transformers Magazine|Transformer Magazine)\)/g, '').replace(/(?:Transformers Magazine|Transformer Magazine)\s*[·•]\s*/g, '');
  }
  return value;
}

function walk(dir, files) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') && ent.name !== '.github') continue;
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (TEXT.test(ent.name)) files.push(p);
  }
  return files;
}

const allow = new Set([
  path.join(ROOT, 'lib', 'blocked-sources.js'),
  path.join(ROOT, 'tests', 'no-competitor-magazine.js'),
  path.join(ROOT, 'scripts', 'strip-competitor-magazine.js')
]);

let changed = 0;
walk(ROOT, []).forEach(function (file) {
  if (allow.has(file)) return;
  const before = fs.readFileSync(file, 'utf8');
  if (!hasDomain(before) && !/\((?:Transformers Magazine|Transformer Magazine)\)/.test(before)) return;
  let after;
  if (file.endsWith('.json')) {
    try {
      after = writeJson(cleanJson(JSON.parse(before)), before);
    } catch (e) {
      after = stripHtml(before);
    }
  } else {
    after = stripHtml(before);
  }
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log(path.relative(ROOT, file));
  }
});
console.log('updated', changed);
