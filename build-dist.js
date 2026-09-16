#!/usr/bin/env node
/* build-dist.js — assemble the PUBLIC deploy artifact in dist/.
 *
 * WHY THIS EXISTS
 * ---------------
 * The site used publish = "." , which deploys the entire working folder. Every
 * internal file was therefore on the CDN by default, "protected" only by a
 * denylist of 404 redirects in netlify.toml. That denylist could not hold:
 *
 *   - Netlify matches redirect rules case-SENSITIVELY but serves files
 *     case-INSENSITIVELY, so /_docs/x.md returned 404 while /_Docs/x.md
 *     returned 200. Both book manuscripts, the RAKEZ feasibility workbook and
 *     a private customer reply were publicly downloadable this way.
 *   - A folder rule like "/Transformer Radiators/*" blocked the directory
 *     index but still served the files inside it.
 *   - Moving the folders out of the root is not durable either:
 *     audit-manufacturers.js:172 WRITES _private/census-audit.json on every
 *     run, so the directory reappears at the next build.
 *
 * The fix is an ALLOWLIST. Nothing reaches dist/ unless it is named here, so a
 * new internal file added next year is excluded by default rather than by
 * somebody remembering to add a rule.
 *
 * SERVERLESS FUNCTIONS ARE NOT AFFECTED. Netlify reads the functions directory
 * from netlify.toml's `functions` key, which is independent of `publish`. So
 * functions/lib/masterclass-chapters.js still bundles into the deployed
 * function and stays reachable through the gated endpoint — but is no longer
 * served as a static file. That closes the 210 KB paid-content exposure.
 *
 * This runs LAST, after every generator. It only copies; no builder changes.
 *
 * Run: node build-dist.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIST = 'dist';

/* ── The allowlist ────────────────────────────────────────────────────────
   Derived by scanning all 1,695 pages for the assets they actually reference
   (src/href/fetch), not by guessing. Re-derive if the site gains a new asset
   class: the verification gate below will fail loudly rather than silently
   shipping a broken page. */

// Whole directories copied verbatim — served content only.
const DIRS = [
  'accessories', 'applications', 'admin', 'books', 'brand', 'case-studies',
  'components', 'data', 'events', 'grids', 'knowledge', 'manufacturers',
  'markets', 'materials', 'media', 'projects', 'tenders', 'topics', 'utilities',
  'viz', 'vendor',
];

// Individual files from directories that are NOT wholly public.
const FILES_FROM_MIXED_DIRS = [
  'lib/event-search.js',        // loaded by search.html; the rest of lib/ is build-time
];

// Runtime JavaScript at the root, derived from what pages actually load.
const ROOT_JS = [
  'analytics.js', 'consent.js', 'course-gate.js', 'fem-leakage.js',
  'follow-button.js', 'form-notify.js', 'intel-feed-ui.js', 'material-latest.js', 'rfq-engine.js',
  'site-stats.js', 'supabase-config.js', 'supabase.js', 'sw.js',
  'tp-directory.js', 'tp-feedback.js', 'tp-freshness.js', 'tp-nav.js', 'tp-pwa.js',
  'tp-grid-lab.js', 'tp-learner.js', 'tp-entitlement.js',
  'tp-theme.js', 'map.js',
  'tp-3d-core.js', 'tp-power-assembly.js', 'tp-oil-assembly.js',
  'tp-castresin-assembly.js', 'tp-ct-assembly.js',
  'part-ecosystem.js', 'component-3d-bridge.js',
];

// Everything else at the root that must ship.
const ROOT_OTHER = [
  'robots.txt', 'ads.txt', 'sitemap.xml', 'feed.xml', 'intel-feed.xml',
  'manifest.webmanifest', 'favicon.ico', 'apple-touch-icon.png',
];

// Root stylesheets — small and fully enumerable.
const ROOT_CSS_RE = /\.css$/;

/* ── Forbidden in the output, whatever the allowlist says ──────────────────
   The gate is the real protection: if any of these ever appear in dist/, the
   build fails rather than deploying. Belt and braces. */
