/* Buyer confirmation and internal notice for a paid listing.
 *
 * Env (names only): RESEND_API_KEY, RESEND_FROM, NOTIFY_TO.
 * Stripe Dashboard must also have email receipts turned on
 * (Settings → Customer emails → Successful payments). This sender does not
 * replace that card receipt.
 *
 * Unconfigured Resend does not fail the webhook. A provider error asks the
 * webhook to retry.
 */
'use strict';

const LABELS = {
  verified_manufacturer: 'Verified Manufacturer ($499)',
  featured_event: 'Featured Event ($299)',
  featured_exhibitor: 'Featured Exhibitor ($399)',
  hosted_webinar: 'Hosted Webinar ($1,500)'
};

function resendKey() { return (process.env.RESEND_API_KEY || '').trim(); }
function notifyTo() { return (process.env.NOTIFY_TO || 'hello@transformerpath.com').trim(); }
function resendFrom() { return (process.env.RESEND_FROM || 'TransformerPath <onboarding@resend.dev>').trim(); }

function money(amount, currency) {
  if (typeof amount !== 'number') return 'unknown';
  return (amount / 100).toFixed(2) + ' ' + String(currency || 'usd').toUpperCase();
}

function messages(row) {
  const label = LABELS[row.product] || row.product;
  const ref = row.company_slug || row.event_id || '';
  const buyerText = [
    'Thank you for your TransformerPath payment.',
    '',
    'Product: ' + label,
    ref ? 'Reference: ' + ref : null,
    'Amount: ' + money(row.amount, row.currency),
    'Session: ' + row.session_id,
    '',
    'Status: paid, pending verification.',
    row.product === 'featured_event'
      ? 'Submit the event name, official URL, and dates at ' + ((process.env.SITE_URL || 'https://transformerpath.com').trim().replace(/\/$/, '')) + '/events.html?paid=featured_event#submit-event'
      : null,
    row.product === 'featured_exhibitor'
      ? 'Submit your company and the event at ' + ((process.env.SITE_URL || 'https://transformerpath.com').trim().replace(/\/$/, '')) + '/sponsor.html?paid=featured_exhibitor#contact'
      : null,
    row.product === 'hosted_webinar'
      ? 'Submit the webinar topic, date, and company at ' + ((process.env.SITE_URL || 'https://transformerpath.com').trim().replace(/\/$/, '')) + '/sponsor.html?paid=hosted_webinar#contact'
      : null,
    row.product === 'verified_manufacturer'
      ? 'Submit your company details at ' + ((process.env.SITE_URL || 'https://transformerpath.com').trim().replace(/\/$/, '')) + '/claim-profile.html?paid=verified_manufacturer#claimForm'
      : null,
    'A VERIFIED MANUFACTURER badge or FEATURED label is published only after a reviewer confirms the organization. Payment does not change technical capability, evidence, or ranking.',
    '',
    'Stripe can also email a card receipt. Turn on email receipts in the Stripe Dashboard under Settings → Customer emails → Successful payments.'
  ].filter(Boolean).join('\n');

  const internalText = [
    'Paid listing received. Status: paid_pending_verification.',
    'Product: ' + label,
    'Session: ' + row.session_id,
    'Email: ' + (row.email || '(none)'),
    'Reference: ' + (ref || '(none)'),
    'Amount: ' + money(row.amount, row.currency),
    'Livemode: ' + (row.livemode === true ? 'true' : 'false'),
    '',
    'Publish a badge only by adding a reviewed row to data/paid-listings.json with status verified, reviewer, reviewed_at, and verification_evidence.'
  ].join('\n');

  return {
    buyer: row.email ? {
      from: resendFrom(),
      to: [row.email],
      subject: 'TransformerPath payment received — ' + label,
      text: buyerText
    } : null,
    internal: {
      from: resendFrom(),
      to: [notifyTo()],
      subject: 'TransformerPath paid listing — ' + label,
      text: internalText
    }
  };
}

async function sendOne(msg, fetcher) {
  const res = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + resendKey()
    },
    body: JSON.stringify(msg)
  });
  return res;
}

async function sendPaidReceipts(row, fetchImpl) {
  const built = messages(row);
  if (!resendKey()) {
    console.log('paid receipt skipped: RESEND_API_KEY not set', row && row.session_id);
    return { sent: false, reason: 'not_configured', retry: false };
  }
  const fetcher = fetchImpl || fetch;
  const queue = [];
  if (built.buyer) queue.push(built.buyer);
  queue.push(built.internal);
  for (let i = 0; i < queue.length; i++) {
    let res;
    try { res = await sendOne(queue[i], fetcher); }
    catch (e) {
      console.error('paid receipt network error');
      return { sent: false, reason: 'error', retry: true };
    }
    if (!res || !res.ok) {
      console.error('paid receipt provider error', res && res.status);
      return { sent: false, reason: 'provider_error', retry: true };
    }
  }
  return { sent: true, retry: false };
}

module.exports = { messages, sendPaidReceipts, LABELS };
