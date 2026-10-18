/* functions/csv-download.js — paid CSV delivery.
 *
 * GET /data/download?session_id=… rewrites here. The Stripe secret is read
 * from STRIPE_SECRET_KEY and is never written to the response, a log line,
 * or a signed URL. payment_status must be paid. The product is the first
 * explicit metadata product on the line items, then the Payment Link, then
 * the session: csv_directory, csv_tenders, csv_awards, or csv_bundle.
 *
 * A paid session gets 15-minute HMAC links. A link with dl, sid, exp, and
 * sig streams the matching build-time CSV. Anything else renders the
 * verify-failed page. This response never includes a Payment Link URL.
 *
 * Dashboard success_url, not a site button:
 * https://transformerpath.com/data/download?session_id={CHECKOUT_SESSION_ID}
 */
'use strict';
const fs = require('fs');
const path = require('path');
const csv = require('../lib/csv-exports');
const dgaDownload = require('../lib/dga-download');
const templateDownload = require('../lib/template-download');
const jobPostReturn = require('../lib/job-post-return');
const { listingProduct } = require('../lib/paid-listings');

const DIGITAL = {
  dga_report: dgaDownload,
  report_template: templateDownload,
  template_bundle: templateDownload,
  commissioning_job_post: jobPostReturn
};

function digitalOf(name) {
  return DIGITAL[String(name || '').trim()] || null;
}

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeSecret() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function scrub(text) {
  const secret = stripeSecret();
  let out = String(text == null ? '' : text);
  if (secret) out = out.split(secret).join('');
  return out;
}

function queryOf(event) {
  return (event && event.queryStringParameters) || {};
}

function bodyOf(event) {
  if (!event || !event.body) return {};
  try { return JSON.parse(event.body); } catch (e) { return {}; }
}

function exportDir() {
  const env = String(process.env.CSV_EXPORT_DIR || '').trim();
  if (env) return env;
  const candidates = [];
  candidates.push(
    path.join(__dirname, '..', 'data', 'csv-exports'),
    path.join(process.cwd(), 'data', 'csv-exports'),
    path.join(__dirname, 'data', 'csv-exports'),
    path.join('/var/task', 'data', 'csv-exports')
  );
  for (let i = 0; i < candidates.length; i++) {
    try {
      if (fs.existsSync(path.join(candidates[i], 'manifest.json'))) return candidates[i];
    } catch (e) { /* try the next location */ }
  }
  return candidates[0] || path.join(process.cwd(), 'data', 'csv-exports');
}

function html(statusCode, page) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff'
    },
    body: scrub(page)
  };
}

function pageOpts(extra) {
  const dir = exportDir();
  return Object.assign({
    previews: csv.loadPreviews(dir),
    directoryScope: csv.readDirectoryScope(dir)
  }, extra || {});
}

function failedPage() {
  return html(200, csv.renderPage(pageOpts({ verified: false })));
}

function missingPage() {
  return html(200, csv.renderPage(pageOpts({
    verified: true,
    fileMissing: true
  })));
}

function paidPage(product, links) {
  const spec = csv.PRODUCTS[product];
  return html(200, csv.renderPage(pageOpts({
    verified: true,
    productLabel: spec ? spec.label : '',
    links: links
  })));
}

function fileResponse(key, text) {
  const spec = csv.FILES[key];
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + spec.filename + '"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow'
    },
    body: scrub(text)
  };
}

function acceptableSessionId(sid) {
  return /^[A-Za-z0-9_]+$/.test(sid) && sid.length >= 4 && sid.length <= 255;
}

async function stripeGet(secret, pathname) {
  const url = STRIPE_API + pathname;
  if (url.indexOf('https://api.stripe.com/') !== 0) throw new Error('unexpected host');
  if (url.indexOf(secret) !== -1) throw new Error('refusing request');
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + secret } });
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  return { ok: !!res.ok, status: res.status, body: body };
}

async function loadSession(secret, sid) {
  const got = await stripeGet(
    secret,
    '/checkout/sessions/' + encodeURIComponent(sid) +
      '?expand[]=payment_link&expand[]=line_items&expand[]=line_items.data.price.product'
  );
  if (!got.ok || !got.body || typeof got.body !== 'object') return null;
  const session = got.body;
  const link = session.payment_link;
  if (!csv.lineItemsNameProduct(session) && typeof link === 'string' && /^plink_[A-Za-z0-9]+$/.test(link)) {
    const extra = await stripeGet(secret, '/payment_links/' + encodeURIComponent(link));
    if (extra.ok && extra.body && typeof extra.body === 'object') session.payment_link = extra.body;
  }
  return session;
}

async function handle(event) {
  const method = event && event.httpMethod;
  if (method !== 'GET' && method !== 'POST') {
    return html(405, csv.renderPage({ verified: false, previews: csv.loadPreviews(exportDir()) }));
  }

  const q = queryOf(event);
  const body = bodyOf(event);
  const dl = String(q.dl || '').trim();
  const sig = String(q.sig || '').trim();
  const asked = String(q.product || body.product || '').trim();
  const signedDigital = digitalOf(dl);
  if (signedDigital) return signedDigital.signedDownload(stripeSecret(), q);
  if (dl || sig) {
    const secret = stripeSecret();
    const sid = String(q.sid || '').trim();
    const ok = secret && csv.verifyDownload(secret, sid, dl, q.exp, sig);
    if (!ok) return failedPage();
    const text = csv.readStored(exportDir(), dl);
    if (!text) return missingPage();
    return fileResponse(dl, text);
  }

  const sid = String(q.session_id || body.session_id || '').trim();
  const askedHandler = digitalOf(asked);
  function denyDigital() {
    return askedHandler ? askedHandler.failed() : failedPage();
  }
  if (!acceptableSessionId(sid)) return denyDigital();
  const secret = stripeSecret();
  if (!secret) return denyDigital();

  let session = null;
  try {
    session = await loadSession(secret, sid);
  } catch (e) {
    return denyDigital();
  }
  if (!session || session.payment_status !== 'paid') return denyDigital();
  const listed = listingProduct(session);
  const listedHandler = digitalOf(listed);
  if (askedHandler || listedHandler) {
    if (!listedHandler || (asked && asked !== listed)) return (askedHandler || listedHandler).failed();
    return listedHandler.fulfilled(secret, sid, Object.assign({}, q, body), listed);
  }
  const product = csv.csvProductFromSession(session);
  if (!product) return failedPage();
  return paidPage(product, csv.issueLinks(secret, sid, product));
}

exports.handler = async function (event) {
  try {
    return await handle(event || {});
  } catch (e) {
    const q = queryOf(event || {});
    const body = bodyOf(event || {});
    const handler = digitalOf(q.dl) || digitalOf(q.product) || digitalOf(body.product);
    if (handler) return handler.failed();
    return failedPage();
  }
};

exports.exportDir = exportDir;
