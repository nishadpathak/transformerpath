/* Verify a Google Identity Services ID token.
 *
 * Checks the RS256 signature against Google's certs (or keys passed in by a
 * test), then aud, iss, and exp. No network call happens when `keys` is set.
 */
'use strict';

const crypto = require('crypto');

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = {
  'https://accounts.google.com': 1,
  'accounts.google.com': 1
};

let certCache = { at: 0, keys: null };

function clearCertCache() {
  certCache = { at: 0, keys: null };
}

function decodeJson(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function audienceOk(aud, clientId) {
  if (aud === clientId) return true;
  if (Array.isArray(aud)) return aud.indexOf(clientId) !== -1;
  return false;
}

function verifyRs256(signingInput, signaturePart, jwk) {
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const sig = Buffer.from(signaturePart, 'base64url');
  return crypto.verify('RSA-SHA256', Buffer.from(signingInput), key, sig);
}

async function loadKeys(opts) {
  if (opts.keys) return opts.keys;
  const now = opts.now || Date.now();
  if (certCache.keys && certCache.keys.length && now - certCache.at < 60 * 60 * 1000) {
    return certCache.keys;
  }
  const fetchImpl = opts.fetchImpl || global.fetch;
  const res = await fetchImpl(CERTS_URL, { headers: { accept: 'application/json' } });
  if (!res || !res.ok) {
    const err = new Error('certs');
    err.code = 'certs';
    throw err;
  }
  const body = await res.json();
  const keys = body && Array.isArray(body.keys) ? body.keys : [];
  if (keys.length) certCache = { at: now, keys: keys };
  return keys;
}

async function verifyGoogleIdToken(token, opts) {
  const options = opts || {};
  const clientId = String(options.clientId || '');
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const raw = String(token || '');
  if (!clientId) return { ok: false, reason: 'aud' };
  if (!raw || raw.length > 8192) return { ok: false, reason: 'malformed' };
  const parts = raw.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { ok: false, reason: 'malformed' };
  }
  let header;
  let payload;
  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
  } catch (e) {
    return { ok: false, reason: 'malformed' };
  }
  if (!header || header.alg !== 'RS256' || !header.kid) return { ok: false, reason: 'alg' };
  let keys;
  try {
    keys = await loadKeys(options);
  } catch (e) {
    return { ok: false, reason: 'certs' };
  }
  const jwk = (keys || []).filter(function (key) { return key && key.kid === header.kid; })[0];
  if (!jwk) return { ok: false, reason: 'kid' };
  let signed = false;
  try {
    signed = verifyRs256(parts[0] + '.' + parts[1], parts[2], jwk);
  } catch (e) {
    return { ok: false, reason: 'signature' };
  }
  if (!signed) return { ok: false, reason: 'signature' };
  if (!audienceOk(payload.aud, clientId)) return { ok: false, reason: 'aud' };
  if (!ISSUERS[payload.iss]) return { ok: false, reason: 'iss' };
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp * 1000 <= now) {
    return { ok: false, reason: 'exp' };
  }
  if (payload.email_verified !== true) return { ok: false, reason: 'email' };
  const email = String(payload.email || '').trim().toLowerCase();
  const sub = String(payload.sub || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'email' };
  if (!/^[A-Za-z0-9_-]+$/.test(sub)) return { ok: false, reason: 'profile' };
  return {
    ok: true,
    profile: {
      sub: sub,
      email: email,
      name: String(payload.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80),
      picture: /^https:\/\/[^\s]+$/.test(String(payload.picture || '')) ? String(payload.picture).slice(0, 500) : ''
    }
  };
}

module.exports = {
  CERTS_URL: CERTS_URL,
  clearCertCache: clearCertCache,
  verifyGoogleIdToken: verifyGoogleIdToken
};
