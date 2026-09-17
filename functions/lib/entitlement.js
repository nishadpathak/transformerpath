/* TransformerPath — server-side entitlement token (HMAC-signed, expiring).
 *
 * The browser-local access model (localStorage 'tp-course-access') cannot be
 * trusted by a serverless function. This helper issues/verifies a signed,
 * expiring entitlement token that a client presents (cookie or Authorization
 * header) to unlock gated content. It is the canonical, non-localStorage,
 * non-query-param entitlement signal for protected delivery.
 *
 * Token = base64url(payload).base64url(hmac), payload = { plan, exp }.
 *    - plan: 'learning' | 'professional' | 'enterprise' (Learning-or-higher unlocks)
 *    - exp : epoch seconds
 * Verified with ENV: ENTITLEMENT_SECRET (or STRIPE_SECRET_KEY fallback).
 * Fail-closed: no/invalid/expired token => not entitled.
 */
'use strict';
const crypto = require('crypto');

// Learning/Professional/Team all unlock the course. 'enterprise' == Team.
const PLAN_RANK = { learning: 1, learner: 1, professional: 2, enterprise: 3, team: 3 };

function secret() { return (process.env.ENTITLEMENT_SECRET || process.env.STRIPE_SECRET_KEY || '').trim(); }
function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uDecode(s) { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }

function hmac(payload) {
  const s = secret();
  if (!s) return null;
  return crypto.createHmac('sha256', s).update(payload).digest('hex');
}

function issue(plan, ttlSeconds) {
  const s = secret();
  if (!s) return null;
  const planKey = String(plan || '').toLowerCase();
  if (!PLAN_RANK[planKey]) return null; // unknown plan -> no token
  const exp = Math.floor(Date.now() / 1000) + (ttlSeconds || 365 * 24 * 3600); // 12 months
  const payload = b64u(JSON.stringify({ plan: planKey, exp }));
  const sig = hmac(payload);
  return sig ? payload + '.' + sig : null;
}

function verify(token) {
  const s = secret();
  if (!s) return { valid: false, reason: 'not_configured' };
  if (!token || token.indexOf('.') < 0) return { valid: false, reason: 'missing' };
  const dot = token.lastIndexOf('.');
  const payload = token.slice(0, dot), sig = token.slice(dot + 1);
  const expect = hmac(payload);
  if (!expect || sig !== expect) return { valid: false, reason: 'bad_signature' };
  try {
    const d = JSON.parse(b64uDecode(payload));
    const now = Math.floor(Date.now() / 1000);
    if (!d || !d.exp || d.exp < now) return { valid: false, reason: d && d.exp ? 'expired' : 'no_expiry' };
    const rank = PLAN_RANK[String(d.plan || '').toLowerCase()];
    if (!rank) return { valid: false, reason: 'unknown_plan' };
    return { valid: true, plan: d.plan, exp: d.exp, rank };
  } catch (e) { return { valid: false, reason: 'bad_payload' }; }
}

function extractToken(req) {
  // Authorization: Bearer <token>
  const auth = (req.headers && req.headers.authorization) || (req.headers && req.headers.Authorization) || '';
  if (auth && auth.toLowerCase().indexOf('bearer ') === 0) return auth.slice(7).trim();
  // Cookie: tp_ent=<token>
  const cookie = (req.headers && req.headers.cookie) || '';
  const m = cookie.match(/(?:^|;\s*)tp_ent=([^;]+)/);
  return m ? m[1] : null;
}

module.exports = { issue, verify, extractToken, PLAN_RANK };
