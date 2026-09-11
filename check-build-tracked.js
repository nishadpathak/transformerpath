#!/usr/bin/env node
/* check-build-tracked.js — fail the build when a build step, or a local module a
 * build step requires, is not tracked by git.
 *
 * WHY THIS EXISTS
 * ---------------
 * The build command keeps gaining steps that are never committed: 15 scripts were
 * untracked on 6 Sept, and by 11 Sept 11 more had joined them (build-services.js
 * onward). A folder-upload deploy builds from the working tree, so it succeeds —
 * and in doing so hides that the committed repository can no longer build the
 * site. The first Git-based deploy, or the first restore from a clone, then dies
 * part-way through the build. Both times that was step 7.
 *
 * This gate runs FIRST in the build command, so that failure is immediate and
 * names the exact files instead of surfacing as "Cannot find module" 7 steps in.
 *
 * WHAT IT CHECKS
 *   - every `node <script>` step in netlify.toml's build command exists and is tracked
 *   - every local module those scripts require (require('./...'), recursively) is tracked
 * It WARNS, without failing, when a tracked build file has uncommitted changes:
 * a Git deploy builds the committed version, not the local one.
 *
 * ESCAPE HATCH (emergency folder deploy only):
 *   ALLOW_UNTRACKED_BUILD=1 node check-build-tracked.js
 * Outside a git work tree (an exported copy of the folder) it warns and passes,
 * because tracked-ness cannot be determined there.
 *
 * Run: node check-build-tracked.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function git(args) {
  return execSync('git ' + args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}
const posix = (p) => p.split(path.sep).join('/');
const quote = (p) => (/[\s'"]/.test(p) ? '"' + p + '"' : p);

try {
  git('rev-parse --is-inside-work-tree');
} catch (e) {
  console.warn('check-build-tracked: not inside a git work tree — cannot verify tracked files, skipping.');
  process.exit(0);
}

const toml = fs.readFileSync('netlify.toml', 'utf8');
const cmdMatch = toml.match(/command\s*=\s*"([^"]+)"/);
if (!cmdMatch) {
  console.error('check-build-tracked: no build command found in netlify.toml');
  process.exit(1);
}

const steps = [...new Set(
  cmdMatch[1].split('&&')
    .map((s) => s.trim())
    .filter((s) => /^node\s+/.test(s))
    .map((s) => posix(path.normalize(s.replace(/^node\s+/, '').split(/\s+/)[0])))
)];

// Local modules required by a file, resolved the way Node would.
function localRequires(file) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
  const found = [];
  const re = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
  let r;
  while ((r = re.exec(src))) {
    // Skip mentions inside comments — this file's own header cites require('./...').
    const lineStart = src.lastIndexOf('\n', r.index) + 1;
    const prefix = src.slice(lineStart, r.index);
    if (/^\s*(\*|\/\*|\/\/)/.test(prefix) || /(^|[^:])\/\//.test(prefix)) continue;
    if (!/[A-Za-z0-9]/.test(path.basename(r[1]))) continue;
    let p = path.normalize(path.join(path.dirname(file), r[1]));
    if (!/\.(c?js|mjs|json)$/.test(p)) {
      if (fs.existsSync(p + '.js')) p += '.js';
      else if (fs.existsSync(path.join(p, 'index.js'))) p = path.join(p, 'index.js');
    }
    found.push(posix(p));
  }
  return found;
}

// Walk steps and everything they pull in.
const via = new Map();
const queue = steps.map((s) => [s, 'build step']);
while (queue.length) {
  const [file, reason] = queue.shift();
  if (via.has(file)) continue;
  via.set(file, reason);
  if (/\.(c?js|mjs)$/.test(file)) {
    for (const dep of localRequires(file)) queue.push([dep, 'required by ' + file]);
  }
}

const tracked = new Set(git('ls-files -z').split('\0').filter(Boolean));
let modified = new Set();
try { modified = new Set(git('diff --name-only -z HEAD').split('\0').filter(Boolean)); } catch (e) { /* no HEAD yet */ }

const missing = [];
const untracked = [];
const dirty = [];
for (const [file, reason] of via) {
  if (!fs.existsSync(file)) missing.push([file, reason]);
  else if (!tracked.has(file)) untracked.push([file, reason]);
  else if (modified.has(file)) dirty.push(file);
}

const moduleCount = [...via.keys()].filter((f) => !steps.includes(f)).length;
console.log('check-build-tracked: ' + steps.length + ' build steps, ' + moduleCount + ' local modules they require');

if (dirty.length) {
  console.warn('  note: ' + dirty.length + ' tracked build file(s) have uncommitted changes — a Git deploy would build the committed version:');
  dirty.slice(0, 10).forEach((f) => console.warn('    ~ ' + f));
  if (dirty.length > 10) console.warn('    ... and ' + (dirty.length - 10) + ' more');
}

if (!missing.length && !untracked.length) {
  console.log('BUILD TRACKED OK — the committed repository can run every build step.');
  process.exit(0);
}

const report = (label, list) => {
  if (!list.length) return;
  console.error('  ' + label + ' (' + list.length + '):');
  list.forEach(([f, reason]) => console.error('    ' + f + '   (' + reason + ')'));
};

if (process.env.ALLOW_UNTRACKED_BUILD === '1') {
  console.warn('BUILD TRACKED CHECK BYPASSED (ALLOW_UNTRACKED_BUILD=1) — a clone of this repo will NOT build:');
  report('missing', missing);
  report('untracked', untracked);
  process.exit(0);
}

console.error('BUILD TRACKED CHECK FAILED — a clone of this repository cannot build the site.');
report('missing from disk', missing);
report('not tracked by git', untracked);
if (untracked.length) console.error('\n  fix:  git add ' + untracked.map(([f]) => quote(f)).join(' '));
process.exit(1);
