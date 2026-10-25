/* Verified Manufacturer ($499 one-time, 12 months, no auto-renewal).
 *
 * Payment identity is the existing Payment Link and Stripe product.
 * Rows live on public.paid_listings. Course access lives on
 * public.entitlements (user_id, product). This module does not create a
 * price, a product, or a second checkout.
 *
 * The badge is not a product certification. Copy uses:
 * "identity and contact checked, not a product certification".
 */
'use strict';

const PRODUCT = 'verified_manufacturer';
const AMOUNT_CENTS = 49900;
const STRIPE_PRODUCT_ID = 'prod_VRGrajnpm0wWTo';
const TERM_MS = 365 * 24 * 60 * 60 * 1000;
const REMINDER_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;
const REVIEWER = 'TransformerPath';
const CONTACT = 'hello@transformerpath.com';
const CHECKED = 'identity and contact checked, not a product certification';
const PRICE_LINE = '$499 one-time payment · covers 12 months';

/* Owner Stripe Dashboard setup and Netlify secrets stay off until this is "1".
 * The public Payment Link does not read the flag. */
function serverEnabled() {
  return String(process.env.TP_VERIFIED_SERVER || '') === '1';
}

const LISTING_COLUMNS = [
  'session_id', 'product', 'company_slug', 'event_id', 'email',
  'amount', 'currency', 'livemode', 'status', 'component', 'created_at'
];

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function emailOf(value) {
  const email = clean(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function httpsUrl(value) {
  const url = clean(value, 500);
  if (!/^https:\/\/[^\s]+$/i.test(url)) return '';
  return url;
}

function parseTime(value) {
  if (!value) return NaN;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : NaN;
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function termEndMs(row) {
  if (!row) return NaN;
  const explicit = parseTime(row.expires_at);
  if (Number.isFinite(explicit)) return explicit;
  const start = parseTime(row.reviewed_at) || parseTime(row.created_at);
  if (!Number.isFinite(start)) return NaN;
  return start + TERM_MS;
}

function termEnded(row, nowMs) {
  if (!row || row.product && row.product !== PRODUCT) return false;
  if (row.status === 'expired') return true;
  if (row.status !== 'verified') return false;
  const end = termEndMs(row);
  if (!Number.isFinite(end)) return false;
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  return now >= end;
}

function effectiveStatus(row, nowMs) {
  if (!row) return 'missing';
  if (row.status === 'refunded' || row.status === 'rejected') return row.status;
  if (termEnded(row, nowMs) || row.status === 'expired') return 'expired';
  return row.status || 'missing';
}

function badgeAllowed(row, nowMs) {
  if (!row || row.product !== PRODUCT) return false;
  if (row.status !== 'verified') return false;
  if (!row.reviewer || !row.reviewed_at || !row.verification_evidence) return false;
  if (termEnded(row, nowMs)) return false;
  return true;
}

function listingRowFromSession(session) {
  const meta = session && session.metadata ? session.metadata : {};
  const email = emailOf(
    (session.customer_details && session.customer_details.email) || session.customer_email
  );
  let companySlug = clean(meta.company_slug, 120);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(companySlug)) companySlug = '';
  return {
    session_id: clean(session && session.id, 200),
    product: PRODUCT,
    company_slug: companySlug || null,
    event_id: null,
    email: email || null,
    amount: typeof session.amount_total === 'number' ? session.amount_total : null,
    currency: clean(session.currency, 12) || 'usd',
    livemode: session.livemode === true,
    status: 'paid_pending_verification',
    component: null,
    created_at: iso(Date.now())
  };
}

function courseEntitlement(course, userId, nowMs) {
  if (!course || !userId) return null;
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  return {
    user_id: userId,
    product: course.product,
    plan: course.plan,
    access_start: iso(now),
    access_end: null,
    status: 'active'
  };
}

function verifiedEntitlement(row, nowMs) {
  if (!row || !row.user_id || row.status !== 'verified') return null;
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  return {
    user_id: row.user_id,
    product: PRODUCT,
    plan: 'Verified Manufacturer',
    access_start: iso(now),
    access_end: iso(now + TERM_MS),
    status: 'active'
  };
}

function readClaim(body) {
  const src = body && typeof body === 'object' ? body : {};
  if (clean(src['bot-field'] || src.bot_field, 80)) {
    return { ok: false, errors: ['not accepted'] };
  }
  const errors = [];
  const company = clean(src.company, 160);
  const role = clean(src.position || src.role, 120);
  const email = emailOf(src.email);
  const website = httpsUrl(src.website);
  const proof = clean(src.proof || src.authorization, 2000);
  const sessionId = clean(src.session_id || src.payment_session, 200);
  const consent = src.consent === true || src.consent === 'on' || src.consent === 'yes';
  if (company.length < 2) errors.push('company required');
  if (role.length < 2) errors.push('role required');
  if (!email) errors.push('work email required');
  if (!website) errors.push('https website required');
  if (proof.length < 20) errors.push('authorization required');
  if (!consent) errors.push('authorization consent required');
  if (!sessionId || sessionId.indexOf('cs_') !== 0 || sessionId.indexOf('{') !== -1) {
    errors.push('payment session required');
  }
  if (errors.length) return { ok: false, errors: errors };
  return {
    ok: true,
    claim: {
      session_id: sessionId,
      claim_company: company,
      claim_role: role,
      claim_website: website,
      email: email,
      authorization_note: proof,
      document_status: 'received',
      consent: true
    }
  };
}

function approve(row, evidence, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const status = effectiveStatus(row, now);
  if (!row || row.product !== PRODUCT) return { ok: false, error: 'not_verified_manufacturer' };
  if (status === 'refunded' || status === 'rejected' || status === 'expired') {
    return { ok: false, error: status };
  }
  if (status !== 'paid_pending_verification' && status !== 'verified') {
    return { ok: false, error: 'not_payable' };
  }
  const note = clean(evidence, 2000);
  if (note.length < 12) return { ok: false, error: 'evidence required' };
  const reviewedAt = iso(now);
  const next = Object.assign({}, row, {
    status: 'verified',
    reviewer: REVIEWER,
    reviewed_at: reviewedAt,
    verification_evidence: note,
    expires_at: iso(now + TERM_MS),
    document_status: row.document_status === 'missing' ? 'received' : (row.document_status || 'checked')
  });
  if (next.document_status === 'received') next.document_status = 'checked';
  return { ok: true, row: next, entitlement: verifiedEntitlement(next, now), publish_row: publishRow(next) };
}

function reject(row, evidence, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const status = effectiveStatus(row, now);
  if (!row || row.product !== PRODUCT) return { ok: false, error: 'not_verified_manufacturer' };
  if (status === 'refunded' || status === 'expired') return { ok: false, error: status };
  const note = clean(evidence, 2000);
  if (note.length < 12) return { ok: false, error: 'evidence required' };
  const next = Object.assign({}, row, {
    status: 'rejected',
    reviewer: REVIEWER,
    reviewed_at: iso(now),
    verification_evidence: note
  });
  return { ok: true, row: next, publish_row: null };
}

function markRefunded(row, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const next = Object.assign({}, row, { status: 'refunded' });
  const entitlement = row && row.user_id ? {
    user_id: row.user_id,
    product: PRODUCT,
    plan: 'Verified Manufacturer',
    access_start: row.created_at || iso(now),
    access_end: iso(now),
    status: 'refunded'
  } : null;
  return { row: next, entitlement: entitlement };
}

function markExpired(row, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  if (!termEnded(Object.assign({}, row, { status: 'verified' }), now) && row.status !== 'expired') {
    return { ok: false, error: 'still_current' };
  }
  const next = Object.assign({}, row, { status: 'expired' });
  const entitlement = row && row.user_id ? {
    user_id: row.user_id,
    product: PRODUCT,
    plan: 'Verified Manufacturer',
    access_start: row.reviewed_at || row.created_at || iso(now),
    access_end: iso(termEndMs(row) || now),
    status: 'expired'
  } : null;
  return { ok: true, row: next, entitlement: entitlement };
}

function publishRow(row) {
  return {
    session_id: row.session_id,
    product: PRODUCT,
    company_slug: row.company_slug || '',
    email: row.email || '',
    status: 'verified',
    reviewer: row.reviewer,
    reviewed_at: row.reviewed_at,
    verification_evidence: row.verification_evidence,
    expires_at: row.expires_at
  };
}

function daysUntil(row, nowMs) {
  const end = termEndMs(row);
  if (!Number.isFinite(end)) return null;
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  return Math.ceil((end - now) / (24 * 60 * 60 * 1000));
}

function dashboardView(rows, extras, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const list = Array.isArray(rows) ? rows : [];
  const listings = list.map(function (row) {
    const status = effectiveStatus(row, now);
    return {
      session_id: row.session_id,
      company_slug: row.company_slug || '',
      claim_company: row.claim_company || '',
      claim_role: row.claim_role || '',
      claim_website: row.claim_website || '',
      payment_status: status,
      document_status: row.document_status || 'missing',
      amount: row.amount,
      currency: row.currency || 'usd',
      livemode: row.livemode === true,
      expires_at: row.expires_at || (Number.isFinite(termEndMs(row)) ? iso(termEndMs(row)) : null),
      days_remaining: status === 'verified' ? daysUntil(row, now) : null,
      badge: badgeAllowed(row, now),
      auto_renewal: false
    };
  });
  return {
    product: PRODUCT,
    price: PRICE_LINE,
    auto_renewal: false,
    wording: CHECKED,
    contact: CONTACT,
    profile: extras && extras.profile ? extras.profile : null,
    listings: listings,
    rfqs: extras && Array.isArray(extras.rfqs) ? extras.rfqs : [],
    enquiries: extras && Array.isArray(extras.enquiries) ? extras.enquiries : [],
    analytics: {
      verified_profiles: listings.filter(function (row) { return row.badge; }).length,
      pending_review: listings.filter(function (row) { return row.payment_status === 'paid_pending_verification'; }).length,
      profile_views: null,
      note: 'Profile views are not counted yet.'
    }
  };
}

function revenueSummary(rows, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const counts = {
    paid_pending_verification: 0,
    verified: 0,
    rejected: 0,
    refunded: 0,
    expired: 0
  };
  let paidCents = 0;
  let refundedCents = 0;
  let testCount = 0;
  let liveCount = 0;
  let expiring = 0;
  (rows || []).forEach(function (row) {
    if (!row || row.product !== PRODUCT) return;
    const status = effectiveStatus(row, now);
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    const amount = typeof row.amount === 'number' ? row.amount : 0;
    if (status === 'refunded') refundedCents += amount;
    else paidCents += amount;
    if (row.livemode === true) liveCount += 1;
    else testCount += 1;
    if (status === 'verified') {
      const left = daysUntil(row, now);
      if (left != null && left >= 0 && left <= 30) expiring += 1;
    }
  });
  return {
    product: PRODUCT,
    price: PRICE_LINE,
    auto_renewal: false,
    currency: 'usd',
    counts: counts,
    amount_cents: { collected: paidCents, refunded: refundedCents },
    livemode: { test: testCount, live: liveCount },
    expiring_within_30_days: expiring
  };
}

function remindersDue(rows, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const renewal = [];
  const expiry = [];
  (rows || []).forEach(function (row) {
    if (!row || row.product !== PRODUCT || row.status !== 'verified') return;
    const end = termEndMs(row);
    if (!Number.isFinite(end)) return;
    if (now >= end && !row.expiry_notice_sent_at) expiry.push(row);
    else if (now >= end - REMINDER_BEFORE_MS && now < end && !row.renewal_reminder_sent_at) renewal.push(row);
  });
  return { renewal: renewal, expiry: expiry };
}

function paymentLink() {
  return require('./paid-listings').PAYMENT_LINKS.verified_manufacturer.url;
}

function messageBase(row) {
  const company = row && (row.claim_company || row.company_slug) ? (row.claim_company || row.company_slug) : 'your company';
  return [
    'TransformerPath',
    'Product: Verified Manufacturer (' + PRICE_LINE + ', no auto-renewal).',
    'Company: ' + company,
    CHECKED + '.',
    'Questions: ' + CONTACT
  ];
}

function templates(kind, row) {
  const lines = messageBase(row);
  let subject = 'TransformerPath Verified Manufacturer';
  if (kind === 'confirmation') {
    subject = 'TransformerPath payment received — Verified Manufacturer';
    lines.push('Status: paid, pending review. The VERIFIED MANUFACTURER badge is not shown until TransformerPath approves the claim.');
    lines.push('Submit the claim at https://transformerpath.com/claim-profile.html?paid=verified_manufacturer#claimForm');
  } else if (kind === 'approval') {
    subject = 'TransformerPath Verified Manufacturer approved';
    lines.push('Status: approved. The badge is published only after this review. It is not a product certification.');
    lines.push('The term ends on ' + (row && row.expires_at ? row.expires_at : 'the review date plus 12 months') + '. It does not auto-renew.');
  } else if (kind === 'rejection') {
    subject = 'TransformerPath Verified Manufacturer not approved';
    lines.push('Status: not approved. The badge is not shown.');
    lines.push('What was checked: ' + ((row && row.verification_evidence) || 'the authorization on the claim.'));
  } else if (kind === 'expiry') {
    subject = 'TransformerPath Verified Manufacturer term ended';
    lines.push('Status: expired. The 12-month term has ended and the badge is removed. There is no auto-renewal.');
    lines.push('To cover another 12 months, use the same one-time payment link: ' + paymentLink());
  } else if (kind === 'renewal') {
    subject = 'TransformerPath Verified Manufacturer term ends soon';
    lines.push('The 12-month term ends on ' + (row && row.expires_at ? row.expires_at : 'the date on your approval') + '.');
    lines.push('There is no auto-renewal and no new charge unless you pay again.');
    lines.push('The same one-time payment link is ' + paymentLink());
  } else if (kind === 'refund') {
    subject = 'TransformerPath Verified Manufacturer refunded';
    lines.push('Status: refunded. The badge is not shown.');
  } else {
    return null;
  }
  const text = lines.join('\n');
  const email = row && emailOf(row.email);
  return {
    buyer: email ? { to: [email], subject: subject, text: text } : null,
    internal: {
      to: [CONTACT],
      subject: subject,
      text: text + (email ? '\nBuyer: ' + email : '\nBuyer: (none)')
    }
  };
}

function entitlementKeys(row) {
  return row ? Object.keys(row).sort() : [];
}

module.exports = {
  PRODUCT: PRODUCT,
  AMOUNT_CENTS: AMOUNT_CENTS,
  STRIPE_PRODUCT_ID: STRIPE_PRODUCT_ID,
  paymentLink: paymentLink,
  TERM_MS: TERM_MS,
  REVIEWER: REVIEWER,
  CONTACT: CONTACT,
  CHECKED: CHECKED,
  PRICE_LINE: PRICE_LINE,
  serverEnabled: serverEnabled,
  LISTING_COLUMNS: LISTING_COLUMNS,
  emailOf: emailOf,
  termEndMs: termEndMs,
  termEnded: termEnded,
  effectiveStatus: effectiveStatus,
  badgeAllowed: badgeAllowed,
  listingRowFromSession: listingRowFromSession,
  courseEntitlement: courseEntitlement,
  verifiedEntitlement: verifiedEntitlement,
  readClaim: readClaim,
  approve: approve,
  reject: reject,
  markRefunded: markRefunded,
  markExpired: markExpired,
  publishRow: publishRow,
  dashboardView: dashboardView,
  revenueSummary: revenueSummary,
  remindersDue: remindersDue,
  templates: templates,
  entitlementKeys: entitlementKeys
};
