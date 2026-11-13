/* Official procurement hosts for Transformer Tenders.
 *
 * A row is shown as open only when its listed source is one of these portals.
 * Aggregator mirrors are never the listed source. This module does not fetch
 * pages and does not store bid documents.
 */
'use strict';

const AGGREGATOR_HOST = [
  'freetender',
  'tendershark',
  'tenderdekho',
  'biddetail',
  'tenderimpulse',
  'bidsfactory',
  'meed.com'
];

function hostOf(url) {
  try { return new URL(String(url || '')).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (e) { return ''; }
}

function endsWithHost(host, root) {
  return host === root || host.endsWith('.' + root);
}

function isAggregatorUrl(url) {
  const host = hostOf(url);
  if (!host) return false;
  return AGGREGATOR_HOST.some(function (name) { return host.indexOf(name) !== -1; });
}

/* GeM BidPlus, CPPP eProcure, state NIC e-tender portals, POWERGRID, Etimad,
 * DEWA, Bahrain Tender Board, Oman Nama / tender board, South Africa National
 * Treasury eTenders, and TED. */
function isOfficialProcurementUrl(url) {
  if (!url || isAggregatorUrl(url)) return false;
  const host = hostOf(url);
  if (!host) return false;
  if (host === 'bidplus.gem.gov.in' || host.endsWith('.bidplus.gem.gov.in')) return true;
  if (endsWithHost(host, 'eprocure.gov.in')) return true;
  if (endsWithHost(host, 'nic.in')) return true;
  if (endsWithHost(host, 'powergrid.in')) return true;
  if (endsWithHost(host, 'etimad.sa')) return true;
  if (endsWithHost(host, 'dewa.gov.ae')) return true;
  if (endsWithHost(host, 'tenderboard.gov.bh')) return true;
  if (endsWithHost(host, 'tenderboard.gov.om') || endsWithHost(host, 'nama.om')) return true;
  if (endsWithHost(host, 'etenders.gov.za')) return true;
  if (host === 'etenders.treasury.gov.za' || host.endsWith('.etenders.treasury.gov.za')) return true;
  if (endsWithHost(host, 'ted.europa.eu')) return true;
  return false;
}

function sourceLabel(url) {
  const host = hostOf(url);
  if (!host) return '';
  if (host.indexOf('bidplus.gem.gov.in') !== -1) return 'GeM BidPlus';
  if (endsWithHost(host, 'eprocure.gov.in')) return 'CPPP eProcure';
  if (endsWithHost(host, 'nic.in')) return 'NIC eProcurement';
  if (endsWithHost(host, 'powergrid.in')) return 'POWERGRID';
  if (endsWithHost(host, 'etimad.sa')) return 'Etimad';
  if (endsWithHost(host, 'dewa.gov.ae')) return 'DEWA';
  if (endsWithHost(host, 'tenderboard.gov.bh')) return 'Bahrain Tender Board';
  if (endsWithHost(host, 'tenderboard.gov.om') || endsWithHost(host, 'nama.om')) return 'Oman Tender Board';
  if (endsWithHost(host, 'etenders.gov.za') || host.indexOf('treasury.gov.za') !== -1) return 'National Treasury eTenders';
  if (endsWithHost(host, 'ted.europa.eu')) return 'TED';
  return host;
}

function portalZone(url, explicit) {
  if (explicit && /^[A-Za-z]+\/[A-Za-z0-9_+-]+$/.test(String(explicit))) return String(explicit);
  const host = hostOf(url);
  if (!host) return '';
  if (host.indexOf('bidplus.gem.gov.in') !== -1 || endsWithHost(host, 'eprocure.gov.in') || endsWithHost(host, 'nic.in') || endsWithHost(host, 'powergrid.in')) return 'Asia/Kolkata';
  if (endsWithHost(host, 'etimad.sa')) return 'Asia/Riyadh';
  if (endsWithHost(host, 'dewa.gov.ae')) return 'Asia/Dubai';
  if (endsWithHost(host, 'tenderboard.gov.bh')) return 'Asia/Bahrain';
  if (endsWithHost(host, 'tenderboard.gov.om') || endsWithHost(host, 'nama.om')) return 'Asia/Muscat';
  if (endsWithHost(host, 'etenders.gov.za') || host.indexOf('treasury.gov.za') !== -1) return 'Africa/Johannesburg';
  return '';
}

module.exports = {
  hostOf: hostOf,
  isAggregatorUrl: isAggregatorUrl,
  isOfficialProcurementUrl: isOfficialProcurementUrl,
  sourceLabel: sourceLabel,
  portalZone: portalZone
};
