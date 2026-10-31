#!/usr/bin/env node
/* Urgent replacement requests are free.
 *
 * provider_lead_pricing can later publish a provider charge. The committed
 * label is empty, so the form renders no amount and no payment control
 * whether the flag is off or on.
 *
 * Approved 31 Oct 2026.
 */
'use strict';

const PUBLISHED_LEAD_PRICE = null;

function leadOfferMarkup(enabled) {
  if (enabled !== true || PUBLISHED_LEAD_PRICE == null) return '';
  return String(PUBLISHED_LEAD_PRICE);
}

module.exports = {
  PUBLISHED_LEAD_PRICE: PUBLISHED_LEAD_PRICE,
  leadOfferMarkup: leadOfferMarkup
};
