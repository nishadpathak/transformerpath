/* lib/src-date.js — parse "11 Sep 2026" as a UTC calendar date.
 *
 * `new Date("11 Sep 2026")` is local midnight. In time zones ahead of UTC,
 * toISOString() then falls on the previous day. Date.UTC keeps the calendar
 * day the source wrote.
 */
'use strict';

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function utcDay(year, monthIndex, day) {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return '';
  const d = new Date(Date.UTC(year, monthIndex, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) return '';
  return d.toISOString().slice(0, 10);
}

function dateFromSrcUtc(src, iso) {
  const explicit = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (explicit) {
    const day = utcDay(Number(explicit[1]), Number(explicit[2]) - 1, Number(explicit[3]));
    if (day) return day;
  }
  const m = String(src || '').match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return '';
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon == null) return '';
  return utcDay(Number(m[3]), mon, Number(m[1]));
}

module.exports = { dateFromSrcUtc, utcDay };
