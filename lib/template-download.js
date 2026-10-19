/* Paid test-report templates. The Stripe session is checked again, then a
 * short-lived HMAC link returns one workbook or the seven-file bundle.
 */
'use strict';
const crypto = require('crypto');
const csv = require('./csv-exports');
const reports = require('./report-templates');

const FAIL = "We couldn't verify this payment, contact hello@transformerpath.com";
const PRODUCTS = { report_template: true, template_bundle: true };

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
      '<title>Test templates — TransformerPath</title>' +
      '<meta name="robots" content="noindex, nofollow">' +
      '<link rel="stylesheet" href="/style.css?v=14">' +
      '<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml"></head><body>' +
      '<header><div class="container nav"><a href="/" class="logo"><span class="word">Transformer<span class="accent">Path</span></span></a></div></header>' +
      '<main id="main" class="container" style="padding:32px 0 64px;max-width:760px">' +
      '<h1>Test and commissioning templates</h1>' + body +
      '<p>These are blank editable workbooks. They are not a substitute for the test standard or for the equipment specification.</p>' +
      '</main></body></html>'
  };
}

function failed() {
  return htmlPage(
    '<p id="template-verify-failed">' + esc(FAIL) + '</p>' +
    '<p><a href="/templates/">Back to the template previews</a></p>'
  );
}

function fileResponse(filename, buffer, type) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': type,
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow'
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true
  };
}

function signFile(secret, sid, exp, product, templateKey) {
  const payload = ['v1', sid, product, templateKey, String(exp)].join('\n');
  return crypto.createHmac('sha256', String(secret)).update(payload).digest('hex');
}

function verifyFile(secret, sid, exp, sig, product, templateKey, now) {
  if (!secret || !PRODUCTS[product]) return false;
  if (!/^[A-Za-z0-9_]+$/.test(String(sid || ''))) return false;
  if (!/^[a-f0-9]{64}$/.test(String(sig || ''))) return false;
  if (templateKey !== 'all' && !reports.BY_KEY[templateKey]) return false;
  if (templateKey === 'all' && product !== 'template_bundle') return false;
  const expNum = Number(exp);
  if (!Number.isSafeInteger(expNum)) return false;
  const clock = now == null ? Date.now() : now;
  if (expNum <= clock) return false;
  if (expNum > clock + csv.TTL_MS + 60 * 1000) return false;
  const expected = signFile(secret, sid, expNum, product, templateKey);
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signedHref(secret, sid, product, templateKey) {
  const exp = Date.now() + csv.TTL_MS;
  const sig = signFile(secret, sid, exp, product, templateKey);
  return '/data/download?dl=' + encodeURIComponent(product) +
    '&template=' + encodeURIComponent(templateKey) +
    '&sid=' + encodeURIComponent(sid) +
    '&exp=' + encodeURIComponent(String(exp)) +
    '&sig=' + encodeURIComponent(sig);
}

function picker(sid) {
  const options = reports.TEMPLATES.map(function (item) {
    return '<option value="' + esc(item.key) + '">' + esc(item.title) + '</option>';
  }).join('');
  return '<p id="template-paid">Payment confirmed for one template. Choose it here. This checkout does not remember an earlier choice, so each visit can build the template you select.</p>' +
    '<form id="template-pick" method="get" action="/data/download">' +
    '<input type="hidden" name="product" value="report_template">' +
    '<input type="hidden" name="session_id" value="' + esc(sid) + '">' +
    '<p><label>Template <select name="template">' + options + '</select></label></p>' +
    '<p><button class="btn btn-amber" type="submit">Build this template</button></p></form>';
}

function linkList(secret, sid, product, keys) {
  return keys.map(function (key) {
    const item = reports.BY_KEY[key];
    const href = signedHref(secret, sid, product, key);
    return '<li><a href="' + esc(href) + '">' + esc(item.title) + '</a> <span>' + esc(item.filename) + '</span></li>';
  }).join('');
}

function fulfilled(secret, sid, query, product) {
  const name = PRODUCTS[product] ? product : '';
  if (!name) return failed();
  const chosen = String((query && query.template) || '').trim();
  if (name === 'report_template') {
    if (!reports.BY_KEY[chosen]) return htmlPage(picker(sid));
    const href = signedHref(secret, sid, name, chosen);
    const item = reports.BY_KEY[chosen];
    return htmlPage(
      '<p id="template-paid">Payment confirmed. This link expires in 15 minutes and only returns ' + esc(item.filename) + '.</p>' +
      '<p><a class="btn btn-amber" id="template-file" href="' + esc(href) + '">Download ' + esc(item.filename) + '</a></p>' +
      '<p><a href="/data/download?product=report_template&amp;session_id=' + encodeURIComponent(sid) + '">Choose a different template</a></p>'
    );
  }
  const zipHref = signedHref(secret, sid, name, 'all');
  return htmlPage(
    '<p id="template-paid">Payment confirmed for all seven templates. Each link expires in 15 minutes.</p>' +
    '<p><a class="btn btn-amber" id="template-zip" href="' + esc(zipHref) + '">Download all seven (.zip)</a></p>' +
    '<ul id="template-files">' + linkList(secret, sid, name, reports.TEMPLATES.map(function (item) { return item.key; })) + '</ul>'
  );
}

function signedDownload(secret, query) {
  const product = String(query.dl || '').trim();
  const templateKey = String(query.template || '').trim();
  if (!verifyFile(secret, query.sid, query.exp, query.sig, product, templateKey)) return failed();
  if (templateKey === 'all') {
    const zip = reports.buildBundleZip();
    return fileResponse(zip.filename, zip.bytes, 'application/zip');
  }
  const built = reports.buildTemplate(templateKey);
  if (!built) return failed();
  return fileResponse(built.template.filename, built.bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

module.exports = {
  FAIL: FAIL,
  signFile: signFile,
  verifyFile: verifyFile,
  failed: failed,
  fulfilled: fulfilled,
  signedDownload: signedDownload
};
