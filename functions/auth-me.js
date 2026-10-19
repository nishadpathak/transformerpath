/* GET /api/auth/me — read the signed session cookie. No database lookup. */
'use strict';

const { meAuth } = require('./lib/google-auth');

exports.handler = function (event) {
  return meAuth(event);
};
