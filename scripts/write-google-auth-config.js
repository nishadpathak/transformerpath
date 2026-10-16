#!/usr/bin/env node
/* Write google-auth-config.js from public Netlify env.
 *
 * The browser file receives GOOGLE_CLIENT_ID only when SESSION_SECRET is also
 * set. Otherwise clientId is empty and the header hides the button.
 * SESSION_SECRET is never printed and never written.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { clientIdOf, buttonEnabled, presence } = require('../functions/lib/google-auth-env');

function render(env) {
  const id = buttonEnabled(env) ? clientIdOf(env) : '';
  const body = [
    '/* Written by scripts/write-google-auth-config.js from GOOGLE_CLIENT_ID.',
    ' * An empty clientId hides Sign in with Google. SESSION_SECRET is never written here. */',
    'window.TP_GOOGLE_AUTH = {',
    '  clientId: ' + JSON.stringify(id),
    '};',
    ''
  ].join('\n');
  const secret = String((env && env.SESSION_SECRET) || '');
  if (secret && body.indexOf(secret) !== -1) {
    throw new Error('refusing to write session secret into google-auth-config.js');
  }
  return body;
}

function writeGoogleAuthConfig(env, dest) {
  const body = render(env || {});
  if (dest) fs.writeFileSync(dest, body);
  return { enabled: buttonEnabled(env || {}), present: presence(env || {}), body: body };
}

if (require.main === module) {
  const dest = process.argv[2] || path.join(__dirname, '..', 'google-auth-config.js');
  const result = writeGoogleAuthConfig(process.env, dest);
  const flags = result.present;
  console.log(
    '[google-auth] button=' + (result.enabled ? 'shown' : 'hidden') +
    ' GOOGLE_CLIENT_ID=' + flags.GOOGLE_CLIENT_ID +
    ' SESSION_SECRET=' + flags.SESSION_SECRET
  );
}

module.exports = { writeGoogleAuthConfig: writeGoogleAuthConfig, render: render };
