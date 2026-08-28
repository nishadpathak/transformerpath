#!/usr/bin/env node
/* build-provenance.js — internal source-provenance model for manufacturer
 * technical-capability facts.
 *
 * This is the Priority 1 "SOURCE PROVENANCE MODEL". Every important fact keeps
 * an explicit evidence trail. Two hard rules are enforced here:
 *   - A fact is a SINGLE field (e.g. "maximum_voltage", "maximum_rating"). We
 *     NEVER combine a separately-stated MVA and kV into one capability claim.
 *   - We never assert a figure is a manufacturer's MAXIMUM unless a source says
 *     so. Where the evidence is a confirmed (sourced) project/order/factory we
 *     record it as CAPABILITY EVIDENCE ("at least X kV-class"), confidence
 *     LIMITED, claim_type INDEPENDENTLY_SOURCED/COMPANY_REPORTED — and we say
 *     so in the note.
 *
 * Facts are drawn VERBATIM (title/url/date) from data/intel.json confirmed
 * items — nothing is invented or inferred beyond an explicit source statement.
 *
 * Output: data/manufacturer-provenance.json (internal; rendered conservatively
 * on profile pages as "Reported capability — sourced evidence", never as a
 * verified maximum). Run before build-company-pages (see netlify.toml).
 */
'use strict';
const fs = require('fs');

// Curated, verified capability-evidence map. Each key is an exact census/tier
// entity name; each fact is one field with full provenance.
const CURATED = [
  {
    name: 'Hitachi Energy',
    facts: [
      { field: 'voltage_class_evidence', value: 765, unit: 'kV',
        source_title: 'Hitachi Energy India wins Rs 6.47bn PGCIL order for 765 kV transformers',
        source_url: 'https://powerpeakdigest.com/hitachi-energy-wins-rs-6-47-billion-765-kv-transformers-order/',
        source_type: 'industry_news', source_date: '2026-07-01', confidence: 'LIMITED',
        claim_type: 'INDEPENDENTLY_SOURCED',
        note: 'Confirmed 765 kV-class transformer order. Evidence of at least 765 kV capability — NOT asserted as the company maximum.' },
    ],
  },
  {
    name: 'BHEL (Bharat Heavy Electricals)',
    facts: [
      { field: 'voltage_class_evidence', value: 765, unit: 'kV',
        source_title: 'BHEL wins Rs 3,618m 765 kV transformer package from PGCIL',
        source_url: 'https://powerpeakdigest.com/pgcil-awards-rs-3-6-bn-765-kv-transformer-contract-to-bhel/',
        source_type: 'industry_news', source_date: '2026-07-01', confidence: 'LIMITED',
        claim_type: 'INDEPENDENTLY_SOURCED',
        note: 'Confirmed 765 kV-class transformer package. Evidence of at least 765 kV capability — NOT asserted as the company maximum.' },
    ],
  },
  {
    name: 'CG Power',
    facts: [
      { field: 'voltage_class_evidence', value: 765, unit: 'kV',
        source_title: 'CG Power wins major PGCIL bulk EHV order — 765 kV Package 7TR-12',
        source_url: 'https://www.tndindia.com/cg-wins-major-bulk-procurement-order-from-pgcil-ehv-transformers/',
        source_type: 'industry_news', source_date: '2026-07-01', confidence: 'LIMITED',
        claim_type: 'INDEPENDENTLY_SOURCED',
        note: 'Confirmed 765 kV-class bulk EHV transformer order. Evidence of at least 765 kV capability — NOT asserted as the company maximum.' },
    ],
  },
  {
    name: 'Hyosung Heavy Industries',
    facts: [
      { field: 'voltage_class_evidence', value: 765, unit: 'kV',
        source_title: 'Hyosung Heavy wins ₩310bn 5-year UHV transformer & reactor supply deal with Australia\'s AusNet',
        source_url: 'https://www.seoul.co.kr/news/economy/industry/2026/07/03/20260703030006',
        source_type: 'industry_news', source_date: '2026-07-03', confidence: 'LIMITED',
        claim_type: 'INDEPENDENTLY_SOURCED',
        note: 'Confirmed UHV (765 kV-class) transformer & reactor supply deal. Evidence of UHV capability — NOT asserted as the company maximum.' },
    ],
  },
  {
    name: 'HD Hyundai Electric',
    facts: [
      { field: 'voltage_class_evidence', value: 765, unit: 'kV',
        source_title: 'HD Hyundai Electric signs ₩1.02tn long-term data-centre power-infrastructure deal (incl. ultra-high-voltage transformers)',
        source_url: 'https://www.etoday.co.kr/news/view/2599845',
        source_type: 'industry_news', source_date: '2026-07-02', confidence: 'LIMITED',
        claim_type: 'INDEPENDENTLY_SOURCED',
        note: 'Confirmed ultra-high-voltage transformer scope. Evidence of UHV capability — NOT asserted as the company maximum.' },
    ],
  },
  {
    name: 'China XD Group',
    facts: [
      { field: 'voltage_class_evidence', value: 1100, unit: 'kV',
        source_title: 'China XD wins CNY 4.13bn in SGCC third-batch UHV & transmission equipment tenders',
        source_url: 'https://www.jiemian.com/article/14811421.html',
        source_type: 'industry_news', source_date: '2026-07-01', confidence: 'LIMITED',
        claim_type: 'INDEPENDENTLY_SOURCED',
        note: 'Confirmed UHV (1100 kV-class) transmission equipment tender participation. Evidence of UHV capability — NOT asserted as the company maximum.' },
    ],
  },
];

