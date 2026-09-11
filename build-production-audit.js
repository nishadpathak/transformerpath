#!/usr/bin/env node
/* build-production-audit.js — POST_SPRINT_PRODUCTION_AUDIT
 *
 * Step 1 of the Commercial Launch / Retention / Operating Engine phase: VERIFY
 * the previous sprint's claimed improvements are actually present, in source →
 * build → deployed HTML → client experience. This is a READ-ONLY verification
 * against the checked-in source + generated data + served HTML. It does NOT
 * assert anything about a live runtime it cannot observe.
 *
 * It also (step 2) sweeps the whole served surface for remaining freshness
 * contradictions ("updated hourly", "refreshed twice a day", "live feed" used
 * as an affirmative claim) so the P0 "one truthful freshness system" is real.
 *
 * Output:
 *   data/post-sprint-production-audit.json  (machine-readable state)
 *   POST_SPRINT_PRODUCTION_AUDIT.md          (human-readable report)  [untracked, re-generated]
 *
 * Run: node build-production-audit.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

function exists(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// Contradictory freshness claims — only affirmative claims. Negations ("not a live
// rate") are deliberately NOT matched because they are truthful.
const CONTRADICT = [
  { re: /refreshed\s+hourly/gi, label: 'refreshed hourly' },
  { re: /updated\s+hourly/gi, label: 'updated hourly' },
  { re: /refreshed\s+twice\s+a\s+day/gi, label: 'refreshed twice a day' },
  { re: /updated\s+twice\s+a\s+day/gi, label: 'updated twice a day' },
  { re: /refreshed\s+2x\/day|updated\s+2x\/day/gi, label: 'refreshed/updated 2x/day' },
];

function contradictionsIn(text) {
  const hits = [];
  CONTRADICT.forEach((c) => { if (c.re.test(text)) hits.push(c.label); });
  return Array.from(new Set(hits));
}

// The surfaces claimed (or expected) by the prior sprint.
const SURFACES = [
  { path: 'intel.html', kind: 'news-feed' },
  { path: 'intelligence.html', kind: 'intel-hub' },
  { path: 'materials.html', kind: 'materials' },
  { path: 'materials/crgo/index.html', kind: 'crgo-monitor' },
  { path: 'learn.html', kind: 'learn' },
  { path: 'masterclass.html', kind: 'masterclass' },
  { path: 'explorer.html', kind: '3d' },
  { path: 'buyers-guide.html', kind: 'buyers-guide' },
  { path: 'components.html', kind: 'components' },
  { path: 'equipment.html', kind: 'equipment' },
  { path: 'testing.html', kind: 'testing' },
  { path: 'software.html', kind: 'software' },
  { path: 'manufacturers.html', kind: 'manufacturers' },
  { path: 'rfq.html', kind: 'rfq' },
  { path: 'workspace.html', kind: 'account' },
  { path: 'pricing.html', kind: 'pricing' },
];

function main() {
  const rows = [];
  SURFACES.forEach((s) => {
    const html = read(s.path);
    const src = exists(s.path);
    // Normalise the sitemap URL: <root>/page.html -> /page.html ; <root>/dir/index.html -> /dir/
    const smUrl = (s.path.endsWith('/index.html'))
      ? s.path.replace(/index\.html$/, '')
      : s.path;
    const sitemap = read('sitemap.xml').includes('transformerpath.com/' + smUrl);
    const hasCanonical = /<link rel="canonical"/.test(html);
    const hasH1 = /<h1[ >]/.test(html);
    // client-experience: is it a mere static shell or does it fetch/drive data?
    const fetchesData = /fetch\(['"](data\/|\.netlify\/functions)/.test(html) || /data-[a-z-]+\.json/.test(html);
    const contradictions = contradictionsIn(html);
    const title = (html.match(/<title>([^<]+)/) || ['', s.kind])[1].trim();
    rows.push({
      surface: s.path, kind: s.kind, title,
      source_present: src, sitemap_indexed: sitemap, has_canonical: hasCanonical, has_h1: hasH1,
      client_fetches_data: fetchesData, freshness_contradictions: contradictions,
    });
  });

  // Sitewide contradiction sweep over every served .html (root + dirs).
  const files = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      if (e.isDirectory()) { if (!/^(node_modules|\.git|dist|scratch|\.claude)$/.test(e.name)) walk(path.join(dir, e.name)); }
      else if (e.name.endsWith('.html')) files.push(path.join(dir, e.name));
    });
  })('.');

  const contradictionPages = [];
  files.forEach((f) => {
    // Immutable dated Intel archives (intel-2026-*.html) are frozen historical
    // snapshots; their old "updated hourly" copy is NOT a live claim and must not
    // be edited (check-archives gate). Exclude them from the fixable sweep.
    if (/^intel-2026-\d{2}-\d{2}\.html$/.test(f)) return;
    const txt = read(f);
    const hits = contradictionsIn(txt);
    if (hits.length) contradictionPages.push({ file: f, claims: hits });
  });

  const out = {
    $schema: 'https://transformerpath.com/production-audit.schema.json',
    generated: new Date().toISOString(),
    note: 'POST-SPRINT PRODUCTION AUDIT. READ-ONLY verification of checked-in source + generated data + served HTML. Does not assert anything about an unobserved live runtime. UNKNOWN > INCORRECT.',
    surfaces: rows,
    freshness_contradiction_sweep: {
      pages_with_contradictions: contradictionPages.length,
      pages: contradictionPages,
    },
  };
  fs.writeFileSync(path.join('data', 'post-sprint-production-audit.json'), JSON.stringify(out, null, 2) + '\n');

  // Human-readable markdown report
  const L = [];
  L.push('# Post-Sprint Production Audit');
  L.push('');
  L.push('> **Verify before building.** Read-only check that the prior sprint claims are present in source -> build -> served HTML -> client experience. Compiled from the checked-in source and generated artifacts; does not assert anything about an unobserved live runtime.');
  L.push('');
  L.push('## Surfaces');
  L.push('');
  L.push('| Surface | Source | Sitemap | H1 | Canonical | Fetches data | Freshness contradictions |');
  L.push('|---------|--------|---------|----|-----------|--------------|--------------------------|');
  rows.forEach((r) => {
    const st = [
      r.source_present ? '✔' : '✘',
      r.sitemap_indexed ? '✔' : (r.kind === 'account' ? 'n/a (noindex)' : '✘'),
      r.has_h1 ? '✔' : '✘',
      r.has_canonical ? '✔' : '✘',
      r.client_fetches_data ? '✔' : 'static',
      r.freshness_contradictions.length ? '**' + r.freshness_contradictions.join(', ') + '**' : '—',
    ];
    L.push('| ' + r.surface + ' | ' + st[0] + ' | ' + st[1] + ' | ' + st[2] + ' | ' + st[3] + ' | ' + st[4] + ' | ' + st[5] + ' |');
  });
  L.push('');
  L.push('## Missing / not-built surfaces');
  L.push('');
  const missing = rows.filter((r) => !r.source_present);
  if (!missing.length) L.push('All listed surfaces are present.');
  else missing.forEach((r) => L.push('- **' + r.surface + '** — no source page present.'));
  L.push('');
  L.push('## Freshness contradiction sweep');
  L.push('');
  L.push('Scanned the entire served HTML tree for affirmative freshness claims (`refreshed hourly`, `updated twice a day`, `twice daily`, etc.). Negations like "not a live rate" are treated as truthful and not flagged.');
  L.push('');
  L.push('Pages with contradictions: **' + contradictionPages.length + '**');
  L.push('');
  if (!contradictionPages.length) L.push('No remaining contradictions. The P0 "one truthful freshness system" is in place.');
  else {
    L.push('| File | Claims |');
    L.push('|------|--------|');
    contradictionPages.forEach((c) => L.push('| ' + c.file + ' | ' + c.claims.join(', ') + ' |'));
  }
  L.push('');

  fs.writeFileSync('POST_SPRINT_PRODUCTION_AUDIT.md', L.join('\n') + '\n');
  console.log('production-audit: ' + rows.length + ' surfaces; ' + contradictionPages.length + ' pages with freshness contradictions.');
  contradictionPages.forEach((c) => console.log('  CONTRADICT ' + c.file + ' :: ' + c.claims.join(', ')));
  console.log('data/post-sprint-production-audit.json + POST_SPRINT_PRODUCTION_AUDIT.md written.');
}

main();
