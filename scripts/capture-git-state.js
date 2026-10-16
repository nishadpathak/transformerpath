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

/* write-supabase-config.js and write-google-auth-config.js rewrite these
 * files from public env before the snapshot. Empty in git, filled on a
 * configured production build. Those rewrites are not source dirt.
 * google-auth-config.js never contains SESSION_SECRET. */
function filterPorcelain(porcelain) {
  return String(porcelain || '').split('\n').filter(function (line) {
    const text = line.trim();
    if (!text) return false;
    return !/(?:^|\s)(?:supabase-config|google-auth-config)\.js$/.test(text);
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