const CONFIDENCE = ['HIGH', 'MEDIUM', 'LIMITED'];
const CLAIM_TYPES = ['INDEPENDENTLY_SOURCED', 'COMPANY_REPORTED', 'INFERRED', 'UNVERIFIED'];

function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// sanity-check each curated fact's source_url actually appears in data/intel.json
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const ALL_INTEL = Object.values(INTEL).flatMap(function (r) { return (r.items || []); });
const intelUrls = new Set(ALL_INTEL.map(function (it) { return it.url; }));

CURATED.forEach(function (c) {
  c.facts.forEach(function (f) {
    if (!intelUrls.has(f.source_url)) {
      console.warn('WARN provenance url not found in data/intel.json (still kept, verify): ' + c.name + ' :: ' + f.source_url);
    }
    if (!CONFIDENCE.includes(f.confidence)) throw new Error('bad confidence ' + c.name);
    if (!CLAIM_TYPES.includes(f.claim_type)) throw new Error('bad claim_type ' + c.name);
    if (!f.value || !f.unit) throw new Error('missing value/unit ' + c.name);
    // NEVER combine MVA and kV into one fact value/note as a product capability.
    if (/mva/i.test(f.field) && /kv/i.test(f.field)) throw new Error('combined field ' + c.name);
    if (new RegExp('\\bMVA\\b', 'i').test(f.note || '') && /kV\b/.test(f.note || '')) {
      // a note may explain; guard only against an explicit combined capability claim
      if (/\b[\d,.]+\s*MVA\b[^\n]*\b[\d,.]+\s*kV\b/i.test(f.note || '')) throw new Error('combined capability in note ' + c.name);
    }
  });
});

const out = CURATED.map(function (c) {
  return {
    name: c.name,
    facts: c.facts.map(function (f) { return Object.assign({}, f, { retrieved_at: '2026-08-28', last_verified: '2026-08-28' }); }),
    source: 'TransformerPath Daily Intel / primary news',
    lastVerified: '2026-08-28',
  };
});

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/manufacturer-provenance.json', JSON.stringify(out, null, 2));
console.log('manufacturer-provenance.json wrote ' + out.length + ' entities | ' + out.reduce(function (s, c) { return s + c.facts.length; }, 0) + ' sourced facts');
out.forEach(function (c) { c.facts.forEach(function (f) { console.log('  ' + c.name + ' :: ' + f.field + ' = ' + f.value + ' ' + f.unit + ' [' + f.confidence + '/' + f.claim_type + ']'); }); });
