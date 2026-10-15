'use strict';
/* Course payments are identified by Checkout metadata or by a Payment Link
 * id. The amount is never enough: a $199 job post must not become Learning.
 *
 * The buy.stripe.com codes below are the dormant engineer links already
 * recorded in docs/payments-audit.md. This file does not create Stripe
 * objects. STRIPE_PAYMENT_LINK_LEARNING, STRIPE_PAYMENT_LINK_PROFESSIONAL,
 * and STRIPE_PAYMENT_LINK_TEAM are optional plink_ ids Nishad can set later.
 */

const COURSES = {
  learning: {
    product: 'learning',
    plan: 'Learning',
    tier: 'learner',
    code: '4gMbIU2lO5hj1NC5DcfYY03',
    linkEnv: 'STRIPE_PAYMENT_LINK_LEARNING'
  },
  professional: {
    product: 'professional',
    plan: 'Professional',
    tier: 'professional',
    code: 'fZu00c3pScJL1NC3v4fYY01',
    linkEnv: 'STRIPE_PAYMENT_LINK_PROFESSIONAL'
  },
  team: {
    product: 'team',
    plan: 'Team',
    tier: 'enterprise',
    code: 'aFacMY6C4aBD2RG2r0fYY02',
    linkEnv: 'STRIPE_PAYMENT_LINK_TEAM'
  }
};

const ALIAS = {
  learning: 'learning',
  learner: 'learning',
  professional: 'professional',
  team: 'team',
  enterprise: 'team'
};

function namedCourse(session) {
  const meta = session && session.metadata ? session.metadata : {};
  const keys = [meta.product, meta.plan, meta.tier];
  for (let i = 0; i < keys.length; i++) {
    const id = ALIAS[String(keys[i] || '').trim().toLowerCase()];
    if (id && COURSES[id]) return COURSES[id];
  }
  return null;
}

/* A completed Checkout Session leaves url empty. payment_link is then either
 * the plink_ id or, after expand[]=payment_link, the Payment Link object
 * whose url is the buy.stripe.com address. */
function paymentLinkParts(session) {
  const link = session && session.payment_link;
  if (link && typeof link === 'object') {
    return {
      id: link.id == null ? '' : String(link.id),
      url: link.url == null ? '' : String(link.url)
    };
  }
  return { id: link == null ? '' : String(link), url: '' };
}

function haystack(session) {
  const link = paymentLinkParts(session);
  return [
    link.id,
    link.url,
    session.success_url,
    session.cancel_url,
    session.client_reference_id,
    session.url
  ].map(function (value) { return value == null ? '' : String(value); }).join('\n');
}

function classifyCourse(session) {
  if (!session || typeof session !== 'object') return null;
  const named = namedCourse(session);
  if (named) return named;
  const paymentLink = paymentLinkParts(session).id;
  const hay = haystack(session);
  const ids = Object.keys(COURSES);
  for (let i = 0; i < ids.length; i++) {
    const spec = COURSES[ids[i]];
    const configured = String(process.env[spec.linkEnv] || '').trim();
    if (configured && paymentLink === configured) return spec;
    if (spec.code && hay.indexOf(spec.code) !== -1) return spec;
  }
  return null;
}

module.exports = {
  COURSES: COURSES,
  classifyCourse: classifyCourse,
  paymentLinkParts: paymentLinkParts
};
