#!/usr/bin/env node
/* scripts/capture-git-state.js — snapshot git HEAD and porcelain BEFORE
 * generators rewrite the work tree. build-release-provenance.js reads this
 * so a production deploy can fail on a dirty source tree without treating
 * the build's own output as dirt.
 */
'use strict';
const fs = require('fs');
const { execSync } = require('child_process');

function git(args) {
  return execSync('git ' + args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

let head = '';
let porcelain = '';
let error = '';
try {
  head = git('rev-parse HEAD');
  porcelain = git('status --porcelain');
} catch (e) {
  error = String(e && e.message || e);
}

const state = {
  head: head,
  porcelain: porcelain,
  git_dirty: porcelain.length > 0,
  captured_at: new Date().toISOString(),
  error: error
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/.release-git-state.json', JSON.stringify(state, null, 2) + '\n');
console.log('git state captured: head=' + (head || 'none').slice(0, 12) + ' dirty=' + state.git_dirty);
