/* Student Learning discount. Off unless the flag and Stripe ids are set,
 * and even then this handler does not call Stripe or create a Checkout Session.
 */
'use strict';

const offer = require('../lib/student-learning-offer');

exports.handler = async function () {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(offer.publicStatus())
  };
};
