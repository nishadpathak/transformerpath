/* Google sign-in: mocked ID-token checks, bad aud / expiry, cookie tamper.
 * No network. No secret is printed.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const { verifyGoogleIdToken, clearCertCache } = require('../functions/lib/google-id-token');
const session = require('../functions/lib/session-cookie');
const { googleAuth, meAuth, logoutAuth } = require('../functions/lib/google-auth');
const { writeGoogleAuthConfig, render } = require('../scripts/write-google-auth-config');
const { authConfigured } = require('../tp-auth');

const CLIENT = '100000000000-publicclient.apps.googleusercontent.com';
const SECRET = 'not-a-real-session-secret';
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);

const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = pair.publicKey.export({ format: 'jwk' });
jwk.kid = 'test-kid';
jwk.alg = 'RS256';
jwk.use = 'sig';

let failed = 0;
function check(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(function () {
        console.log('  PASS  ' + name);
      }).catch(function (e) {
        failed++;
        console.log('  FAIL  ' + name + '  -> ' + (e && e.message));
      });
    }
    console.log('  PASS  ' + name);
    return Promise.resolve();
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + name + '  -> ' + (e && e.message));
    return Promise.resolve();
  }
}

function signJwt(payload, kid) {
  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
    kid: kid || 'test-kid'
  })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = header + '.' + body;
  const sig = crypto.createSign('RSA-SHA256').update(data).sign(pair.privateKey).toString('base64url');
  return data + '.' + sig;
}

function claims(over) {
  return Object.assign({
    iss: 'https://accounts.google.com',
    aud: CLIENT,
    sub: 'google-subject-1',
    email: 'reader@example.com',
    email_verified: true,
    name: 'Test Reader',
    picture: 'https://example.com/avatar.png',
    iat: Math.floor(NOW / 1000),
    exp: Math.floor(NOW / 1000) + 3600
  }, over || {});
}

function envBoth() {
  return { GOOGLE_CLIENT_ID: CLIENT, SESSION_SECRET: SECRET };
}

const tasks = [];

tasks.push(check('mocked certs accept a signed ID token', async function () {
  clearCertCache();
  const verified = await verifyGoogleIdToken(signJwt(claims()), {
    clientId: CLIENT,
    now: NOW,
    keys: [jwk]
  });
  assert.strictEqual(verified.ok, true);
  assert.strictEqual(verified.profile.email, 'reader@example.com');
  assert.strictEqual(verified.profile.name, 'Test Reader');
}));

tasks.push(check('fetch of mocked Google certs verifies the token', async function () {
  clearCertCache();
  const fetchImpl = function (url) {
    assert.strictEqual(url, 'https://www.googleapis.com/oauth2/v3/certs');
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve({ keys: [jwk] }); }
    });
  };
  const verified = await verifyGoogleIdToken(signJwt(claims()), {
    clientId: CLIENT,
    now: NOW,
    fetchImpl: fetchImpl
  });
  assert.strictEqual(verified.ok, true);
}));

tasks.push(check('bad aud is rejected', async function () {
  const verified = await verifyGoogleIdToken(signJwt(claims({ aud: '999-other.apps.googleusercontent.com' })), {
    clientId: CLIENT,
    now: NOW,
    keys: [jwk]
  });
  assert.strictEqual(verified.ok, false);
  assert.strictEqual(verified.reason, 'aud');
}));

tasks.push(check('expired token is rejected', async function () {
  const verified = await verifyGoogleIdToken(signJwt(claims({ exp: Math.floor(NOW / 1000) - 5 })), {
    clientId: CLIENT,
    now: NOW,
    keys: [jwk]
  });
  assert.strictEqual(verified.ok, false);
  assert.strictEqual(verified.reason, 'exp');
}));

tasks.push(check('bad issuer is rejected', async function () {
  const verified = await verifyGoogleIdToken(signJwt(claims({ iss: 'https://example.com' })), {
    clientId: CLIENT,
    now: NOW,
    keys: [jwk]
  });
  assert.strictEqual(verified.ok, false);
  assert.strictEqual(verified.reason, 'iss');
}));

tasks.push(check('tampered token signature is rejected', async function () {
  const token = signJwt(claims());
  const parts = token.split('.');
  const sig = parts[2];
  const at = 8;
  const ch = sig.charAt(at) === 'A' ? 'B' : 'A';
  const flipped = parts[0] + '.' + parts[1] + '.' + sig.slice(0, at) + ch + sig.slice(at + 1);
  const verified = await verifyGoogleIdToken(flipped, { clientId: CLIENT, now: NOW, keys: [jwk] });
  assert.strictEqual(verified.ok, false);
  assert.strictEqual(verified.reason, 'signature');
}));

tasks.push(check('cookie tamper is rejected', function () {
  const cookie = session.signSession({
    sub: 'google-subject-1',
    email: 'reader@example.com',
    name: 'Test Reader',
    picture: 'https://example.com/avatar.png'
  }, SECRET, NOW);
  assert.ok(cookie);
  const read = session.readSession(cookie, SECRET, NOW);
  assert.strictEqual(read.email, 'reader@example.com');
  const flipped = cookie.slice(0, -1) + (cookie.slice(-1) === 'a' ? 'b' : 'a');
  assert.strictEqual(session.readSession(flipped, SECRET, NOW), null);
  const parts = cookie.split('.');
  const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  payload.email = 'other@example.com';
  const swapped = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + parts[1];
  assert.strictEqual(session.readSession(swapped, SECRET, NOW), null);
  assert.strictEqual(session.readSession(cookie, 'a-different-session-secret', NOW), null);
}));

tasks.push(check('expired cookie is rejected', function () {
  const cookie = session.signSession({
    sub: 'google-subject-1',
    email: 'reader@example.com',
    name: 'Test Reader'
  }, SECRET, NOW);
  const later = NOW + (session.MAX_AGE + 5) * 1000;
  assert.strictEqual(session.readSession(cookie, SECRET, later), null);
}));

tasks.push(check('session cookie flags are HttpOnly Secure SameSite=Lax for 30 days', async function () {
  const res = await googleAuth({
    httpMethod: 'POST',
    body: JSON.stringify({ credential: 'mocked-id-token-value' })
  }, {
    env: envBoth(),
    now: NOW,
    verifyIdToken: function () {
      return Promise.resolve({
        ok: true,
        profile: { sub: 'google-subject-1', email: 'reader@example.com', name: 'Test Reader', picture: 'https://example.com/avatar.png' }
      });
    }
  });
  assert.strictEqual(res.statusCode, 200);
  const setCookie = res.headers['Set-Cookie'];
  assert.ok(/^tp_session=[^;]+; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=2592000$/.test(setCookie));
  assert.strictEqual(setCookie.indexOf(SECRET), -1);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.email, 'reader@example.com');
  const me = meAuth({
    httpMethod: 'GET',
    headers: { cookie: setCookie.split(';')[0] }
  }, { env: envBoth(), now: NOW });
  const meBody = JSON.parse(me.body);
  assert.strictEqual(meBody.signedIn, true);
  assert.strictEqual(meBody.name, 'Test Reader');
  assert.strictEqual(meBody.email, 'reader@example.com');
  const tampered = setCookie.split(';')[0].slice(0, -1) + 'x';
  const bad = meAuth({
    httpMethod: 'GET',
    headers: { Cookie: tampered }
  }, { env: envBoth(), now: NOW });
  assert.strictEqual(JSON.parse(bad.body).signedIn, false);
}));

tasks.push(check('handler rejects bad aud and expiry from the verifier', async function () {
  const aud = await googleAuth({
    httpMethod: 'POST',
    body: JSON.stringify({ credential: 'x'.repeat(40) })
  }, {
    env: envBoth(),
    now: NOW,
    verifyIdToken: function () { return Promise.resolve({ ok: false, reason: 'aud' }); }
  });
  assert.strictEqual(aud.statusCode, 401);
  assert.strictEqual(JSON.parse(aud.body).error, 'aud');
  assert.ok(!aud.headers['Set-Cookie']);
  const exp = await googleAuth({
    httpMethod: 'POST',
    body: JSON.stringify({ credential: 'x'.repeat(40) })
  }, {
    env: envBoth(),
    now: NOW,
    verifyIdToken: function () { return Promise.resolve({ ok: false, reason: 'exp' }); }
  });
  assert.strictEqual(exp.statusCode, 401);
  assert.strictEqual(JSON.parse(exp.body).error, 'exp');
  assert.ok(!exp.headers['Set-Cookie']);
}));

tasks.push(check('real bad aud token does not set a cookie', async function () {
  const res = await googleAuth({
    httpMethod: 'POST',
    body: JSON.stringify({ credential: signJwt(claims({ aud: '1-nope.apps.googleusercontent.com' })) })
  }, { env: envBoth(), now: NOW, keys: [jwk] });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(JSON.parse(res.body).error, 'aud');
  assert.ok(!res.headers['Set-Cookie']);
}));

tasks.push(check('missing env hides the button and refuses a session', function () {
  assert.strictEqual(render({}).indexOf('clientId: ""') !== -1, true);
  assert.strictEqual(render({ GOOGLE_CLIENT_ID: CLIENT }).indexOf('clientId: ""') !== -1, true);
  assert.strictEqual(render({ SESSION_SECRET: SECRET }).indexOf('clientId: ""') !== -1, true);
  assert.strictEqual(render({ GOOGLE_CLIENT_ID: CLIENT }).indexOf(CLIENT), -1);
  const shown = render(envBoth());
  assert.strictEqual(shown.indexOf(CLIENT) !== -1, true);
  assert.strictEqual(shown.indexOf(SECRET), -1);
  assert.strictEqual(authConfigured({ clientId: '' }), false);
  assert.strictEqual(authConfigured({}), false);
  assert.strictEqual(authConfigured({ clientId: CLIENT }), true);
  const dest = path.join(os.tmpdir(), 'tp-google-auth-' + process.pid + '.js');
  const written = writeGoogleAuthConfig(envBoth(), dest);
  const disk = fs.readFileSync(dest, 'utf8');
  assert.strictEqual(disk.indexOf(SECRET), -1);
  assert.strictEqual(written.enabled, true);
  fs.unlinkSync(dest);
  return googleAuth({
    httpMethod: 'POST',
    body: JSON.stringify({ credential: 'x'.repeat(40) })
  }, { env: {}, now: NOW }).then(function (res) {
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(JSON.parse(res.body).configured, false);
    assert.ok(!res.headers['Set-Cookie']);
  });
}));

tasks.push(check('logout clears the cookie', function () {
  const res = logoutAuth({ httpMethod: 'POST' });
  assert.strictEqual(res.headers['Set-Cookie'], 'tp_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  assert.strictEqual(JSON.parse(res.body).ok, true);
}));

tasks.push(check('header slot stays hidden and privacy names Google sign-in', function () {
  const header = fs.readFileSync('_partials/header.html', 'utf8');
  assert.ok(/<span class="tp-auth" data-tp-auth hidden><\/span>/.test(header));
  assert.ok(/data-tp-account/.test(header));
  assert.ok(/google-auth-config\.js/.test(header));
  const authSrc = fs.readFileSync('tp-auth.js', 'utf8');
  const readyBlock = authSrc.slice(authSrc.indexOf('ready(function'));
  const guard = readyBlock.indexOf('if (!configured)');
  const render = readyBlock.indexOf('renderButton(');
  assert.ok(guard !== -1 && render !== -1 && guard < render);
  assert.ok(authSrc.indexOf('accounts.google.com/gsi/client') !== -1);
  const privacy = fs.readFileSync('privacy.html', 'utf8');
  assert.ok(privacy.indexOf('Sign in with Google') !== -1);
  assert.ok(privacy.indexOf('do not store them in a database') !== -1);
  assert.ok(privacy.indexOf('tp_session') !== -1);
  const toml = fs.readFileSync('netlify.toml', 'utf8');
  ['/api/auth/google', '/api/auth/me', '/api/auth/logout', '/me'].forEach(function (route) {
    assert.ok(toml.indexOf('from = "' + route + '"') !== -1, route);
  });
  const fn = fs.readFileSync('functions/lib/google-auth.js', 'utf8');
  assert.strictEqual(/supabase/i.test(fn), false);
  const me = fs.readFileSync('me.html', 'utf8');
  assert.ok(/data-tp-me-name/.test(me) && /data-tp-me-email/.test(me) && /data-tp-signout/.test(me));
  assert.ok(/noindex/.test(me));
}));

Promise.all(tasks).then(function () {
  if (failed) {
    console.error('GOOGLE AUTH FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('GOOGLE AUTH OK');
});
