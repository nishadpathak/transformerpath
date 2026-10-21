/* lib/provenance-badge.js — one verified tick for events, Intel,
 * manufacturer evidence, facilities and directory rows.
 *
 * A tick is shown only when the stored grade resolves to Confirmed
 * (a primary official source), a source URL is present, and a real
 * check date is present. Supported and Listed render nothing.
 * The tick is an inline SVG labelled "Sourced". It records a source check.
 * It is not the paid Verified Manufacturer badge. Hover, focus and tap
 * open a tooltip; the button title carries the same sentence for no-JS.
 *
 * Browser: <script src="/lib/provenance-badge.js"> sets window.TPProvenance.
 * Node: require('./lib/provenance-badge').
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TPProvenance = api;
  if (root && root.document && !root.__tpProvBound) {
    root.__tpProvBound = true;
    bindTicks(root.document);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RANK = { Listed: 1, Supported: 2, Confirmed: 3 };
  var seq = 0;
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

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
    var text = String(raw).trim();
    var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    var y, mo, d;
    if (iso) {
      y = +iso[1]; mo = +iso[2]; d = +iso[3];
    } else {
      var disp = text.match(/^(\d{1,2}) ([A-Za-z]{3,9}) (\d{4})$/);
      if (!disp || MONTHS[disp[2].toLowerCase()] == null) return '';
      d = +disp[1]; mo = MONTHS[disp[2].toLowerCase()] + 1; y = +disp[3];
    }
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

  function tickHtml(url, label, checked) {
    seq += 1;
    var id = 'tp-prov-' + seq;
    var plain = 'Sourced · Source: ' + label + ' · checked ' + checked;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" role="img" aria-label="Sourced" focusable="false"><path fill="currentColor" d="M6.17 11.83 2.7 8.36l1.06-1.06 2.41 2.41 5.07-5.07 1.06 1.06z"/></svg>';
    return '<span class="tp-prov">' +
      '<button type="button" class="tp-prov-tick" title="' + esc(plain) + '" aria-expanded="false" aria-describedby="' + id + '">' +
      svg +
      '</button>' +
      '<span class="tp-prov-pop" role="tooltip" id="' + id + '">Sourced · Source: <a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + '</a> · checked ' + esc(checked) + '</span>' +
      '</span>';
  }

  function provenanceBadge(input) {
    input = input || {};
    var url = httpUrl(input.source_url || input.website || input.url);
    var checked = formatChecked(input.checked_at || input.source_checked_at || input.verification_date || input.last_verified);
    if (resolveTier(input) !== 'Confirmed' || !url || !checked) return '';
    var label = sourceLabel(input);
    if (!label) return '';
    return tickHtml(url, label, checked);
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
      provenance: rec.provenance,
      checked_at: rec.source_checked_at || ''
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

function bindTicks(doc) {
  function wrapOf(node) {
    return node && node.closest ? node.closest('.tp-prov') : null;
  }
  function closeAll(except) {
    var nodes = doc.querySelectorAll('.tp-prov.is-open');
    for (var i = 0; i < nodes.length; i++) {
      if (except && nodes[i] === except) continue;
      nodes[i].classList.remove('is-open');
      var b = nodes[i].querySelector('.tp-prov-tick');
      if (b) b.setAttribute('aria-expanded', 'false');
    }
  }
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.tp-prov-tick') : null;
    if (btn) {
      var wrap = btn.parentNode;
      var open = !wrap.classList.contains('is-open');
      closeAll(open ? wrap : null);
      if (open) wrap.classList.add('is-open');
      else wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (e.target.closest && e.target.closest('.tp-prov-pop')) return;
    closeAll(null);
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var active = doc.activeElement;
    var wrap = wrapOf(active);
    if (wrap && active && active.blur) active.blur();
    closeAll(null);
  });
  doc.addEventListener('focusin', function (e) {
    var wrap = wrapOf(e.target);
    if (!wrap) return;
    var b = wrap.querySelector('.tp-prov-tick');
    if (b) b.setAttribute('aria-expanded', 'true');
  });
  doc.addEventListener('focusout', function (e) {
    var wrap = wrapOf(e.target);
    if (!wrap) return;
    setTimeout(function () {
      if (wrap.contains(doc.activeElement)) return;
      wrap.classList.remove('is-open');
      var b = wrap.querySelector('.tp-prov-tick');
      if (b) b.setAttribute('aria-expanded', 'false');
    }, 0);
  });
}
