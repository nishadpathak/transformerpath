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
  { re: /\b100%\s+Website[- ]Verified\b/i, name: '100% Website-Verified' },
  { re: /\bVerified\s+Specialist\s+Makers\b/i, name: 'Verified Specialist Makers' },
  { re: /\bcertified\s+product\s+lines\b/i, name: 'certified product lines' },
  { re: /\bverified\s+listings\b/i, name: 'verified listings' },
  { re: /\bPremium\s+verification\b/i, name: 'Premium verification' },
  { re: /\bVerified\s*-\s*Website Checked\b/i, name: 'Verified - Website Checked' },
  { re: /\bListing\s+\d+\s+verified manufacturers\b/i, name: 'Listing X verified manufacturers' },
];

const IGNORE_DIRS = new Set(['node_modules', '.git', '.gemini', 'brain', 'dist', 'scratch', 'tests', 'manufacturers', 'projects', 'accessories', 'utilities', 'tenders', 'events', 'knowledge', 'media', 'markets', 'case-studies', 'topics', 'archive', '_private', 'Transformer Equipments', '.agents', '_site', 'vendor', 'viz']);

function getFilesToScan() {
  const files = [];
  // Root HTML files
  fs.readdirSync('.').forEach((f) => {
    if (f.endsWith('.html') && !f.includes(' 2.')) files.push(f);
  });
  // Data JSON files
  if (fs.existsSync('data')) {
    fs.readdirSync('data').forEach((f) => {
      if (f.endsWith('.json') && !f.includes(' 2.')) files.push(path.join('data', f));
    });
  }
  // Components & Materials HTML
  ['components', 'materials', 'applications'].forEach((dir) => {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((f) => {
        if (f.endsWith('.html') && !f.includes(' 2.')) files.push(path.join(dir, f));
      });
    }
  });
  return files;
}

const files = getFilesToScan();
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
