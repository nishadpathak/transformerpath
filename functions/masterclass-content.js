/* Netlify function: entitlement-gated Masterclass chapter delivery.
 *
 * This is the ONLY delivery path for the paid Masterclass chapters. The full
 * chapter HTML is NOT in any served static page — it lives here, server-side,
 * and is returned only when the requester presents a valid, server-verified
 * entitlement token (functions/lib/entitlement.js). Without it the function
 * returns a LOCKED preview (title, short original preview, learning objectives,
 * teaser) — never the full chapter text. Fail-closed.
 *
 * GET /.netlify/functions/masterclass-content?chapter=<id>
 *   Authorization: Bearer <token>   (or Cookie tp_ent=<token>)
 * Returns { ok, chapter, title, html? } or { ok:false, locked:true, ... }.
 */
'use strict';
const ent = require('./lib/entitlement');
const CH = require('./lib/masterclass-chapters'); // { [id]: { title, preview, objectives[], teaser, html } }

// Free chapters (always returned, indexable). Everything else is gated.
const FREE = new Set(['fundamentals', 'classification', 'sample-lesson']);

exports.handler = async (event) => {
  const req = event.httpMethod === 'GET' ? event : (event.body ? (function () { try { return JSON.parse(event.body); } catch (e) { return {}; } })() : {});
  const chapter = (event.queryStringParameters && event.queryStringParameters.chapter) || (req && req.chapter) || '';
  const id = String(chapter).toLowerCase();

  if (!CH[id] && !FREE.has(id)) {
    return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'unknown_chapter' }) };
  }
  if (FREE.has(id)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, free: true, chapter: id, title: CH[id] ? CH[id].title : id, html: CH[id] ? CH[id].html : '' }) };
  }

  const token = ent.extractToken(event);
  const v = ent.verify(token);
  if (v.valid) {
    const ch = CH[id];
    return { statusCode: 200, body: JSON.stringify({ ok: true, plan: v.plan, chapter: id, title: ch.title, html: ch.html }) };
  }
  // Fail-closed: locked preview with no full content.
  const ch = CH[id];
  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: false, locked: true, reason: v.reason || 'not_entitled',
      chapter: id, title: ch ? ch.title : id,
      preview: ch ? ch.preview : '',
      objectives: ch ? ch.objectives : [],
      teaser: ch ? ch.teaser : '',
      plan: { name: 'Learning', price: '$199 / 12 months', note: 'Professional and Team include Learning.' },
      unlock: 'masterclass.html?unlock=1',
    }),
  };
};
