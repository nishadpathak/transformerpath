/* Where a claim query should go.
 * A slug-shaped value opens /claim-listing/<slug>/. A known slug is that
 * listing. An unknown slug is the same path, which already returns 404.
 * Anything else stays on the blank form.
 */
'use strict';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function claimQueryTarget(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!SLUG_RE.test(s)) return '';
  return '/claim-listing/' + s + '/';
}

module.exports = { claimQueryTarget: claimQueryTarget };
