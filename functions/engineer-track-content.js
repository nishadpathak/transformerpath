/* Netlify function: entitlement-gated Design Engineer Track levels 2–4.
 *
 * Paid briefs are NOT in any public static JSON. This is the only delivery
 * path. Fail-closed: no/invalid/expired token => locked, no HTML.
 *
 * GET /.netlify/functions/engineer-track-content
 *   Authorization: Bearer <token>   (or Cookie tp_ent=<token>)
 */
'use strict';
const ent = require('./lib/entitlement');
const LEVELS = require('./lib/engineer-track-levels');

exports.handler = async (event) => {
  const token = ent.extractToken(event);
  const v = ent.verify(token);
  if (v.valid) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        plan: v.plan,
        level2: LEVELS.level2,
        level3: LEVELS.level3,
        level4: LEVELS.level4,
      }),
    };
  }
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify({
      ok: false,
      locked: true,
      reason: v.reason || 'not_entitled',
      unlock: 'pricing.html',
    }),
  };
};
