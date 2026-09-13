#!/usr/bin/env node
/**
 * GATE: one verification language (P0.3 / P0.4).
 *
 * There are exactly four supplier states: LISTED, CLAIMED, VERIFIED, SUPPLIER PRO.
 * Fails the build if deprecated verification terminology appears in public UI
 * (HTML) or public client/serverless JS.
 *
 * Genuine external quotes may opt out by adding the marker `tp-allow-legacy-term`
 * in a comment on the same line.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Files whose contents render to the public (excludes scripts/, node_modules, data/).
const PUBLIC_JS = [
  'payments-config.js',
  'payments.js',
  'components-catalog.js',
  'featured-suppliers.js',
  'directory-graph.js',
  'site-graph.js',
  'part-ecosystem.js',
  'component-3d-bridge.js',
  'tp-3d-core.js',
  'functions/create-checkout.js',
  'functions/stripe-webhook.js'
];

const DEPRECATED = [
  /Pro\s+Verified/i,
  /Premium\s+Verified/i,
  /Verified\s+Pro\b/i,
  /Website[- ]?Verified/i,
  /Verified\s*(?:&amp;|&)\s*Pro/i
];

function publicFiles() {
  const html = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  const js = PUBLIC_JS.filter((f) => fs.existsSync(path.join(ROOT, f)));
  return html.concat(js);
}

const errors = [];
for (const file of publicFiles()) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('tp-allow-legacy-term')) return;
    for (const re of DEPRECATED) {
      const m = re.exec(line);
      if (m) errors.push(file + ':' + (i + 1) + ': deprecated term "' + m[0] + '"');
    }
  });
}

if (errors.length) {
  console.error('VERIFICATION TERMINOLOGY GATE: FAIL');
  errors.forEach((e) => console.error('  - ' + e));
  console.error('  Allowed states: LISTED, CLAIMED, VERIFIED, SUPPLIER PRO.');
  process.exit(1);
}
console.log('VERIFICATION TERMINOLOGY GATE: OK (no deprecated verification terms in public UI)');
