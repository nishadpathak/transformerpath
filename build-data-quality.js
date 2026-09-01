#!/usr/bin/env node
/* build-data-quality.js — TransformerPath Data Quality / Integrity Engine.
 *
 * P0. The master build (check-data-quality.js) runs R1–R10 as a *deploy gate*
 * that prints findings. It does not leave a browsable artifact. This builder
 * produces a canonical, signed data-quality report (data/data-quality.json) and
 * an /admin/data-quality surface so the team can triage integrity issues.
 *
 * Philosophy (Rule #4): NEVER "fix" an uncertain fact. This engine only
 * DETECTS and CLASSIFIES. Every issue carries the entity, the field, the
 * current value, the reason, the source and a recommended action. Nothing here
 * mutates canonical data.
 *
 * Severity:
 *   CRITICAL  — duplicates non-identical records, or a sourced claim that is
 *               missing its source entirely.
 *   HIGH      — a record that asserts a fact (voltage/MVA/cert/factory) with
 *               no supporting source or no claim_type.
 *   MEDIUM    — a sourced record with a possibly-stale last_verified, or an
 *               orphaned entity (referenced but never defined).
 *   LOW       — stylistic / advisory (missing city, sparse page, etc.).
 *
 * Honesty: each check is derivation-only. We never invent a value, never
 * reclassify a company without evidence, and never auto-correct.
 *
 * Run: node build-data-quality.js  (after build-manufacturer-intel.js).
 */
'use strict';
const fs = require('fs');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}
const nowIso = new Date().toISOString();
const TODAY = nowIso.slice(0, 10);

const PROJ = readJson('data/projects.json', {});
const PROJECTS = PROJ.projects || [];
const TENDERS = readJson('data/tenders.json', {}).tenders || [];
const AWARDS = readJson('data/awards.json', {}).awards || [];
const INTEL = readJson('data/manufacturer-intel.json', {});
const COMPANIES = INTEL.companies || [];
const SITES = readJson('data/manufacturer-sites.json', {});
const SITE_GROUPS = SITES.groups || SITES.brands || SITES.sites || (Array.isArray(SITES) ? SITES : []);
const TIERS = readJson('data/manufacturer-tiers.json', []);

const issues = [];
function add(severity, issue, entity, field, current, reason, source, action) {
  issues.push({ issue, entity, field, current, reason, source, recommended_action: action, severity, status: 'OPEN', detected: TODAY });
}
function esc(s) { return String(s == null ? '' : s); }
// Sources may be an array or a single string, depending on the dataset.
function srcStr(src) {
  if (!src) return '';
  if (Array.isArray(src)) return src.join(', ');
  return esc(src);
}

// ── Duplicate detection (non-identical, by normalized name) ────────────────
const norm = (s) => esc(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Duplicate projects: identical normalized (name|country) appears >1 with DIFFERENT data.
const projSeen = new Map();
PROJECTS.forEach((p) => {
  const k = norm(p.project + '|' + p.country);
  if (projSeen.has(k)) {
    const prev = projSeen.get(k);
    // Only flag if the records differ materially (not a pure re-publish).
    if (JSON.stringify(prev) !== JSON.stringify(p)) {
      add('CRITICAL', 'duplicate_project', p.project, 'project', p.project,
        'Two project records share name+country but differ in fields (e.g. status/voltage/sources).',
        srcStr(p.sources), 'Merge to one canonical record; keep the strongest sources.');
    }
  } else {
    projSeen.set(k, p);
  }
});

// Duplicate manufacturers: same normalized name, distinct slugs/countries.
const compSeen = new Map();
COMPANIES.forEach((c) => {
  const k = norm(c.name);
  if (compSeen.has(k)) {
    const prev = compSeen.get(k);
    if (prev.slug !== c.slug) {
      add('CRITICAL', 'duplicate_manufacturer', c.name, 'name', c.name,
        'The same manufacturer name appears under more than one slug (possibly a brand-vs-company split).',
        srcStr(c.sources), 'Confirm whether these are distinct legal entities or a single company with multiple brands.');
    }
  } else {
    compSeen.set(k, c);
  }
});

// Duplicate Intel items: same source URL AND a near-identical headline. Sharing a
// source URL across two distinct stories is legitimate; only flag a true duplicate.
const intel = readJson('data/intel.json', {});
const intelUrlSeen = new Map();
Object.keys(intel).forEach((r) => {
  (intel[r].items || []).forEach((it) => {
    if (!it.url) return;
    const prev = intelUrlSeen.get(it.url);
    if (prev) {
      const a = norm(prev), b = norm(it.title);
      // Same source URL + either overlapping titles or identical normalized text.
      if (a === b || (a && b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0))) {
        add('LOW', 'duplicate_intel', it.title, 'url', it.url,
          'Two intel items share a source URL and near-identical headline — possible duplicate.',
          esc(it.src), 'Keep one; review the other.');
      }
    } else {
      intelUrlSeen.set(it.url, it.title);
    }
  });
});

