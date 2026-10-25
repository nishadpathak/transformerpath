/* Service-role access to the existing payment tables.
 * The browser never receives the service-role key. Tests can replace the store.
 */
'use strict';

const { isConfigured, client } = require('./supabase-server');

let override = null;

function setForTests(store) {
  override = store;
}

function current() {
  return override;
}

function missingColumn(error) {
  const text = String(error && (error.message || error.details || error) || '');
  return /column|schema cache|PGRST204|does not exist/i.test(text);
}

function configured() {
  if (override) return override.configured !== false;
  return isConfigured();
}

async function listVerified() {
  if (override) return override.listVerified();
  if (!isConfigured()) {
    const err = new Error('not configured');
    err.code = 'not_configured';
    throw err;
  }
  const { data, error } = await client()
    .from('paid_listings')
    .select('*')
    .eq('product', 'verified_manufacturer');
  if (error) throw error;
  return data || [];
}

async function getBySession(sessionId) {
  if (override) return override.getBySession(sessionId);
  if (!isConfigured()) {
    const err = new Error('not configured');
    err.code = 'not_configured';
    throw err;
  }
  const { data, error } = await client()
    .from('paid_listings')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function updateListing(sessionId, patch) {
  if (override) return override.updateListing(sessionId, patch);
  if (!isConfigured()) {
    const err = new Error('not configured');
    err.code = 'not_configured';
    throw err;
  }
  const { data, error } = await client()
    .from('paid_listings')
    .update(patch)
    .eq('session_id', sessionId)
    .select('*')
    .maybeSingle();
  if (error) {
    if (missingColumn(error)) {
      const err = new Error('migration required');
      err.code = 'migration_required';
      throw err;
    }
    throw error;
  }
  return data;
}

async function upsertEntitlement(row) {
  if (!row) return null;
  if (override) return override.upsertEntitlement(row);
  if (!isConfigured()) return null;
  const payload = {
    user_id: row.user_id,
    product: row.product,
    plan: row.plan,
    access_start: row.access_start,
    access_end: row.access_end,
    status: row.status
  };
  const { error } = await client()
    .from('entitlements')
    .upsert(payload, { onConflict: 'user_id,product' });
  if (error) throw error;
  return payload;
}

async function forEmail(email) {
  if (override) return override.forEmail(email);
  const rows = await listVerified();
  const want = String(email || '').toLowerCase();
  return rows.filter(function (row) {
    return row && String(row.email || '').toLowerCase() === want;
  });
}

module.exports = {
  setForTests: setForTests,
  current: current,
  configured: configured,
  missingColumn: missingColumn,
  listVerified: listVerified,
  getBySession: getBySession,
  updateListing: updateListing,
  upsertEntitlement: upsertEntitlement,
  forEmail: forEmail
};
