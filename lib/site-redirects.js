'use strict';
/* Read published 301s from netlify.toml and _redirects.
 * The first rule for a path wins, matching Netlify. */
const fs = require('fs');
const path = require('path');

function loadRules(root) {
  const rules = [];
  const tomlPath = path.join(root, 'netlify.toml');
  if (fs.existsSync(tomlPath)) {
    fs.readFileSync(tomlPath, 'utf8').split('[[redirects]]').slice(1).forEach(function (block) {
      const from = (block.match(/\bfrom\s*=\s*"([^"]+)"/) || [])[1];
      const to = (block.match(/\bto\s*=\s*"([^"]+)"/) || [])[1];
      const status = (block.match(/\bstatus\s*=\s*(\d+)/) || [])[1];
      if (from && to && status) rules.push({ from: from, to: to, status: Number(status), source: 'netlify.toml' });
    });
  }
  const redirectsPath = path.join(root, '_redirects');
  if (fs.existsSync(redirectsPath)) {
    fs.readFileSync(redirectsPath, 'utf8').split('\n').forEach(function (line) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === '#') return;
      const parts = trimmed.split(/\s+/);
      if (parts.length < 3) return;
      const status = Number(parts[parts.length - 1]);
      if (!status) return;
      rules.push({ from: parts[0], to: parts[1], status: status, source: '_redirects' });
    });
  }
  return rules;
}

function permanentMap(root) {
  const map = new Map();
  loadRules(root).forEach(function (rule) {
    if (rule.status !== 301) return;
    if (!map.has(rule.from)) map.set(rule.from, rule.to);
  });
  return map;
}

module.exports = { loadRules: loadRules, permanentMap: permanentMap };
