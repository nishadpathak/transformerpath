#!/usr/bin/env node
/* build-header-consistency.js
 *
 * The interactive / 3D / tool pages (bushing, explorer, calculator, masterclass,
 * power3d, etc.) built with an older FLAT header (.tp-sitehead with a single row
 * of links and NO dropdown mega-menus), while every generated page uses the
 * canonical grouped dropdown mega-menu header (_partials/header.html).
 *
 * This script replaces the old .tp-sitehead header (markup + its scoped CSS)
 * in those pages with the self-contained canonical mega-menu header
 * (_partials/header-standalone.html), so ALL pages share the same navigation
 * structure — grouped dropdowns, theme toggle, search + account.
 *
 * Read-only-safe: it only swaps an isolated header block; the page's own styles,
 * scripts, and app markup are untouched. It emits the result and verifies the
 * swap succeeded (the page now contains 'nav-group-label' and no longer
 * contains 'tp-sitehead' as a nav).
 *
 * Run: node build-header-consistency.js
 */
'use strict';
const fs = require('fs');

const PAGES = [
  'bushing', 'coretopology', 'coilassembly', 'explorer', 'oltc', 'power3d',
  'test-report', 'power500', 'gsu', 'windings', 'country-designer', 'masterclass',
  'calculator', 'academy', 'autotransformer', 'construction-guide',
];

const STANDALONE = fs.readFileSync('_partials/header-standalone.html', 'utf8');

// Remove from '<div class="tp-sitehead"' through the matching header markup </div>
// AND the immediately-following '<style>...</style>' that holds the .tp-sitehead
// CSS (if present). Returns [newHtml, removedLength, ok].
function stripOldHeader(html) {
  const start = html.indexOf('<div class="tp-sitehead" role="banner">');
  if (start < 0) return [html, 0, false];

  // Find the end of the header markup: the closing </div> of the .tp-sitehead.
  // It is the LAST </div> before the next '<style>' that contains .tp-sitehead.
  let styleIdx = html.indexOf('<style>', start);
  // Find the style block that actually styles .tp-sitehead (in case a later style does).
  let cssEnd = -1;
  let searchFrom = styleIdx;
  while (searchFrom >= 0) {
    const close = html.indexOf('</style>', searchFrom);
    const block = close >= 0 ? html.slice(searchFrom, close) : '';
    if (/.tp-sitehead/.test(block)) { cssEnd = close + '</style>'.length; break; }
    searchFrom = html.indexOf('<style>', close);
  }

  // If no CSS block found, close the header markup at the first ' </div>\n</div>'.
  let headerEnd = -1;
  if (cssEnd < 0) {
    // find the header </div> block: the sitehead closes with '</div>\n  </div>\n</div>'
    const topClose = html.indexOf('\n</div>', start);
    headerEnd = topClose >= 0 ? topClose + '\n</div>'.length : -1;
  } else {
    // header markup ends at the last </div> before the style block
    const before = html.slice(start, cssEnd - '</style>'.length);
    const lastClose = before.lastIndexOf('</div>');
    headerEnd = lastClose >= 0 ? start + lastClose + '</div>'.length : cssEnd;
  }

  if (headerEnd < 0 && cssEnd < 0) return [html, 0, false];

  const cutEnd = cssEnd >= 0 ? cssEnd : headerEnd;
  const removed = html.slice(start, cutEnd);
  const rest = html.slice(cutEnd);
  // Also strip a blank line left behind (optional).
  const newHtml = html.slice(0, start) + rest.replace(/^\n+/, '\n');
  return [newHtml, removed.length, true];
}

function main() {
  let swapped = 0, skipped = 0, failed = 0;
  PAGES.forEach((name) => {
    const file = name + '.html';
    if (!fs.existsSync(file)) { skipped++; return; }
    const html = fs.readFileSync(file, 'utf8');
    let [out, removedLen, ok] = stripOldHeader(html);
    if (!ok) { console.warn('!! ' + file + ': no .tp-sitehead header found (skip)'); skipped++; return; }
    // Insert the standalone canonical header right after <body>.
    const bodyIdx = out.indexOf('<body>');
    const insertAt = bodyIdx >= 0 ? bodyIdx + '<body>'.length : 0;
    out = out.slice(0, insertAt) + '\n' + STANDALONE + '\n' + out.slice(insertAt);
    fs.writeFileSync(file, out);
    // Verify
    const post = fs.readFileSync(file, 'utf8');
    const hasGroups = /nav-group-label/.test(post);
    const oldGone = !/tp-sitehead/.test(post);
    if (hasGroups && oldGone) { swapped++; console.log('OK  ' + file + '  (nav mega-menu groups: ' + (post.match(/nav-group-label/g) || []).length + ')'); }
    else { failed++; console.error('!! ' + file + ' verify FAILED: hasGroups=' + hasGroups + ' oldGone=' + oldGone); }
  });
  console.log('header-consistency: ' + swapped + ' swapped, ' + skipped + ' skipped, ' + failed + ' failed.');
  if (failed) process.exit(1);
}

main();
