/* Netlify handlers for /api/auth/google, /api/auth/me, and /api/auth/logout.
 *
 * The ID token is checked before any cookie is set. The cookie is the only
 * stored profile. These handlers do not use a database.
 */
'use strict';

const envLib = require('./google-auth-env');
const session = require('./session-cookie');
const tokens = require('./google-id-token');

function header(event, name) {
  const headers = (event && event.headers) || {};
  const want = name.toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === want) return headers[keys[i]];
  }
  return '';
}

function rawBody(event) {
  if (!event || event.body == null) return '';
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64').toString('utf8');
  return String(event.body);
}

function json(status, body, extra) {
  return {
    statusCode: status,
    headers: Object.assign({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }, extra || {}),
    body: JSON.stringify(body)
  };
}

async function googleAuth(event, options) {
  const opts = options || {};
  const env = opts.env || process.env;
  if (!event || event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!envLib.buttonEnabled(env)) return json(503, { ok: false, configured: false });
  let body;
  try {
    body = JSON.parse(rawBody(event) || '');
  } catch (e) {
    return json(400, { ok: false, error: 'bad_json' });
  }
  const credential = body && body.credential;
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 8192) {
    return json(400, { ok: false, error: 'bad_credential' });
  }
  const verify = opts.verifyIdToken || tokens.verifyGoogleIdToken;
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const verified = await verify(credential, {
    clientId: envLib.clientIdOf(env),
    now: now,
    keys: opts.keys,
    fetchImpl: opts.fetchImpl
  });
  if (!verified || !verified.ok) {
    return json(401, { ok: false, error: (verified && verified.reason) || 'invalid_token' });
  }
  const secret = envLib.secretOf(env);
  const cookie = session.signSession(verified.profile, secret, now);
  if (!cookie) return json(401, { ok: false, error: 'profile' });
  return json(200, {
    ok: true,
    name: verified.profile.name || '',
    email: verified.profile.email
  }, {
    'Set-Cookie': session.cookieHeader(cookie, session.MAX_AGE)
  });
}

function meAuth(event, options) {
  const opts = options || {};
  const env = opts.env || process.env;
  if (!event || (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD')) {
    return json(405, { signedIn: false, error: 'method' });
  }
  const secret = envLib.secretOf(env);
  if (!secret) return json(200, { signedIn: false, configured: false });
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const raw = session.readCookie(header(event, 'cookie'), session.COOKIE_NAME);
  const profile = session.readSession(raw, secret, now);
  if (!profile) return json(200, { signedIn: false });
  return json(200, {
    signedIn: true,
    name: profile.name,
    email: profile.email,
    picture: profile.picture || ''
  });
}

function logoutAuth(event) {
  if (!event || event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method' });
  return json(200, { ok: true }, { 'Set-Cookie': session.clearCookie() });
}

module.exports = {
  googleAuth: googleAuth,
  meAuth: meAuth,
  logoutAuth: logoutAuth
};
