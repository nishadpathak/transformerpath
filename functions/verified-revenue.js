/* Internal revenue summary. Server-side token. No buyer names. noindex. */
'use strict';

const flow = require('../lib/verified-flow');
const store = require('./lib/verified-store');
const { json, reviewAuth } = require('./lib/verified-auth');

exports.handler = async function (event) {
  if (!event || event.httpMethod !== 'GET') return json(405, { error: 'method' });
  const auth = reviewAuth(event);
  if (!auth.configured) return json(503, { configured: false, reason: 'not_configured' });
  if (!auth.ok) return json(401, { configured: true, error: 'unauthorized' });
  if (!store.configured()) return json(503, { configured: false, reason: 'not_configured' });
  try {
    const rows = await store.listVerified();
    return json(200, Object.assign({ configured: true }, flow.revenueSummary(rows, Date.now())));
  } catch (err) {
    return json(500, { reason: 'error' });
  }
};
