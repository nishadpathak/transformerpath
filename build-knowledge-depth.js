#!/usr/bin/env node
/* build-knowledge-depth.js
 *
 * Audit of published knowledge articles. Measures markers that are actually
 * in each generated page. It does not edit articles and it does not invent
 * sections, citations, or review dates.
 *
 * Scope: <main class="k-wrap"> for words, headings, tables, equations,
 * worked examples, checklists and references. FAQ count is the number of
 * FAQPage Question entities in the page JSON-LD (the builder emits that
 * block in <head>, outside the article main).
 *
 * Run after build-knowledge.js:
 *   node build-knowledge-depth.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const THRESHOLDS = {
  scope: 'words, h2, tables, equations, has_worked_example, has_checklist and references_count are counted inside <main class="k-wrap"> so the shared header and footer are not scored. faq_count is the number of FAQPage Question entities in the page JSON-LD.',
  words: 'Whitespace-separated tokens after scripts, styles and tags are removed.',
  h2: 'Number of h2 elements in the article main.',
  tables: 'Number of table elements in the article main.',
  equations: 'Number of elements with class eq in the article main.',
  has_worked_example: 'True when the article main contains the label "Worked example".',
  has_checklist: 'True when the article main contains the word "checklist".',
  references_count: 'Number of li elements in the References & standards list.',
  faq_count: 'Number of "@type":"Question" entities in FAQPage JSON-LD on the page.',
  score: 'words >= 400 adds 2, else words >= 320 adds 1; h2 >= 8 adds 1; tables >= 1 adds 2; equations >= 1 adds 2; worked example adds 2; checklist adds 1; references_count >= 3 adds 1; faq_count >= 2 adds 1.',
  grade: {
    DEEP: 'score >= 4',
    OK: 'score >= 2 and score < 4',
    THIN: 'score < 2'
  },
  thinness_order: 'Lowest score, then fewest words, then slug. The thinnest pages are the ones this audit flags for a later depth pass.'
};

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

function scoreFromCounts(m) {
  let score = 0;
  if (m.words >= 400) score += 2;
  else if (m.words >= 320) score += 1;
  if (m.h2 >= 8) score += 1;
  if (m.tables >= 1) score += 2;
  if (m.equations >= 1) score += 2;
  if (m.has_worked_example) score += 2;
  if (m.has_checklist) score += 1;
  if (m.references_count >= 3) score += 1;
  if (m.faq_count >= 2) score += 1;
  return score;
}

function gradeFor(score) {
  if (score >= 4) return 'DEEP';
  if (score >= 2) return 'OK';
  return 'THIN';
}

function scoreHtml(html) {
  const mainMatch = String(html).match(/<main class="k-wrap">([\s\S]*?)<\/main>/i);
  const main = mainMatch ? mainMatch[1] : String(html);
  const refsMatch = main.match(/<h2>References[\s\S]*?<\/ul>/i);
  const metrics = {
    words: textOf(main).split(/\s+/).filter(Boolean).length,
    h2: countOf(main, /<h2\b/gi),
    tables: countOf(main, /<table\b/gi),
    equations: countOf(main, /class="eq"/gi),
    has_worked_example: /Worked example/i.test(main),
    has_checklist: /\bchecklist\b/i.test(main),
    references_count: refsMatch ? countOf(refsMatch[0], /<li\b/gi) : 0,
    faq_count: countOf(String(html), /"@type":"Question"/g)
  };
  const score = scoreFromCounts(metrics);
  return Object.assign({}, metrics, { score: score, grade: gradeFor(score) });
}

function writeDepth(dir) {
  const root = dir || 'knowledge';
  const articles = {};
  fs.readdirSync(root).filter(function (name) { return name.endsWith('.html'); }).sort().forEach(function (name) {
    const slug = name.replace(/\.html$/, '');
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    articles[slug] = scoreHtml(html);
  });
  const grades = { THIN: 0, OK: 0, DEEP: 0 };
  Object.keys(articles).forEach(function (slug) { grades[articles[slug].grade] += 1; });
  const payload = {
    $schema: 'https://transformerpath.com/knowledge-depth.schema.json',
    source: 'knowledge/*.html',
    classification: 'audit_only — measures present content; does not invent sections, citations or review dates',
    thresholds: THRESHOLDS,
    article_count: Object.keys(articles).length,
    grade_counts: grades,
    articles: articles
  };
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(path.join('data', 'knowledge-depth.json'), JSON.stringify(payload, null, 2) + '\n');
  console.log('knowledge-depth: ' + payload.article_count + ' articles | THIN ' + grades.THIN + ' OK ' + grades.OK + ' DEEP ' + grades.DEEP);
  return payload;
}

if (require.main === module) writeDepth();
module.exports = { scoreHtml: scoreHtml, THRESHOLDS: THRESHOLDS, writeDepth: writeDepth };
