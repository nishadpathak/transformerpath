/* Shared server-side Supabase client for Netlify functions.
 *
 * The browser client (supabase.js) uses the PUBLISHABLE key with Row-Level
 * Security. Server-side work — writing entitlements, payments, approving a
 * supplier claim, storing an RFQ — needs the SERVICE-ROLE (SECRET) key, which
 * bypasses RLS. That key must live ONLY in the Netlify environment and never
 * in browser code or the repo.
 *
 * Env vars (Netlify → Site → Environment variables):
 *   SUPABASE_URL             https://<project>.supabase.co
 *   SUPABASE_PUBLISHABLE_KEY sb_publishable_...
 *   SUPABASE_SECRET_KEY      sb_secret_...   (service role — privileged)
 *
 * NOTE: @supabase/server is the newer convenience wrapper, but it is authored
 * for Edge Functions (Deno web-standard `fetch` handlers). Netlify Node
 * functions use `exports.handler(event, context)`, so this helper uses the
 * stable @supabase/supabase-js server client instead.
 */
'use strict';
const { createClient } = require('@supabase/supabase-js');

const url = (process.env.SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function isConfigured() {
  return Boolean(url && serviceKey);
}

function client() {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

module.exports = { isConfigured, client, url, serviceKey };
