/* A market is a view of the tender register and the same source-checked intake.
 * The market build runs before tender regeneration. Overlay the curated notices
 * without treating terminal or unevidenced records as actionable procurement. */
'use strict';

const { parseCloseInstant, publishedDeadline, deadlineInstant, classifyOpenDeadline } = require('./deadline');
const { isOfficialProcurementUrl } = require('./tender-sources');
const { findExisting, mergeInto, validateNotice } = require('./tender-notices');
const { recordOnMarket } = require('./market-country');

const OPEN = ['OPEN', 'CLOSING_SOON'];
const AMENDABLE = [...OPEN, 'UNDATED', 'EXPECTED', 'CLOSED'];

function officialLink(row) {
  const raw = row.official_procurement_url || row.official_source_url;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && isOfficialProcurementUrl(raw) ? raw : '';
  } catch { return ''; }
}

function marketTenderSnapshot(tenders, notices, now = Date.now()) {
  const rows = tenders.map((row) => ({ ...row }));
  for (const notice of notices) {
    if (validateNotice(notice).length || !officialLink(notice)) continue;
    const prior = findExisting(rows, notice);
    const previousClose = prior && deadlineInstant(publishedDeadline(prior));
    if (prior && (!AMENDABLE.includes(prior.status) || prior.awardee ||
      (prior.status === 'CLOSED' && (previousClose == null || Date.parse(notice.close_at) <= previousClose)))) continue;
    mergeInto(rows, {
      notices: [notice],
      regionOf: () => '',
      addTender(row) { rows.push(row); return row; }
    });
    const row = prior || rows[rows.length - 1];
    row.status = classifyOpenDeadline(row.close_at, now);
  }
  return rows;
}

// Require an explicitly open status and a dated, allowlisted primary notice.
// India and regional editorial lists may choose the stricter exact-time slice.
function opening(row, now = Date.now(), exactOnly = false) {
  const deadline = exactOnly ? parseCloseInstant(row.close_at) : publishedDeadline(row);
  const source = officialLink(row);
  if (!OPEN.includes(row.status) || row.awardee || !row.source_verified || !source || !deadline) return null;
  const status = classifyOpenDeadline(deadline, now);
  return status === 'CLOSED' ? null : { deadline, source, status, closeMs: deadlineInstant(deadline) };
}

function marketTenderView(rows, market, now = Date.now()) {
  const current = [];
  const history = [];
  for (const row of rows) {
    if (!recordOnMarket(row, market)) continue;
    const result = opening(row, now);
    if (result) {
      current.push({ ...row, ...result });
      continue;
    }
    const deadline = publishedDeadline(row);
    const status = !OPEN.includes(row.status) ? (row.status || 'UNKNOWN')
      : deadline && classifyOpenDeadline(deadline, now) === 'CLOSED' ? 'CLOSED' : 'UNKNOWN';
    history.push({ ...row, status });
  }
  current.sort((a, b) => a.closeMs - b.closeMs || a.title.localeCompare(b.title));
  return { current, history };
}

module.exports = { marketTenderSnapshot, opening, marketTenderView, officialLink };
