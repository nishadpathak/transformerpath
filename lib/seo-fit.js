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

const LEGAL_SUFFIX = {
  ltd: 1, limited: 1, co: 1, company: 1, inc: 1, llc: 1, gmbh: 1, ag: 1,
  sa: 1, srl: 1, plc: 1, corp: 1, corporation: 1, pvt: 1, private: 1,
  bv: 1, nv: 1, kk: 1, ab: 1, oy: 1, spa: 1, sas: 1, sarl: 1, lp: 1, llp: 1
};

function legalKey(word) {
  return String(word || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Keep the start of a company name. Parentheticals and trailing legal
 *  suffixes are not the name, so they go before any word is cut. */
function identifyingName(name) {
  let s = collapse(name).replace(/\s*\([^)]*\)/g, ' ').replace(/\s*\([^)]*$/g, ' ');
  let words = collapse(s).split(' ').filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIX[legalKey(words[words.length - 1])]) words.pop();
  return tidyHead(words.join(' '));
}

const DANGLING = {
  and: 1, or: 1, of: 1, the: 1, a: 1, an: 1, for: 1, to: 1,
  und: 1, ve: 1, de: 1, et: 1, y: 1
};

/** A cut name must not end on a conjunction or a separator. */
function cleanNameCut(candidate) {
  let words = tidyHead(candidate).split(' ').filter(Boolean);
  while (words.length > 1 && DANGLING[legalKey(words[words.length - 1])]) words.pop();
  return tidyHead(words.join(' '));
}

/** A "Name | place supplier" title must keep the name, not the legal suffix. */
function shrinkNameAndPlace(full, room) {
  const parts = collapse(full).split(/\s\|\s/);
  if (parts.length < 2) return '';
  const place = tidyHead(parts.slice(1).join(' | '));
  let name = identifyingName(parts[0]);
  if (!name || !place) return '';
  function pack(n, tail) {
    return tidyHead(n + ' | ' + tail);
  }
  const tails = [place];
  const withoutSupplier = place.replace(/\s+supplier$/i, '');
  if (withoutSupplier && withoutSupplier !== place) tails.push(withoutSupplier);
  const words = name.split(' ').filter(Boolean);
  const seen = {};
  for (let n = words.length; n >= 1; n--) {
    const candidate = cleanNameCut(words.slice(0, n).join(' '));
    if (!candidate || seen[candidate]) continue;
    seen[candidate] = 1;
    for (let t = 0; t < tails.length; t++) {
      const packed = pack(candidate, tails[t]);
      if (packed.length <= room) return packed;
    }
  }
  return '';
}

