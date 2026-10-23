/* Customer dashboard for the signed-in manufacturer.
 * Auth is the existing Google session cookie or a Supabase access token.
 * Rows are filtered to that email. RLS is the database backstop once
 * supabase/migrations/20261021120000_verified_manufacturer_review.sql is applied.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const flow = require('../lib/verified-flow');
const store = require('./lib/verified-store');
const session = require('./lib/session-cookie');
const envLib = require('./lib/google-auth-env');
const { isConfigured, client } = require('./lib/supabase-server');
const { json, header } = require('./lib/verified-auth');

let viewerOverride = null;
let extrasOverride = null;

function sessionViewer(event, env, now) {
  const secret = envLib.secretOf(env || process.env);
  if (!secret) return null;
  const raw = session.readCookie(header(event, 'cookie'), session.COOKIE_NAME);
  const profile = session.readSession(raw, secret, now || Date.now());
  if (!profile || !profile.email) return null;
  return { email: String(profile.email).toLowerCase(), source: 'session' };
}

async function supabaseViewer(event) {
  const token = String(header(event, 'authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !isConfigured()) return null;
  const result = await client().auth.getUser(token);
  const user = result && result.data && result.data.user;
  if (!user || !user.email) return null;
  return { email: String(user.email).toLowerCase(), user_id: user.id, source: 'supabase' };
}

function readJson(name) {
  const candidates = [
    path.join(__dirname, '..', 'data', name),
    path.join(process.cwd(), 'data', name)
  ];
  for (let i = 0; i < candidates.length; i++) {
    try { return JSON.parse(fs.readFileSync(candidates[i], 'utf8')); }
    catch (e) { /* next path */ }
  }
  return null;
}

function extrasFor(rows) {
  if (extrasOverride) return extrasOverride(rows);
  const slugs = {};
  (rows || []).forEach(function (row) {
    if (row && row.company_slug) slugs[String(row.company_slug).toLowerCase()] = true;
  });
  const rfqFile = readJson('rfq-public.json') || {};
  const cards = Array.isArray(rfqFile.cards) ? rfqFile.cards : [];
  const rfqs = cards.filter(function (card) {
    const slug = String(card && (card.supplier_slug || card.company_slug) || '').toLowerCase();
    return slug && slugs[slug];
  }).map(function (card) {
    return {
      title: card.title || card.summary || 'RFQ',
      status: card.status || 'on file'
    };
  });
  const enquiries = (rows || []).map(function (row) {
    return {
      company: row.claim_company || row.company_slug || '',
      document_status: row.document_status || 'missing',
      session_id: row.session_id
    };
  });
  return { rfqs: rfqs, enquiries: enquiries };
}

exports.handler = async function (event) {
  if (!event || (event.httpMethod !== 'GET' && event.httpMethod !== 'POST')) {
    return json(405, { error: 'method' });
  }
  const now = Date.now();
  let viewer = viewerOverride ? await viewerOverride(event) : sessionViewer(event, process.env, now);
  if (!viewer) {
    try { viewer = await supabaseViewer(event); }
    catch (err) { viewer = null; }
  }
  if (!viewer || !viewer.email) {
    const sessionReady = !!envLib.secretOf(process.env);
    const accountsReady = sessionReady || isConfigured();
    return json(401, {
      signedIn: false,
      configured: accountsReady,
      reason: accountsReady ? 'sign_in_required' : 'not_configured'
    });
  }
  if (!store.configured()) {
    return json(503, { signedIn: true, configured: false, reason: 'not_configured' });
  }
  try {
    const rows = await store.forEmail(viewer.email);
    const extras = extrasFor(rows);
    extras.profile = { email: viewer.email };
    return json(200, Object.assign({ signedIn: true, configured: true }, flow.dashboardView(rows, extras, now)));
  } catch (err) {
    return json(500, { signedIn: true, reason: 'error' });
  }
};

exports._setViewerForTests = function (fn) { viewerOverride = fn; };
exports._setExtrasForTests = function (fn) { extrasOverride = fn; };
exports._sessionViewerForTests = sessionViewer;
