/* Discounted Learning checkout for students.
 * The flag is off unless STUDENT_LEARNING_COUPON_ENABLED is exactly "on"
 * AND both Stripe ids are set. This module does not call Stripe, does not
 * create a coupon, price, or Payment Link, and does not contain either id.
 */
'use strict';

var COUPON_ID = /^coupon_[A-Za-z0-9]+$/;
var PRICE_ID = /^price_[A-Za-z0-9]+$/;

function status(env) {
  env = env || process.env;
  var flag = String(env.STUDENT_LEARNING_COUPON_ENABLED || '').trim() === 'on';
  var coupon = String(env.STRIPE_STUDENT_LEARNING_COUPON_ID || '').trim();
  var price = String(env.STRIPE_STUDENT_LEARNING_PRICE_ID || '').trim();
  if (!flag) return { enabled: false, reason: 'flag_off' };
  if (!coupon || !price) return { enabled: false, reason: 'missing_stripe_ids' };
  if (!COUPON_ID.test(coupon) || !PRICE_ID.test(price)) return { enabled: false, reason: 'invalid_stripe_ids' };
  return { enabled: true, coupon: coupon, price: price };
}

/* Params for a one-time Checkout Session. Null while the offer is off.
 * Nothing in this repository posts these params to Stripe. */
function checkoutParams(env) {
  var offer = status(env);
  if (!offer.enabled) return null;
  return {
    mode: 'payment',
    line_items: [{ price: offer.price, quantity: 1 }],
    discounts: [{ coupon: offer.coupon }],
    success_url: 'https://transformerpath.com/pricing.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://transformerpath.com/pricing.html#student-learning-offer'
  };
}

function publicStatus(env) {
  var offer = status(env);
  return { enabled: false, reason: offer.enabled ? 'checkout_not_started' : offer.reason };
}

module.exports = {
  status: status,
  checkoutParams: checkoutParams,
  publicStatus: publicStatus
};
