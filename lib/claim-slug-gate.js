/* Where a claim query should go.
 * A known slug opens its prerendered page. Anything else opens the static
 * not-found page, which already says the listing is missing.
 */
'use strict';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function claimQueryTarget(slug, index) {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return '';
  if (SLUG_RE.test(s) && index && Object.prototype.hasOwnProperty.call(index, s)) {
    return '/claim-listing/' + s + '/';
  }
  return '/claim-listing/not-found/';
}

module.exports = { claimQueryTarget: claimQueryTarget };
