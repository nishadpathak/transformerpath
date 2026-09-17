#!/usr/bin/env node
/* lib/source-concentration.js — Source dependency concentration metrics.
 *
 * PURPOSE
 *   Measures how much of published TransformerPath Intel depends on a small set
 *   of sources (competitor-publication dependency), and how primary vs
 *   secondary the evidence base is. Pure + unit-testable. It does NOT invent
 *   feeds, classify sources, or claim diversification — it computes what the
 *   INPUT says. Built to be statically reviewed and self-tested now, and to be
 *   fed real production Intel once a working shell is available.
 *
 * Input item shape (the future wiring contract):
 *   { intel_id, canonical_fact_id?, sources: [ { source_id, role }, ... ] }
 *   role: PRIMARY | SECONDARY | COMPANY_REPORTED | DISCOVERY_ONLY
 *
 * Rules:
 *   - Each published item/fact is counted ONCE. Multi-source facts count once
 *     but record all supporting sources (no content-volume inflation).
 *   - top_N_source_share = share of items citing at least one of the top-N
 *     sources (a fact counting once even if it names several).
 *   - primary_source_share = items with >=1 PRIMARY-role source.
 *   - secondary_source_share = items with >=1 SECONDARY-role source.
 *   - secondary_only / company_reported_only / discovery_only = items whose
 *     ONLY roles are that one.
 *   - thresholds are configurable QA heuristics, not public truth claims.
 *
 * Run: node lib/source-concentration.js
 */
'use strict';

function rolesOf(item) {
  var R = { hasPrimary: false, hasSecondary: false, hasCompany: false, hasDiscovery: false };
  (item.sources || []).forEach(function (s) {
    var r = String(s.role || '').toUpperCase();
    if (r === 'PRIMARY') R.hasPrimary = true; else if (r === 'SECONDARY') R.hasSecondary = true;
    else if (r === 'COMPANY_REPORTED') R.hasCompany = true; else if (r === 'DISCOVERY_ONLY') R.hasDiscovery = true;
  });
  return R;
}

function unique(a) { var s = {}, o = []; a.forEach(function (x) { if (x && !s[x]) { s[x] = 1; o.push(x); } }); return o; }

function analyze(items, opts) {
  opts = opts || {};
  items = items || [];
  var total = items.length;
  var sourceCount = {};
  items.forEach(function (it) {
    unique((it.sources || []).map(function (s) { return s && s.source_id; })).forEach(function (id) { sourceCount[id] = (sourceCount[id] || 0) + 1; });
  });
  var top = Object.keys(sourceCount).map(function (id) { return { source_id: id, item_count: sourceCount[id] }; })
    .sort(function (a, b) { return b.item_count - a.item_count; });

  function citingTopN(n) {
    var set = {}; top.slice(0, n).forEach(function (s) { set[s.source_id] = 1; });
    return items.filter(function (it) { return (it.sources || []).some(function (s) { return set[s.source_id]; }); }).length;
  }
  var top1 = citingTopN(1), top3 = citingTopN(3), top5 = citingTopN(5);

  var noSource = 0, single = 0, multi = 0, primary = 0, secondary = 0, company = 0;
  var secondaryOnly = 0, companyOnly = 0, discoveryOnly = 0;
  items.forEach(function (it) {
    var srcs = it.sources || [];
    if (!srcs.length) { noSource++; return; }
    if (srcs.length === 1) single++; else multi++;
    var R = rolesOf(it);
    if (R.hasPrimary) primary++;
    if (R.hasSecondary) secondary++;
    if (R.hasCompany) company++;
    if (!R.hasPrimary && R.hasSecondary && !R.hasCompany && !R.hasDiscovery) secondaryOnly++;
    if (!R.hasPrimary && !R.hasSecondary && R.hasCompany) companyOnly++;
    if (!R.hasPrimary && !R.hasSecondary && !R.hasCompany && R.hasDiscovery) discoveryOnly++;
  });

  function share(n) { return total ? n / total : 0; }
  function tc(n) { return Math.round(n * 1000) / 1000; }

  var res = {
    total_items: total,
    unique_sources: top.length,
    top_source_share: tc(share(top1)),
    top_3_source_share: tc(share(top3)),
    top_5_source_share: tc(share(top5)),
    primary_source_share: tc(share(primary)),
    secondary_source_share: tc(share(secondary)),
    secondary_only_share: tc(share(secondaryOnly)),
    company_reported_share: tc(share(company)),
    company_reported_only_share: tc(share(companyOnly)),
    discovery_only_share: tc(share(discoveryOnly)),
    single_source_item_share: tc(share(single)),
    multi_source_item_share: tc(share(multi)),
    items_without_source_share: tc(share(noSource)),
    top_sources: top.slice(0, 10).map(function (s) { return { source_id: s.source_id, item_count: s.item_count, share: tc(share(s.item_count)) }; })
  };

  // Source-type coverage (section 5) — ONLY where the registry supplies source_type.
  if (opts.sourceTypes) {
    var byType = {};
    Object.keys(opts.sourceTypes).forEach(function (id) { var t = opts.sourceTypes[id]; if (t) byType[t] = (byType[t] || 0) + 1; });
    var countries = {}, regions = {};
    Object.keys(opts.sourceRegistry || {}).forEach(function (id) {
      var r = opts.sourceRegistry[id]; if (r && r.country) countries[r.country] = 1; if (r && r.region) regions[r.region] = 1;
    });
    res.coverage = { by_source_type: byType, countries_represented: Object.keys(countries).length, regions_represented: Object.keys(regions).length };
  }

  // Diagnostics — configurable internal heuristics, not public truth.
  var th = Object.assign({ topSource: 0.30, top3: 0.65, primaryMin: 0.30 }, opts.thresholds || {});
  res.diagnostics = [];
  if (res.top_source_share > th.topSource) res.diagnostics.push('HIGH_SINGLE_SOURCE_DEPENDENCY');
  if (res.top_3_source_share > th.top3) res.diagnostics.push('HIGH_TOP3_DEPENDENCY');
  if (res.primary_source_share < th.primaryMin) res.diagnostics.push('LOW_PRIMARY_SOURCE_COVERAGE');
  if (res.items_without_source_share > 0) res.diagnostics.push('SOURCE_ATTRIBUTION_GAP');

  // Machine-readable dependency counters (section 4).
  res.facts_with_primary_source = primary;
  res.facts_secondary_only = secondaryOnly;
  res.facts_company_reported_only = companyOnly;
  res.facts_discovery_only = discoveryOnly;
  res.facts_without_source = noSource;
  return res;
}

