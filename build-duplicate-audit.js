#!/usr/bin/env node
/**
 * build-duplicate-audit.js — P0.7 Duplicate Audit
 *
 * Scans canonical companies and facilities for:
 * 1. Normalized company name similarity (Levenshtein / Token Set Ratio > 0.85)
 * 2. Shared domain names
 * 3. Shared physical addresses / exact city + country combinations with similar names
 *
 * Outputs human-reviewable queue to: data/duplicate-review-queue.json
 */

const fs = require('fs');
const path = require('path');

const COMPANIES_PATH = path.join(__dirname, 'data/companies.json');
const FACILITIES_PATH = path.join(__dirname, 'data/facilities.json');
const OUTPUT_PATH = path.join(__dirname, 'data/duplicate-review-queue.json');

// Stop words / suffixes for normalization
const CORP_SUFFIXES = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'ltd', 'limited',
  'llc', 'llp', 'gmbh', 'co', 'company', 's.a.', 'sa', 'spa', 's.p.a.',
  'bv', 'b.v.', 'ag', 'a.g.', 'pvt', 'pty', 'sl', 's.l.', 'srl', 's.r.l.',
  'group', 'holdings', 'holding', 'systems', 'technologies', 'technology'
]);

function normalizeName(name) {
  if (!name) return '';
  let cleaned = name.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(' ').filter(t => t && !CORP_SUFFIXES.has(t));
  return tokens.join(' ');
}

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

function levenshteinRatio(s1, s2) {
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return 1 - (dist / maxLen);
}

function tokenSetRatio(s1, s2) {
  const tokens1 = Array.from(new Set(s1.split(' ').filter(Boolean))).sort().join(' ');
  const tokens2 = Array.from(new Set(s2.split(' ').filter(Boolean))).sort().join(' ');
  return levenshteinRatio(tokens1, tokens2);
}

function cleanDomain(d) {
  if (!d) return '';
  return d.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
}

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com'
]);

function runAudit() {
  if (!fs.existsSync(COMPANIES_PATH)) {
    console.error('Error: companies.json not found. Run build-canonical-entities.js first.');
    process.exit(1);
  }

  const rawCompanies = JSON.parse(fs.readFileSync(COMPANIES_PATH, 'utf8'));
  const companies = Array.isArray(rawCompanies) ? rawCompanies : (rawCompanies.companies || []);

  const rawFacilities = fs.existsSync(FACILITIES_PATH) ? JSON.parse(fs.readFileSync(FACILITIES_PATH, 'utf8')) : [];
  const facilities = Array.isArray(rawFacilities) ? rawFacilities : (rawFacilities.facilities || []);

  const queue = [];
  const seenPairs = new Set();

  function pairKey(id1, id2) {
    return [id1, id2].sort().join(':::');
  }

  // 1. Cross-audit companies
  for (let i = 0; i < companies.length; i++) {
    const c1 = companies[i];
    const norm1 = normalizeName(c1.name);
    const domain1 = cleanDomain(c1.domain || c1.website);

    for (let j = i + 1; j < companies.length; j++) {
      const c2 = companies[j];
      const pKey = pairKey(c1.id, c2.id);
      if (seenPairs.has(pKey)) continue;

      const norm2 = normalizeName(c2.name);
      const domain2 = cleanDomain(c2.domain || c2.website);

      let flagged = false;
      let reason = '';
      let score = 0;
      let action = 'investigate';
      let notes = '';

      // Check Domain match
      if (domain1 && domain2 && domain1 === domain2 && !GENERIC_DOMAINS.has(domain1)) {
        flagged = true;
        reason = 'domain_match';
        score = 1.0;
        if (norm1 === norm2) {
          action = 'merge';
          notes = `Identical domain (${domain1}) and matching name`;
        } else {
          action = 'keep_separate_facility';
          notes = `Same corporate domain (${domain1}) across different branded business units/entities`;
        }
      }

      // Check Name Similarity (> 0.85)
      if (!flagged && norm1 && norm2) {
        const ratio = Math.max(levenshteinRatio(norm1, norm2), tokenSetRatio(norm1, norm2));
        if (ratio >= 0.85) {
          flagged = true;
          reason = 'name_similarity';
          score = Math.round(ratio * 100) / 100;
          if (c1.headquarters?.country && c2.headquarters?.country && c1.headquarters.country === c2.headquarters.country) {
            action = 'merge';
            notes = `High name similarity (${score}) in same country (${c1.headquarters.country})`;
          } else {
            action = 'investigate';
            notes = `High name similarity (${score}) across different countries (${c1.headquarters?.country || 'Unknown'} vs ${c2.headquarters?.country || 'Unknown'})`;
          }
        }
      }

      // Check City + Country + moderate name similarity (> 0.70)
      if (!flagged && c1.headquarters?.country && c2.headquarters?.country &&
          c1.headquarters.country.toLowerCase() === c2.headquarters.country.toLowerCase() &&
          c1.headquarters?.city && c2.headquarters?.city &&
          c1.headquarters.city.toLowerCase() === c2.headquarters.city.toLowerCase()) {
        const ratio = Math.max(levenshteinRatio(norm1, norm2), tokenSetRatio(norm1, norm2));
        if (ratio >= 0.70) {
          flagged = true;
          reason = 'address_match';
          score = Math.round(ratio * 100) / 100;
          action = ratio >= 0.80 ? 'merge' : 'investigate';
          notes = `Same city/country (${c1.headquarters.city}, ${c1.headquarters.country}) with moderate name similarity (${score})`;
        }
      }

      if (flagged) {
        seenPairs.add(pKey);
        queue.push({
          id: `dup_${queue.length + 1}`,
          reason,
          similarity_score: score,
          recommended_action: action,
          notes,
          entities: [
            {
              id: c1.id,
              name: c1.name,
              slug: c1.slug,
              country: c1.headquarters?.country || null,
              city: c1.headquarters?.city || null,
              domain: domain1 || null,
              roles: c1.roles || []
            },
            {
              id: c2.id,
              name: c2.name,
              slug: c2.slug,
              country: c2.headquarters?.country || null,
              city: c2.headquarters?.city || null,
              domain: domain2 || null,
              roles: c2.roles || []
            }
          ]
        });
      }
    }
  }

  // Summary counts
  const summary = {
    domain_match: queue.filter(q => q.reason === 'domain_match').length,
    name_similarity: queue.filter(q => q.reason === 'name_similarity').length,
    address_match: queue.filter(q => q.reason === 'address_match').length
  };

  const actions = {
    merge: queue.filter(q => q.recommended_action === 'merge').length,
    keep_separate_facility: queue.filter(q => q.recommended_action === 'keep_separate_facility').length,
    investigate: queue.filter(q => q.recommended_action === 'investigate').length
  };

  const output = {
    generated_at: new Date().toISOString(),
    total_potential_duplicates: queue.length,
    summary_by_reason: summary,
    summary_by_action: actions,
    queue
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log('✅ Duplicate audit complete:');
  console.log(`   Total items in review queue: ${queue.length}`);
  console.log(`   - Domain matches: ${summary.domain_match}`);
  console.log(`   - Name similarity: ${summary.name_similarity}`);
  console.log(`   - Address matches: ${summary.address_match}`);
  console.log(`   Recommended actions: ${actions.merge} merge, ${actions.keep_separate_facility} keep separate facility, ${actions.investigate} investigate`);
  console.log(`   Output written to: ${OUTPUT_PATH}`);
}

runAudit();