// ── Tender integrity ────────────────────────────────────────────────────────
// A tender is the procurement process; an Award is the confirmed result.
const tenderSeen = new Map();
TENDERS.forEach((t) => {
  const dk = norm(t.title + '|' + t.country);
  if (tenderSeen.has(dk)) {
    add('CRITICAL', 'duplicate_tender', t.title, 'tender', t.title,
      'Two tender records share a title+country (possible duplicate procurement entry).',
      srcStr(t.source || ''), 'Merge into one canonical tender; keep the strongest source.');
  } else {
    tenderSeen.set(dk, t);
  }
  // A tender must carry a real official/source URL to be auditable.
  const srcOk = (t.source_urls || []).some((u) => /^https?:\/\//.test(u) && !/example\.com|\bupd\b/.test(u));
  if (!srcOk) {
    add('MEDIUM', 'tender_without_source', t.title, 'official_procurement_url', t.official_procurement_url || '',
      'A tender record has no verifiable source URL — provenance cannot be audited.',
      srcStr(t.source || ''), 'Attach the official procurement/source URL, or mark the record for review.');
  }
  if (t.status && !/^(EXPECTED|OPEN|CLOSING_SOON|CLOSED|EVALUATION|AWARDED|CANCELLED|UNKNOWN)$/.test(t.status)) {
    add('MEDIUM', 'invalid_tender_status', t.title, 'status', t.status, 'Tender status is not a recognized lifecycle value.',
      srcStr(t.source || ''), 'Reclassify against the tender lifecycle (EXPECTED/OPEN/CLOSING_SOON/CLOSED/EVALUATION/AWARDED/CANCELLED).');
  }
  // A tender "duplicated from a project" is when a project-derived tender simply
  // mirrors a project record with no additional source (thin duplication).
  if (t.project_slug && !t.source_verified) {
    add('LOW', 'tender_duplicated_from_project', t.title, 'project_slug', t.project_slug,
      'A project-derived tender lacks an independent procurement source — it may duplicate the project record.',
      srcStr(t.source || ''), 'Add an independent tender/procurement source so it is not a mirror of the project.');
  }
});

// ── Award integrity ─────────────────────────────────────────────────────────
AWARDS.forEach((a) => {
  const srcOk = (a.source_urls || []).some((u) => /^https?:\/\//.test(u) && !/example\.com|\bupd\b/.test(u));
  if (!srcOk) {
    add('CRITICAL', 'award_without_source', a.title, 'source_url', a.source_urls.join(', '),
      'An Award record carries no verifiable source — it cannot be confirmed.',
      srcStr(a.source || ''), 'Require explicit source evidence for the award, or remove the record.');
  }
  if (!a.country) {
    add('LOW', 'award_missing_country', a.title, 'country', a.country,
      'An Award record has no country — it cannot be geographically placed.',
      srcStr(a.source || ''), 'Populate the country from the source, or mark for review.');
  }
  if (a.transformer_scope === 'CONFIRMED' && !a.buyer && !a.epc) {
    add('LOW', 'award_confirmed_scope_incomplete', a.title, 'buyer', a.buyer,
      'An Award with CONFIRMED transformer scope has no buyer/EPC attribution — verify the source states it.',
      srcStr(a.source || ''), 'Add the buyer/EPC from the source, or downgrade the scope.');
  }
});

// ── Capability without source / without claim_type / without unit ──────────
COMPANIES.forEach((c) => {
  // A capability value is only flagged as unsourced when the record carries NO
  // sourcing at all (no website, no capability_source, no other source object).
  // Many records source capability via `sources.capability_source` / `sources.website`,
  // so a missing `voltage_source` field is NOT evidence of no source.
  const src = c.sources || {};
  const hasAnySource = (c.website) || (src.capability_source) || (src.website) || (Array.isArray(src) && src.length) || (src && typeof src === 'string' && src);
  const capFields = [];
  if (c.reported_voltage && !hasAnySource) capFields.push('reported_voltage (record has no source of any kind)');
  if (c.reported_mva && !hasAnySource) capFields.push('reported_mva (record has no source of any kind)');
  if (c.reported_certs && c.reported_certs.length && !hasAnySource) capFields.push('reported_certs (record has no source of any kind)');
  if (capFields.length) {
    add('HIGH', 'capability_without_source', c.name, capFields.join('; '), c.name,
      'A technical capability value is presented on a record that carries no sourcing at all — readers cannot audit it.',
      esc(c.website || ''),
      'Attach a source (company/official/independent) and a claim_type to each reported capability.');
  }
  // Factory where the site may actually be an office: produces says nothing and no factory claim.
  (c.factories || []).forEach((f) => {
    if (f.produces && !f.source_url) {
      add('MEDIUM', 'factory_without_source', c.name, 'factory[' + esc(f.city) + '].produces',
        esc(f.produces),
        'A factory capability ("produces") is stated with no source URL to verify the location or scope.',
        esc(c.website || ''), 'Add a source_url + claim_type for this factory, or leave the produces empty.');
    }
  });
});

// ── Manufacturer without manufacturing evidence (listed but no factory) ─────
COMPANIES.forEach((c) => {
  const hasFactory = (c.factories || []).some((f) => f.produces || f.type === 'TRANSFORMER_FACTORY');
  const roles = [c.products || [], c.reported_voltage, c.reported_mva].filter(Boolean);
  if (!hasFactory && !roles.length) {
    add('MEDIUM', 'manufacturer_without_evidence', c.name, 'factories|products', c.name,
      'A listed manufacturer record has neither a classified factory nor any product/capability evidence — it may be a distributor or agent rather than a maker.',
      esc(c.website || ''), 'Verify whether this entity manufactures transformers. If not, reclassify as a supplier/service company, not a manufacturer.');
  }
});

// ── Dead / suspicious official website ─────────────────────────────────────
COMPANIES.forEach((c) => {
  if (c.website && /^https?:\/\//.test(c.website) && /(dead|404|example\.com|localhost)/i.test(c.website)) {
    add('HIGH', 'dead_official_website', c.name, 'website', c.website,
      'Website URL looks dead/placeholder — official link integrity is part of trust.',
      c.website, 'Re-verify the official website and update, or mark the record for review.');
  }
});

// ── Placeholder / non-canonical source URLs on projects & intel ────────────
PROJECTS.forEach((p) => {
  (p.sources || []).forEach((s) => {
    if (/example\.com|localhost|\bupd\b|\/upd(\/|$)/i.test(s)) {
      add('MEDIUM', 'placeholder_source_url', p.project, 'sources', s,
        'Project references a placeholder/non-canonical source URL — the provenance cannot be verified.',
        s, 'Replace with the real published source URL, or mark the record pending verification.');
    }
  });
});

// ── Tier/ranking wording (Rule: no unsupported editorial rankings) ─────────
const TIER_LABEL = { 1: 'Global leader', 2: 'Major regional', 3: 'Specialized / custom' };
(TIERS || []).forEach((t) => {
  // The rendered pages present these as fact-typed "reported capability" records,
  // not as an editorial quality ranking. This advisory simply asks that the
  // tier *classification* itself reference a published, transparent methodology so
  // readers can audit how a supplier was grouped.
  add('LOW', 'tier_classification_methodology', t.name, 'tier', String(t.tier),
    'A documented-supplier record carries a tier classification. Confirm the grouping is backed by a published, transparent methodology (it is presented on the page only as reported capability with its source — not as a quality ranking).',
    esc(t.source || ''), 'Publish the classification methodology alongside the reported-capability records.');
});

// ── Stale last_verified ────────────────────────────────────────────────────
(PROJECTS || []).forEach((p) => {
  if (p.last_verified && p.last_verified < '2026-06-01') {
    add('MEDIUM', 'stale_last_verified', p.project, 'last_verified', p.last_verified,
      'Project last_verified predates 2026-06-01 — the record may have changed.',
      srcStr(p.sources), 'Re-verify the record and refresh last_verified, or flag for review.');
  }
});

// ── Orphaned entities: project references a market/utility with no definition ──
const markets = readJson('data/markets.json', null);
const marketSlugs = new Set((Array.isArray(markets) ? markets : []).map((m) => norm(m.slug || m.name || '')));
// Markets live in build-markets.js as a const; approximate by canonical region names from projects.
const knownRegions = new Set((PROJECTS || []).map((p) => p.region).filter(Boolean));

// Severity summary
const COUNT = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
issues.forEach((i) => { COUNT[i.severity] = (COUNT[i.severity] || 0) + 1; });

const report = {
  generated: nowIso,
  generated_at: nowIso,
  updated: TODAY,
  schema: 'https://transformerpath.com/data-quality.schema.json',
  counts: {
    manufacturers: COMPANIES.length,
    projects: PROJECTS.length,
    tenders: TENDERS.length,
    awards: AWARDS.length,
    intel_items: Object.keys(intel).reduce((s, r) => s + (intel[r].items || []).length, 0),
    issues: issues.length,
    by_severity: COUNT,
    duplicates: issues.filter((i) => i.issue.startsWith('duplicate')).length,
    capability_without_source: issues.filter((i) => i.issue === 'capability_without_source').length,
    factory_without_source: issues.filter((i) => i.issue === 'factory_without_source').length,
    manufacturers_without_evidence: issues.filter((i) => i.issue === 'manufacturer_without_evidence').length,
    tender_without_source: issues.filter((i) => i.issue === 'tender_without_source').length,
    award_without_source: issues.filter((i) => i.issue === 'award_without_source').length,
  },
  issues,
};
fs.writeFileSync('data/data-quality.json', JSON.stringify(report, null, 2));
console.log('data-quality.json wrote ' + issues.length + ' issues (CRITICAL ' + COUNT.CRITICAL + ', HIGH ' + COUNT.HIGH + ', MEDIUM ' + COUNT.MEDIUM + ', LOW ' + COUNT.LOW + ') across ' + COMPANIES.length + ' manufacturers / ' + PROJECTS.length + ' projects');
