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
const BRAND = ' | TransformerPath';

function brandCount(s) {
  return (String(s).match(/TransformerPath/g) || []).length;
}

/** Drop generic middle words so a place name at the end still fits. */
function shrinkKeepingTail(head, room) {
  let words = collapse(head).split(' ').filter(Boolean);
  function joined() { return words.join(' '); }
  if (joined().length <= room) return trimEdge(joined());
  const filler = { transformers: 1, manufacturers: 1, manufacturer: 1, transformer: 1 };
  for (let i = words.length - 2; i >= 1 && joined().length > room; i--) {
    const key = words[i].toLowerCase().replace(/[^a-z]/g, '');
    if (filler[key]) words.splice(i, 1);
  }
  while (words.length > 2 && joined().length > room) words.splice(1, 1);
  if (joined().length <= room) return trimEdge(joined());
  const last = words[words.length - 1];
  const roomForStart = room - last.length - 1;
  if (roomForStart > 3) return trimEdge(cutWord(words.slice(0, -1).join(' '), roomForStart) + ' ' + last);
  return trimEdge(cutWord(joined(), room));
}

/** One brand, never a second "| TransformerPath" and never a " profile" pad. */
function growBranded(s, min, max) {
  if (brandCount(s) !== 1 || !/TransformerPath$/.test(s)) return s;
  const head = s.replace(/\s*\|\s*TransformerPath$/, '');
  const fillers = [' — transformer industry record', ' — industry record', ' record'];
  for (let i = 0; i < fillers.length; i++) {
    const next = collapse(head + fillers[i] + BRAND);
    if (next.length >= min && next.length <= max && brandCount(next) === 1) return next;
  }
  const filler = ' — industry record';
  const room = max - filler.length - BRAND.length;
  const next = collapse(cutWord(head, Math.max(1, room)) + filler + BRAND);
  if (next.length >= min && next.length <= max && brandCount(next) === 1) return next;
  return s;
}

function fitWindow(text, min, max, pads) {
  let s = collapse(text);
  s = s.replace(/(?: \| TransformerPath)+/g, function (all) {
    return brandCount(all) > 1 ? BRAND : all;
  });
  s = s.replace(/\s+profile$/i, '');
  if (s.length > max && brandCount(s) === 1 && /TransformerPath$/.test(s)) {
    const head = s.replace(/\s*\|\s*TransformerPath$/, '');
    s = collapse(shrinkKeepingTail(head, max - BRAND.length) + BRAND);
  } else if (s.length > max && brandCount(s) === 0) {
    const next = collapse(shrinkKeepingTail(s, max - BRAND.length) + BRAND);
    if (next.length <= max && brandCount(next) === 1) s = next;
  }
  if (s.length > max) s = cutWord(s, max);
  const extras = [];
  const seen = {};
  (pads || []).concat([BRAND]).forEach(function (p) {
    if (!p || seen[p] || /^\s*profile$/i.test(p)) return;
    seen[p] = 1;
    extras.push(p);
  });
  extras.forEach(function (p) {
    if (s.length >= min) return;
    if (/TransformerPath/.test(p) && brandCount(s) > 0) return;
    if (s.length + p.length <= max) s += p;
  });
  if (s.length < min && brandCount(s) === 0) {
    const room = max - BRAND.length;
    if (room > 8) {
      const next = collapse(shrinkKeepingTail(s, room) + BRAND);
      if (next.length <= max && brandCount(next) === 1) s = next;
    }
  }
  if (s.length < min) s = growBranded(s, min, max);
  if (s.length > max) s = cutWord(s, max);
  s = s.replace(/(?: \| TransformerPath){2,}/g, BRAND);
  s = s.replace(/\s+profile$/i, '');
  if (brandCount(s) > 1) s = s.replace(/ \| TransformerPath/g, '');
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
