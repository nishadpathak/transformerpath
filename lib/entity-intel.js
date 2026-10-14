'use strict';
/* lib/entity-intel.js — entity profiles vs regional Intel.
 *
 * An item is about an entity only when the title, snippet or buyer names that
 * entity. Sharing a country or a regional feed is not an entity link. "SEC"
 * does not match "Secuencia".
 */
function fold(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const STOP = {
  co: 1, company: 1, ltd: 1, limited: 1, llc: 1, inc: 1, plc: 1, sa: 1,
  the: 1, and: 1, of: 1, group: 1
};

function phrasesFor(name) {
  const out = [];
  String(name || '').split(/[/|,()]+/).forEach(function (part) {
    part.split(/[^A-Za-z0-9]+/).forEach(function (tok) {
      if (/^[A-Z0-9]{2,6}$/.test(tok) && /[A-Z]/.test(tok)) out.push(tok.toLowerCase());
    });
    const words = fold(part).split(/[^a-z0-9]+/).filter(function (w) { return w && !STOP[w] && w.length > 2; });
    if (words.length >= 2) out.push(words.join(' '));
    else if (words.length === 1 && words[0].length >= 5) out.push(words[0]);
  });
  if (fold(name).indexOf('saudi electricity') >= 0) out.push('sec');
  const seen = {};
  return out.filter(function (p) {
    if (!p || seen[p]) return false;
    seen[p] = 1;
    return true;
  });
}

function itemText(item) {
  if (!item) return '';
  return fold([item.title, item.snippet, item.buyer].filter(Boolean).join(' '));
}

function mentionsEntity(item, name) {
  const text = itemText(item);
  if (!text) return false;
  return phrasesFor(name).some(function (p) {
    if (p.indexOf(' ') < 0 && p.length <= 6) {
      return new RegExp('(?:^|[^a-z0-9])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[^a-z0-9]|$)').test(text);
    }
    return text.indexOf(p) >= 0;
  });
}

function splitEntityIntel(items, name) {
  const about = [];
  const regional = [];
  (items || []).forEach(function (item) {
    if (!item) return;
    if (mentionsEntity(item, name)) about.push(item);
    else regional.push(item);
  });
  return { about: about, regional: regional };
}

module.exports = { fold, phrasesFor, mentionsEntity, splitEntityIntel };
