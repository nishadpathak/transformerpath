/* Public client id vs session secret.
 *
 * GOOGLE_CLIENT_ID is a public OAuth client id and may be written into the
 * browser bundle. SESSION_SECRET must never be written, logged, or returned.
 * The sign-in button is shown only when both are usable.
 */
'use strict';

const CLIENT_ID_RE = /^[0-9]+-[0-9A-Za-z_-]+\.apps\.googleusercontent\.com$/;
const MIN_SECRET = 16;

function clientIdOf(env) {
  const value = String((env && env.GOOGLE_CLIENT_ID) || '').trim();
  if (!CLIENT_ID_RE.test(value)) return '';
  return value;
}

function secretOf(env) {
  const value = String((env && env.SESSION_SECRET) || '').trim();
  if (value.length < MIN_SECRET) return '';
  return value;
}

function buttonEnabled(env) {
  return !!(clientIdOf(env) && secretOf(env));
}

function presence(env) {
  const rawId = String((env && env.GOOGLE_CLIENT_ID) || '').trim();
  const rawSecret = String((env && env.SESSION_SECRET) || '').trim();
  return {
    GOOGLE_CLIENT_ID: !rawId ? 'missing' : (clientIdOf(env) ? 'set' : 'invalid'),
    SESSION_SECRET: !rawSecret ? 'missing' : (secretOf(env) ? 'set' : 'invalid')
  };
}

module.exports = {
  CLIENT_ID_RE: CLIENT_ID_RE,
  MIN_SECRET: MIN_SECRET,
  clientIdOf: clientIdOf,
  secretOf: secretOf,
  buttonEnabled: buttonEnabled,
  presence: presence
};
