/* HMAC-signed session cookie. The payload is the only copy of the profile.
 * There is no user table.
 */
'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'tp_session';
const MAX_AGE = 30 * 24 * 60 * 60;

function cleanText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function cleanSub(value) {
  const sub = cleanText(value, 255);
  if (!/^[A-Za-z0-9_-]+$/.test(sub)) return '';
  return sub;
}

function cleanPicture(value) {
  const url = cleanText(value, 500);
  if (!/^https:\/\/[^\s]+$/.test(url)) return '';
  return url;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function signSession(profile, secret, nowMs) {
  const key = String(secret || '');
  if (!key) return '';
  const email = cleanEmail(profile && profile.email);
  const sub = cleanSub(profile && profile.sub);
  if (!email || !sub) return '';
  const now = Math.floor(Number(nowMs) / 1000);
  if (!Number.isFinite(now)) return '';
  const body = {
    sub: sub,
    email: email,
    name: cleanText(profile && profile.name, 80),
    picture: cleanPicture(profile && profile.picture),
    iat: now,
    exp: now + MAX_AGE
  };
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return payload + '.' + sig;
}

function readSession(token, secret, nowMs) {
  const key = String(secret || '');
  if (!key || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = crypto.createHmac('sha256', key).update(parts[0]).digest('base64url');
  if (!safeEqual(parts[1], expected)) return null;
  let body;
  try {
    body = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!body || typeof body !== 'object') return null;
  const now = Math.floor(Number(nowMs) / 1000);
  if (!Number.isFinite(now) || typeof body.exp !== 'number' || body.exp <= now) return null;
  const email = cleanEmail(body.email);
  const sub = cleanSub(body.sub);
  if (!email || !sub) return null;
  return {
    sub: sub,
    email: email,
    name: cleanText(body.name, 80),
    picture: cleanPicture(body.picture),
    iat: body.iat,
    exp: body.exp
  };
}

function cookieHeader(value, maxAge) {
  return COOKIE_NAME + '=' + value + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + maxAge;
}

function clearCookie() {
  return COOKIE_NAME + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

function readCookie(header, name) {
  const raw = String(header || '');
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return '';
}

module.exports = {
  COOKIE_NAME: COOKIE_NAME,
  MAX_AGE: MAX_AGE,
  cleanEmail: cleanEmail,
  cleanPicture: cleanPicture,
  signSession: signSession,
  readSession: readSession,
  cookieHeader: cookieHeader,
  clearCookie: clearCookie,
  readCookie: readCookie
};
