#!/usr/bin/env node
/* lib/intel-source-normalizer.js — Intel source attribution migration layer.
 *
 * PURPOSE
 *   data/intel.json items carry human-readable source attribution in a `src`
 *   string (e.g. "SaudiGulf Projects · 18 Jul 2026 [en]") and a `url`. There is
 *   no source_id / source_domain / source_role yet. This module derives
 *   candidate source attributes and resolves them against the source registry
 *   WITHOUT redesigning data/intel.json or populating a partial registry.
 *
 *   It keeps two meanings separate (spec section 6):
 *     - SOURCE CLASSIFICATION (PRIMARY / SECONDARY / DISCOVERY_ONLY) — from the
 *       registry's primary_or_secondary field.
 *     - CLAIM-SPECIFIC ROLE (PRIMARY_EVIDENCE / SUPPORTING_EVIDENCE /
 *       COMPANY_REPORTED / DISCOVERY) — a default derived by the migration; a
 *       manufacturer site can be PRIMARY evidence that it announced its own
 *       factory while still being COMPANY_REPORTED for the underlying claim.
 *
 *   Rules:
 *     - Source NAME is the first segment of src before date/language metadata.
 *       original src is left untouched.
 *     - Domain normalization strips only the bare `www.` prefix; subdomains
 *       (news., investors., procurement.) are NOT blindly collapsed.
 *     - source_id_candidate is a STABLE stub (slugified canonical_domain). The
 *       real semantic source_id is resolved from the registry; a candidate is
 *       never silently used as the final id when resolution is AMBIGUOUS.
 *
 *   Run: node lib/intel-source-normalizer.js
 */
'use strict';

// ── source name from src (strip date/language; keep original src) ─────────
function parseSourceName(src) {
  var s = String(src || '').trim();
  if (!s) return '';
  // Take the segment before the first date/language separator.
  var seg = s.split(/[·|]/)[0].trim();
  if (seg && seg !== s) return collapse(seg);
  // No separator: strip a trailing "[en]"/"· date" pattern.
  seg = s
    .replace(/\s*·?\s*\[[a-z]{2}\]\s*$/i, '')
    .replace(/\s*·?\s*\d{1,2}\s+[A-Za-z]{3}\s+2026.*$/i, '')
    .replace(/\s*·\s*date unverified\s*$/i, '')
    .trim();
  return collapse(seg);
}
function collapse(s) { return String(s || '').trim().replace(/\s+/g, ' '); }
function normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }

