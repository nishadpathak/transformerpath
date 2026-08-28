const fs = require('fs');
const path = require('path');
function walk(d, skip) {
  let out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (skip.includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, skip));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const skip = ['archive', '_private', 'transformerpath-site', 'node_modules', '.git'];
const files = walk('.', skip);

// Forbidden educational-credential/commercial-architecture terms
const FORBIDDEN = [
  /\bLeaner\b|\blearner\b/gi,            // 'learner' tier naming
  /\bEnterprise\b|\benterprise\b/gi,     // 'Enterprise' tier naming
  /\$199\/year|\$599\/year|\$1,999\/year/gi,
  /\bcertified engineer\b/gi,
  /\bcredential\b/gi,
  /\bco-branded certificates?\b/gi,
  /\bcertificate per level\b/gi,
  /\bprofessional certificate\b/gi,
  /\baccredited qualification\b/gi,
  /\bcertification\b(?![ -]"(?:ISO|IEC|UL|IEEE|CE|ANSI))/gi, // allow product/standard cert refs
  /\bcapstone review \+ certificate\b/gi,
  /\bwe are not FEM\b|\bwe sell none of them\b|\bwe would rather tell you\b/gi,
  /\b10[\s\u2013-]?15%\b/gi,
  /\boptimised works design\b|\boptimized works design\b|\bworks design\b/gi,
  /\bRFQ TP-2026-0000\b/gi,
];

const hits = {};
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  // strip HTML comments (invisible) to avoid false positives from <!-- LEARNER -->
  const s = raw.replace(/<!--[\s\S]*?-->/g, '');
  for (const re of FORBIDDEN) {
    const matches = s.match(re);
    if (matches) {
      hits[f] = hits[f] || new Set();
      matches.forEach(m => hits[f].add(m.trim()));
    }
  }
}
let total = 0;
for (const [f, set] of Object.entries(hits)) {
  const terms = [...set].join(', ');
  console.log(f + ' :: ' + terms);
  total += set.size;
}
console.log('\nfiles with forbidden terms:', Object.keys(hits).length, '| distinct term-hits:', total);
