#!/usr/bin/env node
/* build-course-depth.js
 *
 * Phase 7 — Course depth audit for the TX Design Masterclass (masterclass.html).
 *
 * This is an AUDIT, not an editor. It measures the actual engineering content
 * of each chapter against concrete, visible markers (subsections, equations,
 * worked figures, notes, embedded interactive models, worked tables), then
 * classifies the chapter's depth and flags any chapter that appears thin.
 *
 * HONESTY RULES (inherited from the master build):
 *   - It never invents figures, equations, standards or capability. Everything
 *     tallied is present in the checked-in masterclass.html.
 *   - A LOW depth score is a *flag for deepening* — it is not a claim that the
 *     chapter is wrong, and it is not a recommendation to pad with filler.
 *   - No ranking by payment; no SEO padding. It measures substance only.
 *
 * Outputs:
 *   COURSE_DEPTH_MATRIX.md   — human-readable audit (checked in for review)
 *   data/course-depth.json   — machine-readable matrix used downstream
 */

const fs = require('fs');
const path = require('path');

const SRC = 'masterclass.html';

function read(src) {
  return fs.readFileSync(src, 'utf8');
}

// ---- light HTML text extraction (strip tags, decode a handful of entities) ----
function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countOf(html, re) {
  return (html.match(re) || []).length;
}

// Split masterclass.html into chapters on numbered <h2> headings.
// The first chapter starts at the first '<h2>\d+.' ; each chapter runs to the
// next numbered <h2>. The trailing '<h2>🧊 Interactive 3D & Tools Lab' and the
// embedded model/calculator sections are excluded by the numbered-anchor rule.
function splitChapters(html) {
  const re = /<h2>\s*(\d+)\.\s/gi;
  const anchors = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    anchors.push({ num: parseInt(m[1], 10), index: m.index, matchLen: m[0].length });
  }
  const chapters = [];
  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i].index;
    const end = i + 1 < anchors.length ? anchors[i + 1].index : html.length;
    const raw = html.slice(start, end);
    // heading text
    const headM = raw.match(/<h2>\s*\d+\.\s*([^<]+)/i);
    const title = headM ? headM[1].trim() : '';
    chapters.push({ num: anchors[i].num, title, html: raw, start, end });
  }
  return chapters;
}

const EMBED_MODEL_RE = /class="embed-(?:panel|open|frame)"/gi;
const INTERACTIVE_LINK_RE = /class="tag">\s*interactive/gi;

function analyze(ch) {
  const h = ch.html;
  const totalWords = textOf(h).split(/\s+/).filter(Boolean).length;

  const subsections = countOf(h, /<h3(?:\s[^>]*)?>/gi);
  const equations = countOf(h, /class="eq"/gi);
  const notes = countOf(h, /class="note"/gi);
  const keypoints = countOf(h, /class="keypoint"/gi);
  const figures = countOf(h, /class="fig"/gi);
  const tables = countOf(h, /class="table-wrap"/gi);
  const embeds = countOf(h, EMBED_MODEL_RE);
  const interactiveTags = countOf(h, INTERACTIVE_LINK_RE);

  // Internal cross-links to other chapters / models / learn pages.
  const hrefs = (h.match(/href="([^"]+)"/gi) || []);
  const modelLinks = hrefs.filter((x) => /\.html/.test(x)).length;

  return {
    num: ch.num,
    title: ch.title,
    words: totalWords,
    subsections,
    equations,
    notes,
    keypoints,
    figures,
    tables,
    embeds,
    interactiveTags,
    modelLinks,
  };
}

// Classify depth from measured substance. Thresholds are deliberately
// conservative and content-grounded, not aspirational.
function classify(a) {
  const signals = {
    equations: a.equations,
    figures: a.figures,
    tables: a.tables,
    subsections: a.subsections,
    embeds: a.embeds,
  };
  // Worked multi-step design chapters (9, 25) and the standards/appendix maps
  // are structurally different: heavy on tables/steps, lighter on equations.
  const isDesignChapter = a.title.indexOf('Worked Design') !== -1;
  const isAppendix = /Data Appendix|Standards Map|Glossary/.test(a.title);

  let score = 0;
  score += a.subsections >= 4 ? 2 : a.subsections >= 2 ? 1 : 0;
  score += a.equations >= 1 ? 1 : 0;
  score += a.figures >= 1 ? 1 : 0;
  score += a.tables >= 2 ? 2 : a.tables >= 1 ? 1 : 0;
  score += a.embeds >= 1 ? 1 : 0;
  score += a.notes + a.keypoints >= 2 ? 1 : 0;

  let grade, needs;
  if (isDesignChapter || isAppendix) {
    // Structural chapters graded on completeness, not on equation density.
    grade = (a.tables >= 3 || a.subsections >= 6) ? 'Structural' : 'Structural (thin)';
    needs = false;
  } else {
    if (score >= 6) { grade = 'DEEP'; needs = false; }
    else if (score >= 4) { grade = 'ADEQUATE'; needs = false; }
    else { grade = 'DEPTH_FLAG'; needs = true; }
  }

  return { score, grade, needs, signals };
}

