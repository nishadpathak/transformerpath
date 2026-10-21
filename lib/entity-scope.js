'use strict';
/* Group, subsidiary, and factory events stay on the entity the title names.
 *
 * A company is a subsidiary when another company's name is a strict token
 * prefix of its name. A shared group phrase such as "hitachi energy" does
 * not attach the item to every subsidiary. A subsidiary is attached only
 * when each of its own non-generic name tokens is in the title.
 */

function tokensOf(name, norm) {
  return norm(name).split(' ').filter(Boolean);
}

function hasPhrase(textNorm, phrase) {
  if (!phrase) return false;
  return (' ' + textNorm + ' ').indexOf(' ' + phrase + ' ') >= 0;
}

function longestParent(company, companies, norm) {
  const mine = tokensOf(company.name, norm);
  let best = null;
  let bestLen = 0;
  (companies || []).forEach(function (other) {
    if (!other || other.id === company.id || !other.name) return;
    const theirs = tokensOf(other.name, norm);
    if (!theirs.length || theirs.length >= mine.length || theirs.length <= bestLen) return;
    const prefix = theirs.every(function (t, i) { return mine[i] === t; });
    if (!prefix) return;
    best = other;
    bestLen = theirs.length;
  });
  return best;
}

function extraTokens(company, companies, norm, generic) {
  const parent = longestParent(company, companies, norm);
  if (!parent) return null;
  const mine = tokensOf(company.name, norm);
  const parentTokens = tokensOf(parent.name, norm);
  return mine.slice(parentTokens.length).filter(function (t) { return !generic[t]; });
}

function namedInTitle(extra, text) {
  return !!(extra && extra.length && extra.every(function (t) { return hasPhrase(text, t); }));
}

/**
 * hits: [{ company, phrase }]
 * text: normalized title
 * companies: every company { id, name, slug }
 * Returns a new hit list. Each hit has scope "group" or "subsidiary".
 */
/* Parent names do not depend on the intel title. The same company list is
 * matched against every title, so the parent scan runs once per list. */
let cachedCompanies = null;
let cachedParents = null;
function parentsFor(companies, norm) {
  if (cachedCompanies === companies && cachedParents) return cachedParents;
  const parentOf = {};
  (companies || []).forEach(function (company) {
    if (!company || !company.id) return;
    parentOf[company.id] = longestParent(company, companies, norm);
  });
  cachedCompanies = companies;
  cachedParents = parentOf;
  return parentOf;
}

function assignEntityScope(hits, text, companies, generic, norm) {
  generic = generic || {};
  const parentOf = parentsFor(companies, norm);
  function extraFor(company) {
    const parent = parentOf[company.id] || null;
    if (!parent) return null;
    const mine = tokensOf(company.name, norm);
    const parentTokens = tokensOf(parent.name, norm);
    return mine.slice(parentTokens.length).filter(function (t) { return !generic[t]; });
  }
  const keptIds = {};
  const kept = [];
  (hits || []).forEach(function (hit) {
    if (!hit || !hit.company || !hit.company.id) return;
    const extra = extraFor(hit.company);
    if (extra === null) {
      if (keptIds[hit.company.id]) return;
      keptIds[hit.company.id] = 1;
      kept.push({ company: hit.company, phrase: hit.phrase, scope: 'group' });
      return;
    }
    if (!namedInTitle(extra, text)) return;
    if (keptIds[hit.company.id]) return;
    keptIds[hit.company.id] = 1;
    kept.push({ company: hit.company, phrase: hit.phrase, scope: 'subsidiary' });
  });

  function ancestorKept(company) {
    let parent = parentOf[company.id] || null;
    let guard = 0;
    while (parent && guard < 8) {
      if (keptIds[parent.id]) return true;
      parent = parentOf[parent.id] || null;
      guard++;
    }
    return false;
  }

  (companies || []).forEach(function (company) {
    if (!company || !company.id || keptIds[company.id]) return;
    const extra = extraFor(company);
    if (!namedInTitle(extra, text)) return;
    if (!ancestorKept(company)) return;
    keptIds[company.id] = 1;
    kept.push({ company: company, phrase: extra.join(' '), scope: 'subsidiary' });
  });
  return kept;
}

/**
 * A factory event is attached only when this company's own facility is
 * SOURCED and the title or snippet names that facility's city or site.
 * An unsourced census row, or another country's plant, does not qualify.
 */
function sourcedFacilityId(company, item, facilities, norm) {
  const text = norm((item.title || '') + ' ' + (item.snippet || ''));
  const rows = (facilities || []).filter(function (f) {
    return f && company && f.company_id === company.id && f.status === 'SOURCED';
  });
  for (let i = 0; i < rows.length; i++) {
    const f = rows[i];
    const city = norm(f.city || '');
    const site = norm(f.site || f.facility_name || '');
    if ((city && hasPhrase(text, city)) || (site && hasPhrase(text, site))) return f.id || f.facility_id || null;
  }
  return null;
}

module.exports = {
  assignEntityScope: assignEntityScope,
  extraTokens: extraTokens,
  longestParent: longestParent,
  sourcedFacilityId: sourcedFacilityId
};
