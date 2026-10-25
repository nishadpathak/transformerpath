/* Provider-agnostic Verified Manufacturer mail.
 *
 * Resend is the sender already used by functions/lib/paid-receipt.js.
 * When RESEND_API_KEY is unset the messages are built and not sent.
 * No other email vendor is added.
 */
'use strict';

const flow = require('../../lib/verified-flow');

function resendKey() {
  return (process.env.RESEND_API_KEY || '').trim();
}

function fromAddress() {
  return (process.env.RESEND_FROM || 'TransformerPath <onboarding@resend.dev>').trim();
}

function build(kind, row) {
  const built = flow.templates(kind, row);
  if (!built) return null;
  function wrap(msg) {
    if (!msg) return null;
    return {
      from: fromAddress(),
      to: msg.to,
      subject: msg.subject,
      text: msg.text
    };
  }
  return { buyer: wrap(built.buyer), internal: wrap(built.internal) };
}

async function sendOne(msg, fetcher) {
  return fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + resendKey()
    },
    body: JSON.stringify(msg)
  });
}

async function sendKind(kind, row, fetchImpl) {
  const built = build(kind, row);
  if (!built) return { sent: false, reason: 'unknown', retry: false };
  if (!resendKey()) return { sent: false, reason: 'not_configured', retry: false, messages: built };
  const fetcher = fetchImpl || fetch;
  const queue = [];
  if (built.buyer) queue.push(built.buyer);
  if (built.internal) queue.push(built.internal);
  for (let i = 0; i < queue.length; i++) {
    let res;
    try { res = await sendOne(queue[i], fetcher); }
    catch (e) { return { sent: false, reason: 'error', retry: true }; }
    if (!res || !res.ok) return { sent: false, reason: 'provider_error', retry: true };
  }
  return { sent: true, retry: false };
}

module.exports = { build: build, sendKind: sendKind };
