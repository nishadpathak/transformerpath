#!/usr/bin/env node
/* build-books.js — indexable landing pages for the TransformerPath Professional
 * Engineering Series (18-volume reference library).
 *
 * Every volume gets its own URL (/books/volume-<n>/) so the series has entity
 * pages to grow into. Volumes 1 and 2 are published ("available"); the rest are
 * "coming soon" scaffolding that assert only the confirmed title/subtitle and
 * offer a notify/subscribe CTA. Conservative Book + WebPage + Breadcrumb schema.
 *
 * Run: node build-books.js  (part of the Netlify build command, BEFORE build-seo).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const VOLUMES = [
  { n: 0, title: 'Fundamentals of Transformer Engineering', sub: 'Magnetic Circuits, Principles, and the Physics of Transformation', st: 'coming' },
  { n: 1, title: 'The Transformer Path — A Practical Guide: From Specification to Service', sub: 'Distribution Transformer Design — IEC and IEEE/ANSI Practice', st: 'available' },
  { n: 2, title: 'Power Transformer Design', sub: 'Large Power Transformers and Generator Step-Up Units — IEC and IEEE/ANSI Practice', st: 'available' },
  { n: 3, title: 'Transformer Testing', sub: 'From Routine Tests to Partial Discharge Diagnosis — IEC and IEEE/ANSI Practice', st: 'coming' },
  { n: 4, title: 'Transformer Diagnostics & Condition Assessment', sub: 'Monitoring, Interpretation, and Condition Assessment', st: 'coming' },
  { n: 5, title: 'Transformer Failures & Forensic Engineering', sub: 'Analysis, Root Causes, and Lessons Learned', st: 'coming' },
  { n: 6, title: 'Transformer Manufacturing & Quality', sub: 'Process, Quality, and Production Management', st: 'coming' },
  { n: 7, title: 'Transformer Insulation, Materials & Dielectrics', sub: 'Paper, Oil, Pressboard, and the Solid/Liquid Interface', st: 'coming' },
  { n: 8, title: 'Transformer Components & Accessories', sub: 'Hardware Selection, Integration, and Maintenance', st: 'coming' },
  { n: 9, title: 'Special-Purpose & Emerging Transformers', sub: 'Special Applications, Emerging Technologies, and Extreme Environments', st: 'coming' },
  { n: 10, title: 'Protection, Control, Power Electronics & Grid Integration', sub: 'The Transformer as a System Component', st: 'coming' },
  { n: 11, title: 'Transformer Commercial Engineering & Costing', sub: 'OEM Costing, Bid Strategy, and Post-Award Control', st: 'coming' },
  { n: 12, title: 'Utility Specifications, Tenders & Bid Management', sub: 'Specification Interpretation, Compliance, and Bid Management', st: 'coming' },
  { n: 13, title: 'Transformer Economics, Procurement & Supply Chain', sub: 'Total Cost of Ownership, Sourcing, and Logistics', st: 'coming' },
  { n: 14, title: 'Transformer Safety, Sustainability & Environment', sub: 'People, Equipment, and Environmental Protection', st: 'coming' },
  { n: 15, title: 'Transformer Installation, Commissioning, Service & Life Extension', sub: 'Field Operations, Maintenance, and Lifecycle Management', st: 'coming' },
  { n: 16, title: 'Transformer Standards, Quality & Test Frameworks', sub: 'Standards Architecture, Quality Management, and Test Frameworks', st: 'coming' },
  { n: 17, title: 'Utility Transformer Asset Management', sub: 'Fleet Health, Risk, and Replacement Strategy', st: 'coming' },
];
const byN = {}; VOLUMES.forEach(function (v) { byN[v.n] = v; });

function page(v) {
  const url = 'https://transformerpath.com/books/volume-' + v.n + '/';
  const status = v.st === 'available' ? 'Available' : 'Coming soon';
  const head = 'Transformers, Volume ' + v.n + ' — ' + esc(v.title);
  const bookSchema = { '@context': 'https://schema.org', '@type': 'Book', name: 'Transformers, Volume ' + v.n + ': ' + v.title, alternativeHeadline: v.sub, bookFormat: 'https://schema.org/EBook', author: { '@type': 'Organization', name: 'TransformerPath' }, publisher: { '@type': 'Organization', name: 'TransformerPath' }, inLanguage: 'en' };
  const pageSchema = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Transformers, Volume ' + v.n + ' — ' + v.title, url: url, about: { '@type': 'Book', name: 'Transformers, Volume ' + v.n + ': ' + v.title } };
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Books', item: 'https://transformerpath.com/books.html' },
    { '@type': 'ListItem', position: 2, name: 'Transformers, Volume ' + v.n }] };
  const schema = '<script type="application/ld+json">' + JSON.stringify(bookSchema) + '</script><script type="application/ld+json">' + JSON.stringify(pageSchema) + '</script><script type="application/ld+json">' + JSON.stringify(bc) + '</script>';
  const route = VOLUMES.map(function (o) { return '<a class="tpill' + (o.n === v.n ? ' on' : '') + '" href="../volume-' + o.n + '/">V' + o.n + ' ' + (o.st === 'available' ? '✓' : '·') + '</a>'; }).join('');

  let body;
  if (v.st === 'available') {
    body = '<p class="lead">Now available &mdash; Volume ' + v.n + ' of the TransformerPath Professional Engineering Series.</p>' +
      '<div class="box"><b style="color:var(--text)">Get this volume</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Digital and printed editions of Volume 1 and Volume 2 are available now. Checkout runs directly through Stripe on the books page; a digital copy unlocks instantly and the printed library ships on demand.</p>' +
      '<a class="btn btn-amber" href="../../books.html" data-track="book_view" data-track-book="volume-' + v.n + '">Buy this volume →</a></div>';
  } else {
    body = '<p class="lead">In development &mdash; the next volume in the TransformerPath Professional Engineering Series.</p>' +
      '<p>This volume is part of the 18-volume TransformerPath Professional Engineering Series. It joins the volumes available now, and is written to work with the TransformerPath platform &mdash; linking the engineering reference to the interactive 3D models, calculators and the Academy.</p>' +
      '<div class="box"><b style="color:var(--text)">Want to know when it launches?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Subscribe to stay updated on new volumes and TransformerPath releases.</p>' +
      '<a class="btn btn-amber" href="../../subscribe.html" data-track="book_waitlist" data-track-book="volume-' + v.n + '">Subscribe for updates →</a></div>';
  }

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + head + ' | TransformerPath</title>' +
    '<meta name="description" content="Transformers, Volume ' + v.n + ': ' + esc(v.title) + ' — ' + esc(v.sub) + '. ' + status + ' in the TransformerPath Professional Engineering Series.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="book"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="Transformers, Volume ' + v.n + ' — ' + esc(v.title) + '"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css?v=5"><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><link rel="preconnect" href="https://www.google-analytics.com">' +
    '<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' + schema +
    '<style>.c-wrap{max-width:840px;margin:0 auto;padding:44px 20px 88px}.c-wrap h1{font-size:1.9rem;color:var(--ink)}.c-wrap .sub{color:var(--accent);font-size:1.05rem;font-style:italic;margin:2px 0 0}.c-wrap p{color:var(--text);line-height:1.7}.c-wrap .lead{color:var(--muted);font-size:1rem}.c-wrap .series{margin:18px 0 22px}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:3px 10px;font-size:.72rem;color:var(--text);margin:2px 3px 2px 0;text-decoration:none}.c-wrap .tpill.on{color:var(--accent);border-color:var(--accent);font-weight:700}.c-wrap .box{background:rgba(245,166,35,.08);border:1px solid var(--accent);border-radius:8px;padding:12px 16px;margin-top:18px}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../books.html" style="color:var(--accent)">Books</a> › Transformers, Volume ' + v.n + '</nav>' +
    '<h1>Transformers, Volume ' + v.n + '</h1>' +
    '<p class="sub">' + esc(v.title) + '</p>' +
    '<p class="lead" style="margin-top:2px">' + esc(v.sub) + '</p>' +
    '<div class="series">' + route + '</div>' +
    body +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js?v=2" defer></script>\n</body>\n</html>';
}

let avail = 0, coming = 0;
VOLUMES.forEach(function (v) {
  fs.mkdirSync('books/volume-' + v.n, { recursive: true });
  fs.writeFileSync('books/volume-' + v.n + '/index.html', page(v));
  if (v.st === 'available') avail++; else coming++;
});
console.log('book landing pages:', VOLUMES.length, '| available:', avail, '| coming soon:', coming);
