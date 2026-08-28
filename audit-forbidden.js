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
const files = walk('.', skip)
  // Immutable historical edition snapshots — never edited, so never flagged.
  // They legitimately contain business words ("enterprise"), project dates
  // ("2-year", "per year") and technical cert/standard references.
  .filter((f) => !/intel-2026-\d{2}-\d{2}\.html$/.test(f));

// Forbidden educational-credential/commercial-architecture terms.
//
// NOTE: these are PHRASE-level guards. We deliberately do NOT blanket-flag the
// bare words "enterprise", "learner", "credential" or "certification": those
// appear legitimately (a company named Enterprise; "ISO certification";
// "course completion record") and were producing false positives that drowned
// out real hits. Plan-tier naming (Learning/Professional/Team) is enforced
// separately by check-config.js and audit-consistency.js, which match the
// actual rendered heading/CTA text.
const FORBIDDEN = [
  // Plan naming used AS A TIER (not the business word "enterprise").
  /\b(?:leaner|learner|enterprise)\s+(?:plan|tier|checkout|unlock|payment|access)\b/gi,
  // Educational-credential wording (PhrasePath is not an accreditation body).
  /\$199\/year|\$599\/year|\$1,999\/year/gi,
  /\bcertified engineer\b/gi,
  /\bco-branded certificates?\b/gi,
  /\bcertificate per level\b/gi,
  /\bprofessional certificate\b/gi,
  /\baccredited qualification\b/gi,
  /\bcapstone review \+ certificate\b/gi,
  // Positive credential CLAIMS only. Negations ("...is NOT an accredited or
  // licensed professional credential") are the required honest disclaimer and
  // must not be flagged.
  /\b(?:is|are|offers?|issues?|awards?|grants?|provides?)\s+(?:an?\s+)?(?:accredited|professional|certified|recognised|licensed)\s+credential\b/gi,
  /\b(?:is|are|offers?|issues?|awards?)\s+(?:an?\s+)?(?:accredited|professional|certified|recognised|licensed)\s+qualification\b/gi,
  // Honesty/compliance wording (no "we sell/are not FEM" copy, no 10-15% claim).
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
