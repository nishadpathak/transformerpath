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
  hosted_webinar: 'Hosted Webinar ($1,500)',
  job_standard: 'Job posting ($199 / 30 days)',
  job_featured: 'Featured job ($299 / 30 days)',
  job_bundle_5: 'Job bundle, 5 posts ($799)',
  rfq_lead: 'RFQ lead ($249)',
  rfq_lead_pro: 'Supplier Pro extra lead ($149)',
  supplier_pro: 'Supplier Pro ($1,499 / year)'
};

function origin() {
  return (process.env.SITE_URL || 'https://transformerpath.com').trim().replace(/\/$/, '');
}

function nextStep(product) {
  if (product === 'featured_event') return 'Submit the event name, official URL, and dates at ' + origin() + '/events.html?paid=featured_event#submit-event';
  if (product === 'featured_exhibitor') return 'Submit your company and the event at ' + origin() + '/sponsor.html?paid=featured_exhibitor#contact';
  if (product === 'hosted_webinar') return 'Submit the webinar topic, date, and company at ' + origin() + '/sponsor.html?paid=hosted_webinar#contact';
  if (product === 'verified_manufacturer') return 'Submit your company details at ' + origin() + '/claim-profile.html?paid=verified_manufacturer#claimForm';
  if (product === 'job_standard' || product === 'job_featured' || product === 'job_bundle_5') {
    return 'Submit the vacancy at ' + origin() + '/jobs.html?paid=' + product + '#post. Payment does not publish the opening. A reviewer still records the apply URL, the capture date, and the verification date.';
  }
  if (product === 'rfq_lead' || product === 'rfq_lead_pro') {
    return 'This payment does not qualify a lead and does not release the buyer contact. Contact stays hidden until the lead is included or marked paid and is still qualified. See ' + origin() + '/rfq.html?paid=' + product;
  }
  if (product === 'supplier_pro') {
    return 'Supplier Pro stays pending verification. The inbox still counts only the included leads on file. Payment does not release a buyer contact. See ' + origin() + '/rfq.html?paid=supplier_pro';
  }
  return null;
}

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
    nextStep(row.product),
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
