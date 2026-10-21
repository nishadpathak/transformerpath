/* Event profile titles, hub copy, and the noindex rule for thin stubs.
 *
 * Titles and JSON-LD inputs use fields already on the edition record.
 * A date range is included only when date_status is CONFIRMED. A city is
 * included only when the record has one. Nothing here invents a date,
 * a venue, or an image.
 */
'use strict';

const { cutWord } = require('./seo-fit');
const { resolveStatus } = require('./event-status');

const BRAND = ' | TransformerPath';
const SECTION = ' | Transformer Events';
const SUFFIX = SECTION + BRAND;
const MAX = 100;
const MIN = 50;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function collapse(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function iso(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
}

function confirmed(ev) {
  return !!(ev && String(ev.date_status || '').toUpperCase() === 'CONFIRMED' && iso(ev.start || ev.s));
}

function shortRange(start, end) {
  if (!iso(start)) return '';
  const ys = +start.slice(0, 4);
  const ms = +start.slice(5, 7);
  const ds = +start.slice(8, 10);
  const mon = MONTHS[ms - 1] || '';
  if (!mon) return '';
  if (!iso(end) || end === start) return ds + ' ' + mon;
  const ye = +end.slice(0, 4);
  const me = +end.slice(5, 7);
  const de = +end.slice(8, 10);
  const monE = MONTHS[me - 1] || '';
  if (!monE) return ds + ' ' + mon;
  if (ys === ye && ms === me) return ds + '\u2013' + de + ' ' + mon;
  if (ys === ye) return ds + ' ' + mon + '\u2013' + de + ' ' + monE;
  return ds + ' ' + mon + ' ' + ys + '\u2013' + de + ' ' + monE + ' ' + ye;
}

function hasCity(name, city) {
  if (!city) return false;
  return collapse(name).toLowerCase().indexOf(collapse(city).toLowerCase()) !== -1;
}

function dropOpenParen(h) {
  const open = h.lastIndexOf('(');
  const close = h.lastIndexOf(')');
  if (open === -1 || open < close) return h;
  return collapse(h.slice(0, open)).replace(/[\s|·,;:–—-]+$/g, '').trim();
}

function fitHead(head) {
  const room = MAX - SUFFIX.length;
  let h = collapse(head).replace(/[\s|·,;:–—-]+$/g, '').trim();
  if (h.length > room) h = cutWord(h, room).replace(/[\s|·,;:–—-]+$/g, '').trim();
  const dropped = dropOpenParen(h);
  if (dropped && dropped.length + SUFFIX.length >= MIN) h = dropped;
  if (!h) h = 'Event';
  return h + SUFFIX;
}

/**
 * '<Event> <Year> – <City>, <date range> | Transformer Events | TransformerPath'
 * Year stays in the record name when the name already carries it.
 * City and the date range are dropped, in that order, when the title
 * would pass 100 characters. The date range is omitted unless the
 * edition is CONFIRMED.
 */
function eventProfileTitle(ev) {
  const name = collapse((ev && (ev.name || ev.n)) || 'Event');
  const city = collapse((ev && (ev.city || ev.c)) || '');
  const range = confirmed(ev) ? shortRange(ev.start || ev.s, ev.end || ev.e) : '';
  const cityOk = city && !hasCity(name, city);
  const room = MAX - SUFFIX.length;
  const candidates = [];
  if (cityOk && range) candidates.push(name + ' \u2013 ' + city + ', ' + range);
  if (range) candidates.push(name + ' \u2013 ' + range);
  if (cityOk) candidates.push(name + ' \u2013 ' + city);
  candidates.push(name);
  const head = candidates.find(function (c) { return c.length <= room; }) || name;
  return fitHead(head);
}

function eventHubTitle(seriesName) {
  const name = collapse(seriesName || 'Event');
  const room = MAX - SUFFIX.length;
  const tag = ' editions';
  let base = /editions$/i.test(name) ? name.replace(/\s+editions$/i, '') : name;
  // Drop a parenthetical before the editions tag. Cutting first can land
  // inside the parenthesis, and removing it afterwards also removes the tag.
  base = dropOpenParen(base);
  if (!base) base = 'Event';
  if (base.length + tag.length > room) {
    base = cutWord(base, Math.max(1, room - tag.length));
    base = dropOpenParen(base);
  }
  base = collapse(base).replace(/[\s|·,;:–—-]+$/g, '').trim();
  return fitHead((base || 'Event') + tag);
}

function seriesDisplayName(name, slug) {
  let raw = collapse(name || '');
  raw = raw.replace(/\s*\(?20\d{2}\)?/g, ' ');
  raw = raw.replace(/\s*\(\d+(?:st|nd|rd|th)\s+edition\)/ig, ' ');
  raw = raw.replace(/\s+\d+(?:st|nd|rd|th)\s+edition\b/ig, ' ');
  raw = collapse(raw);
  if (raw) return raw;
  const fromSlug = collapse(String(slug || '').replace(/-/g, ' '));
  return fromSlug || 'Event';
}

function residue(text) {
  let s = collapse(text);
  s = s.replace(/\bprovisional\s*[—–-]\s*annual\b[^.]*/ig, ' ');
  s = s.replace(/\bexact dates tbc\b\.?/ig, ' ');
  s = s.replace(/\bdate est\.\s*(\([^)]*\))?/ig, ' ');
  s = s.replace(/\bnext edition:\s*dates not yet announced\b[^.]*/ig, ' ');
  s = s.replace(/\bnot yet published by organiser\b[^.]*/ig, ' ');
  s = s.replace(/\bdates tba\b\.?/ig, ' ');
  return s.replace(/[^a-z0-9]+/gi, ' ').trim();
}

