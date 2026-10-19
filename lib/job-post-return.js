/* Commissioning job payment has no file. The claim page holds the form.
 * A missing database must not turn this request into a 500 or a CSV page.
 */
'use strict';

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
    body: '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">' +
      '<title>Commissioning job post — TransformerPath</title>' +
      '<meta name="robots" content="noindex, nofollow"></head><body>' +
      '<main id="main"><h1>Commissioning job post</h1>' + body + '</main></body></html>'
  };
}

function failed() {
  return htmlPage('<p id="job-verify-failed">' + esc(FAIL) + '</p><p><a href="/commissioning-jobs/">Back to the commissioning board</a></p>');
}

function fulfilled(secret, sid) {
  const href = '/claim?product=commissioning_job_post&session_id=' + encodeURIComponent(sid);
  return htmlPage(
    '<p id="job-paid">Payment confirmed. This checkout has no file. The vacancy form is on the claim page, and payment does not publish the post.</p>' +
    '<p><a id="job-claim" href="' + esc(href) + '">Open the vacancy form</a></p>'
  );
}

function signedDownload() {
  return htmlPage('<p id="job-no-file">A commissioning job post has no file to download. The vacancy form opens on the claim page after Stripe confirms the session.</p>');
}

module.exports = {
  FAIL: FAIL,
  failed: failed,
  fulfilled: fulfilled,
  signedDownload: signedDownload
};
