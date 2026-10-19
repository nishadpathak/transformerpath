/* Public buy-button switch for jobs and RFQ.
 *
 * Default response is { jobs_rfq_payments: false } and contains no Payment
 * Link URL and no plink_ id. Buttons are added only when the flag is on.
 * The stored Payment Link URL is not changed when a promo code is appended.
 */
'use strict';
const { jobsRfqPaymentsEnabled } = require('../lib/feature-flags');
const { PAYMENT_LINKS, JOBS_RFQ_GROUPS, paymentButtonHref } = require('../lib/paid-listings');

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function groups() {
  const out = {};
  Object.keys(JOBS_RFQ_GROUPS).forEach(function (name) {
    out[name] = JOBS_RFQ_GROUPS[name].map(function (id) {
      const spec = PAYMENT_LINKS[id];
      return {
        product: id,
        label: spec.label,
        href: paymentButtonHref(id)
      };
    });
  });
  return out;
}

exports.handler = async function () {
  const enabled = jobsRfqPaymentsEnabled() === true;
  const body = { jobs_rfq_payments: enabled };
  if (enabled) body.groups = groups();
  const raw = JSON.stringify(body);
  if (raw.indexOf('plink_') !== -1) {
    return json(500, { error: 'refused' });
  }
  return json(200, body);
};
