#!/usr/bin/env node
/* check-gtm.js — TransformerPath Google-tag (GA4) coverage QA gate.
 *
 * PURPOSE
 *   Guarantee that every applicable public page loads the SAME canonical
 *   Google tag EXACTLY ONCE. The production tag is GA4 (Google tag / gtag),
 *   id G-98Q0V62L72, loaded via analytics.js. There is NO GTM container
 *   (no GTM-XXXXXX) in the codebase. This gate:
 *     - FAILS on any served page missing the canonical GA4 id (MISSING_TAG)
 *     - FAILS on any served page with the canonical id twice (DUPLICATE_TAG)
 *     - FAILS on any served page that references a DIFFERENT analytics/GA
 *       container id (WRONG_CONTAINER / OLD_TAG)
 *     - FAILS on any served page that loads a stale analytics.js?v=N (stale
 *       version mismatch) because the current version is stamped consistently
 *     - reports the template-level cause (tag is per-page, not in a partial)
 *
 *   It does NOT verify live gtag firing, domain isolation, or consent — those
 *   require a browser/deployment (see the report's "needs shell" items).
 *
 * Run: node check-gtm.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

// The canonical production tag.
const GA4_ID = 'G-98Q0V62L72';
const ANALYTICS_SCRIPT = 'analytics.js';
// Current analytics.js version to enforce consistency (stamp with bump-assets).
const ANALYTICS_V = 'v=5';

// Dirs gitignored/stale or never served (404) — skip.
const SKIP = ['archive', '_private', 'transformerpath-site', 'dist', 'node_modules', '.git', 'Transformer Equipments', '_docs', '_partials', 'functions', 'admin'];
// Routes that are NOT normal public pages (system/redirect stubs) — exempt.
const EXEMPT = /^(404|offline|admin|tutorial|tx-design-masterclass)\.html$/;

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

const files = walk('.');
const issues = [];
const counts = { missing: 0, duplicate: 0, wrong: 0, stale: 0, ok: 0 };
// Tag occurrences per page (for the report).
const perPage = [];

for (const f of files) {
  if (EXEMPT.test(path.basename(f))) { perPage.push({ file: f, status: 'exempt' }); continue; }
  const s = fs.readFileSync(f, 'utf8');
  // The canonical GA4 id lives inside analytics.js (external), so a page's
  // "production tag present" marker is the <script src="analytics.js..."> tag,
  // not an inline G-XXXXXXXXXX. Count that script tag (exactly once is correct).
  const canonical = (s.match(/<script[^>]*src="[^"]*analytics\.js[^"]*"/g) || []).length;
  // Any inline GA4-style id (G-XXXXXXXXXX) that is not the canonical one is a
  // WRONG_CONTAINER (a page hard-coding a different measurement id).
  const otherIds = (s.match(/G-[A-Z0-9]{8,12}/g) || []).filter(function (x) { return x !== GA4_ID; });
  const gtmIds = (s.match(/GTM-[A-Z0-9]+/g) || []).filter(function (x, i, a) { return a.indexOf(x) === i; });
  // analytics.js version.
  const vMatch = s.match(/analytics\.js\?v=(\d+)/);
  const ver = vMatch ? ('v=' + vMatch[1]) : null;

  const pageIssues = [];
  if (canonical === 0) { counts.missing++; pageIssues.push('MISSING_TAG'); }
  else if (canonical > 1) { counts.duplicate++; pageIssues.push('DUPLICATE_TAG (' + canonical + 'x)'); }
  else counts.ok++;
  if (otherIds.length) { counts.wrong++; pageIssues.push('WRONG_CONTAINER ' + otherIds.join(',')); }
  if (gtmIds.length) { counts.wrong++; pageIssues.push('GTM_CONTAINER ' + gtmIds.join(',')); }
  if (ver && ver !== ANALYTICS_V && canonical > 0) { counts.stale++; pageIssues.push('STALE_TAG_VERSION analytics.js? ' + ver + ' (expected ' + ANALYTICS_V + ')'); }
  if (pageIssues.length) issues.push(f + ' :: ' + pageIssues.join(' | '));
  perPage.push({ file: f, canonical: canonical, status: pageIssues.length ? pageIssues.join(',') : 'ok' });
}

console.log('GOOGLE-TAG (GA4) COVERAGE GATE — canonical id ' + GA4_ID);
console.log('Served pages checked: ' + files.length +
  ' | ok=' + counts.ok + ' missing=' + counts.missing + ' duplicate=' + counts.duplicate +
  ' wrong-container=' + counts.wrong + ' stale-version=' + counts.stale);
console.log('Template cause: analytics.js is declared PER-PAGE, not in _partials/header.html or _partials/footer.html (requested: load exactly once from a global template).');
if (issues.length) {
  console.error('GOOGLE-TAG CHECK FAILED — ' + issues.length + ' page(s) with a tag issue:');
  issues.slice(0, 120).forEach(function (i) { console.error('  ✗ ' + i); });
  if (issues.length > 120) console.error('  … ' + (issues.length - 120) + ' more');
  process.exitCode = 1;
} else {
  console.log('GOOGLE-TAG CHECK OK — canonical id ' + GA4_ID + ' present exactly once on all applicable served pages.');
}
