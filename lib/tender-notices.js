/* Curated tender intake. build-tenders.js merges data/tender-notices.json
 * into the derived tender list. See docs/tender-intake.md.
 *
 * Dedupe key: official reference + buyer + country. If that key is incomplete,
 * the official source URL is the key. Existing fields are kept when the intake
 * does not replace them. A notice without an official URL, or whose summary is
 * not 2–4 sentences, is skipped and never added as open.
 */
'use strict';

const fs = require('fs');
const { parseCloseInstant } = require('./deadline');
const {
  isOfficialProcurementUrl, isAggregatorUrl, sourceLabel, portalZone
} = require('./tender-sources');

const CATEGORIES = { supply: 1, testing_equipment: 1, service: 1 };

function ci(s) { return String(s || '').trim().toLowerCase(); }

function normUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '').toLowerCase();
}

function sentenceCount(text) {
  return String(text || '').split(/[.!?]+/).map(function (part) { return part.trim(); }).filter(Boolean).length;
}

function load(file) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(doc) ? doc : (doc.notices || []);
}

function validateNotice(notice) {
  const errors = [];
  const n = notice || {};
  if (!String(n.title || '').trim()) errors.push('title');
  if (!String(n.buyer || '').trim()) errors.push('buyer');
  if (!String(n.country || '').trim()) errors.push('country');
  if (!CATEGORIES[n.category]) errors.push('category');
  if (!String(n.official_reference || '').trim()) errors.push('official_reference');
  if (!parseCloseInstant(n.close_at)) errors.push('close_at');
  if (!isOfficialProcurementUrl(n.official_source_url)) errors.push('official_source_url');
  if (isAggregatorUrl(n.official_source_url)) errors.push('aggregator');
  if (/transformerpath\.com/i.test(String(n.official_source_url || '')) && /\.pdf(\?|$)/i.test(n.official_source_url)) errors.push('hosted_pdf');
  const sentences = sentenceCount(n.summary);
  if (sentences < 2 || sentences > 4) errors.push('summary');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.date_found || ''))) errors.push('date_found');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.last_verified || ''))) errors.push('last_verified');
  return errors;
}

function refKey(reference, buyer, country) {
  const ref = ci(reference);
  const who = ci(buyer);
  const where = ci(country);
  if (!ref || !who || !where) return '';
  return ref + '|' + who + '|' + where;
}

function recordRef(row) {
  return refKey(row.official_reference || row.procurement_id, row.buyer || row.utility, row.country);
}

function recordUrls(row) {
  const urls = [row.official_procurement_url].concat(row.source_urls || []);
  return urls.map(normUrl).filter(Boolean);
}

function findExisting(tenders, notice) {
  const key = refKey(notice.official_reference, notice.buyer, notice.country);
  const url = normUrl(notice.official_source_url);
  return (tenders || []).find(function (row) {
    if (key && recordRef(row) === key) return true;
    if (url && recordUrls(row).indexOf(url) !== -1) return true;
    return false;
  }) || null;
}

function noticeRecord(notice, regionOf) {
  const zone = notice.portal_timezone || portalZone(notice.official_source_url);
  const text = String(notice.title || '') + ' ' + String(notice.summary || '');
  return {
    title: String(notice.title).trim(),
    full_title: String(notice.title).trim(),
    buyer: String(notice.buyer).trim(),
    utility: String(notice.buyer).trim(),
    epc: '',
    country: String(notice.country).trim(),
    region: regionOf(notice.country),
    project_slug: '',
    transformer_scope: /transformer/i.test(text) ? 'CONFIRMED' : 'UNKNOWN',
    category: notice.category,
    voltage: '',
    quantity: '',
    primary_voltage: '',
    secondary_voltage: '',
    rating: '',
    standard: '',
    delivery_requirement: '',
    qualification_requirement: '',
    official_procurement_url: notice.official_source_url,
    official_reference: String(notice.official_reference).trim(),
    procurement_id: String(notice.official_reference).trim(),
    source: sourceLabel(notice.official_source_url),
    source_urls: [notice.official_source_url],
    source_verified: true,
    expected_raw: '',
    deadline_raw: notice.close_at,
    close_at: parseCloseInstant(notice.close_at),
    portal_timezone: zone,
    stage: 'tendering',
    cls: '',
    awardee: '',
    award_basis: '',
    summary: String(notice.summary).trim(),
    snippet: String(notice.summary).trim(),
    date_found: notice.date_found,
    publication_date: notice.date_found,
    captured_at: notice.date_found,
    last_verified: notice.last_verified
  };
}

