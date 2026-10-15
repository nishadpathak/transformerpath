/* Count directory rows that carry both a source URL and a check date.
 * The stat on the page is this count, not a hardcoded 100%. */
'use strict';

function httpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function checkDate(value) {
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || '').trim());
}

function rowSourced(row) {
  if (!row || typeof row !== 'object') return false;
  var url = row.website || row.source || row.url || row.source_url || row.official_url;
  var date = row.verification_date || row.last_verified || row.checked;
  return httpUrl(url) && checkDate(date);
}

function sourcedCardCount(rows) {
  var list = Array.isArray(rows) ? rows : [];
  var sourced = list.filter(rowSourced).length;
  return {
    sourced: sourced,
    total: list.length,
    text: sourced + ' of ' + list.length
  };
}

module.exports = {
  rowSourced: rowSourced,
  sourcedCardCount: sourcedCardCount
};
