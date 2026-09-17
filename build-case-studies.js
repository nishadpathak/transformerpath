#!/usr/bin/env node
/* build-case-studies.js — TransformerPath Case Studies / Field Experience pages.
 *
 * Generates a page per case study record in data/case-studies.json, plus the
 * hub. A case study is practitioner material grounded in a specific engineering
 * situation — distinct from generic Knowledge. Attribution is optional and only
 * shown where a professional has granted permission; otherwise the piece is
 * TransformerPath EDITORIAL. Content label (EDITORIAL / CONTRIBUTED / SPONSORED)
 * is rendered per record so payment can never silently change editorial intent.
 *
 * Run: node build-case-studies.js  (part of the Netlify build command).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/case-studies.json', 'utf8'));
const CS = DATA.case_studies || [];
const LABEL_COLOR = { EDITORIAL: 'cls-CONFIRMED', CONTRIBUTED: 'cls-INFERRED', SPONSORED: 'cls-PIPELINE' };

function page(c) {
  const url = 'https://transformerpath.com/case-studies/' + c.slug + '/';
  const label = c.content_label || 'EDITORIAL';
  const byline = c.attributed_to ? ' · by ' + esc(c.attributed_to) : ' · TransformerPath editorial';
  const paras = (c.body_paragraphs || []).map((p) => '<p style="line-height:1.8;color:var(--text);margin:0 0 14px">' + esc(p) + '</p>').join('');
  const related = (c.related_links || []).map((l) => '<a class="tpill" href="../../' + l.replace(/^\.\.\//, '') + '">' + esc(l.split('/').pop().replace(/\.html$/, '').replace(/-/g, ' ')) + '</a>').join(' ') || '';

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(c.title) + ' — TransformerPath Case Study</title>' +
    '<meta name="description" content="' + esc(c.summary.slice(0, 160)) + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="article"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(c.title) + '"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: c.title, about: c.topic, author: { '@type': 'Organization', name: c.attributed_to || 'TransformerPath' }, articleSection: c.type }) + '</script>' +
    '<style>.c-wrap{max-width:820px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.7rem;color:var(--ink);line-height:1.2}.c-wrap .lead{color:var(--muted);font-size:1.05rem;max-width:760px}.c-wrap .meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:10px 0 22px}.c-wrap .meta b{color:var(--text)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap .label{display:inline-block;font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 9px;border-radius:999px}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../case-studies.html" style="color:var(--accent)">Case Studies</a> › ' + esc(c.title) + '</nav>' +
    '<span class="label ' + (LABEL_COLOR[label] || 'cls-WATCH') + '">' + esc(label) + '</span>' +
    '<h1>' + esc(c.title) + '</h1>' +
    '<div class="meta"><span><b>Type</b> ' + esc(c.type) + '</span><span><b>Topic</b> ' + esc(c.topic) + '</span><span>' + byline + '</span></div>' +
    '<p class="lead" style="margin-bottom:20px">' + esc(c.summary) + '</p>' +
    paras +
    '<h2>Related principle</h2><p style="color:var(--text);line-height:1.7">' + esc(c.related_principle) + '</p>' +
    (related ? '<h2>Related reading</h2><div style="margin:4px 0 8px">' + related + '</div>' : '') +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n</body>\n</html>';
}

fs.mkdirSync('case-studies', { recursive: true });
let built = 0;
CS.forEach((c) => {
  try {
    fs.mkdirSync('case-studies/' + c.slug, { recursive: true });
    fs.writeFileSync('case-studies/' + c.slug + '/index.html', page(c));
    built++;
  } catch (e) { console.error('!! ' + c.slug + ' failed: ' + e.message); }
});
console.log('case study pages:', built);
