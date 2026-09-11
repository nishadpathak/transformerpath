#!/usr/bin/env node
/* tests/check-verification-terms.js
 *
 * Verifies that deprecated verification terms are NOT used anywhere in served HTML pages.
 * The canonical 4-tier architecture is strictly:
 *   1. LISTED
 *   2. CLAIMED
 *   3. VERIFIED
 *   4. SUPPLIER PRO
 *
 * Terms that must NEVER appear:
 *   - "Pro Verified" / "Pro-Verified"
 *   - "Premium Verified"
 *   - "Verified Pro"
 *   - "Pro / Premium" / "Verified / Pro / Premium"
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
  { re: /\bPro\s+Verified\b/i, name: 'Pro Verified' },
  { re: /\bPro-Verified\b/i, name: 'Pro-Verified' },
  { re: /\bPremium\s+Verified\b/i, name: 'Premium Verified' },
  { re: /\bVerified\s+Pro\b/i, name: 'Verified Pro' },
  { re: /\bPro\s*\/\s*Premium\b/i, name: 'Pro / Premium' },
  { re: /\bVerified\s*\/\s*Pro\s*\/\s*Premium\b/i, name: 'Verified / Pro / Premium' },
];

const IGNORE_DIRS = new Set(['node_modules', '.git', '.gemini', 'brain', 'dist', 'scratch', 'tests']);

function scanDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (!IGNORE_DIRS.has(ent.name)) {
        scanDir(path.join(dir, ent.name), fileList);
      }
    } else if (ent.isFile() && (ent.name.endsWith('.html') || ent.name.endsWith('.js') || ent.name.endsWith('.json'))) {
      if (ent.name === 'check-verification-terms.js') continue;
      fileList.push(path.join(dir, ent.name));
    }
  }
  return fileList;
}

const files = scanDir('.');
let violations = 0;

for (const file of files) {
  // skip vendor, archive or legacy redirect maps
  if (file.includes('scratch/') || file.includes('old-company-redirects')) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.re.test(content)) {
      console.error(`❌ Violation in ${file}: Found deprecated verification term "${p.name}"`);
      violations++;
    }
  }
}

if (violations === 0) {
  console.log(`✅ VERIFICATION ARCHITECTURE GATE: PASS (${files.length} files scanned, 0 deprecated terms)`);
  process.exit(0);
} else {
  console.error(`\n❌ VERIFICATION ARCHITECTURE GATE: FAILED with ${violations} violations.`);
  process.exit(1);
}
