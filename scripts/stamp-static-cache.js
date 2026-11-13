#!/usr/bin/env node
/* Point published CSS and JS URLs at a content hash.
 *
 * netlify.toml gives those files a year-long immutable Cache-Control.
 * The query is the hash of the file bytes, so a changed file is a new URL.
 * sw.js is rewritten after the other hashes are known, and it stays
 * revalidated (see the /sw.js header) so a new worker can install.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DIST = process.argv[2] || 'dist';

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}

function hashFile(abs) {
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 10);
}

const hashes = {};
function hashRel(rel) {
  const abs = path.join(DIST, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return '';
  if (!hashes[rel]) hashes[rel] = hashFile(abs);
  return hashes[rel];
}

function resolveRel(fromRel, url) {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean || /^(?:https?:|\/\/|data:)/i.test(clean)) return '';
  if (clean.charAt(0) === '/') return clean.slice(1);
  const dir = fromRel.indexOf('/') === -1 ? '' : fromRel.replace(/[^/]+$/, '');
  const rel = path.posix.normalize(dir + clean);
  if (rel.startsWith('..')) return '';
  return rel;
}

function rewrite(text, fromRel, skipSelf) {
  return text.replace(/(["'])([^"']+\.(?:css|js))(?:\?[^"']*)?\1/gi, function (full, q, url) {
    const rel = resolveRel(fromRel, url);
    if (!rel) return full;
    if (skipSelf && rel === fromRel) return full;
    const h = hashRel(rel);
    if (!h) return full;
    const clean = url.split('#')[0].split('?')[0];
    return q + clean + '?v=' + h + q;
  });
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('stamp-static-cache: missing ' + DIST);
    process.exit(1);
  }
  const files = walk(DIST, []);
  files.forEach(function (abs) {
    if (!/\.(?:css|js)$/i.test(abs)) return;
    if (path.basename(abs) === 'sw.js') return;
    hashRel(path.relative(DIST, abs).split(path.sep).join('/'));
  });

  /* style.css @imports provenance-badge.css. Hash that target, then rewrite
   * the import, then rehash the stylesheet so HTML does not pin the pre-rewrite bytes. */
  files.forEach(function (abs) {
    if (!/\.css$/i.test(abs)) return;
    const rel = path.relative(DIST, abs).split(path.sep).join('/');
    const before = fs.readFileSync(abs, 'utf8');
    const next = rewrite(before, rel, true);
    if (next === before) return;
    fs.writeFileSync(abs, next);
    delete hashes[rel];
    hashRel(rel);
  });

  const swAbs = path.join(DIST, 'sw.js');
  if (fs.existsSync(swAbs)) {
    const rel = 'sw.js';
    const next = rewrite(fs.readFileSync(swAbs, 'utf8'), rel, true);
    if (next !== fs.readFileSync(swAbs, 'utf8')) fs.writeFileSync(swAbs, next);
    hashes[rel] = hashFile(swAbs);
  }

  let touched = 0;
  files.forEach(function (abs) {
    if (!/\.(?:html|webmanifest)$/i.test(abs)) return;
    const rel = path.relative(DIST, abs).split(path.sep).join('/');
    const before = fs.readFileSync(abs, 'utf8');
    const next = rewrite(before, rel, false);
    if (next !== before) {
      fs.writeFileSync(abs, next);
      touched++;
    }
  });
  console.log('stamp-static-cache: hashed ' + Object.keys(hashes).length + ' assets, rewrote ' + touched + ' pages');
}

if (require.main === module) main();

module.exports = { rewrite, hashFile };