// ── URL / domain normalization ─────────────────────────────────────────────
function urlParts(url) {
  var u;
  try { u = new URL(String(url || '').trim()); } catch (e) { return { status: 'INVALID_URL' }; }
  var hostname = u.hostname.toLowerCase();
  var canonical = hostname.replace(/^www\./, '');
  return { status: 'OK', hostname: hostname, canonical_domain: canonical, pathname: u.pathname };
}
function slugify(domain) { return String(domain || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// ── registry indexes ───────────────────────────────────────────────────────
function buildIndex(registry) {
  var byDomain = {}, byName = {};
  (registry || []).forEach(function (src) {
    var d = (src.canonical_domain || src.domain || '').toLowerCase();
    if (d) { (byDomain[d] = byDomain[d] || []).push(src.source_id); }
    (src.domains || []).forEach(function (x) { (byDomain[x.toLowerCase()] = byDomain[x.toLowerCase()] || []).push(src.source_id); });
    var n = normName(src.name);
    if (n) { (byName[n] = byName[n] || []).push(src.source_id); }
  });
  return { byDomain: byDomain, byName: byName };
}
function entryFor(registry, id) { return (registry || []).find(function (s) { return s.source_id === id; }); }

// ── claim-specific role (default heuristic; keeps classification separate) ─
function claimRoleFor(entry) {
  if (!entry) return 'DISCOVERY';
  if (entry.source_type === 'COMPANY_SOCIAL') return 'DISCOVERY';
  if (entry.source_type === 'MANUFACTURER' || entry.source_type === 'COMPANY_FILING') return 'COMPANY_REPORTED';
  if (entry.primary_or_secondary === 'PRIMARY') return 'PRIMARY_EVIDENCE';
  if (entry.primary_or_secondary === 'SECONDARY') return 'SUPPORTING_EVIDENCE';
  return 'DISCOVERY';
}

// ── resolve an item against the registry ───────────────────────────────────
function resolve(item, registry) {
  var srcName = parseSourceName(item.src);
  var up = urlParts(item.url);
  var base = {
    intel_id: (item.intel_id || item.url || ''),
    original_src: item.src,
    original_url: item.url,
    source_name: srcName,
    source_domain: up.status === 'OK' ? up.canonical_domain : null,
    source_id_candidate: up.status === 'OK' ? slugify(up.canonical_domain) : null,
    source_id: null,
    source_classification: null,
    source_role: null,
    resolution_status: null
  };
  if (!item.src || !srcName) return done(base, 'MISSING_SOURCE');
  if (up.status === 'INVALID_URL') return done(base, 'INVALID_URL');
  var idx = buildIndex(registry); var dom = up.canonical_domain;
  var dHits = idx.byDomain[dom] || [];
  if (dHits.length === 1) { base.source_id = dHits[0]; return done(base, 'DOMAIN_MATCH'); }
  if (dHits.length > 1) { base.resolution_note = 'domain maps to multiple sources: ' + dHits.join(', '); return done(base, 'AMBIGUOUS'); }
  var nHits = idx.byName[normName(srcName)] || [];
  if (nHits.length === 1) { base.source_id = nHits[0]; return done(base, 'NAME_MATCH'); }
  if (nHits.length > 1) { base.resolution_note = 'name maps to multiple sources: ' + nHits.join(', '); return done(base, 'AMBIGUOUS'); }
  return done(base, 'UNREGISTERED');
}
function done(out, status) {
  out.resolution_status = status;
  return out;
}

// Enrich a resolved result with registry classification + claim role.
function enrich(result, registry) {
  if (result.source_id) {
    var entry = entryFor(registry, result.source_id);
    if (entry) {
      result.source_name = entry.name || result.source_name;
      result.source_classification = entry.primary_or_secondary || null;
      result.source_role = claimRoleFor(entry);
    }
  }
  if (!result.source_id) {
    result.source_classification = null;
    result.source_role = 'DISCOVERY';
    // Candidate stub id (never a silent resolve when ambiguous).
    result.source_id = result.source_id_candidate;
  }
  return result;
}

// Public API: resolve + enrich against a registry.
function lookup(item, registry) { return enrich(resolve(item, registry), registry); }

// ── migration output shape ─────────────────────────────────────────────────
function migrationShape(item, registry) {
  var r = lookup(item, registry);
  return {
    intel_id: r.intel_id,
    original_src: r.original_src,
    original_url: r.original_url,
    source_name: r.source_name,
    source_domain: r.source_domain,
    source_id: r.source_id,
    source_classification: r.source_classification,
    source_role: r.source_role,
    resolution_status: r.resolution_status,
    resolution_note: r.resolution_note || null
  };
}

// ── unresolved queue ────────────────────────────────────────────────────────
function buildQueue(items, registry) {
  var queued = [];
  (items || []).forEach(function (it) {
    var r = lookup(it, registry);
    if (['UNREGISTERED', 'AMBIGUOUS', 'INVALID_URL', 'MISSING_SOURCE'].indexOf(r.resolution_status) >= 0) {
      queued.push({ intel_id: r.intel_id, source_name: r.source_name, source_domain: r.source_domain, source_id_candidate: r.source_id_candidate, resolution_status: r.resolution_status, note: r.resolution_note || null });
    }
  });
  return queued;
}

module.exports = { parseSourceName, urlParts, slugify, normName, resolve, lookup, migrationShape, buildQueue, claimRoleFor };

// ── Self-test fixtures ──────────────────────────────────────────────────────
if (require.main === module) {
  var S = require('./intel-source-normalizer');
  var fails = 0; function ok(c, m) { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ok — ' + m); }

  var REG = [
    { source_id: 'saudigulf-projects', name: 'SaudiGulf Projects', canonical_domain: 'saudigulfprojects.com', domains: ['www.saudigulfprojects.com'], source_type: 'INDUSTRY_MEDIA', primary_or_secondary: 'SECONDARY', authority_class: 'INDUSTRY_MEDIA' },
    { source_id: 'dewa', name: 'Dubai Electricity & Water Authority', canonical_domain: 'dewa.gov.ae', domains: ['www.dewa.gov.ae'], source_type: 'UTILITY', primary_or_secondary: 'PRIMARY', authority_class: 'OFFICIAL' }
  ];

  console.log('INTEL SOURCE NORMALIZER self-test');

  // normal src + URL, registered -> DOMAIN_MATCH
  var a = S.migrationShape({ intel_id: 'i1', src: 'SaudiGulf Projects · 18 Jul 2026 [en]', url: 'https://www.saudigulfprojects.com/2026/07/x' }, REG);
  ok(a.source_name === 'SaudiGulf Projects', 'src strips date/language -> "SaudiGulf Projects"');
  ok(a.source_domain === 'saudigulfprojects.com', 'www normalized to canonical_domain');
  ok(a.source_id === 'saudigulf-projects' && a.resolution_status === 'DOMAIN_MATCH', 'registered domain -> DOMAIN_MATCH, semantic source_id');
  ok(a.source_classification === 'SECONDARY' && a.source_role === 'SUPPORTING_EVIDENCE', 'classification SECONDARY, claim role SUPPORTING_EVIDENCE');

  // same source through two URL variants (www vs no www, tracking path) -> same source_id
  var b = S.migrationShape({ intel_id: 'i2', src: 'SaudiGulf Projects · 1 Aug 2026 [en]', url: 'https://saudigulfprojects.com/2026/08/y?tracking=1' }, REG);
  ok(b.source_id === 'saudigulf-projects' && b.source_domain === 'saudigulfprojects.com', 'two URL variants -> same source_id (path/tracking ignored)');

  // subdomain kept distinct from apex
  var c = S.migrationShape({ intel_id: 'i3', src: 'News Corp', url: 'https://news.example.com/story' }, REG);
  ok(c.source_domain === 'news.example.com' && c.source_id === 'news-example-com', 'subdomain NOT collapsed to apex; distinct candidate');

  // tracker/path URL for registered utility -> still DOMAIN_MATCH
  var d = S.migrationShape({ intel_id: 'i4', src: 'DEWA · 2 Aug 2026 [en]', url: 'https://www.dewa.gov.ae/en/news/123' }, REG);
  ok(d.source_id === 'dewa' && d.source_classification === 'PRIMARY' && d.source_role === 'PRIMARY_EVIDENCE', 'utility official site -> PRIMARY / PRIMARY_EVIDENCE');

  // LinkedIn URL
  var e = S.migrationShape({ intel_id: 'i5', src: 'Hitachi Energy · LinkedIn', url: 'https://www.linkedin.com/company/hitachi-energy/posts/1' }, REG);
  ok(e.source_domain === 'linkedin.com' && e.resolution_status === 'UNREGISTERED', 'LinkedIn -> linkedin.com, UNREGISTERED (not silently resolved)');

  // missing src / url / invalid url
  ok(S.migrationShape({ intel_id: 'i6', url: 'https://x.com/a' }, REG).resolution_status === 'MISSING_SOURCE', 'missing src -> MISSING_SOURCE');
  ok(S.migrationShape({ intel_id: 'i7', src: 'Some Source', url: '' }, REG).resolution_status === 'INVALID_URL', 'missing url -> INVALID_URL');
  ok(S.migrationShape({ intel_id: 'i8', src: 'Some Source', url: 'not a url' }, REG).resolution_status === 'INVALID_URL', 'invalid url -> INVALID_URL');

  // ambiguous name (name present in two registry entries)
  var REG2 = [{ source_id: 'a', name: 'Ambiguous Media', canonical_domain: 'amb1.com', source_type: 'INDUSTRY_MEDIA' }, { source_id: 'b', name: 'Ambiguous Media', canonical_domain: 'amb2.com', source_type: 'INDUSTRY_MEDIA' }];
  var amb = S.migrationShape({ intel_id: 'i9', src: 'Ambiguous Media · 1 Jan 2026', url: 'https://somewhere.com/x' }, REG2);
  ok(amb.resolution_status === 'AMBIGUOUS', 'ambiguous name -> AMBIGUOUS');

  // queue: unregistered + invalid + ambiguous collected
  var q = S.buildQueue([ { intel_id:'q1', src:'Unknown · 1 Jan 2026', url:'https://unknown.example.com/a' }, { intel_id:'q2', src:'x', url:'' } ], REG);
  ok(Array.isArray(q) && q.length === 2 && q.some(function(x){return x.resolution_status==='INVALID_URL';}), 'queue collects UNREGISTERED/INVALID');

  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'INTEL SOURCE NORMALIZER PASS'));
  process.exitCode = fails ? 1 : 0;
}
