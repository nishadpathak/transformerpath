#!/usr/bin/env node
/* Write supabase-config.js from public Netlify env vars.
 *
 * Logs which SUPABASE_* names are set or missing. Never prints values.
 * An empty url and anon is the honest "accounts are being set up" config.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { publicConfig, presence, PROBE_VARS } = require('../functions/lib/supabase-public-env');

function render(cfg) {
  return [
    '/* Written by scripts/write-supabase-config.js from SUPABASE_URL and',
    ' * SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY. Empty strings mean',
    ' * accounts are not configured. Do not commit a real key. */',
    'window.TP_SUPABASE = {',
    '  url: ' + JSON.stringify(cfg.url || '') + ',',
    '  anon: ' + JSON.stringify(cfg.anon || '') + '',
    '};',
    '',
  ].join('\n');
}

function writeSupabaseConfig(env, dest) {
  const cfg = publicConfig(env || {});
  const present = presence(env || {});
  const body = render(cfg);
  if (dest) fs.writeFileSync(dest, body);
  return { configured: cfg.configured, reason: cfg.reason, present: present, body: body };
}

function formatFlags(present) {
  return PROBE_VARS.map(function (name) {
    return name + '=' + (present[name] ? 'set' : 'missing');
  }).join(' ');
}

if (require.main === module) {
  const dest = process.argv[2] || path.join(__dirname, '..', 'supabase-config.js');
  const result = writeSupabaseConfig(process.env, dest);
  console.log(
    '[supabase-public-config] configured=' + result.configured +
    ' reason=' + result.reason + ' ' + formatFlags(result.present)
  );
}

module.exports = { writeSupabaseConfig: writeSupabaseConfig, render: render, formatFlags: formatFlags };
