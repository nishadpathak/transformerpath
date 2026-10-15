'use strict';
/* Course payments are identified by Checkout metadata, a known Payment Link
 * id, or the buy.stripe.com code. The amount is never enough: a $199 job
 * post must not become Learning, and a $299 job post must not become
 * Featured Event.
 *
 * Codes and the Learning plink id come from PAYMENT_LINKS. The inactive
 * yearly Learning code 4gMbIU2lO5hj1NC5DcfYY03 is not a classifier.
 * STRIPE_PAYMENT_LINK_LEARNING, STRIPE_PAYMENT_LINK_PROFESSIONAL, and
 * STRIPE_PAYMENT_LINK_TEAM remain optional extra plink_ ids.
 */

const { PAYMENT_LINKS } = require('./paid-listings');

function linkCode(url) {
  const match = String(url || '').match(/buy\.stripe\.com\/([A-Za-z0-9]+)/);
  return match ? match[1] : '';
}

function courseFromLink(key) {
  const spec = PAYMENT_LINKS[key];
  return {
    product: spec.product,
    plan: spec.plan,
    tier: spec.tier,
    code: linkCode(spec.url),
    plinkId: spec.plinkId || '',
    linkEnv: spec.linkEnv
  };
}

const COURSES = {
  learning: courseFromLink('learning'),
  professional: courseFromLink('engineering_pro'),
  team: courseFromLink('engineering_team')
};

const ALIAS = {
  learning: 'learning',
  learner: 'learning',
  professional: 'professional',
  engineering_pro: 'professional',
  'engineering pro': 'professional',
  team: 'team',
  enterprise: 'team',
  engineering_team: 'team',
  'engineering team': 'team'
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
    if (spec.plinkId && (paymentLink === spec.plinkId || hay.indexOf(spec.plinkId) !== -1)) return spec;
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
