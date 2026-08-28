#!/usr/bin/env node
/* build-projects.js — TransformerPath Project Entity Pages.
 *
 * Generates a Project entity page per record in data/projects.json (the audit's
 * Projects schema). A project is a distinct grid/substation build/tender/award,
 * NOT an article. Fields are only shown where sourced; the transformer_requirement
 * grade is displayed so a reader can tell confirmed transformer scope from an
 * inferred or unknown one.
 *
 * Run: node build-projects.js  (part of the Netlify build command).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = (s) => (s || '').toLowerCase();

const DATA = JSON.parse(fs.readFileSync('data/projects.json', 'utf8'));
const PROJECTS = DATA.projects || [];
const MARKET_SLUG = { 'United Arab Emirates': 'uae', 'Saudi Arabia': 'saudi-arabia', 'Qatar': 'qatar', 'Kuwait': 'kuwait', 'Bahrain': 'bahrain', 'India': 'india', 'China': 'china' };
// Utility buyer name fragment -> utility entity slug (data/grids.json derived, matches build-utilities.js).
const UTILITY_SLUG = { 'kahramaa': 'kahramaa', 'dewa': 'dewa', 'ewa': 'ewa', 'ministry of electricity': 'mewre-ministry-of-electricity-and-water', 'saudi': 'saudi-electricity-co-national-grid-sa' };
const uSlug = (u) => { const k = ci(u); for (const [frag, slug] of Object.entries(UTILITY_SLUG)) { if (k.indexOf(frag) >= 0) return slug; } return ''; };
const GRADE_HELP = {
  CONFIRMED: 'Transformer scope is explicitly documented in the source.',
  INFERRED: 'Transformer requirement is reasonably inferred from the substation / grid scope.',
  UNKNOWN: 'Transformer requirement is not yet documented.',
};
const STATUS_LABEL = { evaluation: 'Pre-award / evaluation', tendering: 'Tendering', expected: 'Expected', awarded: 'Awarded', construction: 'Construction', energized: 'Energized' };

function page(p) {
  const slug = slugify(p.project);
  const url = 'https://transformerpath.com/projects/' + slug + '/';
  const grade = (p.transformer_requirement || 'UNKNOWN').toUpperCase();
  const vol = p.voltage || '—';
  const marketLink = MARKET_SLUG[p.country] ? '<a class="tpill" href="../../markets/' + MARKET_SLUG[p.country] + '/">' + esc(p.country) + ' market</a>' : '';
  const utilLink = (p.utility && uSlug(p.utility)) ? '<a class="tpill" href="../../utilities/' + uSlug(p.utility) + '/">' + esc(p.utility) + ' profile</a>' : '';
  const srcLinks = (p.sources || []).filter((u) => u).map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:var(--accent)">source</a>').join(' · ') || '—';

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(p.project) + ' — Transformer Project | TransformerPath</title>' +
    '<meta name="description" content="' + esc(p.project) + ' (' + esc(p.country) + ') — a ' + esc((STATUS_LABEL[p.status] || p.status)) + ' transformer-relevant grid/substation project. Voltage ' + esc(vol) + ', ' + esc(grade.toLowerCase()) + ' transformer requirement. Source-tracked by TransformerPath.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(p.project) + ' — Transformer Project"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Project', name: p.project, description: 'Transformer-relevant ' + (p.status || '') + ' project in ' + p.country + '.', location: { '@type': 'Place', name: p.country } }) + '</script>' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.6rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:26px}.c-wrap .evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:6px 0 16px}.c-wrap .evmeta b{color:var(--text)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap ul{padding-left:20px;line-height:1.7}.c-wrap table{width:100%;border-collapse:collapse;margin:10px 0}.c-wrap table th{text-align:left;color:var(--muted);font-weight:600;padding:6px 10px;border-bottom:1px solid var(--border);width:38%}.c-wrap table td{padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text)}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../projects.html" style="color:var(--accent)">Projects</a> › ' + esc(p.country) + ' › ' + esc(p.project) + '</nav>' +
    '<h1>' + esc(p.project) + '</h1>' +
    '<p class="lead" style="margin-bottom:14px">A ' + esc((STATUS_LABEL[p.status] || p.status)) + ' transformer-relevant grid/substation project, tracked as an entity (not an article) by TransformerPath.</p>' +
    '<div class="evmeta"><span><b>Country</b> ' + esc(p.country) + '</span><span><b>Voltage</b> ' + esc(vol) + '</span><span><b>Status</b> ' + esc((STATUS_LABEL[p.status] || p.status)) + '</span>' + (p.expected ? '<span><b>Expected</b> ' + esc(p.expected) + '</span>' : '') + '</div>' +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:14px 18px;margin-bottom:22px"><span class="cls-badge cls-' + grade + '">' + grade + '</span> <span style="font-size:.9rem;color:var(--text)">' + esc(GRADE_HELP[grade] || GRADE_HELP.UNKNOWN) + '</span></div>' +
    '<h2>Project record</h2><table>' +
    '<tr><th>Project</th><td>' + esc(p.project) + '</td></tr>' +
    '<tr><th>Country</th><td>' + esc(p.country) + '</td></tr>' +
    (p.utility ? '<tr><th>Utility / buyer</th><td>' + esc(p.utility) + '</td></tr>' : '') +
    (p.epc ? '<tr><th>EPC</th><td>' + esc(p.epc) + '</td></tr>' : '') +
    '<tr><th>Transformer requirement</th><td><span class="cls-badge cls-' + grade + '">' + grade + '</span></td></tr>' +
    '<tr><th>Voltage</th><td>' + esc(vol) + '</td></tr>' +
    '<tr><th>Status</th><td>' + esc((STATUS_LABEL[p.status] || p.status)) + '</td></tr>' +
    (p.manufacturer ? '<tr><th>Transformer manufacturer</th><td>' + esc(p.manufacturer) + '</td></tr>' : '') +
    '<tr><th>Expected</th><td>' + esc(p.expected || '—') + '</td></tr>' +
    '</table>' +
    '<h2>Sources</h2><ul><li>' + esc(p.src_label || 'public announcement') + ' · ' + srcLinks + '</li></ul>' +
    '<h2>Market context</h2><div>' + (marketLink || '<span style="color:var(--muted);font-size:.85rem">Market hub not yet built.</span>') + (utilLink ? ' ' + utilLink : '') + '</div>' +
    '<p style="font-size:.78rem;color:var(--muted);margin-top:8px">Last reviewed: ' + new Date().toISOString().slice(0, 10) + '. Sources: public tender/project announcements and TransformerPath Daily Intel; transformer scope graded per the CONFIRMED / INFERRED / UNKNOWN taxonomy. Report a <a href="mailto:hello@transformerpath.com?subject=Project%20correction" style="color:var(--accent)">correction</a>.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Supply this project</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a transformer requirement and TransformerPath will match it against the relevant manufacturing base.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-project="' + esc(slug) + '">Submit an RFQ</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n</body>\n</html>';
}

fs.mkdirSync('projects', { recursive: true });
let built = 0;
PROJECTS.forEach((p) => {
  try {
    const slug = slugify(p.project);
    fs.mkdirSync('projects/' + slug, { recursive: true });
    fs.writeFileSync('projects/' + slug + '/index.html', page(p));
    built++;
  } catch (e) { console.error('!! ' + p.project + ' failed: ' + e.message); }
});
console.log('project entity pages:', built);
