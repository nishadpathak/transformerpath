#!/usr/bin/env node
/**
 * GATE: MVA semantic integrity (P0.6).
 *
 * Three different MVA concepts must never be presented ambiguously together:
 *   - unit transformer rating
 *   - factory annual production capacity
 *   - company/group annual capacity
 *
 * The specific forbidden presentation is a supplier/search card line that fuses
 * a voltage with an unlabelled (annual-capacity-magnitude) MVA figure, e.g.
 *   "Hyosung — 765 kV · 120,000 MVA"
 * which reads as if 120,000 MVA were a unit rating. Annual capacity must live in
 * a separately labelled field. This gate fails if that fused pattern appears in
 * any public HTML.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// voltage (kV) then a middot/pipe/dash separator then a large MVA number with no
// "unit rating" qualifier — the ambiguous card presentation we forbid.
const AMBIGUOUS = /\bkV\b\s*[·|\-–]\s*[\d,]{3,}\s*MVA(?!\s*(?:unit|rating|per\s*unit))/i;

const errors = [];
for (const file of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('tp-allow-mva')) return;
    const m = AMBIGUOUS.exec(line);
    if (m) errors.push(file + ':' + (i + 1) + ': ambiguous voltage·MVA presentation "' + m[0].trim() + '"');
  });
}

if (errors.length) {
  console.error('MVA SEMANTIC GATE: FAIL');
  errors.forEach((e) => console.error('  - ' + e));
  console.error('  Use highest_sourced_unit_rating_mva vs reported_*_capacity_mva_per_year in separate labelled fields.');
  process.exit(1);
}
console.log('MVA SEMANTIC GATE: OK (no ambiguous voltage·MVA card presentation)');
