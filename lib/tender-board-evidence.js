/* Only explicit, officially linked tender evidence may be shown on the board. */
'use strict';

const { parseCloseInstant } = require('./deadline');
const { isOfficialProcurementUrl } = require('./tender-sources');
const { dualZoneLabel, formatZone } = require('./tender-time');

const TYPES = {
  amendment: 'Amendment',
  corrigendum: 'Corrigendum',
  correction: 'Correction',
  deadline_extended: 'Deadline extension'
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateLabel(value) {
  const m = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return '';
  const ms = Date.parse(m[0] + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== m[0]) return '';
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}
function localClose(closeAt, portalTimezone) {
  const close = parseCloseInstant(closeAt);
  if (!close) return '';
  if (portalTimezone) {
    try { return dualZoneLabel(close, portalTimezone); }
    catch (_) { /* The explicit source offset still gives the exact deadline. */ }
  }
  const offset = close.match(/(?:Z|[+-]\d{2}:\d{2})$/)[0];
  return dateLabel(close.slice(0, 10)) + ', ' + close.slice(11, 16) + ' UTC' +
    (offset === 'Z' ? '' : offset) + ' (notice offset) · ' +
    formatZone(Date.parse(close), 'Asia/Dubai') + ' (Asia/Dubai)';
}
function officialAmendments(events) {
  const accepted = [];
  const seen = new Set();
  for (const row of Array.isArray(events) ? events : []) {
    if (!row || !Object.prototype.hasOwnProperty.call(TYPES, row.type) ||
        !dateLabel(row.date) || !isOfficialProcurementUrl(row.source_url)) continue;
    let url;
    try { url = new URL(row.source_url); } catch (_) { continue; }
    if (url.protocol !== 'https:' || url.username || url.password) continue;
    const key = row.type + '|' + row.date + '|' + url.href;
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({ type: row.type, date: row.date, source_url: url.href });
  }
  return accepted.sort((a, b) => b.date.localeCompare(a.date));
}
function amendmentLabel(row) {
  return TYPES[row.type] + ' · ' + dateLabel(row.date);
}
module.exports = { dateLabel, localClose, officialAmendments, amendmentLabel };
