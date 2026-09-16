#!/usr/bin/env node
/* build-books.js — indexable landing pages for the TransformerPath Professional
 * Engineering Series (Volumes 0–19). Titles follow the review-edition manuscripts.
 *
 * Every volume gets its own URL (/books/volume-<n>/). Volumes 1 and 2 are
 * published ("available"); the rest are "coming soon" scaffolding. Each page
 * links back to the matching Masterclass module. Conservative Book + WebPage
 * + Breadcrumb schema. No book body text is copied onto the site.
 *
 * Run: node build-books.js  (part of the Netlify build command, BEFORE build-seo).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const MAP = JSON.parse(fs.readFileSync('data/course-book-map.json', 'utf8'));
const VOLUMES = MAP.volumes.map(function (v) {
  return {
    n: v.n,
    title: v.title,
    sub: v.sub,
    st: v.st,
    course: v.course,
    audience: v.audience || '',
    reviewNote: v.reviewNote || '',
    edition: v.edition || '',
  };
});

function page(v) {
  const url = 'https://transformerpath.com/books/volume-' + v.n + '/';
  const editionLabel = v.edition ? 'Edition ' + v.edition : '';
  const status = v.st === 'available' ? (editionLabel ? 'Available · ' + editionLabel : 'Available') : 'Coming soon';
  const head = 'Transformers, Volume ' + v.n + ' — ' + esc(v.title);
  const bookSchema = { '@context': 'https://schema.org', '@type': 'Book', name: 'Transformers, Volume ' + v.n + ': ' + v.title, alternativeHeadline: v.sub, bookFormat: 'https://schema.org/EBook', author: { '@type': 'Organization', name: 'TransformerPath' }, publisher: { '@type': 'Organization', name: 'TransformerPath' }, inLanguage: 'en' };
  if (v.edition) bookSchema.bookEdition = String(v.edition);
  const pageSchema = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Transformers, Volume ' + v.n + ' — ' + v.title, url: url, about: { '@type': 'Book', name: 'Transformers, Volume ' + v.n + ': ' + v.title } };
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Books', item: 'https://transformerpath.com/books.html' },
    { '@type': 'ListItem', position: 2, name: 'Transformers, Volume ' + v.n }] };
  const schema = '<script type="application/ld+json">' + JSON.stringify(bookSchema) + '</script><script type="application/ld+json">' + JSON.stringify(pageSchema) + '</script><script type="application/ld+json">' + JSON.stringify(bc) + '</script>';
  const route = VOLUMES.map(function (o) { return '<a class="tpill' + (o.n === v.n ? ' on' : '') + '" href="../volume-' + o.n + '/">V' + o.n + ' ' + (o.st === 'available' ? '✓' : '·') + '</a>'; }).join('');

  const courseHref = '../../masterclass.html#' + (v.course || 'fundamentals');
  const courseCta =
    '<div class="box" style="margin-top:18px"><b style="color:var(--text)">Match this volume to the course</b>' +
    '<p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">The Masterclass teaches the working path. This volume is the matching reference — titles and outcomes only on this page; the book itself is the full text.</p>' +
    '<a class="btn btn-amber" href="' + courseHref + '">Open the matching Masterclass module →</a> ' +
    '<a class="btn btn-outline" href="../../learn.html#series-path" style="margin-left:8px">See the Learn series path →</a></div>';

  let body;
  if (v.st === 'available') {
    body = '<p class="lead">Now available &mdash; Volume ' + v.n + ' of the TransformerPath Professional Engineering Series' + (editionLabel ? ' (' + esc(editionLabel) + ')' : '') + '.</p>' +
      (v.audience ? '<p>Written for ' + esc(v.audience.charAt(0).toLowerCase() + v.audience.slice(1)) + '</p>' : '') +
      (v.reviewNote ? '<p class="lead">' + esc(v.reviewNote) + '</p>' : '') +
      '<div class="box"><b style="color:var(--text)">Get this volume</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Digital and printed editions of Volume 1 and Volume 2 are available now. Checkout runs directly through Stripe on the books page; a digital copy unlocks instantly and the printed library ships on demand.</p>' +
      '<a class="btn btn-amber" href="../../books.html" data-track="book_view" data-track-book="volume-' + v.n + '">Buy this volume →</a></div>' +
      courseCta;
  } else {
    body = '<p class="lead">In development &mdash; the next volume in the TransformerPath Professional Engineering Series.</p>' +
      (v.audience ? '<p>Intended audience: ' + esc(v.audience) + '</p>' : '') +
      (v.reviewNote ? '<p class="lead">' + esc(v.reviewNote) + '</p>' : '') +
      '<p>This volume is part of the Volumes 0–19 TransformerPath Professional Engineering Series. It joins the volumes available now, and is written to work with the TransformerPath platform &mdash; linking the engineering reference to the interactive 3D models, calculators and the Academy.</p>' +
      courseCta +
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
