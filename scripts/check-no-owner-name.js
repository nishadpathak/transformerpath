#!/usr/bin/env node
/* Fail if the owner name is in tracked text, or if public HTML
 * still offers a personal service. Binary files (NUL bytes) are skipped.
 * github.com owner-repo URLs are the only allowed exception.
 *
 * Run: node scripts/check-no-owner-name.js
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nameRe = new RegExp('\\b' + 'nis' + 'had' + '\\b|' + 'pat' + 'hak' + '|\\b' + 'nm' + 'p' + '\\b', 'i');
const allowRe = new RegExp('https?://github\\.com/' + 'nis' + 'had' + 'pat' + 'hak' + '\\b[^\\s)\"\'<>]*', 'gi');
const phraseRe = new RegExp(
  ['web' + 'inar', 'consult' + 'ing', 'master' + 'class', 'onboarding ' + 'session', 'capstone ' + 'review'].join('|'),
  'i'
);
const skipPhrase = new Set(['tests', 'docs', 'node_modules', '.git', 'transformerpath', 'archive', '_private', 'functions']);

function stripAllowed(text) {
  return text.replace(allowRe, ' ');
}

function maskAbsoluteUrls(text) {
  return text.replace(/https?:\/\/[^\s"'<>]+/gi, function (url) {
    return url.replace(/./g, ' ');
  });
}

function relOf(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function isPublicHtml(rel) {
  if (!/\.html?$/i.test(rel)) return false;
  const parts = rel.split('/');
  if (parts[0] === 'dist') parts.shift();
  return !parts.some(function (part) { return skipPhrase.has(part); });
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

const problems = [];

function report(rel, text, index, why) {
  const line = lineOf(text, index);
  const snippet = text.split('\n')[line - 1].trim().slice(0, 160);
  problems.push(rel + ':' + line + ' ' + why + (snippet ? ' — ' + snippet : ''));
}

function scanText(rel, text) {
  const scrubbed = stripAllowed(text);
  const nameHit = nameRe.exec(scrubbed);
  nameRe.lastIndex = 0;
  if (nameHit) report(rel, scrubbed, nameHit.index, 'owner name');
  if (isPublicHtml(rel)) {
    const visible = maskAbsoluteUrls(text);
    const phraseHit = phraseRe.exec(visible);
    phraseRe.lastIndex = 0;
    if (phraseHit) report(rel, visible, phraseHit.index, 'public HTML phrase "' + phraseHit[0] + '"');
  }
}

function scanFile(file) {
  let buf;
  try { buf = fs.readFileSync(file); }
  catch (e) { return; }
  if (buf.includes(0)) return;
  scanText(relOf(file), buf.toString('utf8'));
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root });
  return out.toString('utf8').split('\0').filter(Boolean);
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (ent.name === '.git' || ent.name === 'node_modules') return;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}

trackedFiles().forEach(function (rel) { scanFile(path.join(root, rel)); });
walk(path.join(root, 'dist'), []).forEach(scanFile);

if (problems.length) {
  console.error(problems.slice(0, 40).join('\n'));
  if (problems.length > 40) console.error('… and ' + (problems.length - 40) + ' more');
  console.error('\n' + problems.length + ' owner-name / public-HTML check failure(s)');
  process.exit(1);
}
console.log('owner-name check OK');
