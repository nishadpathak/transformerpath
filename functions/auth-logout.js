/* POST /api/auth/logout — clear the session cookie. */
'use strict';

const { logoutAuth } = require('./lib/google-auth');

exports.handler = function (event) {
  return logoutAuth(event);
};
