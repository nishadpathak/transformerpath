/* POST /api/auth/google — verify a Google ID token and set the session cookie. */
'use strict';

const { googleAuth } = require('./lib/google-auth');

exports.handler = function (event) {
  return googleAuth(event);
};
