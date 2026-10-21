/* Shared responses and the internal review token.
 * VERIFIED_REVIEW_TOKEN is server-only. Never write it into a page.
 */
'use strict';

const crypto = require('crypto');

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow'
    },
    body: JSON.stringify(body)
  };
}

function header(event, name) {
  const headers = (event && event.headers) || {};
  const want = name.toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === want) return headers[keys[i]];
  }
  return '';
}

function readBody(event) {
  if (!event || event.body == null || event.body === '') return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : String(event.body);
  try { return JSON.parse(raw); }
  catch (e) { return null; }
}

function reviewAuth(event, env) {
  const expected = String((env || process.env).VERIFIED_REVIEW_TOKEN || '').trim();
  if (expected.length < 24) return { configured: false, ok: false };
  const presented = header(event, 'authorization');
  const match = String(presented).match(/^Bearer\s+(\S+)$/i);
  const given = match ? match[1] : '';
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return { configured: true, ok: false };
  if (!crypto.timingSafeEqual(left, right)) return { configured: true, ok: false };
  return { configured: true, ok: true };
}

module.exports = {
  json: json,
  header: header,
  readBody: readBody,
  reviewAuth: reviewAuth
};
