/* Paid DGA PDF. Stripe session check, then the same HMAC pattern as the CSV
 * download. Gas values come from the query string. The HTML page also tells
 * the browser to copy values it saved locally into that query string.
 */
'use strict';
const crypto = require('crypto');
const csv = require('./csv-exports');
const dga = require('./dga-interpret');
const pdf = require('./dga-pdf');

const STORAGE_KEY = 'tp-dga-inputs';
const FAIL = "We couldn't verify this payment, contact hello@transformerpath.com";

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clip(value) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80);
}

function readInput(q) {
  q = q || {};
  var out = {
    o2n2: q.o2n2 === 'gt02' ? 'gt02' : 'le02',
    age: ['unknown', 'y1_9', 'y10_30', 'y30'].indexOf(q.age) >= 0 ? q.age : 'unknown',
    asset: clip(q.asset),
    sampled: clip(q.sampled)
  };
  var any = false;
  dga.GAS_KEYS.forEach(function (key) {
    if (q[key] != null && String(q[key]).trim() !== '') {
      out[key] = String(q[key]).trim();
      any = true;
    }
  });
  out.present = any;
  return out;
}

function canonical(input) {
  var keys = dga.GAS_KEYS.concat(['o2n2', 'age', 'asset', 'sampled']);
  return keys.map(function (key) {
    return key + '=' + String(input[key] == null ? '' : input[key]);
  }).join('\n');
}

function signReport(secret, sid, exp, input) {
  var payload = ['v1', sid, 'dga_report', String(exp), canonical(input)].join('\n');
  return crypto.createHmac('sha256', String(secret)).update(payload).digest('hex');
}

function verifyReport(secret, sid, exp, sig, input, now) {
  if (!secret) return false;
  if (!/^[A-Za-z0-9_]+$/.test(String(sid || ''))) return false;
  if (!/^[a-f0-9]{64}$/.test(String(sig || ''))) return false;
  var expNum = Number(exp);
  if (!Number.isSafeInteger(expNum)) return false;
  var clock = now == null ? Date.now() : now;
  if (expNum <= clock) return false;
  if (expNum > clock + csv.TTL_MS + 60 * 1000) return false;
  var expected = signReport(secret, sid, expNum, input);
  var a = Buffer.from(String(sig));
  var b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function htmlPage(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff'
    },
    body: body
  };
}

function failed() {
  return htmlPage(200, shell(
    '<p id="dga-verify-failed">' + esc(FAIL) + '</p>' +
    '<p><a href="/tools/dga/">Back to the DGA interpreter</a></p>'
  ));
}

function pdfResponse(buffer) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="transformerpath-dga-report.pdf"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow'
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true
  };
}

function signedHref(secret, sid, input) {
  var exp = Date.now() + csv.TTL_MS;
  var sig = signReport(secret, sid, exp, input);
  var parts = [
    'dl=dga_report',
    'sid=' + encodeURIComponent(sid),
    'exp=' + encodeURIComponent(String(exp)),
    'sig=' + encodeURIComponent(sig)
  ];
  dga.GAS_KEYS.concat(['o2n2', 'age', 'asset', 'sampled']).forEach(function (key) {
    if (input[key] != null && input[key] !== '') parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(input[key])));
  });
  return '/data/download?' + parts.join('&');
}

function shell(inner) {
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>DGA report — TransformerPath</title>' +
    '<meta name="robots" content="noindex, nofollow">' +
    '<link rel="stylesheet" href="/style.css?v=14">' +
    '<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml"></head><body>' +
    '<header><div class="container nav"><a href="/" class="logo"><span class="word">Transformer<span class="accent">Path</span></span></a></div></header>' +
    '<main id="main" class="container" style="padding:32px 0 64px;max-width:760px">' +
    '<h1>DGA PDF report</h1>' + inner +
    '<p>' + esc(dga.DISCLAIMER) + '</p>' +
    '</main></body></html>';
}

function browserFillScript() {
  return '<script>(function(){' +
    'var key=' + JSON.stringify(STORAGE_KEY) + ';' +
    'var params=new URLSearchParams(location.search);' +
    'if(params.get("h2")!=null)return;' +
    'var saved=null;try{saved=JSON.parse(localStorage.getItem(key)||"null");}catch(e){saved=null;}' +
    'if(!saved||saved.h2==null)return;' +
    '["h2","ch4","c2h6","c2h4","c2h2","co","co2","o2n2","age","asset","sampled"].forEach(function(name){' +
    'if(saved[name]!=null&&saved[name]!=="")params.set(name,String(saved[name]));' +
    '});' +
    'location.replace(location.pathname+"?"+params.toString());' +
    '})();</script>';
}

function fulfilled(secret, sid, query) {
  var input = readInput(query);
  if (!input.present) {
    return htmlPage(200, shell(
      '<p id="dga-paid">Payment confirmed for the DGA PDF. Add the gas values from this browser, or type them below.</p>' +
      '<form id="dga-gases" method="get" action="/data/download">' +
      '<input type="hidden" name="product" value="dga_report">' +
      '<input type="hidden" name="session_id" value="' + esc(sid) + '">' +
      dga.GAS_KEYS.map(function (key) {
        return '<p><label>' + dga.GAS_LABELS[key] + ' ppm <input name="' + key + '" inputmode="decimal" required></label></p>';
      }).join('') +
      '<p><button class="btn btn-amber" type="submit">Build the PDF</button></p></form>' +
      browserFillScript()
    ));
  }
  var result = dga.interpret(input);
  if (result.error) {
    return htmlPage(200, shell('<p id="dga-input-error">' + esc(result.error) + '</p>'));
  }
  if (String(query.format || '') === 'pdf') return pdfResponse(pdf.buildPdf(result.lines));
  var href = signedHref(secret, sid, input);
  var preview = result.lines.map(function (line) { return esc(line); }).join('<br>');
  return htmlPage(200, shell(
    '<p id="dga-paid">Payment confirmed. This link expires in 15 minutes.</p>' +
    '<p><a class="btn btn-amber" id="dga-pdf" href="' + esc(href) + '">Download transformerpath-dga-report.pdf</a></p>' +
    '<h2>Report</h2><p id="dga-preview">' + preview + '</p>'
  ));
}

function signedDownload(secret, query) {
  var input = readInput(query);
  if (!verifyReport(secret, query.sid, query.exp, query.sig, input)) return failed();
  var result = dga.interpret(input);
  if (result.error) return htmlPage(200, shell('<p id="dga-input-error">' + esc(result.error) + '</p>'));
  return pdfResponse(pdf.buildPdf(result.lines));
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  FAIL: FAIL,
  readInput: readInput,
  canonical: canonical,
  signReport: signReport,
  verifyReport: verifyReport,
  failed: failed,
  fulfilled: fulfilled,
  signedDownload: signedDownload
};