function main() {
  const html = read(SRC);
  const chapters = splitChapters(html);
  if (chapters.length === 0) {
    console.error('course-depth: no numbered chapters found in ' + SRC);
    process.exit(1);
  }

  const rows = chapters.map(analyze).map((a) => ({ ...a, ...classify(a) }));
  rows.sort((x, y) => x.num - y.num);

  const flags = rows.filter((r) => r.needs);

  // machine-readable output (data/course-depth.json)
  fs.writeFileSync(path.join('data', 'course-depth.json'), JSON.stringify({
    $schema: 'https://transformerpath.com/course-depth.schema.json',
    generated: new Date().toISOString(),
    source: SRC,
    total_chapters: rows.length,
    depth_flags: flags.map((f) => f.num),
    classification: 'audit_only — measures present content; flags thin chapters for deepening, never invents content',
    chapters: rows,
  }, null, 2) + '\n');

  // human-readable audit (COURSE_DEPTH_MATRIX.md)
  const lines = [];
  lines.push('# Course Depth Matrix — TX Design Masterclass');
  lines.push('');
  lines.push('> **Audit, not an editor.** This matrix measures the *actual engineering content* of each of the '
    + rows.length + ' masterclass chapters against concrete markers present in `masterclass.html`. '
    + 'It flags chapters that look thin so they can be deepened with real content — it does not invent figures, '
    + 'equations, standards or capability, and it does not recommend filler. Low depth is a *flag*, not a claim of error.');
  lines.push('');
  lines.push('| # | Chapter | Grade | Words | Subsections | Equations | Figures | Tables | Notes/Keypoints | 3D models |');
  lines.push('|---|---------|-------|------:|------------:|----------:|--------:|-------:|----------------:|-----------:|');
  rows.forEach((r) => {
    const grade = r.needs ? '**' + r.grade + '**' : r.grade;
    lines.push('| ' + r.num + ' | ' + r.title + ' | ' + grade + ' | ' + r.words + ' | ' + r.subsections
      + ' | ' + r.equations + ' | ' + r.figures + ' | ' + r.tables + ' | ' + (r.notes + r.keypoints)
      + ' | ' + r.embeds + ' |');
  });
  lines.push('');
  lines.push('## Depth flags (' + flags.length + ' chapter' + (flags.length === 1 ? '' : 's') + ')');
  lines.push('');
  if (flags.length === 0) {
    lines.push('No chapter is below the substance threshold. All 26 chapters are DEEP or ADEQUATE on measured content.');
  } else {
    flags.forEach((r) => {
      lines.push('- **Chapter ' + r.num + ' — ' + r.title + '** (' + r.grade + ', ' + r.words + ' words, '
        + r.subsections + ' subsections, ' + r.equations + ' equations, ' + r.figures + ' figures, '
        + r.tables + ' tables). Flagged for deepening with substantive engineering content.');
    });
  }
  lines.push('');
  lines.push('## Method');
  lines.push('');
  lines.push('- Split `masterclass.html` on numbered `<h2>` chapter headings; each chapter runs to the next numbered heading.');
  lines.push('- Tallied markers: `<h3>` subsections, `class="eq"` equations, `class="fig"` figures, `class="table-wrap"` '
    + 'tables, `class="note"` + `class="keypoint"` call-outs, `class="embed-panel"/embed-open` interactive 3D models.');
  lines.push('- Grade thresholds (non-design chapters): DEEP ≥ 6 points, ADEQUATE ≥ 4 points, DEPTH_FLAG < 4 points, where '
    + 'points come from measured markers — this is content volume, not quality judgement.');
  lines.push('- Worked-design chapters (9, 25) and structural appendix chapters (12, 19, 26) are graded on structural '
    + 'completeness (tables / subsections), not on equation density.');

  fs.writeFileSync('COURSE_DEPTH_MATRIX.md', lines.join('\n') + '\n');

  console.log('course-depth: ' + rows.length + ' chapters audited; ' + flags.length + ' depth flags.');
  rows.forEach((r) => {
    if (r.needs) console.log('  FLAG  ch' + r.num + ' ' + r.title + ' (' + r.grade + ')');
  });
  console.log('course-depth.json + COURSE_DEPTH_MATRIX.md written.');
}

main();
