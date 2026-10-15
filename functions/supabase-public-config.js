/* GET /.netlify/functions/supabase-public-config
 *
 * Returns the public Supabase URL and anon/publishable key when both are set
 * to a browser-safe value. Otherwise { configured: false } with empty url
 * and anon. Never returns a service-role or secret key.
 *
 * GET ?probe=1 returns which SUPABASE_* names are non-empty. Values are not
 * included.
 */
'use strict';

const { publicConfig, presence } = require('./lib/supabase-public-env');

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

exports.handler = async function (event) {
  const params = (event && event.queryStringParameters) || {};
  const probe = params.probe === '1' || params.probe === 'names';
  if (probe) {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ present: presence(process.env) }),
    };
  }
  const cfg = publicConfig(process.env);
  return {
    statusCode: 200,
    headers: headers,
    body: JSON.stringify({
      configured: cfg.configured,
      reason: cfg.reason,
      url: cfg.url,
      anon: cfg.anon,
    }),
  };
};
