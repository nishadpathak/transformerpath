/* Approved public copy for a growing directory total.
 * 1053 renders as "1,000+". Exact census figures stay in site-stats and JSON-LD.
 * Counts under 1,000 stay exact, because a floor of zero would be a different claim.
 */
'use strict';

function publicCountLabel(n) {
  var num = typeof n === 'number' ? n : Number(String(n == null ? '' : n).replace(/[+,]/g, ''));
  if (!isFinite(num)) return '—';
  num = Math.floor(num);
  if (num < 1000) return String(num);
  var floor = Math.floor(num / 1000) * 1000;
  return floor.toLocaleString('en-US') + '+';
}

module.exports = { publicCountLabel: publicCountLabel };
