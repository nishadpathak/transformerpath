#!/usr/bin/env node
/* build-engineering-claims.js
 *
 * Phase 8/9 — Engineering-claim confidence register.
 *
 * This is DETECTION-ONLY and non-inventing. It reads the shipped artifacts
 * (knowledge/*.html and masterclass.html) and, for each:
 *   (a) decides whether the piece anchors its technical content to a normed
 *       standard (IEC / IEEE / CIGRE / EN / BS / DIN / ANSI / ISO / GB / DL / VDE);
 *   (b) notes whether it carries specific numeric engineering claims
 *       (kVA/MVA/kV/°C/Hz/MPa/mm/km/%/K and design-constant values).
 *
 * It then classifies each piece's claim confidence:
 *   NORMED  — the piece cites a normed standard (anchored). No action.
 *   REVIEW  — the piece makes numeric engineering claims but cites NO normed
 *             standard anywhere. Flagged ENGINEERING_REVIEW_REQUIRED (a review
 *             QUEUE for a qualified engineer — not a statement that the content
 *             is wrong, and never an auto-correction).
 *
 * It never edits a number, never invents a citation, never "fixes" a claim.
 * Output:
 *   data/engineering-claims.json — machine-readable register
 */

const fs = require('fs');
const path = require('path');

const STD = /\b(?:IEC|IEEE|CIGRE|ISO|EN\s?\d|BS\s?\d|ANSI|DIN\s?\d|GB\/T|GB\s?\d|DL\/T|NFC|VDE)\b/i;
// A specific engineering value = a number with an engineering unit, or an explicit
// range/approximation the designer relies on. We deliberately EXCLUDE narrative
// money/value figures and generic counting words to avoid noise.
const NUM_CLAIM = /\b\d+(?:\.\d+)?\s*(?:kVA|MVA|kV|MW|Hz|°C|MPa|mm|km|%|K|A\b|T\b|kg|g\/l|W\/m|mm\/s|μS\/m|µm)\b|\d+(?:\.\d+)?\s*[-–]\s*\d+\s*(?:kV|°C|mm|K|%|MVA|kVA|A|Hz)\b/;

function dec(x) { return String(x).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' '); }
function strip(html) { return dec(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function chapterSplit(html) {
  const parts = html.split(/(?=<h2>\s*\d+\.)/);
  const chapters = [];
  parts.forEach((p) => {
    if (!/^<h2>\s*\d+\./.test(p)) return;
    const m = p.match(/<h2>\s*(\d+)\.\s*([^<]+)/);
    if (!m) return;
    chapters.push({ num: parseInt(m[1], 10), title: dec(m[2]).trim(), html: p });
  });
  return chapters;
}

// Analyse one HTML piece -> classify confidence.
function classify(piece) {
  const body = piece.html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = strip(body);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasStd = STD.test(text);
  // Only count numeric claims that are *engineering values* inside substantive blocks.
  const numBlocks = body.split(/(?=<(?:p|li|td|th|div|tr|h[1-6])>)/)
    .filter((b) => /class="(?:eq|note|keypoint|fig|cap|table-wrap)"/.test(b) || /^<(?:p|li|td|th|div|tr|h[1-6])>/.test(b))
    .map((b) => strip(b)).filter(Boolean);
  const numericClaims = numBlocks.filter((x) => NUM_CLAIM.test(x)).length;

  let confidence;
  if (hasStd) confidence = 'NORMED';
  else if (numericClaims > 0) confidence = 'ENGINEERING_REVIEW_REQUIRED';
  else confidence = 'DESCRIPTIVE_NO_NUMERIC_CLAIMS';

  return { hasStd, numericClaims, wordCount, confidence };
}

function main() {
  const rows = [];

  // Knowledge articles (the "answer" surface — real refs live here).
  const kdir = path.join('knowledge');
  const kFiles = fs.readdirSync(kdir).filter((f) => /\.html$/.test(f));
  kFiles.forEach((f) => {
    const html = fs.readFileSync(path.join(kdir, f), 'utf8');
    const slug = f.replace(/\.html$/, '');
    const title = (html.match(/<title>([^<]+)/) || ['', slug])[1].replace(' | TransformerPath', '').trim();
    rows.push({ kind: 'knowledge', id: slug, name: title, ...classify({ html }) });
  });

  // Masterclass course chapters.
  const mc = fs.readFileSync('masterclass.html', 'utf8');
  chapterSplit(mc).forEach((ch) => {
    rows.push({ kind: 'masterclass', id: 'ch' + ch.num, name: ch.title, num: ch.num, ...classify({ html: ch.html }) });
  });

  // Sort: review-required first (by kind group), then by id.
  rows.sort((a, b) => {
    const rank = (c) => (c === 'ENGINEERING_REVIEW_REQUIRED' ? 0 : c === 'NORMED' ? 1 : 2);
    return rank(a.confidence) - rank(b.confidence) || String(a.id).localeCompare(String(b.id));
  });

  const reviews = rows.filter((r) => r.confidence === 'ENGINEERING_REVIEW_REQUIRED');
  const normed = rows.filter((r) => r.confidence === 'NORMED');
  const descriptive = rows.filter((r) => r.confidence === 'DESCRIPTIVE_NO_NUMERIC_CLAIMS');

  fs.writeFileSync(path.join('data', 'engineering-claims.json'), JSON.stringify({
    $schema: 'https://transformerpath.com/engineering-claims.schema.json',
    generated: new Date().toISOString(),
    scope: 'detection-only; never edits a number or invents a citation',
    counts: { total: rows.length, engineering_review_required: reviews.length, normed: normed.length, descriptive: descriptive.length },
    review_queue: reviews.map((r) => r.id),
    entries: rows,
  }, null, 2) + '\n');

  console.log('engineering-claims: ' + rows.length + ' pieces classified.');
  console.log('  NORMED: ' + normed.length + ' | ENGINEERING_REVIEW_REQUIRED: ' + reviews.length + ' | descriptive: ' + descriptive.length);
  reviews.forEach((r) => console.log('  REVIEW  ' + r.kind + ':' + r.id + ' ' + r.name + ' (numeric claims=' + r.numericClaims + ')'));
  console.log('engineering-claims.json written.');
}

main();
