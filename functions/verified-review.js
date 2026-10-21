/* Internal review queue for Verified Manufacturer.
 * Authorization is the server-side VERIFIED_REVIEW_TOKEN. The page does not
 * contain the token. Approval does not publish a badge by itself: the
 * response includes publish_row for data/paid-listings.json, and the badge
 * renderer still requires reviewer, reviewed_at, and verification_evidence.
 */
'use strict';

const flow = require('../lib/verified-flow');
const store = require('./lib/verified-store');
const mail = require('./lib/verified-mail');
const { json, readBody, reviewAuth } = require('./lib/verified-auth');

function publicQueue(rows, now) {
  return (rows || []).filter(function (row) {
    return row && row.product === flow.PRODUCT;
  }).map(function (row) {
    return {
      session_id: row.session_id,
      company_slug: row.company_slug || '',
      claim_company: row.claim_company || '',
      email: row.email || '',
      status: flow.effectiveStatus(row, now),
      document_status: row.document_status || 'missing',
      amount: typeof row.amount === 'number' ? row.amount : null,
      currency: row.currency || 'usd',
      livemode: row.livemode === true,
      created_at: row.created_at || null,
      expires_at: row.expires_at || null,
      badge: flow.badgeAllowed(row, now)
    };
  });
}

exports.handler = async function (event) {
  const auth = reviewAuth(event);
  if (!auth.configured) return json(503, { configured: false, reason: 'not_configured' });
  if (!auth.ok) return json(401, { configured: true, error: 'unauthorized' });
  if (!store.configured()) return json(503, { configured: false, reason: 'not_configured' });

  const now = Date.now();
  if (event.httpMethod === 'GET') {
    try {
      const rows = await store.listVerified();
      return json(200, { configured: true, queue: publicQueue(rows, now) });
    } catch (err) {
      return json(500, { error: 'error' });
    }
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  const body = readBody(event);
  if (!body) return json(400, { error: 'invalid json' });
  const action = String(body.action || '').trim();
  const sessionId = String(body.session_id || '').trim();
  if (!sessionId) return json(400, { error: 'session_id required' });

  let row;
  try { row = await store.getBySession(sessionId); }
  catch (err) { return json(500, { error: 'error' }); }
  if (!row) return json(404, { error: 'not_found' });

  const decision = action === 'approve'
    ? flow.approve(row, body.verification_evidence, now)
    : action === 'reject'
      ? flow.reject(row, body.verification_evidence, now)
      : { ok: false, error: 'action required' };
  if (!decision.ok) return json(400, { error: decision.error, badge: false });

  try {
    await store.updateListing(sessionId, {
      status: decision.row.status,
      reviewer: decision.row.reviewer,
      reviewed_at: decision.row.reviewed_at,
      verification_evidence: decision.row.verification_evidence,
      expires_at: decision.row.expires_at || null,
      document_status: decision.row.document_status || row.document_status || null
    });
    if (decision.entitlement) await store.upsertEntitlement(decision.entitlement);
  } catch (err) {
    if (err && err.code === 'migration_required') {
      return json(503, {
        stored: false,
        reason: 'migration_required',
        badge: false,
        publish_row: decision.publish_row || null
      });
    }
    return json(500, { stored: false, reason: 'error' });
  }

  const notice = await mail.sendKind(action === 'approve' ? 'approval' : 'rejection', decision.row);
  return json(200, {
    stored: true,
    status: decision.row.status,
    badge: flow.badgeAllowed(decision.row, now),
    publish_row: decision.publish_row || null,
    mail: notice.sent === true ? 'sent' : notice.reason
  });
};
