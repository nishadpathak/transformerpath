#!/usr/bin/env node
/* lib/directory-sort.js — Manufacturer Directory display-order + country-count
 * rules (paper/pen for the public directory fix). Pure + unit-testable.
 *
 * Rules (objective):
 *   1. Manufacturers within each country sort alphabetically by a derived
 *      canonical sort_name (locale-aware, case-insensitive natural sort,
 *      ignoring leading/trailing whitespace). Never sort by verification/Pro
 *      status, paid plan, completeness, insertion order, internal ID or RFQ
 *      eligibility.
 *   2. A derived sort_name must not alter the displayed legal name. Handle
 *      prefixes by ONE documented rule, applied consistently:
 *        DROP a leading article ("The ", "A ", "An ") for sorting only.
 *      Choose this rule and apply it uniformly so "The XYZ Transformer Co."
 *      sorts as "XYZ Transformer Co." — but never merge truly different
 *      entities (the rule is applied to the full remaining name; it does not
 *      normalise across distinct legal names).
 *   3. Countries within a region sort alphabetically (never by manufacturer
 *      count) unless an intentionally documented regional convention exists.
 *   4. Country counts = canonical manufacturer entities per country, unique
 *      (one manufacturer counted once per country it is present in). No
 *      inflation from aliases, duplicate records, brand names, multiple URLs,
 *      or event appearances.
 *   5. Default public directory browsing is alphabetical; actual search may be
 *      relevance-first; technical sourcing may be match-first.
 *   6. Verified/Pro badges stay visible but never reorder the default list.
 *
 *   The function `reconcileCounts` implements the Item-8 rule: the global
 *   headline (546 in 84 countries) is a UNIQUE-MANUFACTURER count, whereas each
 *   per-country count is a COUNTRY-PRESENCE count; a manufacturer present in
 *   more than one country is counted once in the global total and once per
 *   country, so the per-country SUM may exceed the global unique count. It
 *   reports this rather than forcing the numbers to match.
 *
 * Run: node lib/directory-sort.js
 */
'use strict';

