'use strict';
/* Shared event URL helper — listing, map popup and event pages use the same href.
 * Prefers an existing events/<slug>/ page. Never invents a slug that would 404. */
const fs = require('fs');
const path = require('path');

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function stripYear(slug) {
  return String(slug || '').replace(/-20\d{2}.*$/, '').replace(/-19\d{2}.*$/, '');
}

let _cache = null;
function pageIndex() {
  if (_cache) return _cache;
  const dir = 'events';
  const slugs = [];
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'index.html'))) slugs.push(e.name);
    });
  }
  const bySlug = {};
  slugs.forEach((s) => { bySlug[s] = s; });
  _cache = { slugs, bySlug };
  return _cache;
}

function resolveEventSlug(name) {
  const idx = pageIndex();
  const slug = slugify(name);
  if (!slug) return '';
  if (idx.bySlug[slug]) return slug;
  const noYear = stripYear(slug);
  if (noYear && idx.bySlug[noYear]) return noYear;
  const contained = idx.slugs.filter((s) => s.length >= 6 && (
    slug.indexOf(s) >= 0 || (noYear && noYear.indexOf(s) >= 0)
  ));
  contained.sort((a, b) => b.length - a.length);
  return contained[0] || '';
}

function eventHref(ev, opts) {
  opts = opts || {};
  const prefix = opts.prefix || '';
  const name = (ev && (ev.n || ev.name)) || '';
  const slug = resolveEventSlug(name);
  if (slug) return prefix + 'events/' + slug + '/';
  if (opts.fallbackListing === false) return '';
  return prefix + 'events.html?q=' + encodeURIComponent(name);
}

function eventPageMap() {
  const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
  const map = {};
  EVENTS.forEach((ev) => {
    const slug = resolveEventSlug(ev.n);
    if (slug) map[ev.n] = slug;
  });
  return map;
}

function resetCache() { _cache = null; }

module.exports = { slugify, resolveEventSlug, eventHref, eventPageMap, resetCache };
