/* Paid US/EU grid-equipment buyer note. Stripe is checked again, then a
 * short-lived HMAC link returns one PDF.
 */
'use strict';
const crypto = require('crypto');
const csv = require('./csv-exports');
const guide = require('./buyer-guide-us-eu');

const FAIL = "We couldn't verify this payment, contact hello@transformerpath.com";

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlPage(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff'
    },
    body: '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Grid equipment buyer note — TransformerPath</title>' +
      '<meta name="robots" content="noindex, nofollow">' +
      '<link rel="stylesheet" href="/style.css?v=14">' +
      '<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml"></head><body>' +
      '<header><div class="container nav"><a href="/" class="logo"><span class="word">Transformer<span class="accent">Path</span></span></a></div></header>' +
      '<main id="main" class="container" style="padding:32px 0 64px;max-width:760px">' +
      '<h1>US and EU grid equipment buyer note</h1>' + body +
      '<p>This is not legal advice. Questions: <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a>.</p>' +
      '</main></body></html>'
  };
}

function failed() {
  return htmlPage(
    '<p id="guide-verify-failed" data-product="' + esc(guide.PRODUCT) + '">' + esc(FAIL) + '</p>' +
    '<p>The download page recognised product ' + esc(guide.PRODUCT) + ' and did not release the PDF.</p>' +
    '<p><a href="/guides/us-eu-grid-equipment/">Back to the free summary</a></p>'
  );
}

function fileResponse(buffer) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="' + guide.FILENAME + '"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow'
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true
  };
}

function signFile(secret, sid, exp) {
  const payload = ['v1', sid, guide.PRODUCT, String(exp)].join('\n');
  return crypto.createHmac('sha256', String(secret)).update(payload).digest('hex');
}

function verifyFile(secret, sid, exp, sig, now) {
  if (!secret) return false;
  if (!/^[A-Za-z0-9_]+$/.test(String(sid || ''))) return false;
  if (!/^[a-f0-9]{64}$/.test(String(sig || ''))) return false;
  const expNum = Number(exp);
  if (!Number.isSafeInteger(expNum)) return false;
  const clock = now == null ? Date.now() : now;
  if (expNum <= clock) return false;
  if (expNum > clock + csv.TTL_MS + 60 * 1000) return false;
  const expected = signFile(secret, sid, expNum);
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signedHref(secret, sid) {
  const exp = Date.now() + csv.TTL_MS;
  const sig = signFile(secret, sid, exp);
  return '/data/download?dl=' + encodeURIComponent(guide.PRODUCT) +
    '&sid=' + encodeURIComponent(sid) +
    '&exp=' + encodeURIComponent(String(exp)) +
    '&sig=' + encodeURIComponent(sig);
}

function fulfilled(secret, sid) {
  const href = signedHref(secret, sid);
  return htmlPage(
    '<p id="guide-paid">Payment confirmed for the US and EU grid equipment buyer note. This link expires in 15 minutes.</p>' +
    '<p><a class="btn btn-amber" id="guide-pdf" href="' + esc(href) + '">Download ' + esc(guide.FILENAME) + '</a></p>' +
    '<p><a href="/guides/us-eu-grid-equipment/">Free summary</a></p>'
  );
}

function signedDownload(secret, query) {
  if (!verifyFile(secret, query.sid, query.exp, query.sig)) return failed();
  return fileResponse(guide.buildPdf());
}

module.exports = {
  FAIL: FAIL,
  signFile: signFile,
  verifyFile: verifyFile,
  failed: failed,
  fulfilled: fulfilled,
  signedDownload: signedDownload
};