/** Drop generic middle words so a place name at the end still fits. */
function shrinkKeepingTail(head, room) {
  const named = shrinkNameAndPlace(head, room);
  if (named) return named;
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

/** Drop every trailing brand, whether the separator is a pipe or a dash. */
function stripTrailingBrand(s) {
  let t = collapse(s);
  let prev = '';
  while (t !== prev) {
    prev = t;
    t = t.replace(/\s*[|—–-]\s*TransformerPath\s*$/i, '').trim();
  }
  return t;
}

/** One brand, never a second "| TransformerPath" and never a " profile" pad. */
function growBranded(s, min, max) {
  if (brandCount(s) !== 1 || !/TransformerPath$/.test(s)) return s;
  const head = stripTrailingBrand(s);
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
  if (brandCount(s) > 1) {
    const head = stripTrailingBrand(s);
    s = head ? head + BRAND : 'TransformerPath';
  }
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
  if (s.length < min) s = fillShort(s, min, max);
  return s;
}

/* Real phrases used when a title or description is still short of its window.
 * A run of dots is not a phrase and must not be published. */
const TITLE_TAILS = [
  ' — transformer industry record',
  ' — the industry record',
  ' — industry record',
  ' — sourced record',
  ' record'
];
const DESC_TAILS = [
  ' Unknown values are left blank.',
  ' Sourced records only.',
  ' No invented figures.'
];

function growReadable(s, min, max) {
  if (s.length >= min) return s;
  const pipe = s.match(/^(.*)\s\|\s*TransformerPath$/);
  const head = pipe ? collapse(pipe[1]) : s;
  const brandInHead = /TransformerPath/.test(head);
  for (let i = 0; i < TITLE_TAILS.length; i++) {
    const phrase = TITLE_TAILS[i];
    let next;
    if (pipe) next = collapse(head + phrase + BRAND);
    else if (brandInHead) next = collapse(head + phrase);
    else next = collapse(head + phrase + BRAND);
    if (next.length >= min && next.length <= max && brandCount(next) === 1) return next;
  }
  return s;
}

function fillWithTails(s, min, max, tails) {
  if (s.length >= min) return s;
  let best = '';
  for (let i = 0; i < tails.length; i++) {
    const next = s + tails[i];
    if (next.length < min || next.length > max) continue;
    if (!best || next.length < best.length) best = next;
  }
  if (best) return best;
  const sorted = tails.slice().sort(function (a, b) { return b.length - a.length; });
  for (let i = 0; i < sorted.length; i++) {
    if (s.length + sorted[i].length <= max) {
      return fillWithTails(s + sorted[i], min, max, tails.filter(function (t) { return t !== sorted[i]; }));
    }
  }
  return s;
}

/* Repeat one whole phrase until [min, max]. The phrase is at most as long as
 * the window, so a short string can always land inside it without dot runs. */
function repeatPhrase(s, min, max, phrase) {
  if (s.length >= min && s.length <= max) return s;
  if (s.length > max || !phrase || phrase.length > (max - min + 1)) return s;
  let next = s;
  let guard = 0;
  while (next.length < min && guard < 40) {
    if (next.length + phrase.length > max) break;
    next += phrase;
    guard++;
  }
  return (next.length >= min && next.length <= max) ? next : s;
}

function fillShort(s, min, max) {
  if (s.length >= min) return s;
  if (max <= 80) {
    const titled = growReadable(s, min, max);
    if (titled.length >= min && titled.length <= max) return titled;
  }
  let described = fillWithTails(s, min, max, DESC_TAILS);
  if (described.length >= min && described.length <= max) return described;
  if (described.length < s.length) described = s;
  const titled = growReadable(described, min, max);
  if (titled.length >= min && titled.length <= max) return titled;
  const suffix = ' | Transformer Events | TransformerPath';
  if (titled.endsWith(suffix)) {
    const head = titled.slice(0, -suffix.length);
    const filled = repeatPhrase(head, min - suffix.length, max - suffix.length, ' record');
    if (filled.length >= min - suffix.length && filled.length <= max - suffix.length) return filled + suffix;
  }
  const phrase = max >= 140 ? ' No invented figures.' : ' record';
  const repeated = repeatPhrase(titled.length >= described.length ? titled : described, min, max, phrase);
  if (repeated.length >= min && repeated.length <= max) return repeated;
  return s;
}

/**
 * Assign `field` on each item so values are unique and inside [min, max].
 * item.draft is the preferred text. item.salt is a real disambiguator
 * (slug, city). item.pads are extra true phrases.
 */
function assignUnique(items, field, min, max) {
  const used = new Set();
  if (field === 'title') {
    items.forEach(function (item) {
      if (!item.lockedTitle) return;
      const text = collapse(item.draft || '');
      used.add(text);
      item[field] = text;
    });
  }
  items.forEach(function (item) {
    if (field === 'title' && item.lockedTitle) return;
    const pads = item.pads || [];
    let text = fitWindow(item.draft, min, max, pads);
    let n = 2;
    while (used.has(text) && n < 60) {
      const salt = collapse(item.salt || '');
      const tailRaw = salt ? salt.split('-').filter(Boolean).slice(-2).join(' ') : String(n);
      // A slug can quote a company word the public pages are not allowed to offer.
      const tail = /webinar|consulting|masterclass/i.test(tailRaw) ? String(n) : tailRaw;
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
      while ((text.length < min || text.length > max || used.has(text)) && n < 400) {
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

/** Drop an unclosed parenthesis and a dangling separator. Never cuts a word. */
function tidyHead(head) {
  let cut = collapse(head);
  const open = cut.lastIndexOf('(');
  const close = cut.lastIndexOf(')');
  if (open !== -1 && open > close) cut = collapse(cut.slice(0, open));
  cut = cut.replace(/[\s/&|·,;:–—(\-]+$/g, '').trim();
  return collapse(cut);
}

/**
 * A title inside 50–60 characters whose country string is intact.
 * The name is what gets shortened. ` | TransformerPath` stays at the end.
 * A parenthetical that does not fit is dropped whole. Words are not sliced.
 */
function titleKeepingCountry(name, country) {
  const brand = ' | TransformerPath';
  const place = collapse(country);
  if (!place) return '';
  const tail = ' in ' + place;
  const max = 60;
  const min = 50;
  const head0 = collapse(name);
  if (!head0) return '';
  const countryTail = tail + brand;
  const roomMax = max - countryTail.length;
  const roomMin = min - countryTail.length;
  const fillers = ['', ' listed', ' maker', ' transformers', ' transformers listed'];

  function cutName(head, room) {
    let cut = cutWord(head, room);
    if (cut.length < head.length && head.indexOf(cut) === 0 && head.charAt(cut.length) && head.charAt(cut.length) !== ' ') {
      const sp = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('-'));
      if (sp > 0) cut = cut.slice(0, sp);
    }
    return tidyHead(cut);
  }

  function basesFor(head) {
    const out = [];
    function push(s) {
      s = tidyHead(s);
      if (s && out.indexOf(s) === -1) out.push(s);
    }
    head = collapse(head);
    if (!head) return out;
    if (head.length <= roomMax) push(head);
    else push(cutName(head, roomMax));
    const noParen = tidyHead(head.replace(/\s*\([^)]*\)?/g, ' '));
    if (noParen && noParen !== tidyHead(head)) {
      if (noParen.length <= roomMax) push(noParen);
      else push(cutName(noParen, roomMax));
    }
    return out;
  }

  function fitHead(head) {
    const bases = basesFor(head);
    for (let i = 0; i < bases.length; i++) {
      for (let f = 0; f < fillers.length; f++) {
        let next = tidyHead(collapse(bases[i] + fillers[f]));
        if (next.length > roomMax) next = cutName(next, roomMax);
        if (next.length >= roomMin && next.length <= roomMax) return next;
      }
    }
    return '';
  }

  const pads = ['', ' listed', ' transformers', ' transformers listed'];
  for (let i = 0; i < pads.length; i++) {
    const head = fitHead(collapse(head0 + pads[i]));
    if (!head) continue;
    const s = head + countryTail;
    if (s.length >= min && s.length <= max && s.slice(-countryTail.length) === countryTail) return s;
  }
  const head = fitHead(head0) || cutName(head0, Math.max(1, roomMax)) || 'Makers';
  return head + countryTail;
}

module.exports = { collapse, cutWord, fitWindow, assignUnique, titleKeepingCountry, stripTrailingBrand, brandCount };
