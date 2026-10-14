/* lib/provenance-badge.js — one provenance badge for events, Intel,
 * manufacturer evidence, facilities and directory rows.
 *
 * Visible form:
 *   Confirmed · Source: organiser site · checked 14 Oct 2026
 * The source phrase is a link to source_url. "checked" is printed only when
 * the record has a real YYYY-MM-DD check date. No source URL means no badge.
 * A weaker stored grade is never raised to a stronger tier.
 *
 * Browser: <script src="/lib/provenance-badge.js"> sets window.TPProvenance.
 * Node: require('./lib/provenance-badge').
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TPProvenance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RANK = { Listed: 1, Supported: 2, Confirmed: 3 };
  var TIER_HELP = {
    Confirmed: 'Confirmed means a primary official source states this fact.',
    Supported: 'Supported means a reputable secondary source backs this fact. It is not a primary confirmation.',
    Listed: 'Listed means a directory entry or an unverified claim. It is not a confirmation.'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function lower(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return RANK[a] <= RANK[b] ? a : b;
  }

  function httpUrl(raw) {
    var s = String(raw || '').trim();
    if (!/^https?:\/\//i.test(s)) return '';
    if (/[\s<>"']/.test(s)) return '';
    return s;
  }

  function formatChecked(raw) {
    if (raw == null || raw === '') return '';
    var m = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (isNaN(dt.getTime())) return '';
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function normToken(s) {
    return String(s || '').trim().toLowerCase().replace(/[_—–-]+/g, ' ').replace(/\s+/g, ' ');
  }

  function sourceLabel(input) {
    var explicit = String(input.source_label || '').trim();
    if (explicit) return explicit;
    var code = normToken(input.source_type);
    var map = {
      'industry news': 'trade press',
      'trade press': 'trade press',
      'organiser': 'organiser site',
      'organiser site': 'organiser site',
      'manufacturer': 'manufacturer site',
      'manufacturer site': 'manufacturer site',
      'official website': 'official website',
      'tender': 'official tender portal',
      'official tender portal': 'official tender portal',
      'directory': 'directory listing',
      'directory listing': 'directory listing',
      'utility': 'official source',
      'regulator': 'official source',
      'official source': 'official source'
    };
    if (map[code]) return map[code];
    if (input.context === 'event') return 'organiser site';
    return '';
  }

  function gradeFromStatus(status) {
    var s = normToken(status);
    if (!s) return null;
    if (s === 'official website checked' || s === 'website checked') return 'Confirmed';
    if (s.indexOf('listed') === 0) return 'Listed';
    if (s === 'unverified' || s === 'inactive') return null;
    return null;
  }

  function gradeFromProvenance(p) {
    var s = String(p || '').trim().toUpperCase();
    if (s === 'PRIMARY') return 'Confirmed';
    if (s === 'SECONDARY') return 'Supported';
    if (s === 'CURATED' || s === 'WIRE') return 'Listed';
    return null;
  }

  function gradeFromConfidence(c) {
    var s = String(c || '').trim().toUpperCase();
    if (s === 'HIGH') return 'Confirmed';
    if (s === 'MEDIUM') return 'Supported';
    if (s === 'LIMITED') return 'Listed';
    return null;
  }

  function gradeFromEvidence(g) {
    var s = String(g || '').trim().toUpperCase();
    if (s === 'CONFIRMED') return 'Confirmed';
    if (s === 'SUPPORTED') return 'Supported';
    if (s === 'REVIEW_REQUIRED') return 'Listed';
    if (s === 'REJECTED') return 'REJECT';
    return null;
  }

  function gradeFromClaim(c) {
    var s = String(c || '').trim().toUpperCase();
    if (s === 'INDEPENDENTLY_SOURCED') return 'Supported';
    if (s === 'COMPANY_REPORTED' || s === 'INFERRED' || s === 'UNVERIFIED') return 'Listed';
    return null;
  }

  function resolveTier(input) {
    input = input || {};
    var evidence = gradeFromEvidence(input.evidence_grade);
    if (evidence === 'REJECT') return null;
    var tier = null;
    tier = lower(tier, evidence);
    tier = lower(tier, gradeFromProvenance(input.provenance));
    tier = lower(tier, gradeFromConfidence(input.confidence));
    tier = lower(tier, gradeFromStatus(input.verification_status));
    tier = lower(tier, gradeFromClaim(input.claim_type));
    if (String(input.date_status || '').toUpperCase() === 'CONFIRMED') tier = lower(tier, 'Confirmed');
    if (/tier\s*c/i.test(String(input.source_tier || ''))) tier = lower(tier, 'Listed');
    var src = normToken(input.source_type);
    if (src === 'industry news' || src === 'trade press') {
      if (tier === 'Confirmed') tier = 'Supported';
    }
    return tier;
  }

  function provenanceBadge(input, opts) {
    input = input || {};
    opts = opts || {};
    var url = httpUrl(input.source_url || input.website || input.url);
    if (!url) return '';
    var tier = resolveTier(input);
    if (!tier) return '';
    var label = sourceLabel(input);
    if (!label) return '';
    var checked = formatChecked(input.checked_at || input.source_checked_at || input.verification_date || input.last_verified);
    var method = opts.methodologyHref || '/methodology.html#provenance';
    var mark = tier === 'Listed' ? '' : '<span class="tp-prov-mark" aria-hidden="true">✓</span>';
    var checkedHtml = checked ? '<span class="tp-prov-sep"> · </span><span>checked ' + esc(checked) + '</span>' : '';
    return '<span class="tp-prov tp-prov-' + tier.toLowerCase() + '">' +
      mark +
      '<span class="tp-prov-tier">' + tier + '</span>' +
      '<span class="tp-prov-sep"> · </span>' +
      '<span>Source: <a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + '</a></span>' +
      checkedHtml +
      '<button type="button" class="tp-prov-tip" aria-label="What ' + tier + ' means">?</button>' +
      '<span class="tp-prov-pop" role="note">' + esc(TIER_HELP[tier]) +
      ' <a href="' + esc(method) + '">How we grade sources</a></span>' +
      '</span>';
  }

  function eventBadge(ev) {
    if (!ev || String(ev.date_status || '') !== 'CONFIRMED') return '';
    return provenanceBadge({
      source_url: ev.source_url,
      source_type: 'organiser site',
      checked_at: ev.source_checked_at,
      date_status: 'CONFIRMED',
      context: 'event'
    });
  }

  function intelSourceLabel(p) {
    var prov = String(p.provenance || '').toUpperCase();
    var blob = (String(p.url || '') + ' ' + String(p.sourceName || '') + ' ' + String(p.src || '')).toLowerCase();
    if (prov === 'CURATED' || prov === 'WIRE') return 'directory listing';
    if (prov === 'SECONDARY') return 'trade press';
    if (/tender|etimad|tenderboard|procurement|dewa/.test(blob)) return 'official tender portal';
    if (/press-release|news-and-events\/press|hitachienergy|manufacturer/.test(blob)) return 'manufacturer site';
    if (prov === 'PRIMARY') return 'official source';
    return '';
  }

  function intelBadge(p) {
    if (!p || !p.provenance) return '';
    return provenanceBadge({
      source_url: p.url,
      source_label: intelSourceLabel(p),
      provenance: p.provenance,
      checked_at: p.source_checked_at || p.checked_at || ''
    });
  }

  function directoryBadge(rec) {
    rec = rec || {};
    var status = rec.verification_status || '';
    var listed = normToken(status).indexOf('listed') === 0;
    return provenanceBadge({
      source_url: rec.website || rec.source_url || rec.url,
      source_type: listed ? 'directory listing' : 'official website',
      checked_at: rec.verification_date || rec.source_checked_at || '',
      verification_status: status
    });
  }

  function facilityBadge(rec) {
    rec = rec || {};
    if (!rec.claim_type && !rec.confidence && !rec.source_tier && !rec.provenance) return '';
    return provenanceBadge({
      source_url: rec.source_url || rec.url,
      source_type: 'manufacturer site',
      claim_type: rec.claim_type,
      confidence: rec.confidence,
      source_tier: rec.source_tier,
      provenance: rec.provenance
    });
  }

  function evidenceBadge(fact) {
    fact = fact || {};
    return provenanceBadge({
      source_url: fact.source_url,
      source_type: fact.source_type,
      confidence: fact.confidence,
      claim_type: fact.claim_type,
      checked_at: fact.last_verified || ''
    });
  }

  /* Legacy display phrases are recognised as grades, then removed from
   * embedded JSON so public HTML does not keep the old label. */
  function scrubLegacyLabels(text) {
    return String(text)
      .split('Official Website Checked').join('WEBSITE_CHECKED')
      .split('SOURCE CHECKED').join('PROVENANCE');
  }

  return {
    provenanceBadge: provenanceBadge,
    resolveTier: resolveTier,
    formatChecked: formatChecked,
    eventBadge: eventBadge,
    intelBadge: intelBadge,
    directoryBadge: directoryBadge,
    facilityBadge: facilityBadge,
    evidenceBadge: evidenceBadge,
    scrubLegacyLabels: scrubLegacyLabels
  };
});
