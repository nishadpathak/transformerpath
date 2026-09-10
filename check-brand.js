#!/usr/bin/env node
/* check-brand.js — TransformerPath public-output brand gate (regression).
 *
 * PURPOSE
 *   The brand is TransformerPath. This gate guarantees that the SERVED site
 *   never returns a customer-facing legacy reference to:
 *     - "TanBrief" / "Tan Brief" / "tanbrief"  (the standalone briefing brand)
 *     - a customer-facing "Polsia" identity (transformerpath@polsia.app,
 *       polsia.app links, "Polsia" shown as a product/company name)
 *
 *   This is the regression test that stops TanBrief — or any legacy brand —
 *   reappearing in public output. It is deliberately strict on SERVED pages:
 *   whatever is published is what a visitor sees, so we hard-fail on it.
 *
 * CLASSIFICATION (per the incorporate spec)
 *   CUSTOMER_FACING    -> MUST be zero (this gate fails).
 *   INTERNAL_TECHNICAL -> identifiers/URLs that are NOT surfaced as the
 *                         product identity but are required for deployment,
 *                         hosting, APIs or auth (e.g. a hosting/analytics
 *                         subdomain that is not presented as the brand) are
 *                         NOT treated as a brand leak. They live in JS
 *                         internals / metadata, not in the visible brand
 *                         surface, so they are excluded from the hard-fail.
 *   HISTORICAL         -> _private/ and archive/ are never served (netlify.toml
 *                         404s them), so they are excluded from this scan too.
 *
 * Run: node check-brand.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

// Dirs that are gitignored/stale or never served by Netlify (404) — skip.
const SKIP = ['archive', '_private', 'transformerpath-site', 'dist', 'node_modules', '.git', 'Transformer Equipments', '_docs', '_partials', 'functions'];

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (SKIP.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// Brand literals that must never reach a customer.
// TanBrief is a hard zero.
const TANBRIEF_RE = /tan[\s-]?brief/i;
// Polsia: only customer-facing surfaces are hard-fails (visible text, mailto,
// or links to polsia.app). Header/script comments and internal identifiers are
// excluded so we don't break required hosting/infra strings.
const POLSIA_TEXT_RE = /\bPolsia\b/;
const POLSIA_MAIL_RE = /transformerpath@polsia\.app/i;
const POLSIA_LINK_RE = /(?:href|src|action)\s*=\s*["'][^"']*polsia\.app/i;

const files = walk('.');
const problems = [];
let totalChecked = 0;

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  totalChecked++;
  // Only VISIBLE text and visible links count for the customer-facing fail.
  // Strip scripts, styles and HTML comments (they are not a customer-facing
  // brand surface) so internal identifiers/analytics don't trip the gate.
  const visible = s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  // Links/actions still in the raw markup (some are in visible elements).
  const rawLinks = s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

  if (TANBRIEF_RE.test(s)) {
    const m = s.match(TANBRIEF_RE);
    problems.push(f + ' :: TanBrief reference "' + m[0] + '"');
  }
  if (POLSIA_TEXT_RE.test(visible)) {
    const m = visible.match(POLSIA_TEXT_RE);
    problems.push(f + ' :: customer-facing "Polsia" text "' + m[0] + '"');
  }
  if (POLSIA_MAIL_RE.test(s)) {
    problems.push(f + ' :: customer-facing email "transformerpath@polsia.app"');
  }
  if (POLSIA_LINK_RE.test(rawLinks)) {
    problems.push(f + ' :: customer-facing polsia.app link');
  }
}

console.log('BRAND GATE');
console.log('Served HTML files scanned: ' + totalChecked);
if (problems.length) {
  console.error('BRAND CHECK FAILED — ' + problems.length + ' customer-facing legacy-brand reference(s):');
  problems.forEach((p) => console.error('  ✗ ' + p));
  process.exitCode = 1;
} else {
  console.log('BRAND CHECK OK — 0 customer-facing TanBrief / Polsia references in served output.');
}
