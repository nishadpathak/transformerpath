#!/usr/bin/env node
/* check-footer-social.js — one social link per network inside each footer.
 *
 * The mobile footer used to show two LinkedIn controls ("Follow us on LinkedIn"
 * and a second "LinkedIn" share button). This gate fails when any <footer>
 * contains more than one link to the same social network.
 *
 * A footer link counts for a network when its href host, a data-* attribute,
 * or its visible label identifies that network. Share buttons with href="#"
 * still count, because the label and data-linkedin-share mark them as LinkedIn.
 *
 * Run: node check-footer-social.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP = new Set([
  '.git',
  'node_modules',
  'dist',
  'archive',
  '_private',
  'transformerpath-site',
]);

const NETWORKS = [
  { id: 'linkedin', hosts: ['linkedin.com'], aliases: ['linkedin'] },
  { id: 'x', hosts: ['twitter.com', 'x.com'], aliases: ['twitter', 'x'] },
  { id: 'facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'], aliases: ['facebook'] },
  { id: 'instagram', hosts: ['instagram.com'], aliases: ['instagram'] },
  { id: 'youtube', hosts: ['youtube.com', 'youtu.be'], aliases: ['youtube'] },
  { id: 'tiktok', hosts: ['tiktok.com'], aliases: ['tiktok'] },
  { id: 'threads', hosts: ['threads.net'], aliases: ['threads'] },
  { id: 'bluesky', hosts: ['bsky.app'], aliases: ['bluesky', 'bsky'] },
  { id: 'mastodon', hosts: ['mastodon.social'], aliases: ['mastodon'] },
];

const FOOTER_RE = /<footer\b[^>]*>[\s\S]*?<\/footer>/gi;
const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') && ent.name !== '.') continue;
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function visibleText(inner) {
  return inner
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hostOf(attrs) {
  const m = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
  if (!m) return '';
  const href = m[1].trim();
  if (!/^https?:\/\//i.test(href)) return '';
  try {
    return new URL(href).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (err) {
    return '';
  }
}

function hostMatches(host, expected) {
  return host === expected || host.endsWith('.' + expected);
}

function labelMatches(text, aliases) {
  const label = text.replace(/[↗→]+/g, '').trim();
  if (!label) return false;
  for (const alias of aliases) {
    const re = new RegExp('^(?:follow(?:\\s+us)?(?:\\s+on)?\\s+)?' + alias + '$', 'i');
    if (re.test(label)) return true;
  }
  return false;
}

function attrMatches(attrs, aliases) {
  const names = [];
  const re = /(?:^|\s)(data-[a-z0-9_-]+)/gi;
  let m;
  while ((m = re.exec(attrs))) names.push(m[1].toLowerCase());
  for (const alias of aliases) {
    const exact = 'data-' + alias;
    for (const name of names) {
      if (name === exact || name.startsWith(exact + '-')) return true;
    }
  }
  return false;
}

function networkFor(attrs, text) {
  const host = hostOf(attrs);
  for (const net of NETWORKS) {
    if (host && net.hosts.some((h) => hostMatches(host, h))) return net.id;
  }
  for (const net of NETWORKS) {
    if (attrMatches(attrs, net.aliases)) return net.id;
  }
  for (const net of NETWORKS) {
    if (labelMatches(text, net.aliases)) return net.id;
  }
  return null;
}

function footerProblems(html) {
  const problems = [];
  const flags = FOOTER_RE;
  flags.lastIndex = 0;
  let footerIndex = 0;
  let match;
  while ((match = flags.exec(html))) {
    footerIndex += 1;
    const counts = new Map();
    ANCHOR_RE.lastIndex = 0;
    let anchor;
    while ((anchor = ANCHOR_RE.exec(match[0]))) {
      const net = networkFor(anchor[1], visibleText(anchor[2]));
      if (!net) continue;
      counts.set(net, (counts.get(net) || 0) + 1);
    }
    for (const [net, count] of counts) {
      if (count > 1) problems.push({ footerIndex, net, count });
    }
  }
  return problems;
}

function selfTest() {
  const follow = '<a class="tp-li-btn tp-li-follow" data-linkedin-follow href="https://www.linkedin.com/company/transformerpath">Follow us on LinkedIn</a>';
  const share = '<a class="tp-li-btn tp-li-share" data-linkedin-share href="#">LinkedIn</a>';
  const dup = '<footer><div>' + follow + share + '</div></footer>';
  const one = '<footer><div>' + follow + '</div></footer>';
  const twoHosts = '<footer><a href="https://www.linkedin.com/company/transformerpath">Follow us on LinkedIn</a><a href="https://linkedin.com/in/someone">LinkedIn</a></footer>';
  const mixed = '<footer><a href="https://www.linkedin.com/company/transformerpath">Follow us on LinkedIn</a><a href="https://x.com/transformerpath">X</a></footer>';
  const outside = share + '<footer>' + follow + '</footer>';
  const twoFooters = '<footer>' + follow + '</footer><footer>' + follow + '</footer>';
  const cases = [
    ['duplicate buttons', dup, true],
    ['single follow', one, false],
    ['two linkedin hrefs', twoHosts, true],
    ['linkedin and x', mixed, false],
    ['share outside footer', outside, false],
    ['one link in each footer', twoFooters, false],
  ];
  const failed = [];
  for (const [name, html, expectFail] of cases) {
    const problems = footerProblems(html);
    const failedCase = problems.length > 0;
    if (failedCase !== expectFail) failed.push(name + ' (expected ' + (expectFail ? 'fail' : 'pass') + ')');
  }
  if (failed.length) {
    console.error('footer social self-test failed:');
    failed.forEach((line) => console.error('  ' + line));
    process.exit(1);
  }
}

function main() {
  selfTest();
  const root = process.cwd();
  const files = walk(root).sort();
  const problems = [];
  let footers = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const found = footerProblems(html);
    FOOTER_RE.lastIndex = 0;
    footers += (html.match(/<footer\b/gi) || []).length;
    if (!found.length) continue;
    const rel = path.relative(root, file);
    for (const problem of found) {
      problems.push(rel + ' footer #' + problem.footerIndex + ' has ' + problem.count + ' ' + problem.net + ' links');
    }
  }
  if (problems.length) {
    console.error('Footer social links: ' + problems.length + ' footer(s) repeat a network');
    problems.slice(0, 40).forEach((line) => console.error('  ' + line));
    if (problems.length > 40) console.error('  … ' + (problems.length - 40) + ' more');
    process.exit(1);
  }
  console.log('Footer social links OK — ' + files.length + ' page(s), ' + footers + ' footer(s), at most one link per network.');
}

main();