// Natural, locale-aware, case-insensitive comparator over sort names.
function naturalCompare(a, b) {
  a = String(a); b = String(b);
  if (typeof Intl !== 'undefined' && Intl.Collator) {
    return new Intl.Collator('en', { numeric: true, sensitivity: 'base', usage: 'sort' }).compare(a, b);
  }
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

// Derived sort name: trim, drop a leading article once, strip multiple spaces.
function sortName(displayName) {
  var n = String(displayName == null ? '' : displayName).trim().replace(/\s+/g, ' ');
  var m = n.match(/^(The|A|An)\s+(.+)$/i);   // drop leading article for sorting only
  if (m && m[2]) n = m[2];
  return n;
}

// Sort manufacturers alphabetically by sort_name (never by status/paid/order).
function sortManufacturers(list) {
  return (list || []).map(function (m) { return Object.assign({}, m, { __sort_name: sortName(m.name || (m[0] != null ? m[0] : '')) }); })
    .sort(function (a, b) { return naturalCompare(a.__sort_name, b.__sort_name); });
}

// Sort countries alphabetically (pass a comparator default).
function sortCountries(countries) { return (countries || []).sort(function (a, b) { return naturalCompare(a, b); }); }

// Derive an ordered country -> count map from the canonical dataset.
// canonical: array of country records, each { name, makers:[ {name/slug} ] }.
// Each maker is counted once per country it is present in.
function countryCounts(canonical, opts) {
  opts = opts || {};
  var out = [];
  (canonical || []).forEach(function (rec) {
    var makers = (rec.makers || rec.companies || []).filter(function (m) { return m && !/^Served by/i.test(String(m.name || m[0])); });
    var seen = {}; // unique manufacturers in THIS country (drop aliases/duplicates)
    var uniq = makers.filter(function (m) {
      var k = String(m.name || m[0] || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
      if (!k || seen[k]) return false; seen[k] = 1; return true;
    });
    out.push({ country: rec.name || rec.country, count: uniq.length, unique_company_count_in_country: uniq.length });
  });
  // Country-report rule: no inflation from aliases/brands/multiple URLs (dedup above).
  out.sort(function (a, b) { return naturalCompare(a.country, b.country); });
  return out;
}

// Item-8 reconciliation: global unique-manufacturer count vs per-country presence.
// Returns { global_unique, per_country_sum, matches, multiCountry, note }.
function reconcileCounts(counts, globalUnique) {
  var sum = (counts || []).reduce(function (a, c) { return a + c.count; }, 0);
  var matches = sum === globalUnique;
  return {
    global_unique: globalUnique,
    per_country_sum: sum,
    matches: matches,
    note: matches
      ? 'Per-country counts sum to the global unique-manufacturer count.'
      : 'Sum of per-country counts (' + sum + ') exceeds the global unique-manufacturer count (' + globalUnique + '), because ' +
        (+sum - +globalUnique) + ' manufacturer(s) are present in more than one country: the global headline is a UNIQUE-MANUFACTURER count, each country count is a COUNTRY-PRESENCE count. Not forced to match.'
  };
}

module.exports = { naturalCompare, sortName, sortManufacturers, sortCountries, countryCounts, reconcileCounts };

// ── Self-test ───────────────────────────────────────────────────────────────
if (require.main === module) {
  var S = require('./directory-sort');
  var fails = 0; function ok(c, m) { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ok — ' + m); }
  console.log('DIRECTORY SORT + COUNTRY COUNTS self-test');

  // Alphabetical USA (name-based, case-insensitive, natural), not by status/paid.
  var usa = [
    { name: 'Siemens Energy', pro: true }, { name: 'abb', pro: false, verified: true },
    { name: 'Delta Star', pro: false }, { name: 'Eaton', pro: true }, { name: 'prolec GE', verified: true },
  ];
  var sortedUSA = S.sortManufacturers(usa).map(function (m) { return m.__sort_name; });
  ok(sortedUSA[0] === 'abb' && sortedUSA.indexOf('Delta Star') === 1 && sortedUSA.indexOf('Eaton') === 2 && sortedUSA.indexOf('prolec GE') === 3 && sortedUSA.indexOf('Siemens Energy') === 4, 'USA manufacturers alphabetical (abb, Delta Star, Eaton, prolec GE, Siemens Energy) — not by paid/verified/order');
  ok(S.sortName('The XYZ Transformer Company') === 'XYZ Transformer Company', 'leading "The" dropped for sorting only');
  ok(S.sortName('  ABB  ') === 'ABB', 'leading/trailing whitespace ignored');

  // Countries within region alphabetical.
  var na = S.sortCountries(['USA', 'Mexico', 'Canada']);
  ok(na.join(',') === 'Canada,Mexico,USA', 'region countries alphabetical (Canada, Mexico, USA) — not by count');

  // Country counts == canonical, aliases don't inflate.
  var canon = [
    { name: 'USA', makers: [{ name: 'ABB' }, { name: 'abb' }, { name: 'Delta Star' }, { name: 'Eaton' }] },
    { name: 'Canada', makers: [{ name: 'Prolec GE' }, { name: 'Prolec GE' }] },
  ];
  var cc = S.countryCounts(canon);
  var usaC = cc.filter(function (c) { return c.country === 'USA'; })[0].count;
  var canC = cc.filter(function (c) { return c.country === 'Canada'; })[0].count;
  ok(usaC === 3, 'USA count = 3 (aliases/dup "ABB"/"abb" collapsed, not inflated)');
  ok(canC === 1, 'Canada count = 1 (duplicate "Prolec GE" collapsed, not inflated)');
  ok(S.countryCounts(canon).map(function (c) { return c.country; }).join(',') === 'Canada,USA', 'country counts sorted alphabetically');

  // Reconciliation.
  var r = S.reconcileCounts([{ country: 'USA', count: 3 }, { country: 'Canada', count: 1 }], 4);
  ok(r.matches === true, 'counts sum to global unique (3+1=4)');
  var r2 = S.reconcileCounts([{ country: 'USA', count: 3 }, { country: 'Canada', count: 2 }], 4);
  ok(r2.matches === false && /UNIQUE-MANUFACTURER/.test(r2.note), 'multi-country presence -> sum > unique; reported, not forced');

  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'DIRECTORY SORT + COUNTRY COUNTS PASS'));
  process.exitCode = fails ? 1 : 0;
}
