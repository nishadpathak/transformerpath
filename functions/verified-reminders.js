/* Daily expiry and renewal reminders for Verified Manufacturer.
 * No auto-renewal and no new charge. Inert when Supabase is not configured.
 * Schedule: 0 7 * * * in netlify.toml.
 */
'use strict';

const flow = require('../lib/verified-flow');
const store = require('./lib/verified-store');
const mail = require('./lib/verified-mail');
const { json } = require('./lib/verified-auth');

exports.handler = async function () {
  if (!store.configured()) {
    return json(200, { ok: true, skipped: true, reason: 'not_configured', sent: 0 });
  }
  let rows;
  try { rows = await store.listVerified(); }
  catch (err) {
    if (err && err.code === 'not_configured') return json(200, { ok: true, skipped: true, reason: 'not_configured', sent: 0 });
    return json(500, { ok: false, reason: 'error' });
  }
  const now = Date.now();
  const due = flow.remindersDue(rows, now);
  let sent = 0;
  const pending = due.renewal.map(function (row) { return { kind: 'renewal', row: row }; })
    .concat(due.expiry.map(function (row) { return { kind: 'expiry', row: row }; }));
  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const notice = await mail.sendKind(item.kind, item.row);
    if (notice && notice.retry) return json(500, { ok: false, reason: 'receipt failed', sent: sent });
    if (!notice || notice.reason === 'not_configured') {
      return json(200, { ok: true, skipped: true, reason: 'not_configured', sent: sent });
    }
    const stamp = item.kind === 'renewal'
      ? { renewal_reminder_sent_at: new Date(now).toISOString() }
      : { expiry_notice_sent_at: new Date(now).toISOString(), status: 'expired' };
    try {
      await store.updateListing(item.row.session_id, stamp);
      if (item.kind === 'expiry' && item.row.user_id) {
        const expired = flow.markExpired(Object.assign({}, item.row, { status: 'verified' }), now);
        if (expired.entitlement) await store.upsertEntitlement(expired.entitlement);
      }
    } catch (err) {
      if (err && err.code === 'migration_required') {
        return json(200, { ok: true, reason: 'migration_required', sent: sent });
      }
      return json(500, { ok: false, reason: 'error', sent: sent });
    }
    sent += 1;
  }
  return json(200, { ok: true, sent: sent, renewal: due.renewal.length, expiry: due.expiry.length });
};
