/* Public Supabase settings for the browser.
 *
 * Reads only the project URL and a public client key. A service-role or
 * secret key is rejected so it can never be written into supabase-config.js
 * or returned by the public config function.
 *
 * Env vars:
 *   SUPABASE_URL                https://<project-ref>.supabase.co
 *   SUPABASE_ANON_KEY           legacy anon JWT (role "anon")
 *   SUPABASE_PUBLISHABLE_KEY    sb_publishable_... key
 * The first non-empty public key wins. SUPABASE_SECRET_KEY and
 * SUPABASE_SERVICE_ROLE_KEY are reported as present/missing by the probe
 * and are never copied into the browser config.
 */
'use strict';

const PUBLIC_KEY_VARS = ['SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'];

const PROBE_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const URL_RE = /^https:\/\/[a-z0-9]{1,64}\.supabase\.co$/i;

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function isPublicClientKey(value) {
  if (!value) return false;
  if (value.indexOf('sb_secret_') === 0) return false;
  if (value.indexOf('sb_publishable_') === 0) return value.length > 'sb_publishable_'.length;
  const payload = decodeJwtPayload(value);
  if (!payload) return false;
  return payload.role === 'anon';
}

function presence(env) {
  const source = env || {};
  const present = {};
  PROBE_VARS.forEach(function (name) {
    present[name] = trim(source[name]).length > 0;
  });
  return present;
}

function publicConfig(env) {
  const source = env || {};
  const rawUrl = trim(source.SUPABASE_URL).replace(/\/+$/, '');
  let anon = '';
  let anonVar = '';
  for (let i = 0; i < PUBLIC_KEY_VARS.length; i++) {
    const name = PUBLIC_KEY_VARS[i];
    const value = trim(source[name]);
    if (!value) continue;
    anon = value;
    anonVar = name;
    break;
  }
  if (!rawUrl && !anon) {
    return { configured: false, url: '', anon: '', reason: 'missing', source: null };
  }
  if (!rawUrl) {
    return { configured: false, url: '', anon: '', reason: 'missing_url', source: null };
  }
  if (!URL_RE.test(rawUrl)) {
    return { configured: false, url: '', anon: '', reason: 'invalid_url', source: null };
  }
  if (!anon) {
    return { configured: false, url: '', anon: '', reason: 'missing_public_key', source: null };
  }
  if (!isPublicClientKey(anon)) {
    return { configured: false, url: '', anon: '', reason: 'public_key_rejected', source: null };
  }
  return {
    configured: true,
    url: rawUrl,
    anon: anon,
    reason: 'ok',
    source: { url: 'SUPABASE_URL', anon: anonVar },
  };
}

module.exports = {
  PUBLIC_KEY_VARS: PUBLIC_KEY_VARS,
  PROBE_VARS: PROBE_VARS,
  presence: presence,
  publicConfig: publicConfig,
  isPublicClientKey: isPublicClientKey,
};