/** True when the description is empty or only a stock date sentence. */
function boilerplateOnly(text) {
  const raw = collapse(text);
  if (!raw) return true;
  if (/^next edition: dates not yet announced\b/i.test(raw)) return true;
  if (/^not yet published by organiser\.?$/i.test(raw)) return true;
  if (/^dates tba\.?$/i.test(raw)) return true;
  return residue(raw).length < 20;
}

function hasEditionSource(ev) {
  const u = collapse((ev && (ev.source_url || ev.sourceUrl)) || '');
  return /^https?:\/\//i.test(u);
}

function editionEnd(ev) {
  return String((ev && (ev.end || ev.e)) || '');
}

/** Undated records are not a past occurrence. A real end before today is past. */
function isFutureEdition(ev, today) {
  const end = editionEnd(ev);
  if (!iso(end)) return true;
  return end >= today;
}

/**
 * Confirmed editions stay indexable.
 * A projected edition, or any other unconfirmed future edition, stays
 * noindex when the record has no source URL. A past unconfirmed edition
 * with a real description can stay indexable.
 */
function shouldNoindexEdition(ev, today) {
  if (!ev) return true;
  if (confirmed(ev)) return false;
  const day = iso(today) ? today : require('./event-display').dubaiToday();
  const status = String(ev.date_status || '').toUpperCase();
  const projected = status === 'PROJECTED';
  const unconfirmedFuture = isFutureEdition(ev, day);
  if (!hasEditionSource(ev) && (projected || unconfirmedFuture)) return true;
  return boilerplateOnly(ev.description || ev.d || '');
}

function isRealEventImage(url) {
  const u = collapse(url);
  if (!/^https?:\/\//i.test(u)) return false;
  if (/\/brand\/og-image\.png(?:$|\?)/i.test(u)) return false;
  if (/\/brand\/favicon/i.test(u)) return false;
  if (/transformerpath\.com\/brand\//i.test(u)) return false;
  return true;
}

function officialUrl(ev) {
  const u = collapse((ev && (ev.officialUrl || ev.official_url)) || '');
  if (!/^https?:\/\//i.test(u)) return '';
  return u;
}

function hubBlurb(seriesName, list) {
  const bits = (list || []).map(function (ev) {
    const name = collapse(ev.name || ev.n);
    const city = collapse(ev.city || ev.c);
    if (!name) return '';
    if (!city) return name;
    const wrapped = '(' + city + ')';
    if (name.toLowerCase().indexOf(wrapped.toLowerCase()) !== -1) return name;
    return name + ' ' + wrapped;
  }).filter(Boolean);
  let s = 'Editions of ' + collapse(seriesName) + ' on TransformerPath';
  if (bits.length) s += ': ' + bits.join('; ');
  s += '. Each year has its own page.';
  return s;
}

function editionInput(ev) {
  const rec = ev || {};
  const st = resolveStatus(rec);
  const image = rec.image || rec.image_url || '';
  return {
    name: rec.name || rec.n || '',
    status: st.key,
    start: rec.start || rec.s || '',
    end: rec.end || rec.e || '',
    city: rec.city || rec.c || '',
    country: rec.country || rec.co || '',
    venue: rec.venue || rec.v || '',
    description: rec.description || rec.d || '',
    organizer: rec.organiser || rec.organizer || '',
    officialUrl: officialUrl(rec),
    image: isRealEventImage(image) ? image : '',
    type: rec.type || '',
    deadlines: Array.isArray(rec.deadlines) ? rec.deadlines : []
  };
}

function hubInput(seriesName, blurb) {
  return {
    name: seriesName || 'Event',
    status: 'MONITORING',
    start: '',
    end: '',
    city: '',
    country: '',
    venue: '',
    description: blurb || '',
    organizer: '',
    officialUrl: '',
    image: '',
    type: ''
  };
}

module.exports = {
  SUFFIX: SUFFIX,
  MAX: MAX,
  MIN: MIN,
  BRAND: BRAND,
  eventProfileTitle: eventProfileTitle,
  eventHubTitle: eventHubTitle,
  seriesDisplayName: seriesDisplayName,
  boilerplateOnly: boilerplateOnly,
  hasEditionSource: hasEditionSource,
  isFutureEdition: isFutureEdition,
  shouldNoindexEdition: shouldNoindexEdition,
  isRealEventImage: isRealEventImage,
  officialUrl: officialUrl,
  hubBlurb: hubBlurb,
  editionInput: editionInput,
  hubInput: hubInput,
  shortRange: shortRange,
  confirmed: confirmed
};