module.exports = { analyze, rolesOf };

// ── Self-test ───────────────────────────────────────────────────────────────
if (require.main === module) {
  var S = require('./source-concentration');
  var fails = 0; function ok(c, m) { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ok — ' + m); }
  function near(a, b) { return Math.abs(a - b) < 1e-9; }
  function build(specs) { // [[id, role, count], ...] -> single-source items
    var out = [];
    specs.forEach(function (s) { for (var k = 0; k < s[2]; k++) out.push({ intel_id: 'x', sources: [{ source_id: s[0], role: s[1] }] }); });
    return out;
  }
  function buildMulti(list) { // [ [ [id,role], [id,role], ... ], ... ] -> items
    return list.map(function (tuples) { return { intel_id: 'x', sources: tuples.map(function (t) { return { source_id: t[0], role: t[1] }; }) }; });
  }
  var PS = [['P', 'PRIMARY'], ['S', 'SECONDARY']];
  var ABC = [['A', 'PRIMARY'], ['B', 'SECONDARY'], ['C', 'DISCOVERY_ONLY']];

  console.log('SOURCE CONCENTRATION self-test');

  // 1. One source dominates all items.
  var r1 = S.analyze(build([['A', 'PRIMARY', 10]]));
  ok(r1.total_items === 10 && r1.unique_sources === 1 && near(r1.top_source_share, 1.0) && near(r1.primary_source_share, 1.0), 'one source dominates: total 10, unique 1, top share 1.0');
  ok(r1.diagnostics.indexOf('HIGH_SINGLE_SOURCE_DEPENDENCY') >= 0 && r1.diagnostics.indexOf('HIGH_TOP3_DEPENDENCY') >= 0, 'one-source -> HIGH_SINGLE_SOURCE_DEPENDENCY + HIGH_TOP3');

  // 2. Three-source concentration (4A,3B,2C,1D, each single, PRIMARY).
  var r2 = S.analyze(build([['A', 'PRIMARY', 4], ['B', 'PRIMARY', 3], ['C', 'PRIMARY', 2], ['D', 'PRIMARY', 1]]));
  ok(r2.total_items === 10 && r2.unique_sources === 4 && near(r2.top_source_share, 0.4) && near(r2.top_3_source_share, 0.9) && near(r2.top_5_source_share, 1.0), 'three-source concentration: top1 .40, top3 .90, top5 1.0');

  // 3. Mixed primary/secondary: 3 P-single, 2 S-single, 5 P+S multi.
  var r3 = S.analyze(build([['P', 'PRIMARY', 3], ['S', 'SECONDARY', 2]]).concat(buildMulti([PS, PS, PS, PS, PS])));
  ok(r3.total_items === 10 && near(r3.primary_source_share, 0.8) && near(r3.secondary_source_share, 0.7) && near(r3.single_source_item_share, 0.5) && near(r3.multi_source_item_share, 0.5), 'mixed P/S: primary .80, secondary .70, single .50, multi .50');

  // 4. Multi-source fact (each of 4 items cites A,B,C; counted once).
  var r4 = S.analyze(buildMulti([ABC, ABC, ABC, ABC]));
  ok(r4.total_items === 4 && r4.unique_sources === 3 && near(r4.top_source_share, 1.0) && near(r4.multi_source_item_share, 1.0) && near(r4.single_source_item_share, 0), 'multi-source fact: 4 items, 3 unique, counted once (multi 1.0, top 1.0)');

  // 5. Missing source attribution.
  var r5 = S.analyze(build([['A', 'PRIMARY', 2]]).concat([{ intel_id: 'x', sources: [] }]));
  ok(r5.total_items === 3 && near(r5.items_without_source_share, 1 / 3) && r5.diagnostics.indexOf('SOURCE_ATTRIBUTION_GAP') >= 0, 'missing source attribution -> SOURCE_ATTRIBUTION_GAP, 1/3');

  // 6. Company-reported only.
  var r6 = S.analyze(build([['X', 'COMPANY_REPORTED', 3]]));
  ok(near(r6.company_reported_share, 1.0) && near(r6.company_reported_only_share, 1.0) && near(r6.primary_source_share, 0), 'company-reported only -> company share 1.0, primary 0');

  // 7. Balanced source universe (20 items, 20 distinct PRIMARY sources).
  var r7 = S.analyze(build(Array.apply(null, Array(20)).map(function (_, i) { return ['S' + i, 'PRIMARY', 1]; })));
  ok(r7.unique_sources === 20 && near(r7.top_source_share, 0.05) && near(r7.top_3_source_share, 0.15) && r7.diagnostics.length === 0, 'balanced: unique 20, top .05, top3 .15, no diagnostics');

  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'SOURCE CONCENTRATION PASS'));
  process.exitCode = fails ? 1 : 0;
}
