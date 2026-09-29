/* functions/watchlist-subscribe.js — register email alerts for GCC portal presets.
 *
 * POST JSON: { email, presets: ["DEWA","Etimad","MEWRE",...], keywords?: string }
 *
 * Persistence:
 *   1. Supabase table tp_intel_alert_subscriptions (if SUPABASE_* configured)
 *   2. Always emails confirmation to the subscriber + operator notify when RESEND_API_KEY set
 *
 * Honest: without RESEND_API_KEY, returns { sent:false, reason:'not_configured' }
 * without failing the UX. Without Supabase, subscription is still emailed to NOTIFY_TO
 * so the desk can add it manually / via next digest bootstrap.
 */
'use strict';
const sb = require('./lib/supabase-server');

const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const NOTIFY_TO = (process.env.NOTIFY_TO || 'hello@transformerpath.com').trim();
const RESEND_FROM = (process.env.RESEND_FROM || 'TransformerPath <onboarding@resend.dev>').trim();

const ALLOWED = new Set(['DEWA', 'Etimad', 'MEWRE', 'KAHRAMAA', 'Nama', 'OETC']);

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
}

async function sendMail(to, subject, text) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'not_configured' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + RESEND_API_KEY
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject: subject, text: text })
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('Resend error', res.status, t);
    return { sent: false, reason: 'provider_error' };
  }
  return { sent: true };
}

async function upsertSupabase(email, presets, keywords) {
  if (!sb.isConfigured()) return { stored: false, reason: 'supabase_not_configured' };
  try {
    const client = sb.client();
    const row = {
      email: email.toLowerCase(),
      presets: presets,
      keywords: keywords || presets.join(',').toLowerCase(),
      active: true,
      updated_at: new Date().toISOString()
    };
    const { error } = await client
      .from('tp_intel_alert_subscriptions')
      .upsert(row, { onConflict: 'email' });
    if (error) {
      console.error('supabase upsert', error.message);
      return { stored: false, reason: error.message };
    }
    return { stored: true };
  } catch (e) {
    console.error('supabase', e && e.message);
    return { stored: false, reason: String(e && e.message || e) };
  }
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const email = String(data.email || '').trim().toLowerCase();
  if (!validEmail(email)) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Valid email required' }) };
  }

  let presets = Array.isArray(data.presets) ? data.presets : [];
  presets = presets.map(function (p) { return String(p || '').trim(); }).filter(function (p) {
    return ALLOWED.has(p);
  });
  if (!presets.length) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Select at least one portal preset' }) };
  }
  const keywords = String(data.keywords || presets.join(',')).slice(0, 400);

  const store = await upsertSupabase(email, presets, keywords);

  const confirmText =
    'TransformerPath Intel alerts\n\n' +
    'You asked for email alerts on: ' + presets.join(', ') + '\n' +
    'Keywords: ' + keywords + '\n\n' +
    'We email when CONFIRMED / SUPPORTED GCC transformer tenders match these portals ' +
    '(typically with the twice-daily Intel refresh).\n\n' +
    'Desk: https://transformerpath.com/intel.html#tp-watchlists\n' +
    'To stop alerts, reply to this email.\n';

  const userMail = await sendMail(email, 'TransformerPath — Intel alert confirmed (' + presets.join(', ') + ')', confirmText);
  const opMail = await sendMail(
    NOTIFY_TO,
    'Intel alert signup — ' + email,
    'New alert subscription\n\nEmail: ' + email + '\nPresets: ' + presets.join(', ') +
      '\nKeywords: ' + keywords + '\nSupabase stored: ' + store.stored +
      (store.reason ? ' (' + store.reason + ')' : '') + '\n'
  );

  return {
    statusCode: 200,
    headers: cors(),
    body: JSON.stringify({
      ok: true,
      stored: store.stored,
      store_reason: store.reason || null,
      emailed_user: userMail.sent,
      emailed_operator: opMail.sent,
      reason: userMail.sent ? null : (userMail.reason || 'not_configured')
    })
  };
};
