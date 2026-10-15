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

/* write-supabase-config.js rewrites this file from public env before the
 * snapshot. Empty in git, filled on a configured production build. That
 * rewrite is not source dirt. */
function filterPorcelain(porcelain) {
  return String(porcelain || '').split('\n').filter(function (line) {
    if (!line) return false;
    const file = line.slice(3).trim();
    return file !== 'supabase-config.js';
  }).join('\n');
}

function capture() {
  let head = '';
  let porcelain = '';
  let error = '';
  try {
    head = git('rev-parse HEAD');
    porcelain = filterPorcelain(git('status --porcelain'));
  } catch (e) {
    error = String(e && e.message || e);
  }
  return {
    head: head,
    porcelain: porcelain,
    git_dirty: porcelain.length > 0,
    captured_at: new Date().toISOString(),
    error: error
  };
}

if (require.main === module) {
  const state = capture();

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/.release-git-state.json', JSON.stringify(state, null, 2) + '\n');
  console.log('git state captured: head=' + (state.head || 'none').slice(0, 12) + ' dirty=' + state.git_dirty);
}

module.exports = { filterPorcelain: filterPorcelain, capture: capture };
