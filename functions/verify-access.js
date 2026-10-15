// Netlify function: verify a Stripe Checkout Session is genuinely paid before
// granting TransformerPath course access. This is the server-side half of the
// paywall — the browser/client side is NOT trusted to grant access by itself.
//
// Requires the environment variable STRIPE_SECRET_KEY (Stripe dashboard →
// Developers → API keys → Secret key). Fail-closed: if the key is not set, or
// the session is not paid, the function returns valid:false and NO access is
// granted. The tier comes from session metadata or a known Payment Link id.
// The amount is not a tier: an unknown $199 charge does not become Learning.

const STRIPE_API = 'https://api.stripe.com/v1';
const SK = (process.env.STRIPE_SECRET_KEY || '').trim();
const { listingProduct } = require('../lib/paid-listings');
const { classifyCourse } = require('../lib/course-payment');

exports.handler = async (event) => {
  // A plain GET is a CONFIG status probe only — it must never grant access.
  // The pricing page uses it to disable checkout when the backend can't verify
  // payments, so a customer is never charged into a locked-out account.
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({ configured: !!SK, reason: SK ? 'ok' : 'STRIPE_SECRET_KEY not set' }),
    };
  }
  // Only POST is meaningful for a grant; any other method never grants.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!SK) {
    return {
      statusCode: 200,
      body: JSON.stringify({ valid: false, configured: false, reason: 'STRIPE_SECRET_KEY not set' }),
    };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  const sessionId = (body.session_id || '').trim();
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'session_id required' }) };
  }

  try {
    const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${SK}` },
    });
    const session = await res.json();

    if (!res.ok) {
      // 404 (unknown session), 401 (bad key), etc. — never grant.
      return { statusCode: 200, body: JSON.stringify({ valid: false, configured: true, reason: 'stripe_error' }) };
    }

    // The security boundary: the session must be paid. Anything else (open,
    // unpaid, expired, refunded) is rejected.
    if (session.payment_status === 'paid') {
      // Manufacturer and event payments are not course entitlements. valid
      // stays false so course-gate does not grant a learner token.
      const listing = listingProduct(session);
      if (listing) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            valid: false,
            paid: true,
            listing: 'paid_pending_verification',
            product: listing,
            reason: 'listing_payment_not_course'
          }),
        };
      }
      const course = classifyCourse(session);
      if (!course) {
        return {
          statusCode: 200,
          body: JSON.stringify({ valid: false, paid: true, reason: 'unclassified' })
        };
      }
      const tier = course.tier;
      // Issue a server-trusted, expiring entitlement token (not localStorage,
      // not a query param) so gated content delivery can be verified server-side.
      const ent = require('./lib/entitlement');
      const entitlement_token = ent.issue(tier, 365 * 24 * 3600);
      return { statusCode: 200, body: JSON.stringify({ valid: true, paid: true, tier, entitlement_token }) };
    }
    return { statusCode: 200, body: JSON.stringify({ valid: false, paid: false, payment_status: session.payment_status }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ valid: false, configured: true, reason: 'stripe_error', detail: String(e && e.message) }) };
  }
};
