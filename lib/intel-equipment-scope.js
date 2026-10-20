#!/usr/bin/env node
/* Equipment scope for a Daily Intel item.
 *
 * This is not the evidence grade. CONFIRMED / SUPPORTED / INFERRED /
 * PIPELINE / WATCH say whether the event is confirmed. equipment_scope
 * says what the source is about. transformer_scope_confirmed is true
 * only when that source names transformer equipment. A confirmed
 * switchgear notice stays event-confirmed and is not transformer scope.
 *
 * Tag from the source text already on the item (title, snippet, value).
 * An explicit equipment_scope on the item wins. Ambiguous source text
 * is "unclear". Do not infer a transformer from a company name alone.
 */
'use strict';

const SCOPES = ['transformer', 'switchgear-only', 'general-substation', 'unclear'];

const TX_WORD = /\b(auto-?transformers?|transformers?|rectifier transformers?|converter transformers?|distribution transformers?|power transformers?|interconnecting transformers?|icts?|gsus?|oltc)\b/i;
const TX_RATING = /\b\d[\d,.\s]*\s*(?:MVA|kVA)\b/i;
const REACTOR = /\breactors?\b/i;
const SW = /\b(switchgears?|switchboards?|switch-?boards?|gas-insulated switchgear|\bgis\b|circuit[- ]breakers?|dead-tank breakers?|disconnectors?)\b/i;
const SUB = /\b(substations?|interconnections?|grid expansion|transmission (?:line|project|capacity|system)|distribution network)\b/i;
const MIXED = /\b(reactors?|power equipment|ehv)\b/i;

function clean(text) {
  return String(text || '')
    .replace(/transformerpath/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseScope(value) {
  const s = String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (s === 'switchgear' || s === 'switchgear-only') return 'switchgear-only';
  if (s === 'general' || s === 'substation' || s === 'general-substation') return 'general-substation';
  if (s === 'transformer') return 'transformer';
  if (s === 'unclear' || s === 'ambiguous') return 'unclear';
  return '';
}

function withoutNegatedSignals(text) {
  const gear = '(?:auto-?transformers?|transformers?|interconnecting transformers?|icts?|gsus?|oltc)';
  return text
    .replace(new RegExp('\\b(?:no|not|without|never)\\b[^.]{0,90}?\\b' + gear + '\\b', 'gi'), ' ')
    .replace(/\b(?:no|not|without|never)\b[^.]{0,90}?\d[\d,.\s]*\s*(?:MVA|kVA)\b/gi, ' ');
}

function fromText(text) {
  const t = clean(text);
  if (!t) {
    return { equipment_scope: 'unclear', transformer_scope_confirmed: false, scope_basis: 'empty_source_text' };
  }
  const stated = withoutNegatedSignals(t);
  const txWord = TX_WORD.test(stated);
  const txRating = TX_RATING.test(stated) && !REACTOR.test(stated);
  const tx = txWord || txRating;
  const sw = SW.test(t);
  const sub = SUB.test(t);
  if (tx) {
    return { equipment_scope: 'transformer', transformer_scope_confirmed: true, scope_basis: 'source_names_transformer' };
  }
  if (sw && MIXED.test(t)) {
    return { equipment_scope: 'unclear', transformer_scope_confirmed: false, scope_basis: 'source_mixes_switchgear_with_other_equipment' };
  }
  if (sw) {
    return { equipment_scope: 'switchgear-only', transformer_scope_confirmed: false, scope_basis: 'source_names_switchgear_only' };
  }
  if (sub) {
    return { equipment_scope: 'general-substation', transformer_scope_confirmed: false, scope_basis: 'source_names_substation_without_transformer' };
  }
  return { equipment_scope: 'unclear', transformer_scope_confirmed: false, scope_basis: 'source_ambiguous' };
}

function classifyEquipmentScope(item) {
  item = item || {};
  const explicit = normaliseScope(item.equipment_scope || item.equipmentScope);
  if (explicit) {
    const confirmed = explicit === 'transformer'
      ? (item.transformer_scope_confirmed === false ? false : true)
      : false;
    return {
      equipment_scope: explicit,
      transformer_scope_confirmed: confirmed,
      scope_basis: 'explicit_on_item'
    };
  }
  const text = [item.title, item.headline, item.snippet, item.soWhat, item.value, item.scope].filter(Boolean).join(' ');
  return fromText(text);
}

const HEADLINE_PREFIX = {
  'switchgear-only': 'Switchgear only: ',
  'general-substation': 'General substation, not transformer-specific: ',
  'unclear': 'Transformer scope not established: '
};

function scopeHeadline(headline, scope) {
  const h = String(headline || '').trim();
  const prefix = HEADLINE_PREFIX[scope] || '';
  if (!prefix || !h) return h;
  if (h.toLowerCase().indexOf(prefix.toLowerCase()) === 0) return h;
  return prefix + h;
}

const SCOPE_BADGE = {
  transformer: 'transformer scope confirmed',
  'switchgear-only': 'switchgear only',
  'general-substation': 'general substation',
  unclear: 'scope unclear'
};

function scopeBadgeText(classified) {
  if (!classified) return '';
  if (classified.transformer_scope_confirmed) return SCOPE_BADGE.transformer;
  return SCOPE_BADGE[classified.equipment_scope] || SCOPE_BADGE.unclear;
}

module.exports = {
  SCOPES: SCOPES,
  HEADLINE_PREFIX: HEADLINE_PREFIX,
  SCOPE_BADGE: SCOPE_BADGE,
  classifyEquipmentScope: classifyEquipmentScope,
  scopeHeadline: scopeHeadline,
  scopeBadgeText: scopeBadgeText
};