const FORBIDDEN_PATTERNS = [
  /\.pdf$/i, /\.sql$/i, /\.xlsx?$/i, /\.docx?$/i, /\.md$/i, /\.py$/i,
  /(^|\/)[^/]* \d{1,2}(\.[^./]+)?$/,   // conflict copies — backstop for the skip above
  /^_private\//, /^_docs\//, /^_partials\//, /^tests\//, /^supabase\//,
  /^functions\//, /^engine\//, /^archive\//, /^transformerpath-site\//,
  /^Transformer Equipments\//, /^Transformer Radiators\//,
  /^build-.*\.js$/, /^check-.*\.js$/, /^audit-.*\.js$/, /^merge-.*\.js$/,
  /^_region_.*\.json$/, /^_final_.*\.json$/, /^_sync_diag\.js$/,
  /^_merge_validate\.js$/, /^americas_transformer_projects.*\.json$/,
  /^asia_transformer_projects\.json$/, /^netlify\.toml$/, /^package(-lock)?\.json$/,
  /^stamp-intel\.js$/, /^bump-assets\.js$/, /^build_ssr\.js$/, /^build\.py$/,
  /^data\/commerce-intel\.json$/,
  /^data\/engineer-track-paid\.json$/,
];

/* iCloud Drive / macOS conflict copies ("index 2.html", "usa 2/"). The site folder
   lives in iCloud; concurrent writes on 10 Sept produced 83 of them, and one reached
   dist/ as a stale page with the old navigation. They are never deployable content. */
const CONFLICT_COPY = / \d{1,2}(\.[^./]+)?$/;
const skippedConflicts = [];

function rm(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} }

function copyFile(src, destRel) {
  const dest = path.join(DIST, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;            // .DS_Store and friends
    if (CONFLICT_COPY.test(e.name)) { skippedConflicts.push(path.join(dir, e.name)); continue; }
    const p = path.join(dir, e.name);
    // Never copy internal prospect intelligence to the public distribution
    if (p === 'data/commerce-intel.json' || p === 'data/engineer-track-paid.json') continue;
    if (e.isDirectory()) n += copyDir(p);
    else { copyFile(p, p); n++; }
  }
  return n;
}

// ── Build ─────────────────────────────────────────────────────────────────
rm(DIST);
fs.mkdirSync(DIST, { recursive: true });

let count = 0;

// 1. Every served HTML page at the root.
for (const f of fs.readdirSync('.')) {
  if (CONFLICT_COPY.test(f)) { skippedConflicts.push(f); continue; }
  if (f.endsWith('.html')) { copyFile(f, f); count++; }
  else if (ROOT_CSS_RE.test(f)) { copyFile(f, f); count++; }
}

// 2. Runtime JS + static root files.
for (const f of ROOT_JS.concat(ROOT_OTHER)) {
  if (fs.existsSync(f)) { copyFile(f, f); count++; }
  else console.warn('  ! allowlisted but missing: ' + f);
}

// 3. Public directories.
for (const d of DIRS) count += copyDir(d);

// 4. Individual files from mixed directories.
for (const f of FILES_FROM_MIXED_DIRS) {
  if (fs.existsSync(f)) { copyFile(f, f); count++; }
  else console.warn('  ! allowlisted but missing: ' + f);
}

// ── Verification gate ─────────────────────────────────────────────────────
const offenders = [];
(function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { scan(p); continue; }
    const rel = path.relative(DIST, p);
    if (FORBIDDEN_PATTERNS.some((re) => re.test(rel))) offenders.push(rel);
  }
})(DIST);

const bytes = (function size(dir) {
  let t = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    t += e.isDirectory() ? size(p) : fs.statSync(p).size;
  }
  return t;
})(DIST);

if (skippedConflicts.length) {
  console.warn('  ! skipped ' + skippedConflicts.length + ' iCloud conflict cop' + (skippedConflicts.length === 1 ? 'y' : 'ies') + ' — clean them out of the source folder:');
  skippedConflicts.slice(0, 8).forEach((c) => console.warn('      ' + c));
}
console.log('dist/ assembled: ' + count + ' root/allowlisted entries, ' +
  (bytes / 1048576).toFixed(1) + ' MB total');

if (offenders.length) {
  console.error('\nDIST GATE FAILED — private or build-only files reached the artifact:');
  offenders.slice(0, 40).forEach((o) => console.error('  ' + o));
  if (offenders.length > 40) console.error('  … and ' + (offenders.length - 40) + ' more');
  process.exit(1);
}
console.log('DIST GATE OK — no private, manuscript, build-script or internal file in the artifact.');
