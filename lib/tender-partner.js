/* Partner link for the tender alert call to action.
 *
 * TODO: the TendersOnTime partner link will replace TENDER_PARTNER_URL.
 * Until that URL is confirmed, the button stays on a TransformerPath page.
 * An http(s) value is marked rel="sponsored noopener". A site path is not.
 */
'use strict';

const TENDER_PARTNER_URL = '/contact.html';

function isExternal(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

function partnerRel(url) {
  return isExternal(url) ? 'sponsored noopener' : '';
}

function escAttr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function ctaHtml(url) {
  const href = url || TENDER_PARTNER_URL;
  const rel = partnerRel(href);
  const extra = rel ? ' target="_blank" rel="' + rel + '"' : '';
  return '<aside class="tender-cta" data-tender-cta="1">' +
    '<p class="tender-cta-title">Get full global transformer tender alerts</p>' +
    '<p>TransformerPath publishes the public notices on this page and stays an independent record of them. Wider tender alerts are a separate partner service.</p>' +
    '<a class="btn btn-amber" href="' + escAttr(href) + '"' + extra + '>Get full global transformer tender alerts</a>' +
    '</aside>';
}

module.exports = {
  TENDER_PARTNER_URL: TENDER_PARTNER_URL,
  isExternal: isExternal,
  partnerRel: partnerRel,
  ctaHtml: ctaHtml
};
