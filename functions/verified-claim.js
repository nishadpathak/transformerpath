/* Attach identity and authorization to an existing Verified Manufacturer payment.
 * Does not create a paid row and does not publish a badge.
 */
'use strict';

const flow = require('../lib/verified-flow');
const store = require('./lib/verified-store');
const { json, readBody } = require('./lib/verified-auth');

exports.handler = async function (event) {
  if (!event || event.httpMethod !== 'POST') return json(405, { stored: false, error: 'method' });
  if (!flow.serverEnabled()) return json(503, { stored: false, enabled: false, reason: 'flag_off' });
  if (!store.configured()) return json(503, { stored: false, configured: false, reason: 'not_configured' });
  const body = readBody(event);
  if (!body) return json(400, { stored: false, error: 'invalid json' });
  const claim = flow.readClaim(body);
  if (!claim.ok) return json(400, { stored: false, errors: claim.errors });

  let row;
  try { row = await store.getBySession(claim.claim.session_id); }
  catch (err) {
    if (err && err.code === 'not_configured') return json(503, { stored: false, configured: false, reason: 'not_configured' });
    return json(500, { stored: false, reason: 'error' });
  }
  if (!row || row.product !== flow.PRODUCT) {
    return json(200, { stored: false, reason: 'payment_required', badge: false });
  }
  if (row.status === 'refunded' || row.status === 'rejected' || row.status === 'expired') {
    return json(200, { stored: false, reason: row.status, badge: false });
  }
  const patch = {
    email: claim.claim.email,
    claim_company: claim.claim.claim_company,
    claim_role: claim.claim.claim_role,
    claim_website: claim.claim.claim_website,
    authorization_note: claim.claim.authorization_note,
    document_status: 'received'
  };
  try {
    const saved = await store.updateListing(claim.claim.session_id, patch);
    return json(200, {
      stored: true,
      badge: false,
      document_status: 'received',
      payment_status: saved && saved.status ? saved.status : row.status
    });
  } catch (err) {
    if (err && err.code === 'migration_required') {
      return json(503, { stored: false, reason: 'migration_required', badge: false });
    }
    return json(500, { stored: false, reason: 'error' });
  }
};