function applyOnto(row, notice) {
  const zone = notice.portal_timezone || portalZone(notice.official_source_url);
  if (!row.buyer && notice.buyer) row.buyer = notice.buyer;
  if (!row.utility && notice.buyer) row.utility = notice.buyer;
  if (!row.country && notice.country) row.country = notice.country;
  if (!row.procurement_id) row.procurement_id = String(notice.official_reference).trim();
  if (!row.official_reference) row.official_reference = String(notice.official_reference).trim();
  row.category = notice.category || row.category;
  row.close_at = parseCloseInstant(notice.close_at);
  row.deadline_raw = notice.close_at;
  if (zone) row.portal_timezone = zone;
  row.official_procurement_url = notice.official_source_url;
  row.source_urls = [notice.official_source_url];
  row.source = sourceLabel(notice.official_source_url);
  row.source_verified = true;
  row.summary = String(notice.summary).trim();
  row.snippet = row.summary;
  row.date_found = notice.date_found;
  if (!row.publication_date) row.publication_date = notice.date_found;
  if (!row.captured_at) row.captured_at = notice.date_found;
  row.last_verified = notice.last_verified;
  if (!row.stage || row.stage === 'expected' || row.stage === 'planned') row.stage = 'tendering';
  if (row.transformer_scope !== 'CONFIRMED' && /transformer/i.test(notice.title + ' ' + notice.summary)) {
    row.transformer_scope = 'CONFIRMED';
  }
}

function mergeInto(tenders, opts) {
  const report = { added: [], merged: [], skipped: [] };
  (opts.notices || []).forEach(function (notice) {
    const errors = validateNotice(notice);
    const reference = (notice && (notice.official_reference || notice.title)) || '(untitled)';
    if (errors.length) {
      report.skipped.push({ reference: reference, reason: errors.join(',') });
      return;
    }
    const match = findExisting(tenders, notice);
    if (match) {
      applyOnto(match, notice);
      report.merged.push(String(notice.official_reference));
      return;
    }
    const row = opts.addTender(noticeRecord(notice, opts.regionOf));
    if (!row) report.skipped.push({ reference: reference, reason: 'duplicate-title' });
    else report.added.push(String(notice.official_reference));
  });
  return report;
}

function sanitizeSources(row) {
  const urls = (row.source_urls || []).filter(function (url) { return url && !isAggregatorUrl(url); });
  if (isAggregatorUrl(row.official_procurement_url)) {
    row.official_procurement_url = urls.filter(isOfficialProcurementUrl)[0] || '';
    if (/freetender|tendershark|tenderdekho|biddetail|tenderimpulse|bidsfactory|\bmeed\b/i.test(row.source || '')) {
      row.source = row.official_procurement_url ? sourceLabel(row.official_procurement_url) : '';
    }
  }
  row.source_urls = urls;
  if (row.official_procurement_url && !isAggregatorUrl(row.official_procurement_url) && urls.indexOf(row.official_procurement_url) < 0) {
    urls.unshift(row.official_procurement_url);
    row.source_urls = urls;
  }
}

function finalizeRecord(row, deps) {
  sanitizeSources(row);
  const closeAt = parseCloseInstant(row.close_at || '');
  if (closeAt) row.close_at = closeAt;
  else delete row.close_at;
  const deadline = deps.parseDeadline(closeAt || row.deadline_raw || row.expected_raw || row.deadline || '');
  row.deadline = deadline || '';
  let status = deps.deriveStatus(row.stage, row.expected_raw, closeAt || row.deadline);
  if ((status === 'OPEN' || status === 'CLOSING_SOON') && !isOfficialProcurementUrl(row.official_procurement_url)) {
    status = 'UNDATED';
    row.open_withheld = 'no_official_url';
    row.statusLabel = 'Not on an official portal';
  } else {
    delete row.open_withheld;
    row.statusLabel = deps.STATUS_LABEL[status];
  }
  row.status = status;
  row.statusGroup = deps.STATUS_GROUP[status];
  if (closeAt && !row.portal_timezone) {
    const zone = portalZone(row.official_procurement_url);
    if (zone) row.portal_timezone = zone;
  }
  return row;
}

module.exports = {
  load: load,
  validateNotice: validateNotice,
  sentenceCount: sentenceCount,
  findExisting: findExisting,
  mergeInto: mergeInto,
  finalizeRecord: finalizeRecord,
  refKey: refKey
};
