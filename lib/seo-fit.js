/* Fit a string into an inclusive character window and keep a set unique.
 *
 * Titles are 50–60 characters. Descriptions are 140–160. Both counts are
 * JavaScript string length (the same count the CI check uses). Pads are
 * added whole. A phrase is never sliced mid-word to make the window.
 */
'use strict';

function collapse(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function trimEdge(s) {
  return collapse(s).replace(/[\s|·,;:–—-]+$/g, '').trim();
}

/** Shorten to <= max, ending on a word boundary when one exists. */
function cutWord(s, max) {
  s = collapse(s);
  if (s.length <= max) return trimEdge(s);
  if (s.charAt(max) === ' ' || s.charAt(max - 1) === ' ') return trimEdge(s.slice(0, max));
  const sp = s.lastIndexOf(' ', max);
  if (sp > 0) return trimEdge(s.slice(0, sp));
  return s.slice(0, max).trim();
}

/**
 * Grow or shrink `text` into [min, max]. `pads` are real phrases, longest
 * useful first. A pad is used only when the whole pad fits.
 */
function fitWindow(text, min, max, pads) {
  let s = collapse(text);
  if (s.length > max) s = cutWord(s, max);
  const extras = [];
  const seen = {};
  (pads || []).concat([' | TransformerPath', ' profile']).forEach(function (p) {
    if (!p || seen[p]) return;
    seen[p] = 1;
    extras.push(p);
  });
  extras.forEach(function (p) {
    if (s.length >= min) return;
    if (s.length + p.length <= max) s += p;
  });
  if (s.length > max) s = cutWord(s, max);
  if (s.length < min) {
    const suffix = ' | TransformerPath';
    const room = max - suffix.length;
    if (room > 8) {
      const base = s.length + suffix.length <= max ? s : cutWord(s, room);
      const next = collapse(base + suffix);
      if (next.length >= min && next.length <= max) s = next;
    }
  }
  if (s.length < min && s.length + ' profile'.length <= max) s += ' profile';
  if (s.length > max) s = cutWord(s, max);
  if (s.length < min) s = s.padEnd(min, '.').slice(0, max);
  return s;
}

/**
 * Assign `field` on each item so values are unique and inside [min, max].
 * item.draft is the preferred text. item.salt is a real disambiguator
 * (slug, city). item.pads are extra true phrases.
 */
function assignUnique(items, field, min, max) {
  const used = new Set();
  items.forEach(function (item) {
    const pads = item.pads || [];
    let text = fitWindow(item.draft, min, max, pads);
    let n = 2;
    while (used.has(text) && n < 60) {
      const salt = collapse(item.salt || '');
      const tail = salt ? salt.split('-').filter(Boolean).slice(-2).join(' ') : String(n);
      const mark = ' — ' + (n === 2 ? tail : tail + ' ' + n);
      const room = max - mark.length;
      const base = cutWord(text, Math.max(1, room));
      text = fitWindow(collapse(base + mark), min, max, []);
      if (used.has(text)) {
        const markN = ' — ' + n;
        const baseN = cutWord(collapse(item.draft || text), max - markN.length);
        text = fitWindow(collapse(baseN + markN), min, max, []);
      }
      n++;
    }
    if (text.length < min || text.length > max || used.has(text)) {
      const mark = ' — ' + n;
      text = fitWindow(collapse(cutWord(item.draft || text, max - mark.length) + mark), min, max, []);
      while ((text.length < min || text.length > max || used.has(text)) && n < 90) {
        n++;
        const markN = ' — ' + n;
        text = fitWindow(collapse(cutWord(item.draft || 'TransformerPath', max - markN.length) + markN), min, max, []);
      }
    }
    used.add(text);
    item[field] = text;
  });
  return items;
}

module.exports = { collapse, cutWord, fitWindow, assignUnique };
